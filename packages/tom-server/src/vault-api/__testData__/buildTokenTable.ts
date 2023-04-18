import type VaultDb from '../db'
import { type tokenDetail } from '../middlewares/auth'

const token: tokenDetail = {
  value: 'accessTokenddddddddddddddddddddddddddddddddddddddddddddddddddddd',
  content: { sub: 'userId', epoch: 1 }
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
const buildTokenTable = (dbManager: VaultDb): Promise<void> => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore same
    dbManager.db.db.run(
      'CREATE TABLE accessTokens (id varchar(64) primary key, data text)',
      () =>
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
        // @ts-ignore same
        dbManager.db.db.run(
          `INSERT INTO accessTokens VALUES('${token.value}', '${JSON.stringify(
            token.content
          )}')`,
          () => {
            resolve()
          }
        )
    )
  })
}

export default buildTokenTable
