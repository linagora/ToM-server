/**
 * Tests for version-manager module.
 * Tests version ordering, idempotency checking, and timestamp formatting.
 */

import {
  shouldApplyUpdate,
  isIdempotentDuplicate,
  formatTimestamp,
  type VersionInfo
} from './version-manager'

describe('version-manager', () => {
  describe('shouldApplyUpdate', () => {
    it('returns true for new user (null lastSettings)', () => {
      const result = shouldApplyUpdate(null, 1, Date.now())
      expect(result).toBe(true)
    })

    it('returns true when new version is higher', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 1000,
        request_id: 'req-old'
      }
      const result = shouldApplyUpdate(lastSettings, 2, 2000)
      expect(result).toBe(true)
    })

    it('returns true when version is same but timestamp is newer', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 1000,
        request_id: 'req-old'
      }
      const result = shouldApplyUpdate(lastSettings, 1, 2000)
      expect(result).toBe(true)
    })

    it('returns false when version is same but timestamp is older', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 2000,
        request_id: 'req-old'
      }
      const result = shouldApplyUpdate(lastSettings, 1, 1000)
      expect(result).toBe(false)
    })

    it('returns false when version is lower', () => {
      const lastSettings: VersionInfo = {
        version: 2,
        timestamp: 2000,
        request_id: 'req-old'
      }
      const result = shouldApplyUpdate(lastSettings, 1, 3000)
      expect(result).toBe(false)
    })

    it('returns false when version and timestamp are same', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 1000,
        request_id: 'req-old'
      }
      const result = shouldApplyUpdate(lastSettings, 1, 1000)
      expect(result).toBe(false)
    })

    it('handles edge case: version 0', () => {
      const lastSettings: VersionInfo = {
        version: 0,
        timestamp: 1000,
        request_id: 'req-old'
      }
      const result = shouldApplyUpdate(lastSettings, 1, 2000)
      expect(result).toBe(true)
    })

    it('handles edge case: timestamp 0', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 0,
        request_id: 'req-old'
      }
      const result = shouldApplyUpdate(lastSettings, 1, 1)
      expect(result).toBe(true)
    })
  })

  describe('isIdempotentDuplicate', () => {
    it('returns false when lastSettings is null', () => {
      const result = isIdempotentDuplicate(null, 'req-123')
      expect(result).toBe(false)
    })

    it('returns false when requestId is different', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 1000,
        request_id: 'req-old'
      }
      const result = isIdempotentDuplicate(lastSettings, 'req-new')
      expect(result).toBe(false)
    })

    it('returns true when requestId is same', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 1000,
        request_id: 'req-123'
      }
      const result = isIdempotentDuplicate(lastSettings, 'req-123')
      expect(result).toBe(true)
    })

    it('handles empty string requestId', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 1000,
        request_id: ''
      }
      const result = isIdempotentDuplicate(lastSettings, '')
      expect(result).toBe(true)
    })

    it('handles different requestId with empty string', () => {
      const lastSettings: VersionInfo = {
        version: 1,
        timestamp: 1000,
        request_id: ''
      }
      const result = isIdempotentDuplicate(lastSettings, 'req-123')
      expect(result).toBe(false)
    })
  })

  describe('formatTimestamp', () => {
    it('returns ISO string format', () => {
      const timestamp = 1640995200000 // 2022-01-01T00:00:00.000Z
      const result = formatTimestamp(timestamp)
      expect(result).toBe('2022-01-01T00:00:00.000Z')
    })

    it('handles current timestamp', () => {
      const now = Date.now()
      const result = formatTimestamp(now)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    })

    it('handles timestamp 0 (Unix epoch)', () => {
      const result = formatTimestamp(0)
      expect(result).toBe('1970-01-01T00:00:00.000Z')
    })

    it('handles negative timestamp (before Unix epoch)', () => {
      const timestamp = -86400000 // 1 day before epoch
      const result = formatTimestamp(timestamp)
      expect(result).toBe('1969-12-31T00:00:00.000Z')
    })

    it('handles far future timestamp', () => {
      const timestamp = 4102444800000 // 2100-01-01T00:00:00.000Z
      const result = formatTimestamp(timestamp)
      expect(result).toBe('2100-01-01T00:00:00.000Z')
    })
  })
})
