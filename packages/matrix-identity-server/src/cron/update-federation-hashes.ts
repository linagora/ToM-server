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
  const prefixErrorMessage = '[Update federation server hashes]'

  let federationServersAddresses =
    typeof conf.federation_servers === 'object'
      ? (conf.federation_servers as string[])
      : conf.federation_servers
      ? (conf.federation_servers as string).split(/[,\s]+/)
      : []

  let serversIndexFail: number[] = []

  let responses = (
    await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      federationServersAddresses.map((address) =>
        fetch(encodeURI(`https://${address}/_matrix/identity/v2/hash_details`))
      )
    )
  )
    .filter((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${prefixErrorMessage} Request to get pepper and algorithms from federation server ${federationServersAddresses[index]} failed. Reason: ${result.reason}`
        )
        serversIndexFail.push(index)
        return false
      }
      return true
    })
    .map((result) => (result as PromiseFulfilledResult<Response>).value)

  federationServersAddresses = federationServersAddresses.filter(
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
          `${prefixErrorMessage} Error on parsing response body of request to get pepper and algorithm from ${federationServersAddresses[index]}. Reason: ${curr.reason}`
        )
      }
      const body = curr.value as
        | HashDetails
        | { error: string; errcode: string }
      if ('errcode' in body) {
        throw new Error(
          `${prefixErrorMessage} Error in response body of request to get pepper and algorithm from ${federationServersAddresses[index]}. Reason: ${body.error}`
        )
      } else if (body.algorithms == null || body.algorithms.length < 1) {
        throw new Error(
          `${prefixErrorMessage} Error ${federationServersAddresses[index]} did not provide algorithms`
        )
      } else if (body.lookup_pepper == null) {
        throw new Error(
          `${prefixErrorMessage} Error ${federationServersAddresses[index]} did not provide lookup_pepper`
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

  federationServersAddresses = federationServersAddresses.filter(
    (_address, index) => !serversIndexFail.includes(index)
  )
  serversIndexFail = []

  const federationServersDetail = federationServersAddresses.reduce<
    Record<string, { pepper: string; algorithm: string }>
  >(
    (acc, curr, index) => ({
      ...acc,
      [curr]: {
        pepper: bodies[index].lookup_pepper,
        algorithm: bodies[index].algorithms[0]
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
  const updatedHashes: Record<
    string,
    Array<Record<string, string | number>>
  > = federationServersAddresses.reduce(
    (acc, curr) => ({
      ...acc,
      [curr]: []
    }),
    {}
  )

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
        federationServersAddresses.forEach((address) => {
          updatedHashes[address].push({
            hash: hash[federationServersDetail[address].algorithm as 'sha256'](
              `${value} ${_field} ${federationServersDetail[address].pepper}`
            ),
            active: usersData[matrixAddress].active
          })
        })
      }
    })
  })

  const { hostname } = new URL(conf.base_url)

  responses = (
    await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/promise-function-async
      federationServersAddresses.map((address) =>
        fetch(encodeURI(`https://${address}/_matrix/identity/v2/lookups`), {
          method: 'post',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            algorithm: federationServersDetail[address].algorithm,
            pepper: federationServersDetail[address].pepper,
            mappings: {
              [hostname]: updatedHashes[address]
            }
          })
        })
      )
    )
  )
    .filter((result, index) => {
      if (result.status === 'rejected') {
        logger.error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${prefixErrorMessage} Request to post updated hashes on ${federationServersAddresses[index]} failed. Reason: ${result.reason}`
        )
        return false
      }
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
          `${prefixErrorMessage} Error on parsing response body of request to push updated hashes to ${federationServersAddresses[index]}. Reason: ${result.reason}`
        )
      }
      const body = result.value as
        | Record<string, unknown>
        | { error: string; errcode: string }
      if ('errcode' in body) {
        throw new Error(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `${prefixErrorMessage} Error in response body of request to post updated hashes on ${federationServersAddresses[index]}. Reason: ${body.error}`
        )
      }
    } catch (e) {
      logger.error(e)
    }
  })
}
