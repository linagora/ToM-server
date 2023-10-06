import { body } from 'express-validator'

export const commonValidators = [
  body('algorithm').exists().isString(),
  body('pepper').exists().isString()
]

export const lookupValidator = body('addresses')
  .exists()
  .isArray()
  .custom((value, { req }) => {
    if ((value as any[]).some((address) => typeof address !== 'string')) {
      throw new Error('One of the address is not a string')
    }
    return true
  })

export const lookupsValidator = body('mappings')
  .exists()
  .isObject()
  .custom((value, { req }) => {
    if (Object.keys(value).length > 1) {
      throw new Error('Only one server address is allowed')
    }
    return true
  })
