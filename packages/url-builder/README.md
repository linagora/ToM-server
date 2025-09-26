# URL Builder

A robust and fluent utility for safely and easily building URLs in Type Script or JavaScript. This package provides both a simple function and a powerful class for constructing URLs with proper path joining, query parameter handling, and error management.

## Features

- **Protocol Handling:** Automatically adds `https://` to the base URL if a protocol is missing.
- **Path Management:** Correctly joins path segments, handles absolute paths, and prevents security vulnerabilities like path traversal.
- **Query Parameters:** Easily add query parameters from an object, including support for array values.
- **Fluent API:** The `UrlBuilder` class allows for method chaining to construct complex URLs in a readable way.
- **Custom Errors:** Throws specific, descriptive error types for better debugging and error handling.

## API Reference

### 1. `buildUrl` Function

A simple, straightforward function for building a URL in a single call.

**Signature:**

```tsx
buildUrl(
  base: string,
  path?: string,
  query?: QueryParams,
  options?: UrlOptions
): string;
```

**Usage:**

```tsx
import { buildUrl } from './url_builder';

// Basic usage with path and query parameters
const url = buildUrl('example.com', 'api/v1/users', { limit: 10, sort: 'asc' });
console.log(url); // https://example.com/api/v1/users?limit=10&sort=asc

// Handling a base URL with a path and absolute path
const absUrl = buildUrl('[api.example.com/v1](https://api.example.com/v1)', '/users', { id: 123 });
console.log(absUrl); // https://api.example.com/users?id=123

// Using the `useTls` option
const httpUrl = buildUrl('localhost:3000', 'status', {}, { useTls: false });
console.log(httpUrl); // http://localhost:3000/status
```

### 2. `UrlBuilder` Class

A class-based solution for constructing URLs with a fluent, chainable API. Ideal for more complex or reusable URL patterns.

**Signature:**

```tsx
new UrlBuilder(base: string, options?: UrlOptions);
```

**Methods:**

- **`.path(segment: string)`:** Adds a single path segment. If the segment starts with `/`, it replaces all previous paths.
- **`.paths(...segments: string[])`:** Adds multiple path segments at once.
- **`.query(params: QueryParams)`:** Adds a set of query parameters from an object.
- **`.param(key: string, value: QueryValue)`:** Adds a single query parameter.
- **`.hash(fragment: string)`:** Sets the URL fragment (hash).
- **`.build(): string`:** Finalizes and returns the complete URL string.
- **`.clone(): UrlBuilder`:** Creates a new `UrlBuilder` instance with the current state, allowing you to branch off and build new URLs without affecting the original.

**Usage:**

```tsx
import { UrlBuilder } from './url_builder';

// Create a builder instance and chain methods
const builder = new UrlBuilder('[api.example.com/v1](https://api.example.com/v1)')
  .path('users')
  .param('userId', 42)
  .query({
    include: ['posts', 'comments'], // Handles arrays
  })
  .hash('profile');

const url = builder.build();
console.log(url); // https://api.example.com/v1/users?userId=42&include=posts&include=comments#profile

// Clone the builder to create a new URL
const anotherUrl = builder.clone().path('posts').param('id', 123).build();
console.log(anotherUrl); // https://api.example.com/v1/users/posts?userId=42&include=posts&include=comments&id=123#profile
```

## Error Types

The library throws specific error types to help you handle different failure scenarios. You can catch them using `instanceof` checks.

- `UrlError`: The base class for all custom errors.
- `MissingArgumentError`: Thrown when a required argument (e.g., the base URL) is missing.
- `InvalidUrlError`: Thrown when the base URL is unrecoverably invalid.
- `InvalidPathError`: Thrown when a path segment contains unsafe characters or patterns.

```tsx
import { buildUrl, UrlError, InvalidUrlError, InvalidPathError } from './url_builder';

try {
  buildUrl('example.com', '[http://malicious.site](http://malicious.site)');
} catch (e) {
  if (e instanceof InvalidPathError) {
    console.error(`Caught specific path error: ${e.message}`);
  } else if (e instanceof UrlError) {
    console.error(`Caught general URL error: ${e.message}`);
  } else {
    console.error('Caught an unknown error');
  }
}
```
