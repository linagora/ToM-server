import _nacl, { type Nacl } from 'js-nacl'

// export const supportedHashes = ['sha256', 'sha512']
export const supportedHashes = ['sha256']

export class Hash {
  ready: Promise<void>
  nacl?: Nacl
  constructor() {
    this.ready = new Promise((resolve, reject) => {
      void _nacl.instantiate((nacl) => {
        this.nacl = nacl
        resolve()
      })
    })
  }

  private _hash(
    method: ((s: Uint8Array) => Uint8Array) | undefined,
    ...str: string[]
  ): string {
    /* istanbul ignore if */
    if (this.nacl == null || method == null) throw new Error('Not initialized')
    return Buffer.from(method(this.nacl.encode_utf8(str.join(' '))))
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\//g, '_')
      .replace(/\+/g, '-')
  }

  sha256(...str: string[]): string {
    /* istanbul ignore next */
    return this._hash(this.nacl?.crypto_hash_sha256, ...str)
  }

  sha512(...str: string[]): string {
    /* istanbul ignore next */
    return this._hash(this.nacl?.crypto_hash, ...str)
  }
}
