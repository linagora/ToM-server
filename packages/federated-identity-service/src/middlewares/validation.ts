import { body, type ValidationChain } from 'express-validator'

export const commonValidators = [
  body('algorithm').exists().isString(),
  body('pepper').exists().isString()
]

export const lookupValidator = (hashesLimit: number): ValidationChain =>
  body('addresses')
    .exists()
    .isArray()
    .custom((value, { req }) => {
      if ((value as any[]).some((address) => typeof address !== 'string')) {
        throw new Error('One of the address is not a string')
      } else if ((value as string[]).length > hashesLimit) {
        throw new Error(`Adresses limit of ${hashesLimit} exceeded`)
      }
      return true
    })

export const lookupsValidator = [
  body('pepper').exists().isString(),
  body('mappings')
    .exists()
    .isObject()
    .custom((value, { req }) => {
      if (Object.keys(value).length > 1) {
        throw new Error('Only one server address is allowed')
      }
      if (
        Object.keys(value).length === 1 &&
        !(
          Array.isArray(Object.values(value)[0]) &&
          (Object.values(value)[0] as any[]).every(
            (hash) => typeof hash === 'string'
          )
        )
      ) {
        throw new Error('Mappings object values are not string arrays')
      }
      return true
    })
]
