/**
 * Version and timestamp management utilities for handling settings updates.
 * Provides idempotency checking and version-based ordering logic.
 */

/**
 * Represents version information for a settings update.
 */
export interface VersionInfo {
  /** Version number of the settings */
  version: number
  /** Unix timestamp in milliseconds when the settings were created */
  timestamp: number
  /** Unique request identifier for idempotency */
  request_id: string
}

/**
 * Determines whether an update should be applied based on version and timestamp.
 * Implements the following ordering rules:
 * 1. New user (no lastSettings) - always apply
 * 2. Higher version - always apply
 * 3. Same version but newer timestamp - apply
 * 4. Otherwise - reject as stale
 *
 * @param lastSettings - The last known settings for the user, or null if new user
 * @param newVersion - The version number from the incoming message
 * @param newTimestamp - The timestamp from the incoming message (Unix ms)
 * @returns true if the update should be applied, false otherwise
 *
 * @example
 * ```typescript
 * // New user - always apply
 * shouldApplyUpdate(null, 1, Date.now()) // returns true
 *
 * // Higher version - always apply
 * shouldApplyUpdate({ version: 1, timestamp: 100, request_id: 'abc' }, 2, 200) // returns true
 *
 * // Same version but newer timestamp - apply
 * shouldApplyUpdate({ version: 1, timestamp: 100, request_id: 'abc' }, 1, 200) // returns true
 *
 * // Stale update - reject
 * shouldApplyUpdate({ version: 2, timestamp: 200, request_id: 'abc' }, 1, 100) // returns false
 * ```
 */
export function shouldApplyUpdate(
  lastSettings: VersionInfo | null,
  newVersion: number,
  newTimestamp: number
): boolean {
  // New user - always apply
  if (!lastSettings) {
    return true
  }

  // Higher version - always apply
  if (newVersion > lastSettings.version) {
    return true
  }

  // Same version but newer timestamp - apply
  if (
    newVersion === lastSettings.version &&
    newTimestamp > lastSettings.timestamp
  ) {
    return true
  }

  // Otherwise, it's stale
  return false
}

/**
 * Checks if an incoming update is an idempotent duplicate based on request ID.
 * Returns true if the request has already been processed (same requestId as last settings).
 *
 * @param lastSettings - The last known settings for the user, or null if new user
 * @param newRequestId - The request ID from the incoming message
 * @returns true if this is a duplicate request, false otherwise
 *
 * @example
 * ```typescript
 * // No previous settings - not a duplicate
 * isIdempotentDuplicate(null, 'req-123') // returns false
 *
 * // Same request ID - duplicate
 * isIdempotentDuplicate({ version: 1, timestamp: 100, request_id: 'req-123' }, 'req-123') // returns true
 *
 * // Different request ID - not a duplicate
 * isIdempotentDuplicate({ version: 1, timestamp: 100, request_id: 'req-123' }, 'req-456') // returns false
 * ```
 */
export function isIdempotentDuplicate(
  lastSettings: VersionInfo | null,
  newRequestId: string
): boolean {
  if (!lastSettings) {
    return false
  }

  return newRequestId === lastSettings.request_id
}

/**
 * Formats a Unix timestamp (milliseconds) as an ISO 8601 string.
 * Useful for logging and debugging timestamp values.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Human-readable ISO 8601 timestamp string
 *
 * @example
 * ```typescript
 * formatTimestamp(1640995200000) // returns "2022-01-01T00:00:00.000Z"
 * formatTimestamp(Date.now()) // returns current time as ISO string
 * ```
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString()
}
