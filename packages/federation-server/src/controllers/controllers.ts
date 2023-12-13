import { supportedHashes } from '@twake/crypto'
import { MatrixErrors, type DbGetResult } from '@twake/matrix-identity-server'
import lodash from 'lodash'
import { hashByServer } from '../db'
import {
  FederationServerError,
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
    let thirdPartyMappings: Record<string, Record<string, string[]>> = {}
    validationErrorHandler(req)
    db.get('hashes', ['value', 'hash', 'active'], {
      hash: (req.body as { addresses: string[] }).addresses
    })
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((rows) => {
        rows.forEach((row) => {
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
          ? db.get(hashByServer, ['hash', 'server', 'active'], {
              hash: thirdPartyHashes
            })
          : Promise.resolve([])
      })
      .then((rows: DbGetResult) => {
        thirdPartyMappings = mapValues(groupBy(rows, 'server'), (items) =>
          items.reduce<Record<string, string[]>>(
            (acc, curr) => {
              return curr.active === 1
                ? {
                    actives: [...acc.actives, curr.hash as string],
                    inactives: acc.inactives
                  }
                : {
                    actives: acc.actives,
                    inactives: [...acc.inactives, curr.hash as string]
                  }
            },
            { actives: [], inactives: [] }
          )
        )
        let responseBody: Record<
          string,
          Record<string, string | Record<string, string[]>>
        > = {
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
          new FederationServerError({
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
    const serverAddress = Object.keys(req.body.mappings)[0]
    const hashes = req.body.mappings[serverAddress] as Array<
      Record<string, string | number>
    >
    db.deleteEqual(hashByServer, 'server', serverAddress)
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      .then((_) => {
        return Promise.all(
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          hashes.map((hash) =>
            db.insert(hashByServer, {
              hash: hash.hash,
              active: hash.active,
              server: serverAddress
            })
          )
        )
      })
      .then(() => {
        res.status(201).json({})
      })
      .catch((e) => {
        next(
          new FederationServerError({
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

export const hashDetails = (db: IdentityServerDb): expressAppHandler => {
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
            db.logger.debug('No previous pepper')
            res.json(resp)
          })
      })
      .catch((e) => {
        next(
          new FederationServerError({
            message: e,
            code: MatrixErrors.errCodes.unknown
          })
        )
      })
  }
}
