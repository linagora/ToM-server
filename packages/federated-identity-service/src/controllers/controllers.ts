import { supportedHashes } from '@twake/crypto'
import { type TwakeLogger } from '@twake/logger'
import { MatrixErrors, type DbGetResult } from '@twake/matrix-identity-server'
import lodash from 'lodash'
import { hashByServer } from '../db'
import {
  FederatedIdentityServiceError,
  validationErrorHandler
} from '../middlewares/errors'
import {
  type Config,
  type IdentityServerDb,
  type expressAppHandler
} from '../types'
const { groupBy, mapValues } = lodash

export const lookup = (
  conf: Config,
  db: IdentityServerDb
): expressAppHandler => {
  return (req, res, next) => {
    const mappings: Record<string, string> = {}
    const inactives: Record<string, string> = {}
    let thirdPartyMappings: Record<string, string[]> = {}
    validationErrorHandler(req)
    db.get('hashes', ['value', 'hash', 'active'], {
      hash: (req.body as { addresses: string[] }).addresses
    })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((rows) => {
        rows.forEach((row) => {
          // istanbul ignore else
          if (row.active === 1) {
            // @ts-expect-error row.hash is not null
            mappings[row.hash] = row.value
          } else {
            // @ts-expect-error row.hash is not null
            inactives[row.hash] = row.value
          }
        })
        const allMatchingHashes = Object.keys(mappings)
        if (conf.additional_features === true) {
          allMatchingHashes.concat(Object.keys(inactives))
        }
        const thirdPartyHashes = (
          req.body as { addresses: string[] }
        ).addresses.filter((hash) => !allMatchingHashes.includes(hash))
        return thirdPartyHashes.length > 0
          ? db.get(hashByServer, ['hash', 'server'], {
              hash: thirdPartyHashes
            })
          : Promise.resolve([])
      })
      .then((rows: DbGetResult) => {
        thirdPartyMappings = mapValues(groupBy(rows, 'server'), (items) =>
          items.map((item) => item.hash as string)
        )
        let responseBody: Record<string, Record<string, string | string[]>> = {
          mappings,
          third_party_mappings: thirdPartyMappings
        }
        if (conf.additional_features ?? false) {
          responseBody = {
            ...responseBody,
            inactive_mappings: inactives
          }
        }
        res.json(responseBody)
      })
      .catch((e) => {
        next(
          new FederatedIdentityServiceError({
            message: e,
            code: MatrixErrors.errCodes.unknown
          })
        )
      })
  }
}

export const lookups = (db: IdentityServerDb): expressAppHandler => {
  return (req, res, next) => {
    validationErrorHandler(req)
    const pepper = req.body.pepper
    const serverAddress = Object.keys(req.body.mappings)[0]
    const hashes = req.body.mappings[serverAddress] as string[]

    db.get('keys', ['data'], { name: ['pepper', 'previousPepper'] })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((rows: DbGetResult) => {
        const currentFedServerPeppers = rows.map((r) => r.data as string)
        return db.deleteWhere(hashByServer, [
          { field: 'server', operator: '=', value: serverAddress },
          ...currentFedServerPeppers.map((p) => ({
            field: 'pepper',
            operator: '!=' as const,
            value: p
          }))
        ])
      })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((_) => {
        return Promise.all(
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          hashes.map((hash) =>
            db.insert(hashByServer, {
              hash,
              server: serverAddress,
              pepper
            })
          )
        )
      })
      .then(() => {
        res.status(201).json({})
      })
      .catch((e) => {
        next(
          new FederatedIdentityServiceError({
            message: e,
            code: MatrixErrors.errCodes.unknown
          })
        )
      })
  }
}

interface HashDetailsObject {
  algorithms: string[]
  lookup_pepper: string
  alt_lookup_peppers?: string[]
}

export const hashDetails = (
  db: IdentityServerDb,
  logger: TwakeLogger
): expressAppHandler => {
  return (req, res, next) => {
    db.get('keys', ['data'], { name: 'pepper' })
      .then((rows) => {
        const resp: HashDetailsObject = {
          algorithms: supportedHashes,
          lookup_pepper: rows[0].data as string
        }
        db.get('keys', ['data'], { name: 'previousPepper' })
          .then((rows2) => {
            if (rows2 != null && rows2.length > 0)
              resp.alt_lookup_peppers = [rows2[0].data as string]
            res.json(resp)
          })
          .catch((e) => {
            logger.debug('No previous pepper')
            res.json(resp)
          })
      })
      .catch((e) => {
        next(
          new FederatedIdentityServiceError({
            message: e,
            code: MatrixErrors.errCodes.unknown
          })
        )
      })
  }
}
