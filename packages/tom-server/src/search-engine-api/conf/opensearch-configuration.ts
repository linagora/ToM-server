import { type ClientOptions } from '@opensearch-project/opensearch'
import { isHostnameValid } from '@twake/utils'
import fs from 'fs'
import { type Config } from '../../types'

export class OpenSearchConfiguration {
  private _host!: string
  private _protocol!: string
  private _username: string | undefined
  private _password: string | undefined
  private _caCertPath: string | undefined
  private _maxRetries!: number

  constructor(config: Config) {
    this._setUsername(config.opensearch_user)
    this._setPassword(config.opensearch_password)
    if (this._username == null && this._password != null) {
      throw new Error('opensearch_user is missing')
    }
    if (this._username != null && this._password == null) {
      throw new Error('opensearch_password is missing')
    }
    this._setHost(config.opensearch_host)
    this._setProtocol(config.opensearch_ssl)
    this._setCaCertPath(config.opensearch_ca_cert_path)
    this._setMaxRetries(config.opensearch_max_retries)
  }

  private _setHost(host: string | null | undefined): void {
    if (host == null) {
      throw new Error('opensearch_host is required when using OpenSearch')
    }
    if (typeof host !== 'string') {
      throw new Error('opensearch_host must be a string')
    }
    if (!isHostnameValid(host)) {
      throw new Error('opensearch_host is invalid')
    }
    this._host = host
  }

  private _setProtocol(ssl: boolean | undefined): void {
    if (ssl != null && typeof ssl !== 'boolean') {
      throw new Error('opensearch_ssl must be a boolean')
    }
    this._protocol = ssl != null && ssl ? 'https' : 'http'
  }

  private _setUsername(username: string | null | undefined): void {
    if (username != null) {
      if (typeof username !== 'string') {
        throw new Error('opensearch_user must be a string')
      }
      this._username = username
    }
  }

  private _setPassword(password: string | null | undefined): void {
    if (password != null) {
      if (typeof password !== 'string') {
        throw new Error('opensearch_password must be a string')
      }
      this._password = password
    }
  }

  private _setCaCertPath(caCertPath: string | null | undefined): void {
    if (caCertPath != null) {
      if (typeof caCertPath !== 'string') {
        throw new Error('opensearch_ca_cert_path must be a string')
      }
      this._caCertPath = caCertPath
    }
  }

  private _setMaxRetries(maxRetries: number | undefined | null): void {
    if (maxRetries != null && typeof maxRetries !== 'number') {
      throw new Error('opensearch_max_retries must be a number')
    }
    this._maxRetries = maxRetries ?? 3
  }

  getMaxRetries(): number {
    return this._maxRetries
  }

  getClientOptions(): ClientOptions {
    let auth = ''
    if (this._username != null && this._password != null) {
      auth = `${this._username}:${this._password}@`
    }

    let options: ClientOptions = {
      node: `${this._protocol}://${auth}${this._host}`,
      maxRetries: this._maxRetries
    }

    if (this._protocol === 'https' && this._caCertPath != null) {
      options = {
        ...options,
        ssl: {
          ca: fs.readFileSync(this._caCertPath, 'utf-8')
        }
      }
    }
    return options
  }
}
