import { json, Router, urlencoded } from 'express'
import type FederationServer from '..'
import { hashDetails } from '../controllers/controllers'
import { auth } from '../middlewares/auth'
import { errorMiddleware } from '../middlewares/errors'
import {
  allowCors,
  methodNotAllowed,
  methodNotFound
} from '../middlewares/utils'
import { type expressAppHandler, type middlewaresList } from '../types'

const errorMiddlewares = (middleware: expressAppHandler): middlewaresList => [
  allowCors,
  middleware,
  errorMiddleware
]

export default (server: FederationServer): Router => {
  const routes = Router()

  routes
    .route('/_matrix/identity/v2/hash_details')
    .get(
      allowCors,
      json(),
      urlencoded({ extended: false }),
      auth(server.authenticate, server.conf.trusted_servers_addresses),
      hashDetails(server.db),
      errorMiddleware
    )
    .all(...errorMiddlewares(methodNotAllowed))

  const defaultGetEndpoints = Object.keys(server.api.get)
  const defaultPostEndpoints = Object.keys(server.api.post)

  defaultGetEndpoints.forEach((k) => {
    routes.route(k).get(server.api.get[k])
  })
  defaultPostEndpoints.forEach((k) => {
    routes.route(k).post(server.api.post[k])
  })

  const allDefaultEndpoints = [
    ...new Set([...defaultGetEndpoints, ...defaultPostEndpoints])
  ]

  allDefaultEndpoints.forEach((k) => {
    routes.route(k).all(...errorMiddlewares(methodNotAllowed))
  })

  routes.use(...errorMiddlewares(methodNotFound))

  return routes
}
