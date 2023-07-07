import type MatrixApplicationServer from '..'
import { type ClientEvent, type TransactionRequestBody } from '../interfaces'
import { validationErrorHandler, type expressAppHandler } from '../utils'

export type TransactionController = (
  appServer: MatrixApplicationServer
) => expressAppHandler

export const transaction: TransactionController = (
  appServer: MatrixApplicationServer
) => {
  return (req, res, next) => {
    validationErrorHandler(req)
    const txnId = req.params.txnId
    const events = (req.body as TransactionRequestBody).events
    const ephemeral = req.body['de.sorunome.msc2409.ephemeral'] ?? []
    if (appServer.lastProcessedTxnId === txnId) {
      res.send({})
      return
    }
    events.forEach((event: ClientEvent) => {
      // We check that the event is not a message event but a state event (event which update metadata of a room like topic, name, members, ...)
      if (event.state_key != null) {
        appServer.emit(
          `type: ${event.type} | state_key: ${event.state_key}`,
          event
        )
      } else {
        appServer.emit(`type: ${event.type}`, event)
      }
    })
    ephemeral.forEach((event: ClientEvent) => {
      if (event.type != null) {
        appServer.emit('ephemeral_type: ' + event.type, event)
      } else {
        appServer.emit('ephemeral', event)
      }
    })
    appServer.lastProcessedTxnId = txnId
    res.send({})
  }
}
