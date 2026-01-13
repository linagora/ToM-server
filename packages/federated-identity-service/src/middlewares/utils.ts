import { errCodes } from '@twake-chat/utils'
import { type expressAppHandler } from '../types'
import { FederatedIdentityServiceError } from './errors'

export const allowCors: expressAppHandler = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, OPTIONS'
  )
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  )
  next()
}

export const methodNotAllowed: expressAppHandler = (req, res, next) => {
  throw new FederatedIdentityServiceError({
    status: 405,
    code: errCodes.unrecognized
  })
}

export const methodNotFound: expressAppHandler = (req, res, next) => {
  throw new FederatedIdentityServiceError({
    status: 404,
    code: errCodes.notFound
  })
}
