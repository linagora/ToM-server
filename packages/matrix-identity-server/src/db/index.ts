import type { Database } from 'sqlite3'

declare interface dbArgs {
  type: 'sqlite' | 'pg'
  host: string
  user?: string
  password?: string
}

const IdentityServerDb = async (args: dbArgs): Promise<Database> => {
  if (args.type === 'sqlite') {
    const mod = await import('sqlite3')
    const db = new mod.Database(args.host)
    return await Promise.resolve(db)
  }
  else {
    return await Promise.reject(new Error(`Unknown type ${args.type}`))
  }
}

export default IdentityServerDb
