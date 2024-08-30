/* istanbul ignore file */
/*
import type MatrixClientServer from '..'
import {
  send,
  errMsg,
  validateParameters,
  type expressAppHandler,
  extractQueryParameters,
  checkTypes,
  setDefaultValues,
  type queryParametersType,
  type queryParametersValueChecks,
  checkValues
} from '@twake/utils'
import { type SyncConfig } from './utils'
import { Filter } from '../utils/filter'
import { StreamToken } from '../utils/notifier'
import { type TokenContent } from '../utils/authenticate'

interface queryParameters {
  filter: string
  fullState: boolean
  setPresence: string
  since: string
  timeout: number
}

const queryParametersSchema = {
  filter: false,
  fullState: false,
  setPresence: false,
  since: false,
  timeout: false
}

const types: queryParametersType = {
  filter: 'string',
  fullState: 'boolean',
  setPresence: 'string',
  since: 'string',
  timeout: 'number'
}

const defaultValues = {
  filter: '{}',
  fullState: false,
  setPresence: 'online',
  timeout: 0
}

const values: queryParametersValueChecks = {
  setPresence: (value: string): boolean => {
    return ['offline', 'online', 'unavailable'].includes(value)
  },
  timeout: (value: string): boolean => {
    const valueAsNumber = parseInt(value, 10)
    return valueAsNumber >= 0 && valueAsNumber <= 5000
  },
  since: (value: string): boolean => {
    try {
      const streamToken = StreamToken.fromString(value)
      if (value === streamToken.toString()) {
        return true
      } else {
        return false
      }
    } catch (e) {
      return false
    }
  }
}

const Sync = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    let queryParams = extractQueryParameters(req)
    try {
      checkTypes(queryParams, types)
      queryParams = setDefaultValues(queryParams, defaultValues)
      checkValues(queryParams, values)
    } catch (e) {
      send(
        res,
        400,
        errMsg('invalidParam', (e as Error).message),
        ClientServer.logger
      )
      return
    }
    validateParameters(
      res,
      queryParametersSchema,
      queryParams,
      ClientServer.logger,
      (queryParams) => {
        ClientServer.authenticate(req, res, (data: TokenContent, token) => {
          const syncConfig: SyncConfig = {
            userId: data.sub,
            filter: new Filter(
              JSON.parse((queryParams as queryParameters).filter)
            ),
            isGuest: data.isGuest,
            deviceId: data.device_id
          }
          const syncResult = generateSyncResponse(
            syncConfig,
            queryParams as Record<string, string>,
            ClientServer
          )
        })
      }
    )
  }
}

interface SyncResult {
  // to be implemented
}

const generateSyncResponse = (
  queryParams: Record<string, string>,
  data: Record<string, any>,
  ClientServer: MatrixClientServer
): SyncResult => {}

export default Sync
*/
