import { Hash, randomString, generateKeyPair } from './index'

const sha256Results: Record<string, string> = {
  'alice@example.com email matrixrocks':
    '4kenr7N9drpCJ4AfalmlGQVsOn3o2RHjkADUpXJWZUc',
  'bob@example.com email matrixrocks':
    'LJwSazmv46n0hlMlsb_iYxI0_HXEqy_yj6Jm636cdT8',
  '18005552067 msisdn matrixrocks':
    'nlo35_T5fzSGZzJApqu8lgIudJvmOQtDaHtr-I4rU7I'
}

const sha512Results: Record<string, string> = {
  'alice@example.com email matrixrocks':
    'c3TM9O_rjRNXZqGs9pFWXI5vUHFOLXbFfyCHSLd2uRKIa_YGsnVKriiGrJc6L6OweHWkHj5Mpvtiy6ownVPriQ',
  'bob@example.com email matrixrocks':
    '9qZ5E82WIiOUqXHGk7ImtQgVB0-4Doux5UrxwaKXlE5sjQSW2oCrZiaVo4xt3EwWEVxdTILN3MuEdDRZJbq8Zg',
  '18005552067 msisdn matrixrocks':
    '2ETkcIjIUHqsIT-VOSwJ09tFSjTwTRpK86OlvDQhyqg1_miu_OaaIKbMbHgZNliHtJ2TF0A41pG3znq3HJq8sg'
}

describe('Hash methods', () => {
  it('should give the wanted result', (done) => {
    const hash = new Hash()
    hash.ready
      .then(() => {
        Object.keys(sha256Results).forEach((str) => {
          expect(hash.sha256(str)).toEqual(sha256Results[str])
          expect(hash.sha256(...str.split(' '))).toEqual(sha256Results[str])
          expect(hash.sha512(str)).toEqual(sha512Results[str])
          expect(hash.sha512(...str.split(' '))).toEqual(sha512Results[str])
        })
        done()
      })
      .catch((e) => done(e))
  })
})

test('randomString', () => {
  const res = randomString(64)
  expect(res).toMatch(/^[a-zA-Z0-9]{64}$/)
})

describe('generateKeyPair', () => {
  it('should generate a valid Ed25519 key pair and key ID', () => {
    const { publicKey, privateKey, keyId } = generateKeyPair('ed25519')
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]+$/) // Unpadded Base64 URL encoded string
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]+$/) // Unpadded Base64 URL encoded string
    expect(keyId).toMatch(/^ed25519:[A-Za-z0-9_-]+$/) // Key ID format
  })

  it('should generate a valid Curve25519 key pair and key ID', () => {
    const { publicKey, privateKey, keyId } = generateKeyPair('curve25519')
    expect(publicKey).toMatch(/^[A-Za-z0-9_-]+$/) // Unpadded Base64 URL encoded string
    expect(privateKey).toMatch(/^[A-Za-z0-9_-]+$/) // Unpadded Base64 URL encoded string
    expect(keyId).toMatch(/^curve25519:[A-Za-z0-9_-]+$/) // Key ID format
  })
})
