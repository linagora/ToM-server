import { Hash } from '@twake/crypto'
import { type TwakeLogger } from '@twake/logger'
import fetch, { type Response } from 'node-fetch'
import {
  fieldsToHash,
  type UpdatableFields,
  type ValueField
} from '../lookup/updateHash'
import { type Config } from '../types'
import type UserDB from '../userdb'
import { dbFieldsToHash, filter } from './changePepper'

interface HashDetails {
  algorithms: string[]
  lookup_pepper: string
  alt_lookup_peppers?: string[]
}

interface LookupsDetail {
  address: string
  algorithm: string
  pepper: string
  updatedHashes: string[]
}
/**
 * update federated identity service hashes cron job.
 *
 * @param {MatrixIdentityServer} idServer - the matrix identity server instance.
 */
export default async (
  conf: Config,
  userDB: UserDB,
  logger: TwakeLogger
): Promise<void> => {
  const prefixErrorMessage = '[Update federated identity service hashes]'

  let federatedIdentityServicesAddresses =
    typeof conf.federated_identity_services === 'object'
      ? (conf.federated_identity_services as string[])
      : conf.federated_identity_services != null
      ? (conf.federated_identity_services as string).split(/[,\s]+/)
      : []

  let serversIndexFail: number[] = []

  let responses = (
    await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      federatedIdentityServicesAddresses.map((address) =>
        fetch(encodeURI(`https://${address}/_matrix/identity/v2/hash_details`))
      )
    )
  )
    .filter((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${prefixErrorMessage} Request to get pepper and algorithms from federated identity service ${federatedIdentityServicesAddresses[index]} failed. Reason: ${result.reason}`
        )
        serversIndexFail.push(index)
        return false
      }
      return true
    })
    .map((result) => (result as PromiseFulfilledResult<Response>).value)

  federatedIdentityServicesAddresses =
    federatedIdentityServicesAddresses.filter(
      (_address, index) => !serversIndexFail.includes(index)
    )
  serversIndexFail = []

  const bodies = (
    await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      responses.map((response) => response.json())
    )
  ).reduce<HashDetails[]>((acc, curr, index) => {
    try {
      if (curr.status === 'rejected') {
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${prefixErrorMessage} Error on parsing response body of request to get pepper and algorithm from ${federatedIdentityServicesAddresses[index]}. Reason: ${curr.reason}`
        )
      }
      const body = curr.value as
        | HashDetails
        | { error: string; errcode: string }
      if ('errcode' in body) {
        throw new Error(
          `${prefixErrorMessage} Error in response body of request to get pepper and algorithm from ${federatedIdentityServicesAddresses[index]}. Reason: ${body.error}`
        )
      } else if (body.algorithms == null || body.algorithms.length < 1) {
        throw new Error(
          `${prefixErrorMessage} Error ${federatedIdentityServicesAddresses[index]} did not provide algorithms`
        )
      } else if (body.lookup_pepper == null) {
        throw new Error(
          `${prefixErrorMessage} Error ${federatedIdentityServicesAddresses[index]} did not provide lookup_pepper`
        )
      } else {
        return [...acc, body]
      }
    } catch (e) {
      logger.error(e)
      serversIndexFail.push(index)
      return acc
    }
  }, [])

  federatedIdentityServicesAddresses =
    federatedIdentityServicesAddresses.filter(
      (_address, index) => !serversIndexFail.includes(index)
    )

  const federatedIdentityServicesDetail =
    federatedIdentityServicesAddresses.reduce<
      Record<string, { algorithm: string; peppers: string[] }>
    >(
      (acc, curr, index) => ({
        ...acc,
        [curr]: {
          algorithm: bodies[index].algorithms[0],
          peppers: [
            bodies[index].lookup_pepper,
            ...(bodies[index].alt_lookup_peppers ?? [])
          ]
        }
      }),
      {}
    )

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

  const getUsersHashes = (algorithm: string, pepper: string): string[] => {
    const result: string[] = []
    Object.keys(usersData).forEach((matrixAddress) => {
      fieldsToHash.forEach((field) => {
        const v = usersData[matrixAddress][field as keyof ValueField]
        if (
          v != null &&
          v.toString().length > 0 &&
          usersData[matrixAddress].active === 1
        ) {
          let value = v.toString()
          let _field: string = field
          if (field === 'phone') {
            _field = 'msisdn'
            value = value.replace(/\s/g, '').replace(/^\+/, '')
          }
          logger.debug(`Prepare ${_field} hash for ${value}`)
          result.push(
            hash[algorithm as 'sha256'](`${value} ${_field} ${pepper}`)
          )
        }
      })
    })
    return result
  }

  const lookupsRequestsDetails = federatedIdentityServicesAddresses.reduce<
    LookupsDetail[]
  >(
    (acc, address) => [
      ...acc,
      ...federatedIdentityServicesDetail[address].peppers.map((pepper) => ({
        address,
        algorithm: federatedIdentityServicesDetail[address].algorithm,
        pepper,
        updatedHashes: getUsersHashes(
          federatedIdentityServicesDetail[address].algorithm,
          pepper
        )
      }))
    ],
    []
  )

  const { hostname, port } = new URL(conf.base_url)
  // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
  const host = hostname.concat(':', port || '443')

  responses = (
    await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      lookupsRequestsDetails.map((detail) =>
        fetch(
          encodeURI(`https://${detail.address}/_matrix/identity/v2/lookups`),
          {
            method: 'post',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              algorithm: detail.algorithm,
              pepper: detail.pepper,
              mappings: {
                [host]: detail.updatedHashes
              }
            })
          }
        )
      )
    )
  )
    .filter((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${prefixErrorMessage} Request to post updated hashes on ${federatedIdentityServicesAddresses[index]} failed. Reason: ${result.reason}`
        )
        return false
      }
      logger.debug(
        `Hashes pushed to ${federatedIdentityServicesAddresses[index]}`
      )
      return true
    })
    .map((result) => (result as PromiseFulfilledResult<Response>).value)
  ;(
    await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      responses.map((response) => response.json())
    )
  ).forEach((result, index) => {
    try {
      if (result.status === 'rejected') {
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${prefixErrorMessage} Error on parsing response body of request to push updated hashes to ${federatedIdentityServicesAddresses[index]}. Reason: ${result.reason}`
        )
      }
      const body = result.value as
        | Record<string, unknown>
        | { error: string; errcode: string }
      if ('errcode' in body) {
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${prefixErrorMessage} Error in response body of request to post updated hashes on ${federatedIdentityServicesAddresses[index]}. Reason: ${body.error}`
        )
      }
    } catch (e) {
      logger.error(e)
    }
  })
}
