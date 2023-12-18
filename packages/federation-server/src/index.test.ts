import { Hash } from '@twake/crypto'
import dockerComposeV1, { v2 as dockerComposeV2 } from 'docker-compose'
import express from 'express'
import fs from 'fs'
import type * as http from 'http'
import * as fetch from 'node-fetch'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:https'
import os from 'os'
import path from 'path'
import request from 'supertest'
import {
  DockerComposeEnvironment,
  Wait,
  type StartedDockerComposeEnvironment,
  type StartedTestContainer
} from 'testcontainers'
import FederationServer from '.'
import JEST_PROCESS_ROOT_PATH from '../jest.globals'
import { buildMatrixDb, buildUserDB } from './__testData__/build-userdb'
import defaultConfig from './__testData__/config.json'
import { type Config } from './types'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const syswideCas = require('@small-tech/syswide-cas')

const pathToTestDataFolder = path.join(
  JEST_PROCESS_ROOT_PATH,
  'src',
  '__testData__'
)
const pathToSynapseDataFolder = path.join(pathToTestDataFolder, 'synapse-data')

const authToken =
  'authTokenddddddddddddddddddddddddddddddddddddddddddddddddddddddd'

jest.unmock('node-fetch')

interface IHashDetails {
  algorithms: ['sha256']
  lookup_pepper: string
  alt_lookup_peppers?: string[]
}

describe('Federation server', () => {
  const hash = new Hash()

  beforeAll((done) => {
    hash.ready
      .then(() => {
        done()
      })
      .catch((e) => {
        done(e)
      })
  })

  describe('Integration tests', () => {
    let containerNameSuffix: string
    let startedCompose: StartedDockerComposeEnvironment
    let identity1IPAddress: string
    let identity2IPAddress: string
    let tokens: { matrixToken: string; federationToken: string }
    let hashDetails: IHashDetails
    let allPeppers: string[]

    const simulationConnection = async (
      username: string,
      password: string,
      matrixServer: string,
      federationServer?: string
    ): Promise<
      { matrixToken: string; federationToken?: string } | undefined
    > => {
      let response = await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${matrixServer}/_matrix/client/v3/login`
        )
      )
      let body = (await response.json()) as any
      const providerId = body.flows[0].identity_providers[0].id
      response = await fetch.default(
        encodeURI(
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          `https://${matrixServer}/_matrix/client/r0/login/sso/redirect/${providerId}?redirectUrl=http://localhost:9876`
        ),
        {
          redirect: 'manual'
        }
      )
      let location = response.headers.get('location') as string
      const matrixCookies = response.headers.get('set-cookie')
      response = await fetch.default(location)
      body = await response.text()
      const hiddenInputFieldsWithValue = [
        ...(body as string).matchAll(/<input.*name="(\S+?)".*value="(\S+?)"/g)
      ]
        .map((matchElt) => `${matchElt[1]}=${matchElt[2]}&`)
        .join('')
      const formWithToken = `${hiddenInputFieldsWithValue}user=${username}&password=${password}`
      response = await fetch.default(location, {
        method: 'POST',
        body: new URLSearchParams(formWithToken),
        redirect: 'manual'
      })
      location = response.headers.get('location') as string
      response = await fetch.default(location, {
        headers: {
          cookie: matrixCookies as string
        }
      })
      body = await response.text()
      const loginTokenValue = [
        ...(body as string).matchAll(/loginToken=(\S+?)"/g)
      ][0][1]
      response = await fetch.default(
        encodeURI(`https://${matrixServer}/_matrix/client/v3/login`),
        {
          method: 'POST',
          body: JSON.stringify({
            initial_device_display_name: 'Jest Test Client',
            token: loginTokenValue,
            type: 'm.login.token'
          })
        }
      )
      body = (await response.json()) as any
      const matrixToken = body.access_token as string
      if (federationServer != null) {
        const userId = body.user_id as string
        response = await fetch.default(
          encodeURI(
            `https://${matrixServer}/_matrix/client/v3/user/${userId}/openid/request_token`
          ),
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${matrixToken}`
            },
            body: JSON.stringify({})
          }
        )
        body = await response.json()
        response = await fetch.default(
          encodeURI(
            `https://${federationServer}/_matrix/identity/v2/account/register`
          ),
          {
            method: 'POST',
            body: JSON.stringify({
              ...body,
              matrix_server_name: `${matrixServer}:443`
            })
          }
        )
        body = await response.json()
      }
      return {
        matrixToken,
        federationToken: federationServer != null ? body.token : null
      }
    }

    const getAllPeppers = (hashDetails: IHashDetails): string[] => [
      hashDetails.lookup_pepper,
      ...(hashDetails.alt_lookup_peppers ?? [])
    ]

    beforeAll((done) => {
      syswideCas.addCAs(
        path.join(pathToTestDataFolder, 'nginx', 'ssl', 'ca.pem')
      )
      Promise.allSettled([dockerComposeV1.version(), dockerComposeV2.version()])
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((results) => {
          const promiseSucceededIndex = results.findIndex(
            (res) => res.status === 'fulfilled'
          )
          if (promiseSucceededIndex === -1) {
            throw new Error('Docker compose is not installed')
          }
          containerNameSuffix = promiseSucceededIndex === 0 ? '_' : '-'
          return new DockerComposeEnvironment(
            path.join(pathToTestDataFolder),
            'docker-compose.yml'
          )
            .withEnvironment({ MYUID: os.userInfo().uid.toString() })
            .withWaitStrategy(
              `postgresql${containerNameSuffix}1`,
              Wait.forHealthCheck()
            )
            .withWaitStrategy(
              `synapse-federation${containerNameSuffix}1`,
              Wait.forHealthCheck()
            )
            .withWaitStrategy(
              `synapse-1${containerNameSuffix}1`,
              Wait.forHealthCheck()
            )
            .withWaitStrategy(
              `synapse-2${containerNameSuffix}1`,
              Wait.forHealthCheck()
            )
            .withWaitStrategy(
              `synapse-3${containerNameSuffix}1`,
              Wait.forHealthCheck()
            )
            .up()
        })
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then((upResult) => {
          startedCompose = upResult
          done()
        })
        .catch((e) => {
          done(e)
        })
    })

    afterAll((done) => {
      const filesToDelete: string[] = [
        path.join(pathToSynapseDataFolder, 'matrix.example.com.signing.key'),
        path.join(pathToSynapseDataFolder, 'matrix1.example.com.signing.key'),
        path.join(pathToSynapseDataFolder, 'matrix2.example.com.signing.key'),
        path.join(pathToSynapseDataFolder, 'matrix3.example.com.signing.key'),
        path.join(pathToSynapseDataFolder, 'homeserver.log'),
        path.join(pathToSynapseDataFolder, 'media_store1'),
        path.join(pathToSynapseDataFolder, 'media_store2'),
        path.join(pathToSynapseDataFolder, 'media_store3'),
        path.join(pathToSynapseDataFolder, 'media_store_federation')
      ]
      filesToDelete.forEach((path: string) => {
        if (fs.existsSync(path)) {
          const isDir = fs.statSync(path).isDirectory()
          isDir ? fs.rmdirSync(path) : fs.unlinkSync(path)
        }
      })
      if (startedCompose != null) {
        startedCompose
          .down()
          .then(() => {
            done()
          })
          .catch((e) => {
            done(e)
          })
      } else {
        done()
      }
    })

    describe('Federation server in docker container', () => {
      let federationServerContainer: StartedTestContainer
      const federationServerHostname = 'federation.example.com'
      const pathToFederationServerConf = path.join(
        pathToTestDataFolder,
        'federation-server',
        'federation-server.conf'
      )
      let confOriginalContent: string

      const getHashDetails = async (): Promise<IHashDetails> => {
        const response = await fetch.default(
          encodeURI(
            `https://${federationServerHostname}/_matrix/identity/v2/hash_details`
          ),
          {
            headers: { Authorization: `Bearer ${tokens.federationToken}` }
          }
        )
        return (await response.json()) as IHashDetails
      }

      beforeAll((done) => {
        identity1IPAddress = startedCompose
          .getContainer(`identity-server-1${containerNameSuffix}1`)
          .getIpAddress('test')
        identity2IPAddress = startedCompose
          .getContainer(`identity-server-2${containerNameSuffix}1`)
          .getIpAddress('test')

        confOriginalContent = fs.readFileSync(
          pathToFederationServerConf,
          'utf-8'
        )

        fs.writeFileSync(
          pathToFederationServerConf,
          confOriginalContent.replace(
            /"trusted_servers_addresses": \[\]/g,
            `"trusted_servers_addresses": ["${identity1IPAddress}", "${identity2IPAddress}"]`
          ),
          'utf-8'
        )

        federationServerContainer = startedCompose.getContainer(
          `federation-server${containerNameSuffix}1`
        )

        federationServerContainer
          .restart()
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then(() => {
            return simulationConnection(
              'askywalker',
              'askywalker',
              'matrix1.example.com',
              federationServerHostname
            )
          })
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then((askywalkerTokens) => {
            tokens = askywalkerTokens as {
              matrixToken: string
              federationToken: string
            }
            return Promise.all([
              simulationConnection(
                'lskywalker',
                'lskywalker',
                'matrix2.example.com'
              ),
              simulationConnection('okenobi', 'okenobi', 'matrix3.example.com')
            ])
          })
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then(() => {
            // wait for identity servers to push hashes to federation server
            return new Promise((resolve) => setTimeout(resolve, 8000))
          })
          .then(() => {
            done()
          })
          .catch((e) => {
            done(e)
          })
      })

      afterAll((done) => {
        fs.writeFileSync(
          pathToFederationServerConf,
          confOriginalContent,
          'utf-8'
        )
        if (federationServerContainer != null) {
          federationServerContainer
            .stop()
            .then(() => {
              done()
            })
            .catch((e) => {
              done(e)
            })
        } else {
          done()
        }
      })

      it('should get server DNS in which searched users is registered', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const lskywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`lskywalker@example.com email ${pepper}`)
        )
        const hosts = new Set<string>()
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await fetch.default(
            encodeURI(
              `https://${federationServerHostname}/_matrix/identity/v2/lookup`
            ),
            {
              method: 'post',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.federationToken}`
              },
              body: JSON.stringify({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [lskywalkerHashes[i]]
              })
            }
          )
          /*
              Body example:
              {
                mappings: {},
                inactive_mappings: {},
                third_party_mappings: { 
                  'identity2.example.com:443': { 
                    actives: ['gxkUW11GNrH5YASQhG_I7ijwdUBoMpqqSCc_OtbpOm0'],
                    inactives: [] 
                  } 
                }
              }
            */
          const body = (await response.json()) as Record<
            string,
            Record<string, string | Record<string, string[]>>
          >
          expect(body).toHaveProperty('mappings', {})
          expect(body).toHaveProperty('inactive_mappings', {})
          expect(body).toHaveProperty('third_party_mappings')
          Object.keys(body.third_party_mappings).forEach((host) =>
            hosts.add(host)
          )
          expect(Object.keys(body.third_party_mappings)).toHaveLength(1)
          expect(body.third_party_mappings).toHaveProperty([
            'identity2.example.com:443'
          ])
          expect(
            JSON.stringify(
              body.third_party_mappings['identity2.example.com:443']
            )
          ).toEqual(
            JSON.stringify({
              actives: [lskywalkerHashes[i]],
              inactives: []
            })
          )
        }
        expect(hosts.size).toEqual(1)
        expect(hosts.has('identity2.example.com:443')).toEqual(true)
      })

      it('should get user of federation server environment on lookup', async () => {
        await simulationConnection(
          'chewbacca',
          'chewbacca',
          'matrix.example.com'
        )
        await new Promise((resolve) => setTimeout(resolve, 8000))
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const chewbaccaHashes = allPeppers.map((pepper) =>
          hash.sha256(`chewbacca@example.com email ${pepper}`)
        )

        const matrixAddresses = new Set<string>()
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await fetch.default(
            encodeURI(
              `https://${federationServerHostname}/_matrix/identity/v2/lookup`
            ),
            {
              method: 'post',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.federationToken}`
              },
              body: JSON.stringify({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [chewbaccaHashes[i]]
              })
            }
          )
          const body = (await response.json()) as Record<
            string,
            Record<string, string | Record<string, string[]>>
          >
          expect(body).toHaveProperty('inactive_mappings', {})
          expect(body).toHaveProperty('third_party_mappings', {})
          expect(body).toHaveProperty('mappings')
          Object.values(body.mappings as Record<string, string>).forEach(
            (address) => matrixAddresses.add(address)
          )
        }
        expect(matrixAddresses.size).toEqual(1)
        expect(matrixAddresses.has('@chewbacca:example.com')).toEqual(true)
      })

      it('should find all servers on which a third party user is connected on lookup', async () => {
        await simulationConnection(
          'lskywalker',
          'lskywalker',
          'matrix1.example.com'
        )
        await new Promise((resolve) => setTimeout(resolve, 8000))
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const lskywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`lskywalker@example.com email ${pepper}`)
        )
        const hosts = new Set<string>()
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await fetch.default(
            encodeURI(
              `https://${federationServerHostname}/_matrix/identity/v2/lookup`
            ),
            {
              method: 'post',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.federationToken}`
              },
              body: JSON.stringify({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [lskywalkerHashes[i]]
              })
            }
          )
          const body = (await response.json()) as Record<
            string,
            Record<string, string | Record<string, string[]>>
          >
          expect(body).toHaveProperty('mappings', {})
          expect(body).toHaveProperty('inactive_mappings', {})
          expect(body).toHaveProperty('third_party_mappings')
          Object.keys(body.third_party_mappings).forEach((host) =>
            hosts.add(host)
          )
        }
        expect(hosts.size).toEqual(2)
        expect(hosts.has('identity1.example.com:443')).toEqual(true)
        expect(hosts.has('identity2.example.com:443')).toEqual(true)
      })

      it('should find all federation users and servers address of third party users on lookup', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const lskywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`lskywalker@example.com email ${pepper}`)
        )
        const chewbaccaHashes = allPeppers.map((pepper) =>
          hash.sha256(`chewbacca@example.com email ${pepper}`)
        )
        const qjinnHashes = allPeppers.map((pepper) =>
          hash.sha256(`qjinn@example.com email ${pepper}`)
        )
        const okenobiHashes = allPeppers.map((pepper) =>
          hash.sha256(`okenobi@example.com email ${pepper}`)
        )
        const askywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`askywalker@example.com email ${pepper}`)
        )
        const matrixAddresses = new Set<string>()
        const askywalkerHosts = new Set<string>()
        const lskywalkerHosts = new Set<string>()

        for (let i = 0; i < allPeppers.length; i++) {
          const response = await fetch.default(
            encodeURI(
              `https://${federationServerHostname}/_matrix/identity/v2/lookup`
            ),
            {
              method: 'post',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.federationToken}`
              },
              body: JSON.stringify({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [
                  lskywalkerHashes[i],
                  qjinnHashes[i],
                  chewbaccaHashes[i],
                  okenobiHashes[i],
                  askywalkerHashes[i]
                ]
              })
            }
          )
          const body = (await response.json()) as Record<
            string,
            Record<string, string | Record<string, string[]>>
          >
          expect(body).toHaveProperty('inactive_mappings', {})
          expect(body).toHaveProperty('mappings')
          Object.values(body.mappings as Record<string, string>).forEach(
            (address) => matrixAddresses.add(address)
          )
          expect(body).toHaveProperty('third_party_mappings')
          Object.keys(body.third_party_mappings).forEach((host) => {
            Object.keys(
              body.third_party_mappings[host] as Record<string, string[]>
            ).forEach((key) => {
              ;(body.third_party_mappings[host] as Record<string, string[]>)[
                key
              ].forEach((hash) => {
                switch (hash) {
                  case lskywalkerHashes[i]:
                    lskywalkerHosts.add(host)
                    break
                  case askywalkerHashes[i]:
                    askywalkerHosts.add(host)
                    break
                  default:
                    break
                }
              })
            })
          })
        }
        expect(askywalkerHosts.size).toEqual(1)
        expect(askywalkerHosts.has('identity1.example.com:443')).toEqual(true)
        expect(lskywalkerHosts.size).toEqual(2)
        expect(lskywalkerHosts.has('identity1.example.com:443')).toEqual(true)
        expect(lskywalkerHosts.has('identity2.example.com:443')).toEqual(true)
        expect(matrixAddresses.size).toEqual(1)
        expect(matrixAddresses.has('@chewbacca:example.com')).toEqual(true)
      })

      it('should not find user from not trusted identity server on lookup', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const okenobiHashes = allPeppers.map((pepper) =>
          hash.sha256(`okenobi@example.com email ${pepper}`)
        )
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await fetch.default(
            encodeURI(
              `https://${federationServerHostname}/_matrix/identity/v2/lookup`
            ),
            {
              method: 'post',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.federationToken}`
              },
              body: JSON.stringify({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [okenobiHashes[i]]
              })
            }
          )
          const body = (await response.json()) as Record<
            string,
            Record<string, string | Record<string, string[]>>
          >
          expect(body).toHaveProperty('inactive_mappings', {})
          expect(body).toHaveProperty('third_party_mappings', {})
          expect(body).toHaveProperty('mappings', {})
        }
      })

      it('should not find user not connected on any matrix server on lookup', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const qjinnHashes = allPeppers.map((pepper) =>
          hash.sha256(`qjinn@example.com email ${pepper}`)
        )
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await fetch.default(
            encodeURI(
              `https://${federationServerHostname}/_matrix/identity/v2/lookup`
            ),
            {
              method: 'post',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${tokens.federationToken}`
              },
              body: JSON.stringify({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [qjinnHashes[i]]
              })
            }
          )
          const body = (await response.json()) as Record<
            string,
            Record<string, string | Record<string, string[]>>
          >
          expect(body).toHaveProperty('inactive_mappings', {})
          expect(body).toHaveProperty('third_party_mappings', {})
          expect(body).toHaveProperty('mappings', {})
        }
      })
    })

    // Does not work on CI when pepper is udpated due to ip addresses in identity servers requests
    describe.skip('Federation Server as express app', () => {
      let federationServer: FederationServer
      let app: express.Application
      let expressFederationServer: http.Server
      const pathToIdentityServerConf = path.join(
        pathToTestDataFolder,
        'identity-server',
        'conf'
      )
      const pathToNginxSsl = path.join(pathToTestDataFolder, 'nginx', 'ssl')
      let federationServerCrtFilePath: string
      let federationServerKeyFilePath: string

      const originalContents: string[] = []
      const interfaces = os.networkInterfaces()
      const hostNetworkInterface = Object.keys(interfaces)
        .reduce<os.NetworkInterfaceInfo[]>((acc, key) => {
          return interfaces[key] != null
            ? [...acc, ...(interfaces[key] as os.NetworkInterfaceInfo[])]
            : acc
        }, [])
        .find(
          (networkInterface) =>
            networkInterface.family === 'IPv4' && !networkInterface.internal
        ) as os.NetworkInterfaceInfo

      const getHashDetails = async (): Promise<IHashDetails> => {
        const response = await request(app)
          .get('/_matrix/identity/v2/hash_details')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${tokens.federationToken}`)

        return response.body as IHashDetails
      }

      beforeAll((done) => {
        execFileSync(
          path.join(
            pathToTestDataFolder,
            'generate-self-signed-certificate.sh'
          ),
          ['-ip', hostNetworkInterface.address]
        )

        for (let i = 1; i <= 3; i++) {
          const confFilePath = path.join(
            pathToIdentityServerConf,
            `identity-server-${i}.conf`
          )
          const content = fs.readFileSync(confFilePath, 'utf-8')
          originalContents.push(content)
          const newContent = content.replace(
            /federation\.example\.com/g,
            `${hostNetworkInterface.address}:3000`
          )
          fs.writeFileSync(confFilePath, newContent, 'utf-8')
        }

        federationServerCrtFilePath = path.join(
          pathToNginxSsl,
          `${hostNetworkInterface.address}.crt`
        )
        federationServerKeyFilePath = path.join(
          pathToNginxSsl,
          `${hostNetworkInterface.address}.key`
        )

        const waitForFilesExist = async (
          filesPath: string[],
          currentTime = 0,
          timeout = 5000
        ): Promise<boolean> => {
          if (filesPath.every((path) => fs.existsSync(path))) return true
          if (currentTime === timeout) return false
          await new Promise<void>((resolve, reject) =>
            setTimeout(() => {
              resolve()
            }, 1000)
          )
          return await waitForFilesExist(filesPath, currentTime + 1000, timeout)
        }

        waitForFilesExist([
          federationServerCrtFilePath,
          federationServerKeyFilePath
        ])
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then((areFilesCreated) => {
            if (!areFilesCreated)
              throw new Error(
                'Certificates files for federation server has not been created'
              )
            return Promise.all([
              startedCompose
                .getContainer(`identity-server-1${containerNameSuffix}1`)
                .restart(),
              startedCompose
                .getContainer(`identity-server-2${containerNameSuffix}1`)
                .restart(),
              startedCompose
                .getContainer(`identity-server-3${containerNameSuffix}1`)
                .restart()
            ])
          })
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then(() => {
            identity1IPAddress = startedCompose
              .getContainer(`identity-server-1${containerNameSuffix}1`)
              .getIpAddress('test')

            identity2IPAddress = startedCompose
              .getContainer(`identity-server-2${containerNameSuffix}1`)
              .getIpAddress('test')

            const testConfig: Config = {
              ...(defaultConfig as Config),
              additional_features: true,
              cron_service: true,
              base_url: `https://${hostNetworkInterface.address}:3000`,
              database_engine: 'pg',
              database_user: 'twake',
              database_password: 'twake!1',
              database_host: `${startedCompose
                .getContainer(`postgresql${containerNameSuffix}1`)
                .getHost()}:5432`,
              database_name: 'federation',
              ldap_base: 'dc=example,dc=com',
              ldap_uri: `ldap://${startedCompose
                .getContainer(`postgresql${containerNameSuffix}1`)
                .getHost()}:389`,
              matrix_database_engine: 'pg',
              matrix_database_host: `${startedCompose
                .getContainer(`postgresql${containerNameSuffix}1`)
                .getHost()}:5432`,
              matrix_database_name: 'synapsefederation',
              matrix_database_user: 'synapse',
              matrix_database_password: 'synapse!1',
              pepperCron: '*/2 * * * *',
              server_name: 'example.com',
              template_dir: path.join(
                JEST_PROCESS_ROOT_PATH,
                '..',
                'matrix-identity-server',
                'templates'
              ),
              trust_x_forwarded_for: true,
              trusted_servers_addresses: [
                identity1IPAddress,
                identity2IPAddress
              ],
              update_users_cron: '*/5 * * * * *',
              userdb_engine: 'ldap'
            }
            federationServer = new FederationServer(testConfig)
            app = express()
            return federationServer.ready
          })
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then(() => {
            app.use(federationServer.routes)
            const key = fs.readFileSync(federationServerKeyFilePath)
            const cert = fs.readFileSync(federationServerCrtFilePath)
            expressFederationServer = createServer({ key, cert }, app)
            return new Promise<void>((resolve, _reject) => {
              expressFederationServer.listen(3000, () => {
                resolve()
              })
            })
          })
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then(() => {
            // wait for identity servers to push hashes to federation server
            return new Promise((resolve) => setTimeout(resolve, 8000))
          })
          .then(() => {
            done()
          })
          .catch((e) => {
            done(e)
          })
      })

      afterAll((done) => {
        for (let i = 1; i <= 3; i++) {
          fs.writeFileSync(
            path.join(pathToIdentityServerConf, `identity-server-${i}.conf`),
            originalContents[i - 1],
            'utf-8'
          )
        }
        const filesToDelete = [
          federationServerCrtFilePath,
          federationServerKeyFilePath
        ]
        filesToDelete.forEach((path: string) => {
          if (fs.existsSync(path)) fs.unlinkSync(path)
        })
        if (federationServer != null) federationServer.cleanJobs()
        if (expressFederationServer != null) {
          expressFederationServer.close((e) => {
            if (e != null) {
              done(e)
            }
            done()
          })
        } else {
          done()
        }
      })

      it('should find all servers on which a third party user is connected on lookup', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const lskywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`lskywalker@example.com email ${pepper}`)
        )
        const hosts = new Set<string>()
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${tokens.federationToken}`)
            .send({
              algorithm: hashDetails.algorithms[0],
              pepper: allPeppers[i],
              addresses: [lskywalkerHashes[i]]
            })
          expect(response.body).toHaveProperty('mappings', {})
          expect(response.body).toHaveProperty('inactive_mappings', {})
          expect(response.body).toHaveProperty('third_party_mappings')
          Object.keys(response.body.third_party_mappings).forEach((host) =>
            hosts.add(host)
          )
        }
        expect(hosts.size).toEqual(2)
        expect(hosts.has('identity1.example.com:443')).toEqual(true)
        expect(hosts.has('identity2.example.com:443')).toEqual(true)
      })

      it('should get user of federation server environment on lookup', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const chewbaccaHashes = allPeppers.map((pepper) =>
          hash.sha256(`chewbacca@example.com email ${pepper}`)
        )

        const matrixAddresses = new Set<string>()
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${tokens.federationToken}`)
            .send({
              algorithm: hashDetails.algorithms[0],
              pepper: allPeppers[i],
              addresses: [chewbaccaHashes[i]]
            })
          expect(response.body).toHaveProperty('inactive_mappings', {})
          expect(response.body).toHaveProperty('third_party_mappings', {})
          expect(response.body).toHaveProperty('mappings')
          Object.values(
            response.body.mappings as Record<string, string>
          ).forEach((address) => matrixAddresses.add(address))
        }
        expect(matrixAddresses.size).toEqual(1)
        expect(matrixAddresses.has('@chewbacca:example.com')).toEqual(true)
      })

      it('should not find user from not trusted identity server on lookup', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const okenobiHashes = allPeppers.map((pepper) =>
          hash.sha256(`okenobi@example.com email ${pepper}`)
        )
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${tokens.federationToken}`)
            .send({
              algorithm: hashDetails.algorithms[0],
              pepper: allPeppers[i],
              addresses: [okenobiHashes[i]]
            })
          expect(response.body).toHaveProperty('inactive_mappings', {})
          expect(response.body).toHaveProperty('third_party_mappings', {})
          expect(response.body).toHaveProperty('mappings', {})
        }
      })

      it('should not find user not connected on any matrix server on lookup', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const qjinnHashes = allPeppers.map((pepper) =>
          hash.sha256(`qjinn@example.com email ${pepper}`)
        )
        for (let i = 0; i < allPeppers.length; i++) {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${tokens.federationToken}`)
            .send({
              algorithm: hashDetails.algorithms[0],
              pepper: allPeppers[i],
              addresses: [qjinnHashes[i]]
            })
          expect(response.body).toHaveProperty('inactive_mappings', {})
          expect(response.body).toHaveProperty('third_party_mappings', {})
          expect(response.body).toHaveProperty('mappings', {})
        }
      })

      it('should find all federation users and servers address of third party users on lookup', async () => {
        hashDetails = await getHashDetails()
        allPeppers = getAllPeppers(hashDetails)
        const lskywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`lskywalker@example.com email ${pepper}`)
        )
        const chewbaccaHashes = allPeppers.map((pepper) =>
          hash.sha256(`chewbacca@example.com email ${pepper}`)
        )
        const qjinnHashes = allPeppers.map((pepper) =>
          hash.sha256(`qjinn@example.com email ${pepper}`)
        )
        const okenobiHashes = allPeppers.map((pepper) =>
          hash.sha256(`okenobi@example.com email ${pepper}`)
        )
        const askywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`askywalker@example.com email ${pepper}`)
        )

        const matrixAddresses = new Set<string>()
        const askywalkerHosts = new Set<string>()
        const lskywalkerHosts = new Set<string>()

        for (let i = 0; i < allPeppers.length; i++) {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${tokens.federationToken}`)
            .send({
              algorithm: hashDetails.algorithms[0],
              pepper: allPeppers[i],
              addresses: [
                lskywalkerHashes[i],
                qjinnHashes[i],
                chewbaccaHashes[i],
                okenobiHashes[i],
                askywalkerHashes[i]
              ]
            })
          expect(response.body).toHaveProperty('inactive_mappings', {})
          expect(response.body).toHaveProperty('mappings')
          Object.values(
            response.body.mappings as Record<string, string>
          ).forEach((address) => matrixAddresses.add(address))
          expect(response.body).toHaveProperty('third_party_mappings')
          Object.keys(response.body.third_party_mappings).forEach((host) => {
            Object.keys(
              response.body.third_party_mappings[host] as Record<
                string,
                string[]
              >
            ).forEach((key) => {
              ;(
                response.body.third_party_mappings[host] as Record<
                  string,
                  string[]
                >
              )[key].forEach((hash) => {
                switch (hash) {
                  case lskywalkerHashes[i]:
                    lskywalkerHosts.add(host)
                    break
                  case askywalkerHashes[i]:
                    askywalkerHosts.add(host)
                    break
                  default:
                    break
                }
              })
            })
          })
        }
        expect(askywalkerHosts.size).toEqual(1)
        expect(askywalkerHosts.has('identity1.example.com:443')).toEqual(true)
        expect(lskywalkerHosts.size).toEqual(2)
        expect(lskywalkerHosts.has('identity1.example.com:443')).toEqual(true)
        expect(lskywalkerHosts.has('identity2.example.com:443')).toEqual(true)
        expect(matrixAddresses.size).toEqual(1)
        expect(matrixAddresses.has('@chewbacca:example.com')).toEqual(true)
      })
    })
  })

  describe('Mock tests', () => {
    let federationServer: FederationServer
    let app: express.Application
    let expressFederationServer: http.Server
    const trustedIpAddress = '192.168.1.1'
    const trustedIpv6Address = '2001:db8:3333:4444:5555:6666:7777:8888'
    const trustedNetwork = '192.168.200.4/30'
    const testConfig = {
      ...(defaultConfig as Partial<Config>),
      additional_features: true,
      cron_service: true,
      trusted_servers_addresses: [
        trustedIpAddress,
        trustedNetwork,
        trustedIpv6Address
      ]
    }

    const stopFederationServer = (
      done: jest.DoneCallback,
      filesToDelete = [
        path.join(pathToTestDataFolder, 'database.db'),
        path.join(pathToTestDataFolder, 'matrix.db'),
        path.join(pathToTestDataFolder, 'user.db')
      ]
    ): void => {
      filesToDelete.forEach((path: string) => {
        if (fs.existsSync(path)) fs.unlinkSync(path)
      })
      if (federationServer != null) federationServer.cleanJobs()
      if (expressFederationServer != null) {
        expressFederationServer.close((e) => {
          if (e != null) {
            done(e)
          }
          done()
        })
      } else {
        done()
      }
    }

    beforeAll((done) => {
      Promise.all([
        buildUserDB(testConfig as Config),
        buildMatrixDb(testConfig as Config)
      ])
        // eslint-disable-next-line @typescript-eslint/promise-function-async
        .then(() => {
          done()
        })
        .catch((e) => {
          done(e)
        })
    })

    afterAll((done) => {
      stopFederationServer(done)
    })

    beforeEach(() => {
      jest.restoreAllMocks()
    })

    describe('Working cases', () => {
      let hashDetails: IHashDetails
      let allPeppers: string[]
      let askywalkerHashes: string[]
      let lskywalkerHashes: string[]
      let okenobiHashes: string[]
      let lorganaHashes: string[]
      let chewbaccaHashes: string[]
      let qjinnHashes: string[]

      const setFederationServerDataAndRoutes = async (): Promise<void> => {
        await new Promise<void>((resolve, _reject) =>
          setTimeout(() => {
            resolve()
          }, 16000)
        ) // wait to set previousPepper in db
        await federationServer.db.insert('accessTokens', {
          id: authToken,
          data: '{"sub": "@test:example.com"}'
        })
        await new Promise<void>((resolve, _reject) => {
          app.use(federationServer.routes)
          expressFederationServer = app.listen(3000, () => {
            resolve()
          })
        })
      }

      const pushHashesToFederationServer = async (): Promise<void> => {
        const response = await request(app)
          .get('/_matrix/identity/v2/hash_details')
          .set('Accept', 'application/json')
          .set('Authorization', `Bearer ${authToken}`)

        hashDetails = response.body as IHashDetails

        allPeppers = [
          hashDetails.lookup_pepper,
          ...(hashDetails.alt_lookup_peppers ?? [])
        ]

        askywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`askywalker@example.com email ${pepper}`)
        )
        lskywalkerHashes = allPeppers.map((pepper) =>
          hash.sha256(`lskywalker@example.com email ${pepper}`)
        )
        lorganaHashes = allPeppers.map((pepper) =>
          hash.sha256(`lorgana@example.com email ${pepper}`)
        )
        okenobiHashes = allPeppers.map((pepper) =>
          hash.sha256(`okenobi@example.com email ${pepper}`)
        )

        chewbaccaHashes = allPeppers.map((pepper) =>
          hash.sha256(`chewbacca@example.com email ${pepper}`)
        )

        qjinnHashes = allPeppers.map((pepper) =>
          hash.sha256(`qjinn@example.com email ${pepper}`)
        )

        const pamidalaHashes = allPeppers.map((pepper) =>
          hash.sha256(`pamidala@example.com email ${pepper}`)
        )

        await Promise.all([
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          ...askywalkerHashes.map((askywalkerHash, index) =>
            request(app)
              .post('/_matrix/identity/v2/lookups')
              .set('Accept', 'application/json')
              .set('X-forwarded-for', trustedIpAddress)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[index],
                mappings: {
                  'identity1.example.com:8448': [
                    {
                      hash: askywalkerHash,
                      active: 1
                    }
                  ]
                }
              })
          ),
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          ...lskywalkerHashes.map((lskywalkerHash, index) =>
            request(app)
              .post('/_matrix/identity/v2/lookups')
              .set('Accept', 'application/json')
              .set('X-forwarded-for', '192.168.200.5')
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[index],
                mappings: {
                  'identity2.example.com:443': [
                    {
                      hash: lskywalkerHash,
                      active: 1
                    }
                  ]
                }
              })
          ),
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          ...lorganaHashes.map((lorganaHash, index) =>
            request(app)
              .post('/_matrix/identity/v2/lookups')
              .set('Accept', 'application/json')
              .set('X-forwarded-for', trustedIpv6Address)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[index],
                mappings: {
                  'identity3.example.com:8448': [
                    {
                      hash: lorganaHash,
                      active: 1
                    },
                    {
                      hash: pamidalaHashes[index],
                      active: 0
                    }
                  ]
                }
              })
          ),
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          ...okenobiHashes.map((okenobiHash, index) =>
            request(app)
              .post('/_matrix/identity/v2/lookups')
              .set('Accept', 'application/json')
              .set('X-forwarded-for', 'falsy_ip_address')
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[index],
                mappings: {
                  'identity4.example.com:443': [
                    {
                      hash: okenobiHash,
                      active: 1
                    }
                  ]
                }
              })
          )
        ])
      }

      describe('Use environment variables', () => {
        const {
          trust_x_forwarded_for: trustXForwardedFor,
          trusted_servers_addresses: trustedServersAddresses,
          ...mIdentityServerConfig
        } = testConfig

        beforeAll((done) => {
          process.env.TRUSTED_SERVERS_ADDRESSES = trustedServersAddresses
            .join(',')
            .concat(',invalid_ip')
          process.env.TRUST_X_FORWARDED_FOR = String(trustXForwardedFor)
          federationServer = new FederationServer(mIdentityServerConfig)
          app = express()
          federationServer.ready
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then(() => setFederationServerDataAndRoutes())
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then(() => pushHashesToFederationServer())
            .then(() => {
              done()
            })
            .catch((e) => {
              done(e)
            })
        })

        afterAll((done) => {
          delete process.env.TRUSTED_SERVERS_ADDRESSES
          delete process.env.TRUST_X_FORWARDED_FOR
          stopFederationServer(done, [
            path.join(pathToTestDataFolder, 'database.db')
          ])
        })

        it('should get server in which third party user is registered on lookup', async () => {
          const hosts = new Set<string>()
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [lskywalkerHashes[i]]
              })
            expect(response.body).toHaveProperty('mappings', {})
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings')
            Object.keys(response.body.third_party_mappings).forEach((host) =>
              hosts.add(host)
            )
          }
          expect(hosts.size).toEqual(1)
          expect(hosts.has('identity2.example.com:443')).toEqual(true)
        })

        it('should get user of federation server environment on lookup', async () => {
          const matrixAddresses = new Set<string>()
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [chewbaccaHashes[i]]
              })
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings', {})
            expect(response.body).toHaveProperty('mappings')
            Object.values(
              response.body.mappings as Record<string, string>
            ).forEach((address) => matrixAddresses.add(address))
          }
          expect(matrixAddresses.size).toEqual(1)
          expect(matrixAddresses.has('@chewbacca:example.com')).toEqual(true)
        })

        it('should not find user from not trusted identity server on lookup', async () => {
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [okenobiHashes[i]]
              })
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings', {})
            expect(response.body).toHaveProperty('mappings', {})
          }
        })

        it('should not find user not connected on any matrix server on lookup', async () => {
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [qjinnHashes[i]]
              })
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings', {})
            expect(response.body).toHaveProperty('mappings', {})
          }
        })

        it('should find all servers on which a third party user is connected on lookup', async () => {
          await Promise.all(
            allPeppers.map(async (pepper, i) => {
              await request(app)
                .post('/_matrix/identity/v2/lookups')
                .set('Accept', 'application/json')
                .set('X-forwarded-for', trustedIpAddress)
                .send({
                  algorithm: hashDetails.algorithms[0],
                  pepper,
                  mappings: {
                    'identity1.example.com:8448': [
                      {
                        hash: lskywalkerHashes[i],
                        active: 1
                      },
                      {
                        hash: askywalkerHashes[i],
                        active: 1
                      }
                    ]
                  }
                })
            })
          )

          const hosts = new Set<string>()
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [lskywalkerHashes[i]]
              })
            expect(response.body).toHaveProperty('mappings', {})
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings')
            Object.keys(response.body.third_party_mappings).forEach((host) =>
              hosts.add(host)
            )
          }
          expect(hosts.size).toEqual(2)
          expect(hosts.has('identity1.example.com:8448')).toEqual(true)
          expect(hosts.has('identity2.example.com:443')).toEqual(true)
        })

        it('should find all federation users and servers address of third party users on lookup', async () => {
          const matrixAddresses = new Set<string>()
          const askywalkerHosts = new Set<string>()
          const lskywalkerHosts = new Set<string>()
          const lorganaHosts = new Set<string>()

          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: hashDetails.lookup_pepper,
                addresses: [
                  lskywalkerHashes[i],
                  lorganaHashes[i],
                  chewbaccaHashes[i],
                  qjinnHashes[i],
                  okenobiHashes[i],
                  askywalkerHashes[i]
                ]
              })
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('mappings')
            Object.values(
              response.body.mappings as Record<string, string>
            ).forEach((address) => matrixAddresses.add(address))
            expect(response.body).toHaveProperty('third_party_mappings')
            Object.keys(response.body.third_party_mappings).forEach((host) => {
              Object.keys(
                response.body.third_party_mappings[host] as Record<
                  string,
                  string[]
                >
              ).forEach((key) => {
                ;(
                  response.body.third_party_mappings[host] as Record<
                    string,
                    string[]
                  >
                )[key].forEach((hash) => {
                  switch (hash) {
                    case lskywalkerHashes[i]:
                      lskywalkerHosts.add(host)
                      break
                    case askywalkerHashes[i]:
                      askywalkerHosts.add(host)
                      break
                    case lorganaHashes[i]:
                      lorganaHosts.add(host)
                      break
                    default:
                      break
                  }
                })
              })
            })
          }
          expect(askywalkerHosts.size).toEqual(1)
          expect(askywalkerHosts.has('identity1.example.com:8448')).toEqual(
            true
          )
          expect(lskywalkerHosts.size).toEqual(2)
          expect(lskywalkerHosts.has('identity1.example.com:8448')).toEqual(
            true
          )
          expect(lskywalkerHosts.has('identity2.example.com:443')).toEqual(true)
          expect(lorganaHosts.size).toEqual(1)
          expect(lorganaHosts.has('identity3.example.com:8448')).toEqual(true)
          expect(matrixAddresses.size).toEqual(1)
          expect(matrixAddresses.has('@chewbacca:example.com')).toEqual(true)
        })
      })

      describe('Use JSON configuration object', () => {
        beforeAll((done) => {
          federationServer = new FederationServer(testConfig)
          app = express()
          federationServer.ready
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then(() => setFederationServerDataAndRoutes())
            // eslint-disable-next-line @typescript-eslint/promise-function-async
            .then(() => pushHashesToFederationServer())
            .then(() => {
              done()
            })
            .catch((e) => {
              done(e)
            })
        })

        it('should get server in which third party user is registered on lookup', async () => {
          const hosts = new Set<string>()
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [lskywalkerHashes[i]]
              })
            expect(response.body).toHaveProperty('mappings', {})
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings')
            Object.keys(response.body.third_party_mappings).forEach((host) =>
              hosts.add(host)
            )
          }
          expect(hosts.size).toEqual(1)
          expect(hosts.has('identity2.example.com:443')).toEqual(true)
        })

        it('should get user of federation server environment on lookup', async () => {
          const matrixAddresses = new Set<string>()
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [chewbaccaHashes[i]]
              })
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings', {})
            expect(response.body).toHaveProperty('mappings')
            Object.values(
              response.body.mappings as Record<string, string>
            ).forEach((address) => matrixAddresses.add(address))
          }
          expect(matrixAddresses.size).toEqual(1)
          expect(matrixAddresses.has('@chewbacca:example.com')).toEqual(true)
        })

        it('should not find user from not trusted identity server on lookup', async () => {
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [okenobiHashes[i]]
              })
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings', {})
            expect(response.body).toHaveProperty('mappings', {})
          }
        })

        it('should not find user not connected on any matrix server on lookup', async () => {
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [qjinnHashes[i]]
              })
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings', {})
            expect(response.body).toHaveProperty('mappings', {})
          }
        })

        it('should find all servers on which a third party user is connected on lookup', async () => {
          await Promise.all(
            allPeppers.map(async (pepper, i) => {
              await request(app)
                .post('/_matrix/identity/v2/lookups')
                .set('Accept', 'application/json')
                .set('X-forwarded-for', trustedIpAddress)
                .send({
                  algorithm: hashDetails.algorithms[0],
                  pepper,
                  mappings: {
                    'identity1.example.com:8448': [
                      {
                        hash: lskywalkerHashes[i],
                        active: 1
                      },
                      {
                        hash: askywalkerHashes[i],
                        active: 1
                      }
                    ]
                  }
                })
            })
          )

          const hosts = new Set<string>()
          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: allPeppers[i],
                addresses: [lskywalkerHashes[i]]
              })
            expect(response.body).toHaveProperty('mappings', {})
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('third_party_mappings')
            Object.keys(response.body.third_party_mappings).forEach((host) =>
              hosts.add(host)
            )
          }
          expect(hosts.size).toEqual(2)
          expect(hosts.has('identity1.example.com:8448')).toEqual(true)
          expect(hosts.has('identity2.example.com:443')).toEqual(true)
        })

        it('should find all federation users and servers address of third party users on lookup', async () => {
          const matrixAddresses = new Set<string>()
          const askywalkerHosts = new Set<string>()
          const lskywalkerHosts = new Set<string>()
          const lorganaHosts = new Set<string>()

          for (let i = 0; i < allPeppers.length; i++) {
            const response = await request(app)
              .post('/_matrix/identity/v2/lookup')
              .set('Accept', 'application/json')
              .set('Authorization', `Bearer ${authToken}`)
              .send({
                algorithm: hashDetails.algorithms[0],
                pepper: hashDetails.lookup_pepper,
                addresses: [
                  lskywalkerHashes[i],
                  lorganaHashes[i],
                  chewbaccaHashes[i],
                  qjinnHashes[i],
                  okenobiHashes[i],
                  askywalkerHashes[i]
                ]
              })
            expect(response.body).toHaveProperty('inactive_mappings', {})
            expect(response.body).toHaveProperty('mappings')
            Object.values(
              response.body.mappings as Record<string, string>
            ).forEach((address) => matrixAddresses.add(address))
            expect(response.body).toHaveProperty('third_party_mappings')
            Object.keys(response.body.third_party_mappings).forEach((host) => {
              Object.keys(
                response.body.third_party_mappings[host] as Record<
                  string,
                  string[]
                >
              ).forEach((key) => {
                ;(
                  response.body.third_party_mappings[host] as Record<
                    string,
                    string[]
                  >
                )[key].forEach((hash) => {
                  switch (hash) {
                    case lskywalkerHashes[i]:
                      lskywalkerHosts.add(host)
                      break
                    case askywalkerHashes[i]:
                      askywalkerHosts.add(host)
                      break
                    case lorganaHashes[i]:
                      lorganaHosts.add(host)
                      break
                    default:
                      break
                  }
                })
              })
            })
          }
          expect(askywalkerHosts.size).toEqual(1)
          expect(askywalkerHosts.has('identity1.example.com:8448')).toEqual(
            true
          )
          expect(lskywalkerHosts.size).toEqual(2)
          expect(lskywalkerHosts.has('identity1.example.com:8448')).toEqual(
            true
          )
          expect(lskywalkerHosts.has('identity2.example.com:443')).toEqual(true)
          expect(lorganaHosts.size).toEqual(1)
          expect(lorganaHosts.has('identity3.example.com:8448')).toEqual(true)
          expect(matrixAddresses.size).toEqual(1)
          expect(matrixAddresses.has('@chewbacca:example.com')).toEqual(true)
        })
      })
    })

    describe('Error cases', () => {
      const errorMessage = 'error message'

      it('reject unimplemented endpoint with 404', async () => {
        const response = await request(app).get('/unkown')
        expect(response.statusCode).toBe(404)
        expect(JSON.stringify(response.body)).toEqual(
          JSON.stringify({ errcode: 'M_NOT_FOUND', error: 'Not Found' })
        )
      })

      describe('Lookup endpoint', () => {
        it('reject not allowed method with 405 status code', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)

          expect(response.statusCode).toBe(405)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNRECOGNIZED',
              error: 'Unrecognized'
            })
          )
        })

        it('should send an error if auth token is invalid', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', 'falsy_token')
            .send({
              addresse: [],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNAUTHORIZED',
              error: 'Unauthorized'
            })
          )
        })

        it('should send an error if auth token is not in accessTokens table', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken.replace('a', 'f')}`)
            .send({
              addresse: [],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNAUTHORIZED',
              error: 'Unauthorized'
            })
          )
        })

        it('should send an error if token data in accessTokens table does not contain "sub" field', async () => {
          jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValue([{ data: JSON.stringify({}) }])

          const jsonParseSpy = jest.spyOn(JSON, 'parse')

          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresse: [],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(jsonParseSpy).toHaveBeenNthCalledWith(2, '{}')
          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNAUTHORIZED',
              error: 'Unauthorized'
            })
          )
        })

        it('should send an error if "algorithm" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [],
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: algorithm)'
            })
          )
        })

        it('should send an error if "algorithm" is not a string', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [],
              algorithm: 2,
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: algorithm)'
            })
          )
        })

        it('should send an error if "pepper" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [],
              algorithm: 'sha256'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: pepper)'
            })
          )
        })

        it('should send an error if "pepper" is not a string', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [],
              algorithm: 'sha256',
              pepper: 2
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: pepper)'
            })
          )
        })

        it('should send an error if "addresses" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: addresses)'
            })
          )
        })

        it('should send an error if "addresses" is not a string array', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: 2,
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: addresses)'
            })
          )
        })

        it('should send an error if one address is not a string', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: [
                '@dwho:example.com',
                '@rtyler:example.com',
                2,
                '@msmith:example.com'
              ],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error:
                'Error field: One of the address is not a string (property: addresses)'
            })
          )
        })

        it('should send an error if getting hashes from db fails', async () => {
          jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([
              { data: JSON.stringify({ sub: '@test:example.com' }) }
            ])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: ['@dwho:example.com', '@rtyler:example.com'],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })

        it('should send an error if getting hashes from hashes table fails', async () => {
          const dbGetSpy = jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([
              { data: JSON.stringify({ sub: '@test:example.com' }) }
            ])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: ['@dwho:example.com', '@rtyler:example.com'],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(dbGetSpy).toHaveBeenCalledTimes(2)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })

        it('should send an error if getting hashes from hashbyserver table fails', async () => {
          const dbGetSpy = jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([
              { data: JSON.stringify({ sub: '@test:example.com' }) }
            ])
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookup')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              addresses: ['@dwho:example.com', '@rtyler:example.com'],
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(dbGetSpy).toHaveBeenCalledTimes(3)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })
      })

      describe('Lookups endpoint', () => {
        it('reject not allowed method with 405 status code', async () => {
          const response = await request(app)
            .get('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)

          expect(response.statusCode).toBe(405)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNRECOGNIZED',
              error: 'Unrecognized'
            })
          )
        })

        it('should send an error if requester ip does not belong to trusted ip addresses', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', '192.168.1.25')
            .send({
              mappings: {},
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNAUTHORIZED',
              error: 'Unauthorized'
            })
          )
        })

        it('should send an error if requester ip is not a valid address', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', 'falsy_ip_address')
            .send({
              mappings: {},
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(401)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNAUTHORIZED',
              error: 'Unauthorized'
            })
          )
        })

        it('should send an error if "pepper" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: { 'test.example.com': [] },
              algorithm: 'sha256'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: pepper)'
            })
          )
        })

        it('should send an error if "pepper" is not a string', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: { 'test.example.com': [] },
              algorithm: 'sha256',
              pepper: 2
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: pepper)'
            })
          )
        })

        it('should send an error if "mappings" is not in body', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: mappings)'
            })
          )
        })

        it('should send an error if "mappings" is not an object', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: 2,
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error: 'Error field: Invalid value (property: mappings)'
            })
          )
        })

        it('should send an error if "mappings" contains more than one server hostname', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: { 'test.example.com': [], 'test2.example.com': [] },
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(response.statusCode).toEqual(400)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_INVALID_PARAM',
              error:
                'Error field: Only one server address is allowed (property: mappings)'
            })
          )
        })

        it('should send an error if getting pepper in hashbyserver table fails', async () => {
          const getPeppersSpy = jest
            .spyOn(federationServer.db, 'get')
            .mockRejectedValue(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: { 'test.example.com': [] },
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(getPeppersSpy).toHaveBeenCalledTimes(1)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })

        it('should send an error if getting pepper in keys table fails', async () => {
          const getPeppersSpy = jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([{ pepper: 'matrixrocks' }])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: { 'test.example.com': [] },
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(getPeppersSpy).toHaveBeenCalledTimes(2)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })

        it('should send an error if deleting hashes in hashbyserver table fails', async () => {
          const deleteWhereSpy = jest
            .spyOn(federationServer.db, 'deleteWhere')
            .mockRejectedValue(new Error(errorMessage))

          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: { 'test.example.com': [] },
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(deleteWhereSpy).toHaveBeenCalledTimes(1)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })

        it('should send an error if inserting hashes in hashbyserver table fails', async () => {
          const insertSpyOn = jest
            .spyOn(federationServer.db, 'insert')
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([])
            .mockRejectedValueOnce(new Error(errorMessage))
            .mockResolvedValueOnce([])

          const response = await request(app)
            .post('/_matrix/identity/v2/lookups')
            .set('Accept', 'application/json')
            .set('X-forwarded-for', trustedIpAddress)
            .send({
              mappings: {
                'test.example.com': ['test1', 'test2', 'test3', 'test4']
              },
              algorithm: 'sha256',
              pepper: 'test_pepper'
            })

          expect(insertSpyOn).toHaveBeenCalledTimes(4)
          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })
      })

      describe('Hash_details endpoint', () => {
        it('reject not allowed method with 405 status code', async () => {
          const response = await request(app)
            .post('/_matrix/identity/v2/hash_details')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)

          expect(response.statusCode).toBe(405)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNRECOGNIZED',
              error: 'Unrecognized'
            })
          )
        })

        it('should send an error if deleting hashes in hashbyserver table fails', async () => {
          jest
            .spyOn(federationServer.db, 'get')
            .mockResolvedValueOnce([
              { data: JSON.stringify({ sub: '@test:example.com' }) }
            ])
            .mockRejectedValueOnce(new Error(errorMessage))

          const response = await request(app)
            .get('/_matrix/identity/v2/hash_details')
            .set('Accept', 'application/json')
            .set('Authorization', `Bearer ${authToken}`)

          expect(response.statusCode).toEqual(500)
          expect(JSON.stringify(response.body)).toEqual(
            JSON.stringify({
              errcode: 'M_UNKNOWN',
              error: `Error: ${errorMessage}`
            })
          )
        })
      })
    })
  })
})
