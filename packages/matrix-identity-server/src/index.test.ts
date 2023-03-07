import express from 'express'
import request from 'supertest'
import IdServer from '@twake/matrix-identity-server'

const idServer = new IdServer()

const app = express()

Object.keys(idServer.api.get).forEach( k => {
  app.get(k, idServer.api.get[k])
})

test('versions endpoint', async () => {
  const response = await request(app).get('/_matrix/identity/versions')
  expect(response.statusCode).toBe(200)
})
