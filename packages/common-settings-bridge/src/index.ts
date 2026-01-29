/**
 * Common Settings Bridge
 *
 * Synchronizes user profile settings from AMQP messages to Matrix/Synapse.
 */

// Re-export main bridge class
export { CommonSettingsBridge } from './bridge'

// Re-export types
export * from './types'

// Re-export errors
export * from './errors'

// Run CLI when executed directly
import { runCli } from './cli'

// Run main only when executed directly (avoid side effects on import)
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runCli()
  } catch (error) {
    console.error('Unhandled error:', error)
    process.exit(1)
  }
}
