import { Router } from 'express'
import type FederationServer from '..'

export default (server: FederationServer): Router => {
  const routes = Router()

  const defaultGetEndpoints = Object.keys(server.api.get)
  const defaultPostEndpoints = Object.keys(server.api.post)

  defaultGetEndpoints.forEach((k) => {
    routes.route(k).get(server.api.get[k])
  })
  defaultPostEndpoints.forEach((k) => {
    routes.route(k).post(server.api.post[k])
  })

  return routes
}
