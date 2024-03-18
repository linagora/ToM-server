import { body, type ValidationChain } from 'express-validator'

export const createRoomValidation = (): ValidationChain[] => {
  const validators: ValidationChain[] = [
    body('name').isString().optional(),
    body('aliasName').exists().isString(),
    body('topic').isString().optional(),
    body('visibility')
      .custom((value) => {
        if (!['public', 'private'].includes(value)) {
          throw new Error('visibility should equal to "private" or "public"')
        }
        return true
      })
      .optional(),
    body('ldapFilter').exists().isObject()
  ]
  return validators
}

export const blockSenderValidation = (): ValidationChain[] => [
  body('usersIds').custom((value) => {
    if (
      !Array.isArray(value) ||
      value.some(
        (id) => typeof id !== 'string' || id.match(/^@[^:]*:.*/) == null
      )
    ) {
      throw new Error(
        'usersIds should be an array of strings representing Matrix users ids'
      )
    }
    return true
  })
]
