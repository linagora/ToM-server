import ldapjs from 'ldapjs'
import defaultConfig from '../config.json'
import UserDBLDAP from './ldap'

const server = ldapjs.createServer()

beforeAll((done) => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
  // @ts-ignore
  server.search('ou=users, o=example', (req, res, next) => {
    const obj = {
      dn: req.dn.toString(),
      attributes: {
        objectclass: ['inetOrgPerson'],
        uid: 'dwho',
        sn: 'doctor'
      }
    }
    // eslint-disable-next-line @typescript-eslint/strict-boolean-expressions
    if (req.filter.matches(obj.attributes)) {
      res.send(obj)
    }
    res.end()
  })
  server.listen(63389, 'localhost', () => {
    done()
  })
})

afterAll((done) => {
  server.close(() => {
    done()
  })
})

describe('LDAP', () => {
  it('should return result', (done) => {
    const userDB = new UserDBLDAP({
      ...defaultConfig,
      database_engine: 'sqlite',
      userdb_engine: 'sqlite',
      ldap_uri: 'ldap://localhost:63389',
      ldap_base: 'ou=users,o=example'
    })
    userDB.ready
      .then(() => {
        userDB
          .get('', [], { uid: 'dwho', sn: ['doctor'] })
          .then((list) => {
            expect(list[0].dn).toBe('ou=users,o=example')
            // userDB.client.destroy()
            userDB
              .get('', ['uid'], { uid: 'dwho' })
              .then((list) => {
                expect(list[0]).toEqual({ uid: 'dwho' })
                userDB
                  .get('', [], { uid: 'zz' })
                  .then((list) => {
                    done()
                  })
                  .catch((e) => {
                    done('ee')
                  })
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should display error message on connection error', async () => {
    const userDB = new UserDBLDAP({
      ...defaultConfig,
      database_engine: 'sqlite',
      userdb_engine: 'ldap',
      ldap_uri: 'ldap://falsy:63389',
      ldap_user: 'cn=admin',
      ldap_password: 'root',
      ldap_base: 'ou=users,o=example'
    })
    const loggerErrorSpy = jest.spyOn(userDB.logger, 'error')
    await userDB.ready
    expect(loggerErrorSpy).toHaveBeenCalled()
  })

  it('should provide match', (done) => {
    const userDB = new UserDBLDAP({
      ...defaultConfig,
      database_engine: 'sqlite',
      userdb_engine: 'sqlite',
      ldap_uri: 'ldap://localhost:63389',
      ldap_base: 'ou=users,o=example'
    })
    userDB.ready
      .then(() => {
        userDB
          .match('', ['uid'], ['uid'], 'wh')
          .then((list) => {
            expect(list[0]).toEqual({ uid: 'dwho' })
            done()
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should provide getAll', (done) => {
    const userDB = new UserDBLDAP({
      ...defaultConfig,
      database_engine: 'sqlite',
      userdb_engine: 'sqlite',
      ldap_uri: 'ldap://localhost:63389',
      ldap_base: 'ou=users,o=example'
    })
    userDB.ready
      .then(() => {
        userDB
          .getAll('', ['uid'])
          .then((list) => {
            expect(list[0]).toEqual({ uid: 'dwho' })
            done()
          })
          .catch(done)
      })
      .catch(done)
  })

  it('should provide getAll with order', (done) => {
    const userDB = new UserDBLDAP({
      ...defaultConfig,
      database_engine: 'sqlite',
      userdb_engine: 'sqlite',
      ldap_uri: 'ldap://localhost:63389',
      ldap_base: 'ou=users,o=example'
    })
    userDB.ready
      .then(() => {
        userDB
          .getAll('', ['uid'], 'uid')
          .then((list) => {
            expect(list[0]).toEqual({ uid: 'dwho' })
            done()
          })
          .catch(done)
      })
      .catch(done)
  })
})
