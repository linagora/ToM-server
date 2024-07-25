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

// eslint-disable-next-line @typescript-eslint/promise-function-async
export const fillPoliciesDB = (
  userId: string,
  idServer: MatrixIdentityServer,
  accepted: number
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const policies = getUrlsFromPolicies(
      computePolicy(idServer.conf, idServer.logger)
    )
    const policyNames = Object.keys(policies)

    // eslint-disable-next-line @typescript-eslint/promise-function-async
    const insertPromises = policyNames.map((policyName) => {
      return idServer.db.insert('userPolicies', {
        policy_name: policyName,
        user_id: userId,
        accepted
      })
    })

    Promise.all(insertPromises)
      .then(() => {
        resolve(policyNames)
      })
      .catch((e) => {
        /* istanbul ignore next */
        idServer.logger.error('Error inserting user policies', e)
        reject(e)
      })
  })
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
                let token: string = ''
                // @ts-expect-error req.query exists
                if (req.query != null && Object.keys(req.query).length > 0) {
                  // @ts-expect-error req.query.access_token may be null
                  token = req.query.access_token
                } else if (req.headers.authorization != null) {
                  token = req.headers.authorization.split(' ')[1]
                }
                idServer.db
                  .get('accessTokens', ['data'], { id: token })
                  .then((rows) => {
                    const userId = JSON.parse(rows[0].data as string).sub
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
                          idServer.logger.error(
                            'Error updating user policies',
                            e
                          )
                          // istanbul ignore next
                          send(res, 500, errMsg('unknown'))
                        })
                    })
                    send(res, 200, {})
                  })
                  .catch((e) => {
                    // istanbul ignore next
                    idServer.logger.error('Error getting user data', e)
                    // istanbul ignore next
                    send(res, 500, errMsg('unknown'))
                  })
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
