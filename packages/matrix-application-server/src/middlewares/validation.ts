import { body, param, type ValidationChain } from 'express-validator'
import { Endpoints } from '../utils'

export default (endpointId: string): ValidationChain[] => {
  let validators: ValidationChain[] = []
  switch (endpointId) {
    case Endpoints.TRANSACTIONS:
      validators = [
        param('txnId').exists().isString(),
        body('events').exists().isArray()
      ]
      break
    default:
      break
  }
  return validators
}
