/* istanbul ignore file */
import { type Policies } from '.'
import type MatrixIdentityServer from '..'
import {
  errMsg,
  jsonContent,
  send,
  validateParameters,
  type expressAppHandler
} from '@twake/utils'
import computePolicy from './_computePolicies'
import { type DbGetResult } from '..'

type UrlsFromPolicies = Record<string, string[]>

export const getUrlsFromPolicies = (policies: Policies): UrlsFromPolicies => {
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

/*
Filling every policy for a given user. Useful when setting up test data or initializing every policy to not accepted.
CAUTION: This function completely overwrites the user's previous policy acceptance status.
*/

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const fillPoliciesDB = (
  userId: string,
  idServer: MatrixIdentityServer,
  accepted: number
): Promise<DbGetResult[]> => {
  const policies = getUrlsFromPolicies(
    computePolicy(idServer.conf, idServer.logger)
  )
  const policyNames = Object.keys(policies)
  idServer.logger.debug(
    `Filling policies ${policyNames.join(', ')} for user userId ${userId}`
  )

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  const promises: Array<Promise<DbGetResult>> = policyNames.map(
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    (policyName) => {
      return (
        idServer.db
          .get('userPolicies', [], {
            user_id: userId,
            policy_name: policyName
          })
          // eslint-disable-next-line @typescript-eslint/promise-function-async
          .then((alreadyExists) => {
            if (alreadyExists.length > 0) {
              return idServer.db.updateAnd(
                'userPolicies',
                { accepted },
                { field: 'user_id', value: userId },
                { field: 'policy_name', value: policyName }
              )
            } else {
              return idServer.db.insert('userPolicies', {
                policy_name: policyName,
                user_id: userId,
                accepted
              })
            }
          })
          .catch((e) => {
            /* istanbul ignore next - Tested separatly by deliberately violating unique constraints in the insert above */
            idServer.logger.error('Error filling policies', e)
            /* istanbul ignore next */
            throw e // Re-throw the error to be caught by Promise.all
          })
      )
    }
  )

  return Promise.all(promises)
}

const PostTerms = <T extends string = never>(
  idServer: MatrixIdentityServer<T>
): expressAppHandler => {
  const urlsFromPolicies = getUrlsFromPolicies(
    computePolicy(idServer.conf, idServer.logger)
  )
  return (req, res) => {
    idServer.authenticate(
      req,
      res,
      (data, id) => {
        const userId: string = data.sub

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
              if (typeof urls === 'string') urls = [urls]
              Object.keys(urlsFromPolicies).forEach((policyName) => {
                ;(urls as string[]).forEach((url) => {
                  if (urlsFromPolicies[policyName].includes(url)) {
                    done.push(policyName)
                  }
                })
              })
              if (done.length > 0) {
                done.forEach((policyName) => {
                  idServer.db
                    .updateAnd(
                      'userPolicies',
                      { accepted: 1 },
                      { field: 'user_id', value: userId },
                      { field: 'policy_name', value: policyName }
                    )
                    .then(() => {})
                    .catch((e) => {
                      // istanbul ignore next
                      idServer.logger.error('Error updating user policies', e)
                      // istanbul ignore next
                      send(res, 500, errMsg('unknown'))
                    })
                })
                send(res, 200, {})
              } else {
                send(res, 400, errMsg('unrecognized', 'Unknown policy'))
              }
            }
          )
        })
      },
      false
    )
    // send(res, 200, {})
  }
}

export default PostTerms
