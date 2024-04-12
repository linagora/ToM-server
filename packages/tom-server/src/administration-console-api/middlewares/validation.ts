import { body, type ValidationChain } from 'express-validator'

export default (): ValidationChain[] => {
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
