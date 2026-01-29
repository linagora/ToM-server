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
runCli()
