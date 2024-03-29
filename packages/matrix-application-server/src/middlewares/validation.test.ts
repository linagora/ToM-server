import { Endpoints } from '../utils'
import validation from './validation'
import { body, param } from 'express-validator'

describe('Validation', () => {
  it('should return array containing param and body validator if it is "transactions" endpoint', () => {
    expect(JSON.stringify(validation(Endpoints.TRANSACTIONS))).toEqual(
      JSON.stringify([
        param('txnId').exists().isString(),
        body('events').exists().isArray()
      ])
    )
  })

  it('should return array containing param validator if it is "users" endpoint', () => {
    expect(JSON.stringify(validation(Endpoints.USERS))).toEqual(
      JSON.stringify([param('userId').exists().isString()])
    )
  })

  it('should return array containing param validator if it is "rooms" endpoint', () => {
    expect(JSON.stringify(validation(Endpoints.ROOMS))).toEqual(
      JSON.stringify([param('aliasRoom').exists().isString()])
    )
  })

  it('should return empty array for any other endpoint', () => {
    expect(validation('falsy_endpoint')).toEqual([])
  })
})
