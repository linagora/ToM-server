/**
 * Unit tests for the WellKnown class.
 *
 * The tests are written with Jest. They use a tiny Express app together
 * with supertest to issue real HTTP requests against the handler that
 * WellKnown registers.
 */

import request from 'supertest'
import express, { type Express } from 'express'
import WellKnown from '.'
import { type Config } from '../types'
import defaultConfig from '../config.json'

type WellKnownConfig = Pick<Config, 'features'>

jest.mock('@twake/utils', () => ({
  send: (res: any, code: number, payload: any) => {
    res.status(code).json(payload)
  }
}))

function buildConfig(
  overrides: Partial<WellKnownConfig> = {}
): WellKnownConfig {
  return {
    ...defaultConfig,
    ...overrides
  } as WellKnownConfig
}

function createApp(conf: WellKnownConfig): Express {
  const app = express()
  const wellKnown = new WellKnown(conf as unknown as Config)

  app.get(
    '/.well-known/matrix/client',
    wellKnown.api.get['/.well-known/matrix/client']
  )
  app.get(
    '/.well-known/twake/client',
    wellKnown.api.get['/.well-known/twake/client']
  )
  return app
}

describe('WellKnown class', () => {
  beforeEach(() => {
    global.fetch = jest.fn() 
  })

  it('propagates features.common_settings.enabled correctly', async () => {
    const conf = buildConfig({
      features: {
        common_settings: {
          ...defaultConfig.features.common_settings,
          enabled: true
        },
        matrix_profile_updates_allowed: false
      }
    })
    const app = createApp(conf)

    const res = await request(app).get('/.well-known/matrix/client')
    expect(res.status).toBe(200)

    expect(res.body['app.twake.chat']).toMatchObject({
      common_settings: { enabled: true }
    })
  })

  it('propagates features.matrix_profile_updates_allowed correctly', async () => {
    const conf = buildConfig({
      features: {
        common_settings: {
          ...defaultConfig.features.common_settings,
          enabled: false
        },
        matrix_profile_updates_allowed: true
      }
    })
    const app = createApp(conf)

    const res = await request(app).get('/.well-known/matrix/client')
    expect(res.status).toBe(200)

    expect(res.body['app.twake.chat']).toMatchObject({
      matrix_profile_updates_allowed: true
    })
  })

  it('merges remote matrix config without throwing', async () => {
    // Simulate a remote config from fetch
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        'm.identity_server': { base_url: 'https://remote.identity.url' }
      })
    })

    const conf = buildConfig({
      features: {
        common_settings: {
          ...defaultConfig.features.common_settings,
          enabled: false
        },
        matrix_profile_updates_allowed: false
      }
    })

    const app = createApp(conf)
    const res = await request(app).get('/.well-known/matrix/client')

    expect(res.status).toBe(200)
    expect(res.body['m.identity_server']).toMatchObject({
      base_url: 'https://remote.identity.url'
    })
  })
})
