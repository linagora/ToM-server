import ldapjs from 'ldapjs'
import UserDBLDAP from './ldap'
import defaultConfig from '../config.json'

const server = ldapjs.createServer()

beforeAll(done => {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
  // @ts-ignore
  server.search('ou=users, o=example', (req, res, next) => {
    const obj = {
      dn: req.dn.toString(),
      attributes: {
        objectclass: ['inetOrgPerson'],
        uid: 'dwho'
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
  // server.removeAllListeners()
  server.close(() => { done() })
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
    userDB.get('', [], 'uid', 'dwho').then(list => {
      expect(list[0].dn).toBe('ou=users,o=example')
      // userDB.client.destroy()
      userDB.get('', ['uid'], 'uid', 'dwho').then(list => {
        expect(list[0]).toEqual({ uid: 'dwho' })
        userDB.get('', [], 'uid', 'zz').then(list => {
          done('zz does not exist')
        }).catch(e => {
          userDB.client.destroy()
          done()
        })
      }).catch(e => done(e))
    }).catch(e => done(e))
  })
})
