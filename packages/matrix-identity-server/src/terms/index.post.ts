/* istanbul ignore file */
import { type Policies } from '.'
import { type Config } from '..'
import type IdentityServerDb from '../db'
import { Authenticate, jsonContent, send, validateParameters, type expressAppHandler } from '../utils'
import { errMsg } from '../utils/errors'
import computePolicy from './_computePolicies'

type UrlsFromPolicies = Record<string, string[]>

const getUrlsFromPolicies = (policies: Policies): UrlsFromPolicies => {
  const urlsFromPolicies: UrlsFromPolicies = {}
  Object.keys(policies).forEach((policyName) => {
    const policy = policies[policyName as ('privacy_policy' | 'terms_of_service')]
    if (policy != null) {
      const newName = `${policyName} ${policy.version}`
      Object.keys(policy).forEach((lang: string) => {
        if (typeof policy[lang] !== 'string') {
          if (urlsFromPolicies[newName] == null) urlsFromPolicies[newName] = []
          urlsFromPolicies[newName].push((policy[lang] as Record<string, 'name' | 'url'>).url)
        }
      })
    }
  })
  return urlsFromPolicies
}

const PostTerms = (db: IdentityServerDb, conf: Config): expressAppHandler => {
  const authenticate = Authenticate(db)
  const urlsFromPolicies = getUrlsFromPolicies(computePolicy(conf))
  return (req, res) => {
    authenticate(req, res, (data, id) => {
      jsonContent(req, res, (data) => {
        validateParameters(res, { user_accepts: true }, data, (data) => {
          let urls = (data as { user_accepts: string[] | string }).user_accepts
          const done: string[] = []
          /* istanbul ignore if */
          if (typeof urls === 'string') urls = [urls]
          Object.keys(urlsFromPolicies).forEach(policyName => {
            (urls as string[]).forEach(url => {
              if (urlsFromPolicies[policyName].includes(url)) {
                done.push(policyName)
              }
            })
          })
          if (done.length > 0) {
            // TODO register validation
            send(res, 200, {})
          } else {
            send(res, 400, errMsg('unrecognized', 'Unknown policy'))
          }
        })
      })
    })
    // send(res, 200, {})
  }
}

export default PostTerms
