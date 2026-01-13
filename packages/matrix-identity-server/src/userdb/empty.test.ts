import { getLogger, type TwakeLogger } from '@twake-chat/logger'
import defaultConfig from '../config.json'
import UserDBEmpty from './empty'

const logger: TwakeLogger = getLogger()

describe('Empty user DB', () => {
  let userDB: UserDBEmpty

  afterAll(() => {
    userDB.close()
    logger.close()
  })

  it('should return result', (done) => {
    userDB = new UserDBEmpty(
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
