import { type CacheType } from './index.ts'
import { type DbGetResult, type Config } from '../types.ts'
import type NodeCache from 'node-cache'

class MemoryCache implements CacheType {
  ready: Promise<void>
  cache?: NodeCache

  constructor(conf: Config) {
    this.ready = new Promise((resolve, reject) => {
      import('node-cache')
        .then((mod) => {
          this.cache = new (mod.default ?? mod)({
            stdTTL: conf.cache_ttl ?? 600,
            useClones: false
          })
          resolve()
        })
        .catch(reject)
    })
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async get(key: string) {
    const res = this.cache?.get<DbGetResult>(key)
    if (res === undefined) return null
    return res
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async set(key: string, value: DbGetResult) {
    this.cache?.set(key, value)
  }
}

export default MemoryCache
