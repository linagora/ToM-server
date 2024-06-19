import _nacl, { type Nacl } from 'js-nacl'
import nacl from 'tweetnacl'
import * as naclUtil from 'tweetnacl-util'

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

export const randomChar = (): string => {
  return Math.random().toString(36).slice(-1)
}

export const randomString = (n: number): string => {
  let res = ''
  for (let i = 0; i < n; i++) {
    res += randomChar()
  }
  return res
}

// Function to generate KeyId
function generateKeyId(algorithm: string, identifier: string): string {
  return `${algorithm}:${identifier}`
}

// Function to convert a Base64 string to unpadded Base64 URL encoded string
function toBase64Url(base64: string): string {
  return base64.replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-')
}

// Function to generate Ed25519 key pair and KeyId
function generateEdKeyPair(): {
  publicKey: string
  privateKey: string
  keyId: string
} {
  // Generate an Ed25519 key pair
  const keyPair = nacl.sign.keyPair()

  // Generate a unique identifier for the KeyId
  const identifier = nacl.randomBytes(8) // Generate 8 random bytes
  let identifierHex = naclUtil.encodeBase64(identifier)
  // Convert to unpadded Base64 URL encoded form
  identifierHex = toBase64Url(identifierHex)

  const algorithm = 'ed25519'
  const _keyId = generateKeyId(algorithm, identifierHex)

  return {
    publicKey: toBase64Url(naclUtil.encodeBase64(keyPair.publicKey)),
    privateKey: toBase64Url(naclUtil.encodeBase64(keyPair.secretKey)),
    keyId: _keyId
  }
}

// Function to generate Curve25519 key pair and KeyId
function generateCurveKeyPair(): {
  publicKey: string
  privateKey: string
  keyId: string
} {
  // Generate a Curve25519 key pair
  const keyPair = nacl.box.keyPair()

  // Generate a unique identifier for the KeyId
  const identifier = nacl.randomBytes(8) // Generate 8 random bytes
  let identifierHex = naclUtil.encodeBase64(identifier)
  // Convert to unpadded Base64 URL encoded form
  identifierHex = toBase64Url(identifierHex)

  const algorithm = 'curve25519'
  const _keyId = generateKeyId(algorithm, identifierHex)

  return {
    publicKey: toBase64Url(naclUtil.encodeBase64(keyPair.publicKey)),
    privateKey: toBase64Url(naclUtil.encodeBase64(keyPair.secretKey)),
    keyId: _keyId
  }
}

export const generateKeyPair = (
  algorithm: 'ed25519' | 'curve25519'
): { publicKey: string; privateKey: string; keyId: string } => {
  if (algorithm === 'ed25519') {
    return generateEdKeyPair()
  } else if (algorithm === 'curve25519') {
    return generateCurveKeyPair()
  } else {
    throw new Error('Unsupported algorithm')
  }
}
