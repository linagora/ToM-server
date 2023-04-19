import { recoveryWords, type ITableDetail } from '../utils'

export interface ISQLTableDetail extends ITableDetail {
  columns: Record<string, string>
}

export const recoveryWordsSQL: ISQLTableDetail = {
  ...recoveryWords,
  columns: {
    userId: 'userId TEXT PRIMARY KEY NOT NULL',
    words: 'words TEXT NOT NULL'
  }
}
