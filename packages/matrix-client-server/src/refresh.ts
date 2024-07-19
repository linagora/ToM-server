import {
  epoch,
  errMsg,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'
import type MatrixClientServer from '.'
import { randomString } from '@twake/crypto'
import { type DbGetResult } from '@twake/matrix-identity-server'

interface RequestBody {
  refresh_token: string
}

interface RefreshTokenData {
  id: number
  user_id: string
  device_id: string
  token: string
  next_token_id?: string
  expiry_ts?: number
  ultimate_session_expiry_ts?: number
}
const schema = {
  refresh_token: true
}

const generateTokens = (
  clientServer: MatrixClientServer,
  res: any,
  oldRefreshToken: string,
  nextRefreshToken: string,
  nextRefreshTokenId: string,
  currentTimestamp: number,
  refreshTokenData: RefreshTokenData,
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  additionalPromises: Array<Promise<DbGetResult | void>>
): void => {
  const newAccessToken = randomString(64)
  const insertNewAccessToken = clientServer.matrixDb.insert('access_tokens', {
    id: randomString(64),
    user_id: refreshTokenData.user_id,
    device_id: refreshTokenData.device_id,
    token: newAccessToken,
    valid_until_ms: currentTimestamp + 64000, // TODO: Set valid_until_ms based on server config, current value is arbitrary
    refresh_token_id: nextRefreshTokenId,
    used: 0
  }) // TODO : Handle 'puppets_user_id' if relevant
  const updateOldAccessToken = clientServer.matrixDb.updateWithConditions(
    'access_tokens',
    { used: 1 },
    [{ field: 'refresh_token_id', value: refreshTokenData.id }]
  ) // Invalidate the old access token

  Promise.all([
    insertNewAccessToken,
    updateOldAccessToken,
    ...additionalPromises
  ])
    .then(() => {
      send(res, 200, {
        access_token: newAccessToken,
        refresh_token: nextRefreshToken
      })
    })
    .catch((e) => {
      // istanbul ignore next
      clientServer.logger.error('Error generating tokens', e)
      // istanbul ignore next
      send(res, 500, e)
    })
}

const refresh = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    jsonContent(req, res, clientServer.logger, (obj) => {
      validateParameters(res, schema, obj, clientServer.logger, (obj) => {
        const refreshToken = (obj as RequestBody).refresh_token
        clientServer.matrixDb
          .get('refresh_tokens', ['*'], { token: refreshToken })
          .then((rows) => {
            if (rows.length === 0) {
              clientServer.logger.error('Unknown refresh token', refreshToken)
              send(res, 400, errMsg('unknownToken'))
              return
            }
            const refreshTokenData = rows[0] as unknown as RefreshTokenData
            const currentTimestamp = epoch()
            if (
              refreshTokenData.expiry_ts !== undefined &&
              refreshTokenData.expiry_ts !== null &&
              refreshTokenData.expiry_ts < currentTimestamp
            ) {
              send(
                res,
                401,
                errMsg('invalidToken', 'Refresh token has expired')
              )
              return
            }

            // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
            if (refreshTokenData.next_token_id) {
              clientServer.matrixDb
                .get('refresh_tokens', ['token'], {
                  id: refreshTokenData.next_token_id
                })
                .then((nextTokenRows) => {
                  if (nextTokenRows.length === 0) {
                    // istanbul ignore next
                    send(
                      res,
                      500,
                      errMsg('unknown', 'Failed to retrieve the next token')
                    )
                    return
                  }
                  const deleteOldRefreshToken = // Delete the old refresh token when the new one is used, as per the spec
                    clientServer.matrixDb.deleteWhere('refresh_tokens', {
                      field: 'token',
                      value: refreshToken,
                      operator: '='
                    })
                  const newRefreshToken = nextTokenRows[0].token as string
                  generateTokens(
                    clientServer,
                    res,
                    refreshToken,
                    newRefreshToken,
                    nextTokenRows[0].id as string,
                    currentTimestamp,
                    refreshTokenData,
                    [deleteOldRefreshToken]
                  )
                })
                .catch((e) => {
                  // istanbul ignore next
                  clientServer.logger.error('Error retrieving next token', e)
                  // istanbul ignore next
                  send(res, 500, e)
                })
            } else {
              const newRefreshToken = randomString(64) // If there is not next_token_id specified, generate a new refresh token
              const newRefreshTokenId = randomString(64)
              const insertNewRefreshToken = clientServer.matrixDb.insert(
                'refresh_tokens',
                {
                  id: newRefreshTokenId,
                  user_id: refreshTokenData.user_id,
                  device_id: refreshTokenData.device_id,
                  token: newRefreshToken,
                  expiry_ts: currentTimestamp + 64000 // TODO: Set expiry_ts based on server config, current value is arbitrary and handle ultimate_session_expiry_ts
                }
              )
              const updateOldRefreshToken = // Link the newly created refresh token to the old one, so that the old one is deleted when the new one is used
                clientServer.matrixDb.updateWithConditions(
                  'refresh_tokens',
                  { next_token_id: newRefreshTokenId },
                  [{ field: 'token', value: refreshToken }]
                )
              generateTokens(
                clientServer,
                res,
                refreshToken,
                newRefreshToken,
                newRefreshTokenId,
                currentTimestamp,
                refreshTokenData,
                [insertNewRefreshToken, updateOldRefreshToken]
              )
            }
          })
          .catch((error) => {
            // istanbul ignore next
            clientServer.logger.error('Error fetching refresh token', error)
            send(
              res,
              500,
              errMsg(
                'unknown',
                'An error occurred while fetching the refresh token'
              )
            )
          })
      })
    })
  }
}

export default refresh
