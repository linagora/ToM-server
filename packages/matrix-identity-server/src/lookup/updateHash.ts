import { Hash, supportedHashes } from '@twake-chat/crypto'
import { type TwakeLogger } from '@twake-chat/logger'
import { createPool } from 'generic-pool'
import type IdentityServerDb from '../db'

export const fieldsToHash = ['phone', 'email']

// TODO: move this in conf
const jobs = 5

export interface ValueField {
  active: number
  email?: string
  phone?: string
}
export type UpdatableFields = Record<string, ValueField>

type _UpdateArgs = [
  matrixAddress: string,
  method: string,
  field: 'email' | 'phone',
  value: string,
  active: number
]

type _Update = (
  matrixAddress: string,
  method: string,
  field: 'email' | 'phone',
  value: string,
  active: number
) => Promise<void>

// eslint-disable-next-line @typescript-eslint/promise-function-async
const updateHash = <T extends string = never>(
  db: IdentityServerDb<T>,
  logger: TwakeLogger,
  data: UpdatableFields,
  pepper?: string
): Promise<void> => {
  const hash = new Hash()
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return new Promise((resolve, reject): void => {
    hash.ready
      .then(() => {
        // Insert function (will be used in parallel using generic-pool)
        const update: _Update = async (
          matrixAddress,
          method,
          field,
          value,
          active
        ): Promise<void> => {
          if (pepper == null || pepper.length === 0) {
            pepper = (
              (await db.get('keys', ['data'], {
                name: 'pepper'
              })) as unknown as Array<{ data: string }>
            )[0].data
          }

          // Format phone
          let _field: string = field
          if (field === 'phone') {
            _field = 'msisdn'
            value = value.replace(/\s/g, '').replace(/^\+/, '')
          }
          await db.insert('hashes', {
            hash: hash[method as 'sha256'](`${value} ${_field} ${pepper}`),
            pepper,
            type: _field,
            value: matrixAddress,
            active
          })
        }

        const factory = {
          create: async () => {
            return { update }
          },
          destroy: async (worker: unknown) => {}
        }

        // Read data
        const params: _UpdateArgs[] = []
        Object.keys(data).forEach((matrixAddress) => {
          fieldsToHash.forEach((field) => {
            const v = data[matrixAddress][field as keyof ValueField]
            if (v != null && v.toString().length > 0) {
              supportedHashes.forEach((method: string) => {
                params.push([
                  matrixAddress,
                  method,
                  field as 'phone' | 'email',
                  v as string,
                  data[matrixAddress].active
                ])
              })
            }
          })
        })

        const pool = createPool(factory, { max: jobs })

        if (params.length === 0) {
          resolve()
        } else {
          Promise.all(
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            params.map((param) => {
              let worker: { update: _Update }
              return (
                pool
                  .acquire()
                  // eslint-disable-next-line @typescript-eslint/promise-function-async
                  .then((w) => {
                    worker = w as { update: _Update }
                    return worker.update(...param)
                  })
                  .then((res) => {
                    pool.release(worker).catch(logger.error)
                    return res
                  })
              )
            })
          )
            .then(() => {
              resolve()
            })
            .catch(reject)
        }
      })
      .catch(reject)
  })
}

export default updateHash
