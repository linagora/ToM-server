import { type CacheType } from '.'
import { type DbGetResult, type Config } from '../types'

class MemoryCache implements CacheType {
  ready: Promise<void>
  private items = new Map<string, { value: DbGetResult; expires: number }>()
  private readonly ttl: number

  constructor(conf: Config) {
    this.ttl = (conf.cache_ttl ?? 600) * 1000
    this.ready = Promise.resolve()
  }

  async get(key: string) {
    const entry = this.items.get(key)
    if (entry === undefined) return null
    if (Date.now() > entry.expires) {
      this.items.delete(key)
      return null
    }
    return entry.value
  }

  async set(key: string, value: DbGetResult) {
    this.items.set(key, { value, expires: Date.now() + this.ttl })
  }
}

export default MemoryCache
