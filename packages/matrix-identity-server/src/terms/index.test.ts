import Terms from './index'
import express from 'express'
import request from 'supertest'
import DefaultConfig from '../config.json'
import { type Config } from '..'
import { resetPolicies } from './_computePolicies'

const policies = {
  privacy_policy: {
    en: {
      name: 'Privacy Policy',
      url: 'https://example.org/somewhere/privacy-1.2-en.html'
    },
    fr: {
      name: 'Politique de confidentialité',
      url: 'https://example.org/somewhere/privacy-1.2-fr.html'
    },
    version: '1.2'
  },
  terms_of_service: {
    en: {
      name: 'Terms of Service',
      url: 'https://example.org/somewhere/terms-2.0-en.html'
    },
    fr: {
      name: "Conditions d'utilisation",
      url: 'https://example.org/somewhere/terms-2.0-fr.html'
    },
    version: '2.0'
  }
}

describe('Terms', () => {
  describe('Policies directly in configuration', () => {
    const app = express()

    const baseConf: Config = {
      ...DefaultConfig,
      database_engine: 'sqlite',
      database_host: ':memory:',
      policies
    }

    app.get('/_matrix/identity/v2/terms', Terms(baseConf))

    describe('/_matrix/identity/v2/terms', () => {
      it('should return policies', async () => {
        const response = await request(app).get('/_matrix/identity/v2/terms')
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({ policies })
      })
    })
  })
  describe('policies in a distinct file', () => {
    resetPolicies()
    const app = express()
    const baseConf: Config = {
      ...DefaultConfig,
      database_engine: 'sqlite',
      database_host: './test.db',
      policies: './src/terms/__testData__/policies.json'
    }

    app.get('/_matrix/identity/v2/terms', Terms(baseConf))

    describe('/_matrix/identity/v2/terms', () => {
      it('should return policies', async () => {
        const response = await request(app).get('/_matrix/identity/v2/terms')
        expect(response.statusCode).toBe(200)
        expect(response.body).toEqual({ policies })
      })
    })
  })
})
