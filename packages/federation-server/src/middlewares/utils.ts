import { MatrixErrors } from '@twake/matrix-identity-server'
import { type expressAppHandler } from '../types'
import { FederationServerError } from './errors'

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
  throw new FederationServerError({
    status: 405,
    code: MatrixErrors.errCodes.unrecognized
  })
}

export const methodNotFound: expressAppHandler = (req, res, next) => {
  throw new FederationServerError({
    status: 404,
    code: MatrixErrors.errCodes.notFound
  })
}
