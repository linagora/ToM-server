import { type TwakeLogger } from '../../logger/index'
import type IdentityServerDb from '../db'
import updateHash, { type UpdatableFields } from '../lookup/updateHash'
import MatrixDB from '../matrixDb'
import { type Config, type ActionResult } from '../types'
import type UserDB from '../userdb'
import { epoch, toMatrixId, getLocalPart } from '../../utils/index'

type AnyDb = IdentityServerDb<any>
type UserRecord = Record<string, string>
type Task = () => Promise<unknown>

interface SyncCtx {
  conf: Config
  db: AnyDb
  logger: TwakeLogger
  matrixUids: Set<string> | null
  federated: boolean
  ts: number
}

interface EvalState {
  tasks: Task[]
  toUpdate: UpdatableFields
  existing: Set<string>
  activeMap: Map<string, number>
}

const extractLocalPart = (id: string): string => {
  const lp = getLocalPart(id)
  if (lp) return lp
  // Fallback: If no @, regex replacement behavior used in original code
  return id.replace(/^@(.*?):.*$/, '$1')
}

const toMatrixIdSafe = (uid: string, server: string): string => {
  try {
    return uid ? toMatrixId(uid, server) : ''
  } catch {
    return ''
  }
}

const fetchMatrixUids = async (conf: Config, log: TwakeLogger): Promise<Set<string> | null> => {
  if (!conf.matrix_database_host || !conf.matrix_database_engine) return null
  const matrixDb = new MatrixDB(conf, log)
  try {
    await matrixDb.ready
    const rows = await matrixDb.getAll('users', ['name'])
    const valid = rows.map(r => extractLocalPart(r.name as string)).filter(Boolean) as string[]
    return new Set(valid)
  } catch (err) {
    log.error('Failed to load Matrix UIDs; aborting user sync to avoid mass activation', err)
    throw new Error('Unable to fetch Matrix UIDs', { cause: err })
  } finally {
    matrixDb.close()
  }
}

const buildContext = async (conf: Config, db: AnyDb, logger: TwakeLogger): Promise<SyncCtx> => {
  const federated = (conf.federated_identity_services?.length ?? 0) > 0 ||
    (conf.is_federated_identity_service ?? false)
  const matrixUids = await fetchMatrixUids(conf, logger)
  return { conf, db, logger, matrixUids, federated, ts: Math.floor(epoch() / 1000) }
}

const getHashes = async (db: AnyDb): Promise<Map<string, number>> => {
  const rows = await db.getAll('hashes', ['value', 'active'])
  const activeMap = new Map<string, number>()
  for (const row of rows) {
    const lp = extractLocalPart(row.value as string)
    if (!lp) continue
    const active = row.active as number
    activeMap.set(lp, Math.max(activeMap.get(lp) ?? 0, active))
  }
  return activeMap
}

const CHUNK_SIZE = 10

const executeTasks = async (tasks: Task[], logger: TwakeLogger): Promise<number> => {
  let failed = 0
  for (let i = 0; i < tasks.length; i += CHUNK_SIZE) {
    const chunk = tasks.slice(i, i + CHUNK_SIZE)
    await Promise.all(chunk.map(task => task().catch((err) => {
      failed += 1
      logger.error('User sync DB task failed', err)
    })))
  }
  return failed
}

const upsertHistory = (db: AnyDb, addr: string, active: number, ts: number, exists: boolean): Task => async () => {
  const data = { address: addr, active, timestamp: ts }
  if (exists) {
    await db.update('userHistory', data, 'address', addr)
  } else {
    await db.insert('userHistory', data)
  }
}

const populateChunkState = async (ctx: SyncCtx, chunk: UserRecord[], state: EvalState): Promise<void> => {
  const addresses = chunk.map(u => {
    const mxid = toMatrixIdSafe(u.uid, ctx.conf.server_name)
    if (!mxid)
      ctx.logger.warn(`malformed uid detected: ${u.uid}`)
    return mxid
  }).filter(Boolean)
  if (addresses.length === 0) return
  const hist = await ctx.db.get('userHistory', ['address'], { address: addresses })
  state.existing = new Set(hist.map(h => h.address as string))
}

const evaluateUser = (ctx: SyncCtx, user: UserRecord, state: EvalState): void => {
  const addr = toMatrixIdSafe(user.uid, ctx.conf.server_name)
  if (!addr) {
    ctx.logger.warn(`malformed uid detected: ${user.uid}`)
    return
  }
  const isMx = ctx.matrixUids?.has(user.uid) ?? false
  const known = state.activeMap.get(user.uid)
  const exists = state.existing.has(addr)

  if (known === undefined) {
    const active = ctx.matrixUids ? (isMx ? 1 : 0) : 1
    if (active !== 0) state.tasks.push(upsertHistory(ctx.db, addr, active, ctx.ts, exists))
    if (!ctx.federated || isMx) state.toUpdate[addr] = { email: user.mail, phone: user.mobile, active }
  } else if (isMx && !known) {
    state.tasks.push(async () => ctx.db.update('hashes', { active: 1 }, 'value', addr))
    state.tasks.push(upsertHistory(ctx.db, addr, 1, ctx.ts, exists))
  }
}

const setInactive = (ctx: SyncCtx, uid: string): Task => async () => {
  const addr = toMatrixIdSafe(uid, ctx.conf.server_name)
  if (!addr) {
    ctx.logger.warn(`malformed uid detected: ${uid}`)
    return
  }
  const rows = await ctx.db.get('userHistory', ['active'], { address: addr })
  if (!rows || rows.length === 0) {
    await ctx.db.insert('userHistory', { address: addr, active: 0, timestamp: ctx.ts })
  } else if (rows[0].active !== 0) {
    await ctx.db.update('userHistory', { active: 0 }, 'address', addr)
  }
}

const getInactiveTasks = (ctx: SyncCtx, activeMap: Map<string, number>, currentUids: Set<string>): Task[] => {
  const tasks: Task[] = []
  for (const uid of activeMap.keys()) {
    if (!currentUids.has(uid)) tasks.push(setInactive(ctx, uid))
  }
  return tasks
}

const updateUsers = async <T extends string = never>(
  conf: Config, db: IdentityServerDb<T>, userDB: UserDB, logger: TwakeLogger
): Promise<ActionResult> => {
  const [ctx, activeMap, users] = await Promise.all([
    buildContext(conf, db, logger),
    getHashes(db),
    userDB.getAll('users', ['uid', 'mail', 'mobile']) as Promise<UserRecord[]>,
  ]).catch((err) => {
    logger.error('Failed to load initial data for user sync', err)
    throw err
  })
  const state: EvalState = { tasks: [], toUpdate: {}, existing: new Set(), activeMap }
  const currentUids = new Set<string>()

  for (let i = 0; i < users.length; i += CHUNK_SIZE) {
    const chunk = users.slice(i, i + CHUNK_SIZE)
    chunk.forEach(u => currentUids.add(u.uid))
    await populateChunkState(ctx, chunk, state)
    chunk.forEach(u => evaluateUser(ctx, u, state))
  }

  state.tasks.push(...getInactiveTasks(ctx, activeMap, currentUids))
  if (Object.keys(state.toUpdate).length > 0) {
    state.tasks.push(async () => updateHash(db, logger, state.toUpdate))
  }

  const failed = await executeTasks(state.tasks, logger)
  if (failed > 0) return { success: false, error: `User sync completed with ${failed} failed task(s)` }
  return { success: true }
}

export default updateUsers
