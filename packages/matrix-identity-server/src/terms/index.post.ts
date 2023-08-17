/* istanbul ignore file */
import { type Policies } from '.'
import type MatrixIdentityServer from '..'
import {
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '../utils'
import { errMsg } from '../utils/errors'
import computePolicy from './_computePolicies'

type UrlsFromPolicies = Record<string, string[]>

const getUrlsFromPolicies = (policies: Policies): UrlsFromPolicies => {
  const urlsFromPolicies: UrlsFromPolicies = {}
  Object.keys(policies).forEach((policyName) => {
    const policy = policies[policyName as 'privacy_policy' | 'terms_of_service']
    if (policy != null) {
      const newName = `${policyName} ${policy.version}`
      Object.keys(policy).forEach((lang: string) => {
        if (typeof policy[lang] !== 'string') {
          if (urlsFromPolicies[newName] == null) urlsFromPolicies[newName] = []
          urlsFromPolicies[newName].push(
            (policy[lang] as Record<string, 'name' | 'url'>).url
          )
        }
      })
    }
  })
  return urlsFromPolicies
}

const PostTerms = (idServer: MatrixIdentityServer): expressAppHandler => {
  const urlsFromPolicies = getUrlsFromPolicies(
    computePolicy(idServer.conf, idServer.logger)
  )
  return (req, res) => {
    idServer.authenticate(req, res, (data, id) => {
      jsonContent(req, res, idServer.logger, (data) => {
        validateParameters(
          res,
          { user_accepts: true },
          data,
          idServer.logger,
          (data) => {
            let urls = (data as { user_accepts: string[] | string })
              .user_accepts
            const done: string[] = []
            /* istanbul ignore if */
            if (typeof urls === 'string') urls = [urls]
            Object.keys(urlsFromPolicies).forEach((policyName) => {
              ;(urls as string[]).forEach((url) => {
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
          }
        )
      })
    })
    // send(res, 200, {})
  }
}

export default PostTerms
