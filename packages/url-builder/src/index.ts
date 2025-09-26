import {
  InvalidPathError,
  InvalidUrlError,
  MissingArgumentError,
  UrlError
} from './errors'
import { QueryParams, QueryValue, UrlOptions } from './types'

/**
 * Builder class for constructing URLs with a fluent API
 */
export class UrlBuilder {
  private baseUrl: URL
  private pathSegments: string[] = []
  private queryParams = new URLSearchParams()
  private fragment?: string
  private options: Required<UrlOptions>

  /**
   * Creates a new UrlBuilder instance
   * @param base - The base URL (e.g., 'example.com' or 'https://example.com')
   * @param options - Optional configuration for URL building
   * @throws {MissingArgumentError} If the base URL is not provided
   * @throws {InvalidUrlError} If the base URL is invalid
   */
  constructor(base: string, options: UrlOptions = {}) {
    if (!base) {
      throw new MissingArgumentError('base')
    }

    this.options = {
      preserveFragment: options.preserveFragment ?? false
    }

    this.baseUrl = this.parseBaseUrl(base)

    this.baseUrl.searchParams.forEach((value, key) => {
      this.queryParams.append(key, value)
    })

    // TODO: preserveFragment
    // if (this.options.preserveFragment && this.baseUrl.hash) {
    //   this.fragment = this.baseUrl.hash.substring(1)
    // }

    if (this.baseUrl.pathname && this.baseUrl.pathname !== '/') {
      this.pathSegments = this.baseUrl.pathname.split('/').filter(Boolean)
    }
  }

  /**
   * Parses and validates the base URL
   */
  private parseBaseUrl(base: string): URL {
    try {
      return new URL(base)
    } catch (e) {
      throw new InvalidUrlError(base, e)
    }
  }

  /**
   * Adds a path segment or multiple segments to the URL
   * @param path - Path segment(s) to add (e.g., 'api/v1' or '/api/v1')
   * @returns The builder instance for chaining
   * @throws {InvalidPathError} If the path contains invalid patterns
   */
  path(path: string): this {
    if (path) {
      const sanitized = sanitizePath(path)

      if (sanitized) {
        const segments = sanitized.split('/').filter(Boolean)
        this.pathSegments.push(...segments)
      }
    }
    return this
  }

  /**
   * Adds multiple path segments
   * @param segments - Array of path segments to add
   * @returns The builder instance for chaining
   * @throws {InvalidPathError} If any path segment contains invalid patterns
   */
  paths(...segments: string[]): this {
    segments.forEach((segment) => {
      if (segment) {
        const sanitized = sanitizePath(segment)
        if (sanitized && !sanitized.startsWith('/')) {
          this.pathSegments.push(...sanitized.split('/').filter(Boolean))
        }
      }
    })
    return this
  }

  /**
   * Adds query parameters to the URL
   * @param params - Query parameters as key-value pairs
   * @returns The builder instance for chaining
   */
  query(params: QueryParams): this {
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined) {
        continue
      }

      if (Array.isArray(value)) {
        value.forEach((v) => {
          if (v !== null && v !== undefined) {
            this.queryParams.append(key, String(v))
          }
        })
      } else {
        this.queryParams.append(key, String(value))
      }
    }
    return this
  }

  /**
   * Sets a single query parameter
   * @param key - The parameter key
   * @param value - The parameter value
   * @returns The builder instance for chaining
   */
  param(key: string, value: QueryValue | QueryValue[]): this {
    return this.query({ [key]: value })
  }

  /**
   * Clears all query parameters
   * @returns The builder instance for chaining
   */
  clearQuery(): this {
    this.queryParams = new URLSearchParams()
    return this
  }

  /**
   * Sets the URL fragment (hash)
   * @param fragment - The fragment without the '#' prefix
   * @returns The builder instance for chaining
   */
  hash(fragment: string): this {
    this.fragment = fragment
    return this
  }

  /**
   * Builds and returns the final URL string
   * @returns The complete URL as a string
   */
  build(): string {
    const url = new URL(this.baseUrl)

    if (this.pathSegments.length > 0) {
      url.pathname = '/' + this.pathSegments.join('/')
    }

    this.queryParams.forEach((value, key) => {
      url.searchParams.append(key, value)
    })

    if (this.fragment) {
      url.hash = this.fragment
    }

    return url.toString()
  }

  /**
   * Creates a copy of the current builder
   * @returns A new UrlBuilder instance with the same state
   */
  clone(): UrlBuilder {
    const cloned = new UrlBuilder(this.baseUrl.origin, this.options)
    cloned.pathSegments = [...this.pathSegments]
    cloned.queryParams = new URLSearchParams(this.queryParams)
    cloned.fragment = this.fragment
    return cloned
  }

  /**
   * Returns the current URL as a string (alias for build())
   */
  toString(): string {
    return this.build()
  }
}

/**
 * Sanitizes and validates a path segment
 */
function sanitizePath(path: string): string {
  if (!path) return ''

  if (path.startsWith('//')) {
    throw new InvalidPathError(
      path,
      'Protocol-relative URLs are not allowed in paths'
    )
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) {
    throw new InvalidPathError(
      path,
      'URLs with protocols are not allowed in paths'
    )
  }

  return path
    .split('/')
    .filter(Boolean) // Removes empty path - e.g. //api/ -> [ "", "api" ] -> [ "api" ]
    .filter((s) => !s.match(/\.+/)) // Removes path traversial attempts
    .join('/')
}

/**
 * Builds a valid and safe URL by combining a base URL, a path, and optional query parameters.
 *
 * This is the improved version of the original function with better path handling and
 * null/undefined query parameter filtering.
 *
 * @param base - The base URL (e.g., 'example.com' or 'https://example.com'). Required.
 * @param path - The path to be appended (e.g., 'api/v1/data' or '/api/v1/data'). Optional.
 * @param query - Optional query parameters as a key-value object.
 * @returns The final, combined URL as a string.
 * @throws {MissingArgumentError} If the 'base' argument is not provided.
 * @throws {InvalidUrlError} If the base URL is invalid.
 * @throws {InvalidPathError} If the path contains invalid patterns.
 */
export const buildUrl = (
  base: string,
  path?: string,
  query?: QueryParams
): string => {
  if (path && query) return new UrlBuilder(base).path(path).query(query).build()
  else if (path && !query) return new UrlBuilder(base).path(path).build()
  else if (!path && query) return new UrlBuilder(base).query(query).build()
  return new UrlBuilder(base).build()
}

// Example usage:
/*
// Using the function
const url1 = buildUrl('example.com', 'api/v1/users', { limit: 10, active: true });
console.log(url1); // https://example.com/api/v1/users?limit=10&active=true

// Using the builder
const builder = new UrlBuilder('example.com')
  .path('api/v1')
  .path('users')
  .query({ limit: 10, tags: ['javascript', 'typescript'] })
  .hash('results');

console.log(builder.build()); // https://example.com/api/v1/users?limit=10&tags=javascript&tags=typescript#results

// Cloning and modifying
const builder2 = builder.clone()
  .path('123')
  .param('include', 'profile');

console.log(builder2.build()); // https://example.com/api/v1/users/123?limit=10&tags=javascript&tags=typescript&include=profile#results
*/
