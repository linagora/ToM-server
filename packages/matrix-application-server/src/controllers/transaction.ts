import type MatrixApplicationServer from '..'
import { AppServerAPIError, type expressAppHandler } from '../utils'
import { type ClientEvent, type TransactionRequestBody } from '../interfaces'
import { validationResult, type ValidationError } from 'express-validator'

export type TransactionController = (
  appServer: MatrixApplicationServer
) => expressAppHandler

export const transaction: TransactionController = (
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
    events.forEach((event: ClientEvent) => {
      if (event.state_key != null) {
        appServer.emit('event', event)
        if (event.type != null) {
          appServer.emit('type:' + event.type, event)
        }
      }
    })
    appServer.lastProcessedTxnId = txnId
    res.send()
  }
}
