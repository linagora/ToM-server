import { type Config } from '..'
import type IdentityServerDb from '../db'
import { type expressAppHandler, send } from '../utils'
import fs from 'fs'

export interface Policy {
  version: string
  [key: string]: { name: string, url: string } | string;
}

export interface Policies {
  privacy_policy?: Policy
  terms_of_service?: Policy
}

// TODO: implement policies
const Terms = (conf: Config): expressAppHandler => {
  let policies: Policies = {}
  if (conf.policies != null) {
    if (typeof conf.policies === 'string') {
      try {
        policies = JSON.parse(fs.readFileSync(conf.policies).toString()) as Policies
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
  return (req, res) => {
    send(res, 200, { policies })
  }
}

export default Terms
