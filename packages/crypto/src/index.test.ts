import { Hash, randomString, canonicalJson, signJson } from './index'
import nacl from 'tweetnacl'
import naclUtil from 'tweetnacl-util'

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

describe('canonicalJson', () => {
  test('should handle empty object', () => {
    const input = {}
    const expectedOutput = '{}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })

  test('should handle simple object with different key types', () => {
    const input = { one: 1, two: 'Two' }
    const expectedOutput = '{"one":1,"two":"Two"}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })

  test('should handle object with keys in reverse order', () => {
    const input = { b: '2', a: '1' }
    const expectedOutput = '{"a":"1","b":"2"}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })

  test('should handle nested objects with arrays', () => {
    const input = {
      auth: {
        success: true,
        mxid: '@john.doe:example.com',
        profile: {
          display_name: 'John Doe',
          three_pids: [
            {
              medium: 'email',
              address: 'john.doe@example.org'
            },
            {
              medium: 'msisdn',
              address: '123456789'
            }
          ]
        }
      }
    }
    const expectedOutput =
      '{"auth":{"mxid":"@john.doe:example.com","profile":{"display_name":"John Doe","three_pids":[{"address":"john.doe@example.org","medium":"email"},{"address":"123456789","medium":"msisdn"}]},"success":true}}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })

  test('should handle object with non-ASCII characters', () => {
    const input = { a: '日本語' }
    const expectedOutput = '{"a":"日本語"}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })

  test('should handle object with non-ASCII keys', () => {
    const input = { 本: 2, 日: 1 }
    const expectedOutput = '{"日":1,"本":2}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })

  test('should handle object with unicode escape sequences', () => {
    const input = { a: '\u65E5' }
    const expectedOutput = '{"a":"日"}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })

  test('should handle object with null values', () => {
    const input = { a: null }
    const expectedOutput = '{"a":null}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })

  test('should handle object with special numeric values', () => {
    const input = { a: -0, b: 1e10 }
    const expectedOutput = '{"a":0,"b":10000000000}'
    expect(canonicalJson(input)).toEqual(expectedOutput)
  })
})

describe('signJson', () => {
  const testKeyPair = nacl.sign.keyPair()
  const signingKey = naclUtil.encodeBase64(testKeyPair.secretKey)
  const signingName = 'testSigningName'
  const keyId = 'testKeyId'

  it('should add signature to a simple object', () => {
    const jsonObj = { a: 1, b: 'string' }
    const result = signJson(jsonObj, signingKey, signingName, keyId)

    expect(result).toHaveProperty('signatures')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(result.signatures).toHaveProperty(signingName)
    expect(result.signatures?.[signingName]).toHaveProperty(keyId)
    expect(result).toMatchObject({
      a: 1,
      b: 'string',
      signatures: expect.any(Object)
    })
  })

  it('should preserve existing signatures', () => {
    const jsonObj = {
      a: 1,
      b: 'string',
      signatures: {
        existingSignature: {
          existingKeyId: 'existingSignatureValue'
        }
      }
    }
    const result = signJson(jsonObj, signingKey, signingName, keyId)

    expect(result.signatures).toHaveProperty('existingSignature')
    expect(result.signatures?.existingSignature).toHaveProperty('existingKeyId')
    expect(result.signatures).toHaveProperty(signingName)
    expect(result.signatures?.[signingName]).toHaveProperty(keyId)
  })

  it('should handle unsigned field correctly', () => {
    const jsonObj = { a: 1, b: 'string', unsigned: { c: 2 } }
    const result = signJson(jsonObj, signingKey, signingName, keyId)

    expect(result).toHaveProperty('unsigned')
    expect(result.unsigned).toEqual({ c: 2 })
  })

  it('should not include `unsigned` field if not present', () => {
    const jsonObj = { a: 1, b: 'string' }
    const result = signJson(jsonObj, signingKey, signingName, keyId)

    expect(result).not.toHaveProperty('unsigned')
  })

  it('should handle complex nested objects', () => {
    const jsonObj = { a: { b: { c: 1 } }, d: ['e', 'f', { g: 'h' }] }
    const result = signJson(jsonObj, signingKey, signingName, keyId)

    expect(result).toHaveProperty('signatures')
    expect(result.signatures).toHaveProperty(signingName)
    expect(result.signatures?.[signingName]).toHaveProperty(keyId)
    expect(result).toMatchObject({
      a: { b: { c: 1 } },
      d: ['e', 'f', { g: 'h' }],
      signatures: expect.any(Object)
    })
  })

  it('should handle objects with null values', () => {
    const jsonObj = { a: null, b: 'string' }
    const result = signJson(jsonObj, signingKey, signingName, keyId)

    expect(result).toHaveProperty('signatures')
    expect(result.signatures).toHaveProperty(signingName)
    expect(result.signatures?.[signingName]).toHaveProperty(keyId)
    expect(result).toMatchObject({
      a: null,
      b: 'string',
      signatures: expect.any(Object)
    })
  })
})
