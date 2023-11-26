import { Hash } from '@twake/crypto'
import { type TwakeLogger } from '@twake/logger'
import fetch from 'node-fetch'
import type UserDB from '../userdb'
import {
  fieldsToHash,
  type UpdatableFields,
  type ValueField
} from '../lookup/updateHash'
import { type Config } from '../types'
import { dbFieldsToHash, filter } from './changePepper'

interface HashDetails {
  algorithms: string[]
  lookup_pepper: string
}

/**
 * update federation server hashes cron job.
 *
 * @param {MatrixIdentityServer} idServer - the matrix identity server instance.
 */
export default async (
  conf: Config,
  userDB: UserDB,
  logger: TwakeLogger
): Promise<void> => {
  try {
    let response = await fetch(
      encodeURI(
        `https://${
          conf.federation_server as string
        }/_matrix/identity/v2/hash_details`
      )
    )

    let body = (await response.json()) as
      | HashDetails
      | { error: string; errcode: string }
    if ('errcode' in body) {
      throw new Error(body.error)
    }

    if (body.algorithms == null || body.algorithms.length < 1) {
      throw new Error('No algorithms received from federation server')
    }
    const algorithm = body.algorithms[0]

    const isMatrixDbAvailable =
      Boolean(conf.matrix_database_host) && Boolean(conf.matrix_database_engine)

    const usersData = (
      await filter(
        await userDB.getAll('users', [...dbFieldsToHash, 'uid']),
        conf,
        logger
      )
    ).reduce<UpdatableFields>((acc, row) => {
      acc[`@${row.uid as string}:${conf.server_name}`] = {
        email: row.mail as string,
        phone: row.mobile as string,
        active: isMatrixDbAvailable ? (row.active as number) : 1
      }
      return acc
    }, {})

    const hash = new Hash()
    await hash.ready
    const updatedHashes: Array<Record<string, string | number>> = []
    Object.keys(usersData).forEach((matrixAddress) => {
      fieldsToHash.forEach((field) => {
        const v = usersData[matrixAddress][field as keyof ValueField]
        if (v != null && v.toString().length > 0) {
          let value = v.toString()
          let _field: string = field
          if (field === 'phone') {
            _field = 'msisdn'
            value = value.replace(/\s/g, '').replace(/^\+/, '')
          }
          updatedHashes.push({
            hash: hash[algorithm as 'sha256'](
              `${value} ${_field} ${(body as HashDetails).lookup_pepper}`
            ),
            active: usersData[matrixAddress].active
          })
        }
      })
    })

    const { hostname } = new URL(conf.base_url)
    response = await fetch(
      encodeURI(
        `https://${
          conf.federation_server as string
        }/_matrix/identity/v2/lookups`
      ),
      {
        method: 'post',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          algorithm,
          pepper: body.lookup_pepper,
          mappings: {
            [hostname]: updatedHashes
          }
        })
      }
    )

    body = (await response.json()) as
      | HashDetails
      | { error: string; errcode: string }

    if ('errcode' in body) {
      throw new Error(body.error)
    }
  } catch (error) {
    throw new Error('Failed to update federation server hashes', {
      cause: error
    })
  }
}