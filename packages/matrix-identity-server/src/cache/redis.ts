/* istanbul ignore file */
import { type CacheType } from '.'
import { type DbGetResult, type Config } from '../types'
import { type RedisClientType } from 'redis'

class RedisCache implements CacheType {
  client?: RedisClientType
  ready: Promise<void>
  ttl: number
  constructor(conf: Config) {
    // Validate parameters
    if (conf.redis_uri == null) throw new Error('redis_uri required')
    if (!/^redis:\/\//.test(conf.redis_uri)) throw new Error('Bad redis url')

    this.ttl = conf.cache_ttl ?? 600
    this.ready = new Promise((resolve, reject) => {
      import('redis')
        .then((mod) => {
          this.client = (mod.default ?? mod).createClient({
            url: conf.redis_uri
          })
          this.client.connect().then(resolve).catch(reject)
        })
        .catch(reject)
    })
  }

  async get(key: string): Promise<DbGetResult | null> {
    if (this.client == null) return null
    const res: string | null = await this.client.get(key)
    return res == null ? null : JSON.parse(res)
  }

  async set(key: string, value: DbGetResult): Promise<void> {
    if (this.client == null)
      throw new Error('Redis not initialized, pease wait')
    await this.client.setEx(key, this.ttl, JSON.stringify(value))
  }
}

export default RedisCache
