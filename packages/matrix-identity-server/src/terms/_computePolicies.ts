import { type TwakeLogger } from '@twake-chat/logger'
import fs from 'fs'
import { type Policies } from '.'
import { type Config } from '../types'

let policies: Policies = {}

const computePolicy = (conf: Config, logger: TwakeLogger): Policies => {
  if (Object.keys(policies).length > 0) return policies
  if (conf.policies != null) {
    if (typeof conf.policies === 'string') {
      try {
        policies = JSON.parse(
          fs.readFileSync(conf.policies).toString()
        ) as Policies
      } catch (e) {
        /* istanbul ignore next */
        logger.error('Error:', e)
        /* istanbul ignore next */
        throw new Error('Unable to parse policies file')
      }
    } else {
      policies = conf.policies
    }
  }
  return policies
}

export const resetPolicies = (): void => {
  policies = {}
}

export default computePolicy
