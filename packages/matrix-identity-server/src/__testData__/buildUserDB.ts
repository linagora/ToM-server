import { type Config } from '..'
import UserDB from '../userdb'

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildUserDB = (conf: Config): Promise<void> => {
  const userDb = new UserDB(conf)
  return new Promise((resolve, reject) => {
    userDb.ready.then(() => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
      // @ts-ignore same
      userDb.db.db.run('CREATE TABLE users (uid varchar(8), phone varchar(12), email varchar(32))', () => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore same
        userDb.db.db.run("INSERT INTO users VALUES('dwho', '33612345678', 'dwho@company.com')", () => {
          resolve()
        })
      })
    }).catch(e => {
      /* istanbul ignore next */
      reject(e)
    })
  })
}

export default buildUserDB
