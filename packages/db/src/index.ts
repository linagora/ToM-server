// Main Database class
export { default } from './database'
export { default as Database } from './database'

// SQL adapters
export { default as Pg } from './sql/pg'
export { default as SQLite } from './sql/sqlite'

// Utilities
export { default as createTables } from './sql/_createTables'

// Types
export type {
  SupportedDatabases,
  DatabaseConfig,
  DbGetResult,
  SqlComparaisonOperator,
  ISQLCondition,
  DbBackend
} from './types'

// Re-export adapter database types
export type { PgDatabase } from './sql/pg'
export type { SQLiteDatabase, SQLiteStatement } from './sql/sqlite'
