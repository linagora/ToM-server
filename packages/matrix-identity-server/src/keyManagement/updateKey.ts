/* istanbul ignore file */

// TO BE MODIFIED LATER ON --- FILE NOT IN USE FOR THE MOMENT

/**
 * Change long-term key
 */

import { generateKeyPair } from '@twake-chat/crypto'
import { type TwakeLogger } from '@twake-chat/logger'
import type IdentityServerDb from '../db'

const updateKey = async (
  db: IdentityServerDb,
  logger: TwakeLogger
): Promise<void> => {
  try {
    // Step 1:
    //  - Drop old-old key
    //  - Get current key
    const previousKeyRows = await db.get('longTermKeypairs', ['keyID'], {
      name: 'previousKey'
    })

    if (previousKeyRows.length === 0) {
      /* istanbul ignore next */
      throw new Error('No previousKey found')
    }

    // Check if keyID is in the correct format /^ed25519:[A-Za-z0-9_-]+$/
    if (!/^ed25519:[A-Za-z0-9_-]+$/.test(previousKeyRows[0].keyID as string)) {
      /* istanbul ignore next */
      throw new Error('previousKey value is not valid')
    }

    const currentKeyRows = await db.get(
      'longTermKeypairs',
      ['keyID', 'public', 'private'],
      { name: 'currentKey' }
    )

    if (currentKeyRows.length === 0) {
      /* istanbul ignore next */
      throw new Error('currentKey undefined')
    }

    // Step 2:
    //  - Generate new key pair
    //  - Set previousKey to current value
    //  - Update database with new key pair
    const newKey = generateKeyPair('ed25519')

    try {
      await db.update(
        'longTermKeypairs',
        {
          keyID: currentKeyRows[0].keyID as string,
          public: currentKeyRows[0].public as string,
          private: currentKeyRows[0].private as string
        },
        'name',
        'previousKey'
      )
      logger.info('Previous key updated successfully')
    } catch (error) {
      /* istanbul ignore next */
      logger.error('Error updating previous key', error)
      /* istanbul ignore next */
      throw error
    }

    try {
      await db.update(
        'longTermKeypairs',
        {
          keyID: newKey.keyId,
          public: newKey.publicKey,
          private: newKey.privateKey
        },
        'name',
        'currentKey'
      )
      logger.info('Current key updated successfully')
    } catch (error) {
      /* istanbul ignore next */
      logger.error('Error updating current key', error)
      /* istanbul ignore next */
      throw error
    }

    logger.info('Long-term key updated successfully')
  } catch (error) {
    /* istanbul ignore next */
    logger.error('Error updating long-term key', error)
  }
}

export default updateKey
