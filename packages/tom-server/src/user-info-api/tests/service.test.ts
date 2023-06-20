import type { NextFunction, Request, Response } from 'express'
import ldap from 'ldapjs'
import type { Config } from '../../types'
import { userDB as UserDB } from '@twake/matrix-identity-server'
import UserInfoService from '../services'
import type { UserInformation } from '../types'

const server = ldap.createServer()

interface FilterRequest extends Request {
  filter: ldap.Filter
  dn: string
}

const config = {
  userdb_engine: 'ldap',
  ldap_uri: 'ldap://localhost:63389',
  ldap_base: 'ou=users,o=example'
}

beforeAll((done) => {
  server.search(
    'ou=users, o=example',
    (req: FilterRequest, res: Response, _next: NextFunction) => {
      const obj = {
        dn: req.dn.toString(),
        attributes: {
          objectclass: ['inetOrgPerson'],
          uid: 'dwho',
          cn: 'David Who',
          sn: 'Who',
          givenName: 'David'
        }
      }

      if (req.filter.matches(obj.attributes)) {
        res.send(obj)
      }

      res.end()
    }
  )

  server.listen(63389, 'localhost', done)
})

afterAll((done) => {
  server.close(done)
})

describe('user info service', () => {
  it('should return the user info', async () => {
    const userDb = new UserDB(config as Config)
    await userDb.ready
    const service = new UserInfoService(userDb)
    const user = await service.get('dwho')

    expect(user).toEqual({
      givenName: 'David',
      uid: 'dwho',
      sn: 'Who'
    } satisfies UserInformation)
  })
})
