import { type DbGetResult, type Config } from '../types'
import MemoryCache from './memory'
import RedisCache from './redis'

export interface CacheType {
  ready: Promise<void>
  get: (key: string) => Promise<DbGetResult | null>
  set: (key: string, value: DbGetResult) => Promise<void>
}

class Cache implements CacheType {
  db?: CacheType
  ready: Promise<void>
  constructor(conf: Config) {
    switch (conf.cache_engine) {
      /* istanbul ignore next */
      case 'redis': {
        /* istanbul ignore next */
        this.db = new RedisCache(conf)
        /* istanbul ignore next */
        break
      }
      case 'memory': {
        this.db = new MemoryCache(conf)
        break
      }
      /* istanbul ignore next */
      default: {
        /* istanbul ignore next */
        throw new Error(`Unknown cache engine ${conf.cache_engine as string}`)
      }
    }
    this.ready = this.db.ready
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async get(key: string) {
    /* istanbul ignore if */
    if (this.db == null) return null
    return await this.db.get(key)
  }

  // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
  async set(key: string, value: DbGetResult) {
    /* istanbul ignore if */
    if (this.db == null) throw new Error('Cache not ready, please wait')
    await this.db.set(key, value)
  }
}

export default Cache
