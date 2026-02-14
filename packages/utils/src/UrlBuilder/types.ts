/**
 * Supported types for query parameter values
 */
export type QueryValue = string | number | boolean | null | undefined
export type QueryParams = Record<string, QueryValue | QueryValue[]>

/**
 * Options for URL building
 */
export interface UrlOptions {
  preserveFragment?: boolean
}
