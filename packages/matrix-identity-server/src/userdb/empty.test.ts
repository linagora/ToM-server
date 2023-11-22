import UserDBEmpty from './empty'
import { logger } from '../../jest.globals'
import defaultConfig from '../config.json'

describe('Empty user DB', () => {
  it('should return result', (done) => {
    const userDB = new UserDBEmpty(
      {
        ...defaultConfig,
        database_engine: 'sqlite',
        userdb_engine: ''
      },
      logger
    )
    userDB.ready
      .then(() => {
        userDB
          .get('', ['uid'], { uid: 'dwho' })
          .then((list) => {
            expect(list).toHaveLength(0)
            userDB
              .match('', ['uid'], { uid: 'dwho' })
              .then((list) => {
                expect(list).toHaveLength(0)
                userDB
                  .getAll('', ['uid'], { uid: 'dwho' })
                  .then((list) => {
                    expect(list).toHaveLength(0)
                    done()
                  })
                  .catch(done)
              })
              .catch(done)
          })
          .catch(done)
      })
      .catch(done)
  })
})
