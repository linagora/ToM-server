import { type Policies } from '.'
import { type Config } from '..'
import fs from 'fs'

let policies: Policies = {}

const computePolicy = (conf: Config): Policies => {
  if (Object.keys(policies).length > 0) return policies
  if (conf.policies != null) {
    if (typeof conf.policies === 'string') {
      try {
        policies = JSON.parse(
          fs.readFileSync(conf.policies).toString()
        ) as Policies
      } catch (e) {
        /* istanbul ignore next */
        console.error('Error:', e)
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
