import { body } from 'express-validator'

export const commonValidators = [
  body('algorithm').exists().isString(),
  body('pepper').exists().isString()
]

export const lookupsValidator = body('mappings')
  .exists()
  .isObject()
  .custom((value, { req }) => {
    if (Object.keys(value).length > 1) {
      throw new Error('Only one server address is allowed')
    }
    return true
  })
