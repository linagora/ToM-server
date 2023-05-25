import fs from 'fs'
import { dump, load } from 'js-yaml'
import { type Config } from '..'
import { randomString } from '@twake/crypto'

interface Namespace {
  exclusive: boolean
  regex: string
}

export interface Namespaces {
  users?: Namespace[]
  rooms?: Namespace[]
  aliases?: Namespace[]
}

export interface AppServiceOutput {
  as_token: string
  hs_token: string
  id: string
  namespaces: Namespaces
  protocols?: string[]
  rate_limited?: boolean
  sender_localpart: string
  url: string
}

export class AppServiceRegistration {
  asToken: string
  hsToken: string
  id: string
  private _namespaces!: Namespaces
  protocols?: string[]
  rateLimited?: boolean
  private _senderLocalpart!: string
  private _url!: string

  private _cachedRegex: Record<string, RegExp> = {}

  /**
   * Construct a new application service registration.
   * @constructor
   * @param {AppServiceOutput} conf The configuration of the application service
   */
  constructor(conf: Config) {
    let appServiceConfig: AppServiceOutput
    if (fs.existsSync(conf.registration_file_path)) {
      appServiceConfig = load(
        fs.readFileSync(conf.registration_file_path, { encoding: 'utf8' })
      ) as AppServiceOutput
    } else {
      appServiceConfig = {
        as_token: randomString(64),
        hs_token: randomString(64),
        id: randomString(64), // Maybe this id should be part of config file
        sender_localpart: conf.sender_localpart ?? '',
        url: conf.base_url,
        namespaces: conf.namespaces ?? {}
      }
    }
    this.asToken = appServiceConfig.as_token
    this.hsToken = appServiceConfig.hs_token
    this.id = appServiceConfig.id
    this.url = appServiceConfig.url
    this.senderLocalpart = appServiceConfig.sender_localpart
    this.namespaces = appServiceConfig.namespaces
  }

  /**
   * Get whether requests from this AS are rate-limited by the home server.
   */
  public isRateLimited(): boolean {
    return this.rateLimited === undefined ? true : this.rateLimited
  }

  /**
   * Set the URL which the home server will hit in order to talk to the AS.
   * @param {string} url The application service url
   * @throws If parameter is not a string or not an url
   */
  private set url(url: string) {
    if (typeof url !== 'string') {
      throw new Error(
        'The value of "url" field in configuration must be a string'
      )
    }
    const urlRegex =
      // eslint-disable-next-line no-useless-escape
      /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}(\.[a-zA-Z0-9()]{1,6})?\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/g
    if (!urlRegex.test(url)) {
      throw new Error(
        'The value of "url" field in configuration is not a correct url'
      )
    }
    this._url = url
  }

  get url(): string {
    return this._url
  }

  /**
   * Set the desired user_id localpart for the app service itself.
   * @param {string} localpart The user_id localpart ("alice" in "@alice:domain")
   * @throws If parameter is not a string
   */
  private set senderLocalpart(localpart: string) {
    if (typeof localpart !== 'string') {
      throw new Error(
        'The value of "sender_localpart" field in configuration must be a string'
      )
    }
    this._senderLocalpart = localpart
  }

  get senderLocalpart(): string {
    return this._senderLocalpart
  }

  /**
   * Set namespaces property
   * @param {Namespaces} namespaces object retrieve from configuration file
   * @throws If parameter does not respect the Namespaces interface structure
   */
  private set namespaces(namespaces: Namespaces) {
    if (typeof namespaces !== 'object') {
      throw new Error(
        'The value of "namespaces" field in configuration must be an object'
      )
    }
    // TODO missing test for left side
    this._namespaces = this.namespaces ?? {}
    const keys: string[] = Object.keys(namespaces)
    const authorizedKeys = ['users', 'rooms', 'aliases']
    for (const key of keys) {
      if (authorizedKeys.includes(key)) {
        if (Array.isArray(namespaces[key as keyof Namespaces])) {
          if (this._namespaces[key as keyof Namespaces] == null) {
            this._namespaces[key as keyof Namespaces] = []
          }
          // @ts-expect-error namespaces[key] is defined
          namespaces[key as keyof Namespaces].forEach(
            (namespace: Namespace, index: number) => {
              if (namespace.regex == null) {
                throw new Error(
                  `regex field is not defined for "${key}" field at index ${index}`
                )
              }
              if (typeof namespace.regex !== 'string') {
                throw new Error(
                  `regex field should be a string for "${key}" field at index ${index}`
                )
              }
              const regexObject: Namespace = {
                exclusive: Boolean(namespace.exclusive),
                regex: namespace.regex
              }
              // @ts-expect-error this._namespaces[key] is defined
              this._namespaces[key as keyof Namespaces].push(regexObject)
            }
          )
        } else {
          throw new Error(`The value of field "${key}" should be an array`)
        }
      } else {
        throw new Error(
          `The field "${key}" does not belong to the authorized fields: users, rooms, aliases`
        )
      }
    }
  }

  get namespaces(): Namespaces {
    return this._namespaces
  }

  /**
   * Output this registration to the given file name.
   * @param {String} filename The file name to write the yaml to.
   * @throws If required fields hs_token, as_token, url are missing.
   */
  public createRegisterFile(filename: string): void {
    if (fs.existsSync(filename)) {
      console.info('Application service registration file already exists')
      return
    }
    const fileContent: AppServiceOutput = {
      id: this.id,
      hs_token: this.hsToken,
      as_token: this.asToken,
      url: this.url,
      sender_localpart: this.senderLocalpart,
      namespaces: this.namespaces
    }
    if (this.protocols != null) {
      fileContent.protocols = this.protocols
    }
    if (this.rateLimited != null) {
      fileContent.rate_limited = this.rateLimited
    }
    fs.writeFileSync(filename, dump(fileContent))
  }

  /**
   * Check if a user_id meets this registration regex.
   * @param {string} userId The user ID
   * @param {boolean} onlyExclusive True to restrict matching to only exclusive
   * regexes. False to allow exclusive or non-exlusive regexes to match.
   * @return {boolean} True if there is a match.
   */
  public isUserMatch(userId: string, onlyExclusive: boolean): boolean {
    return this._isMatch(this.namespaces.users, userId, onlyExclusive)
  }

  /**
   * Check if a room alias meets this registration regex.
   * @param {string} alias The room alias
   * @param {boolean} onlyExclusive True to restrict matching to only exclusive
   * regexes. False to allow exclusive or non-exlusive regexes to match.
   * @return {boolean} True if there is a match.
   */
  public isAliasMatch(alias: string, onlyExclusive: boolean): boolean {
    return this._isMatch(this.namespaces.aliases, alias, onlyExclusive)
  }

  /**
   * Check if a room ID meets this registration regex.
   * @param {string} roomId The room ID
   * @param {boolean} onlyExclusive True to restrict matching to only exclusive
   * regexes. False to allow exclusive or non-exlusive regexes to match.
   * @return {boolean} True if there is a match.
   */
  public isRoomMatch(roomId: string, onlyExclusive: boolean): boolean {
    return this._isMatch(this.namespaces.rooms, roomId, onlyExclusive)
  }

  private _isMatch(
    regexList: Namespace[] | undefined,
    sample: string,
    onlyExclusive: boolean
  ): boolean {
    if (regexList == null) {
      return false
    }
    for (const regexObj of regexList) {
      let regex = this._cachedRegex[regexObj.regex]
      if (regex == null) {
        regex = new RegExp(regexObj.regex)
        // Avoid to create the same RegExp object several times
        this._cachedRegex[regexObj.regex] = regex
      }
      if (regex.test(sample)) {
        if (onlyExclusive && !regexObj.exclusive) {
          continue
        }
        return true
      }
    }
    return false
  }
}
