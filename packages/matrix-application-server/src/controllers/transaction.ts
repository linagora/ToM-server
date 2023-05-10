import type MatrixApplicationServer from '..'
import { AppServerAPIError } from '../utils'
import { type ClientEvent, type TransactionRequestBody } from '../interfaces'
import { type AppServerController } from '.'
import { validationResult, type ValidationError } from 'express-validator'

export const transaction: AppServerController = (
  appServer: MatrixApplicationServer
) => {
  return (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      const errorMessage = errors
        .array({ onlyFirstError: true })
        .map(
          (error: ValidationError) =>
            `Error ${error.type}: ${String(error.msg)}${
              'path' in error ? ` (property: ${error.path})` : ''
            }`
        )
        .join(', ')
      throw new AppServerAPIError({
        status: 400,
        message: errorMessage
      })
    }
    const txnId = req.params.txnId
    const events = (req.body as TransactionRequestBody).events
    if (appServer.lastProcessedTxnId === txnId) {
      res.send()
      return
    }
    // We check that the event is not a message event but a state event (event which update metadata of a room like topic, name, members, ...)
    events
      .filter((event: ClientEvent) => event.state_key != null)
      .forEach((event: ClientEvent) => {
        switch (event.type) {
          default:
            break
        }
      })
    appServer.lastProcessedTxnId = txnId
    res.send()
  }
}
