import { Hash, randomString } from '@twake/crypto'
import { epoch } from '@twake/utils'
import type MatrixClientServer from '..' // Adjust the import path as necessary
import { type TwakeLogger } from '@twake/logger'

export let validToken: string
export let validToken1: string
export let validToken2: string
export let validToken3: string
export let validRefreshToken1: string
export let validRefreshToken2: string
export let validRefreshToken3: string
export async function setupTokens(
  clientServer: MatrixClientServer,
  logger: TwakeLogger
): Promise<void> {
  validToken = randomString(64)
  validToken1 = randomString(64)
  validToken2 = randomString(64)
  validToken3 = randomString(64)
  const validRefreshTokenId1 = randomString(64)
  const validRefreshTokenId2 = randomString(64)
  const validRefreshTokenId3 = randomString(64)
  validRefreshToken1 = randomString(64)
  validRefreshToken2 = randomString(64)
  validRefreshToken3 = randomString(64)

  try {
    await clientServer.matrixDb.insert('user_ips', {
      user_id: '@testuser:example.com',
      device_id: 'testdevice',
      access_token: validToken,
      ip: '127.0.0.1',
      user_agent: 'curl/7.31.0-DEV',
      last_seen: 1411996332123
    })

    const hash = new Hash()
    await hash.ready
    await clientServer.matrixDb.insert('users', {
      name: '@testuser:example.com',
      password_hash: hash.sha256(
        '$2a$10$zQJv3V3Kjw7Jq7Ww1X7z5e1QXsVd1m3JdV9vG6t8Jv7jQz4Z5J1QK'
      )
    })

    await clientServer.matrixDb.insert('user_ips', {
      user_id: '@testuser2:example.com',
      device_id: 'testdevice2',
      access_token: validToken2,
      ip: '137.0.0.1',
      user_agent: 'curl/7.31.0-DEV',
      last_seen: 1411996332123
    })

    await clientServer.matrixDb.insert('user_ips', {
      user_id: '@testuser3:example.com',
      device_id: 'testdevice3',
      access_token: validToken3,
      ip: '147.0.0.1',
      user_agent: 'curl/7.31.0-DEV',
      last_seen: 1411996332123
    })

    await clientServer.matrixDb.insert('refresh_tokens', {
      id: validRefreshTokenId3,
      user_id: '@seconduser:example.com',
      device_id: 'seconddevice',
      token: validRefreshToken3
    })

    await clientServer.matrixDb.insert('refresh_tokens', {
      id: validRefreshTokenId2,
      user_id: '@seconduser:example.com',
      device_id: 'seconddevice',
      token: validRefreshToken2
    })

    await clientServer.matrixDb.insert('access_tokens', {
      id: randomString(64),
      user_id: '@thirduser:example.com',
      device_id: 'thirddevice',
      token: randomString(64),
      refresh_token_id: validRefreshTokenId2
    })

    await clientServer.matrixDb.insert('refresh_tokens', {
      id: validRefreshTokenId1,
      user_id: '@firstuser:example.com',
      device_id: 'firstdevice',
      token: validRefreshToken1,
      next_token_id: validRefreshTokenId2
    })

    await clientServer.matrixDb.insert('access_tokens', {
      id: randomString(64),
      user_id: '@firstuser:example.com',
      device_id: 'firstdevice',
      token: validToken1,
      valid_until_ms: epoch() + 64000,
      refresh_token_id: validRefreshTokenId1
    })

    await clientServer.matrixDb.insert('access_tokens', {
      id: randomString(64),
      user_id: '@testuser:example.com',
      device_id: 'testdevice',
      token: validToken,
      valid_until_ms: epoch() + 64000
    })

    await clientServer.matrixDb.insert('access_tokens', {
      user_id: '@testuser2:example.com',
      device_id: 'testdevice2',
      token: validToken2,
      valid_until_ms: epoch() + 64000
    })

    await clientServer.matrixDb.insert('threepid_validation_session', {
      session_id: 'validatedSession2',
      medium: 'email',
      address: 'validated@example.com',
      client_secret: 'validatedSecret2',
      last_send_attempt: 1,
      validated_at: epoch()
    })

    await clientServer.matrixDb.insert('user_threepids', {
      user_id: '@validated:example.com',
      medium: 'email',
      address: 'validated@example.com',
      validated_at: epoch(),
      added_at: epoch()
    })

    await clientServer.matrixDb.insert('threepid_validation_session', {
      session_id: 'validatedSession',
      medium: 'msisdn',
      address: '0612938719',
      client_secret: 'validatedSecret',
      last_send_attempt: 1,
      validated_at: epoch()
    })

    await clientServer.matrixDb.insert('user_threepids', {
      user_id: '@validated:example.com',
      medium: 'msisdn',
      address: '0612938719',
      validated_at: epoch(),
      added_at: epoch()
    })

    await clientServer.matrixDb.insert('access_tokens', {
      id: randomString(64),
      user_id: '@thirduser:example.com',
      device_id: 'thirddevice',
      token: validToken3,
      refresh_token_id: validRefreshTokenId3,
      valid_until_ms: epoch() + 64000
    })

    await clientServer.matrixDb.insert('access_tokens', {
      id: 0,
      user_id: 'wrongUserId',
      token: 'wrongUserAccessToken'
    })
  } catch (e) {
    // istanbul ignore next
    logger.error('Error creating tokens for authentication', e)
  }
}
