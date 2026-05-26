import type { TwakeLogger } from "@twake/logger";

import type { DatabaseConfig, DbGetResult } from "../types";
import type { PgDatabase } from "./pg";
import type { SQLiteDatabase } from "./sqlite";

export type CreateDbMethod<T extends string> = (
  conf: DatabaseConfig,
  tables: Record<T, string>,
  indexes: Partial<Record<T, string[]>>,
  initializeValues: Partial<Record<T, Array<Record<string, string | number>>>>,
) => Promise<void>;

abstract class SQL<T extends string> {
  db?: SQLiteDatabase | PgDatabase;
  ready: Promise<void>;
  cleanJob?: NodeJS.Timeout;
  protected readonly logger: TwakeLogger;

  constructor(
    conf: DatabaseConfig,
    logger: TwakeLogger,
    tables?: Record<T, string>,
    indexes?: Partial<Record<T, string[]>>,
    initializeValues?: Partial<Record<T, Array<Record<string, string | number>>>>,
  ) {
    this.logger = logger;
    // @ts-expect-error method is defined in child class
    this.ready = this.createDatabases(conf, tables, indexes, initializeValues, this.logger);
  }

  getCount(table: T, field: string, value?: string | number | string[]): Promise<number> {
    return new Promise((resolve, reject) => {
      const args: unknown[] = [table, [`count(${field}) as count`]];
      if (value !== null && value !== undefined) args.push({ [field]: value });
      // @ts-expect-error implemented later
      this.get(...args)
        .then((rows: Array<Record<string, string>>) => {
          resolve(parseInt(rows[0].count, 10));
        })
        .catch((e: unknown) => {
          /* istanbul ignore next */
          reject(e);
        });
    });
  }

  getAll(table: T, fields: string[], order?: string): Promise<DbGetResult> {
    // @ts-expect-error implemented later
    return this.get(table, fields, undefined, order);
  }
}

export default SQL;
