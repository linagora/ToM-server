import { Hash, supportedHashes } from '@twake/crypto'
import type MatrixIdentityServer from '..'
import { createPool } from 'generic-pool'

const fieldsToHash = ['phone', 'email']

// TODO: move this in conf
const jobs = 5

interface ValueField {
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
const updateHash = (
  idServer: MatrixIdentityServer,
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
              (await idServer.db.get('keys', ['data'], {
                name: 'pepper'
              })) as unknown as Array<{ data: string }>
            )[0].data
          }
          // console.debug('pepper + hash', [pepper, hash[method as 'sha256'](`${value} ${field} ${pepper}`)])
          await idServer.db.insert('hashes', {
            hash: hash[method as 'sha256'](`${value} ${field} ${pepper}`),
            pepper,
            type: field,
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
                    pool.release(worker).catch(console.error)
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
