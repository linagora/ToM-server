import validation from './validation'
import { body } from 'express-validator'

describe('Validation', () => {
  it('should return array containing body validators', () => {
    expect(JSON.stringify(validation())).toEqual(
      JSON.stringify([
        body('name').isString(),
        body('aliasName').exists().isString(),
        body('topic').isString(),
        body('visibility').custom((value) => {
          if (!['public', 'private'].includes(value)) {
            throw new Error('visibility should equal to "private" or "public"')
          }
        }),
        body('ldapFilter').exists().isObject()
      ])
    )
  })
})
