/* istanbul ignore file */

/**
 * Implements https://spec.matrix.org/v1.11/client-server-api/#put_matrixclientv3roomsroomidstateeventtypestatekey
 *
 *
 *
 *
 * TODO : add link between the http request where no state key parameter is given
 *
 * Servers might need to post-process some events if they relate to another event.
 * The event’s relationship type (rel_type) determines any restrictions which might apply,
 * such as the user only being able to send one event of a given type in relation to another.
 */

import type MatrixClientServer from '../..'
import { type Request } from 'express'
import { errMsg, send, type expressAppHandler, jsonContent } from '@twake/utils'
import { randomString } from '@twake/crypto'

import { roomAliasRegex, roomIdRegex } from '@twake/utils'

type EventContent = Record<string, any>

export const sendStateEvent = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  return async (req, res) => {
    const roomId = (req as Request).params.roomId
    const eventType = (req as Request).params.eventType
    const stateKey = (req as Request).params.stateKey

    // Check if it is a valid roomId
    if (roomId === null || !roomIdRegex.test(roomId)) {
      send(res, 400, errMsg('invalidParam', 'Invalid room ID'))
      return
    }
    const validRoomId = await clientServer.matrixDb.get('rooms', ['room_id'], {
      room_id: roomId
    })
    if (validRoomId.length === 0) {
      send(res, 400, errMsg('invalidParam', 'Invalid room ID'))
      return
    }

    // TO DO : add check for authorization before sending the event (depends on the event type)

    clientServer.authenticate(req, res, (data) => {
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      jsonContent(req, res, clientServer.logger, async (obj) => {
        const eventContent: EventContent = (req as Request).body
        const userId = data.sub
        // Generate a unique event ID
        const eventId = `$${randomString(64)}:example.com` //  TO DO : add or server name

        try {
          // Validate the event content based on the event type
          switch (eventType) {
            case 'm.room.create':
              if (stateKey.length > 0) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid state key for event type')
                )
                return
              }
              // update room_stats_state with new room info
              clientServer.matrixDb
                .insert('room_stats_state', {
                  room_id: roomId,
                  is_federatable: eventContent.federate | 1,
                  room_type: eventContent.room_type
                })
                .then(() => {
                  clientServer.matrixDb
                    .insert('rooms', {
                      room_id: roomId,
                      creator: userId,
                      room_version: eventContent.room_version
                    })
                    .then(() => {})
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error updating room creator:',
                        err
                      )
                    })
                })
                .catch((err) => {
                  /* istanbul ignore next */
                  send(res, 500, errMsg('unknown', err))
                  /* istanbul ignore next */
                  clientServer.logger.error('Error updating room creator:', err)
                })
              break

            case 'm.room.name':
              if (stateKey.length > 0) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid state key for event type')
                )
                return
              }
              if (typeof eventContent.name !== 'string') {
                send(res, 400, errMsg('invalidParam', 'Invalid name parameter'))
                return
              } else {
                if (eventContent.name.length > 0) {
                  clientServer.matrixDb
                    .updateWithConditions(
                      'room_stats_state',
                      { name: eventContent.name },
                      [{ field: 'room_id', value: roomId }]
                    )
                    .then(() => {})
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error updating room name:',
                        err
                      )
                    })
                }
              }
              break

            case 'm.room.topic':
              if (stateKey.length > 0) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid state key for event type')
                )
                return
              }
              if (typeof eventContent.topic !== 'string') {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid topic parameter')
                )
                return
              } else {
                if (eventContent.topic.length !== null) {
                  clientServer.matrixDb
                    .updateWithConditions(
                      'room_stats_state',
                      { topic: eventContent.topic },
                      [{ field: 'room_id', value: roomId }]
                    )
                    .then(() => {})
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error updating room topic:',
                        err
                      )
                    })
                }
              }
              break

            case 'm.room.avatar':
              if (stateKey.length > 0) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid state key for event type')
                )
                return
              }
              if (typeof eventContent.url !== 'string') {
                send(res, 400, errMsg('invalidParam', 'Invalid url parameter'))
                return
              } else {
                if (eventContent.name.length > 0) {
                  clientServer.matrixDb
                    .updateWithConditions(
                      'room_stats_state',
                      { avatar: eventContent.url },
                      [{ field: 'room_id', value: roomId }]
                    )
                    .then(() => {})
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error updating room avatar:',
                        err
                      )
                    })
                }
              }
              break

            case 'm.room.canonical_alias':
              // eslint-disable-next-line no-case-declarations
              const _alias: string = eventContent.alias
              // eslint-disable-next-line no-case-declarations
              const _altAliases: [string] = eventContent.alt_aliases
              for (const alias of [_alias, ..._altAliases]) {
                if (
                  alias !== null &&
                  alias.length > 0 &&
                  !roomAliasRegex.test(alias)
                ) {
                  send(
                    res,
                    400,
                    errMsg('invalidParam', `Invalid alias '${alias}'`)
                  )
                  return
                }
              }
              if (_alias !== null && _alias.length > 0) {
                clientServer.matrixDb
                  .get('room_stats_state', ['canonical_alias'], {
                    room_id: roomId
                  })
                  .then((rows) => {
                    if (rows[0].canonical_alias !== null) {
                      clientServer.matrixDb
                        .updateWithConditions(
                          'room_stats_state',
                          { canonical_alias: _alias },
                          [{ field: 'room_id', value: roomId }]
                        )
                        .then(() => {
                          clientServer.logger.info(
                            'Canonical room alias correctly updated'
                          )
                        })
                        .catch((err) => {
                          /* istanbul ignore next */
                          send(res, 500, errMsg('unknown', err))
                          /* istanbul ignore next */
                          clientServer.logger.error(
                            'Error updating canonical room_alias:',
                            err
                          )
                        })
                    } else {
                      clientServer.matrixDb
                        .insert('room_stats_state', {
                          room_id: roomId,
                          canonical_alias: _alias
                        })
                        .then(() => {})
                        .catch((err) => {
                          /* istanbul ignore next */
                          send(res, 500, errMsg('unknown', err))
                          /* istanbul ignore next */
                          clientServer.logger.error(
                            'Error inserting canonical room_alias:',
                            err
                          )
                        })
                    }
                  })
                  .catch((err) => {
                    /* istanbul ignore next */
                    send(res, 500, errMsg('unknown', err))
                    /* istanbul ignore next */
                    clientServer.logger.error(
                      'Error getting canonical room_alias:',
                      err
                    )
                  })
              }
              for (const aliases of _altAliases) {
                if (aliases !== null && aliases.length > 0) {
                  clientServer.matrixDb
                    .insert('room_aliases', {
                      room_id: roomId,
                      alias: aliases
                    })
                    .then(() => {})
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error inserting alt room_alias:',
                        err
                      )
                    })
                }
              }
              break

            // TO DO : implement following
            case 'm.room.member':
              if (typeof eventContent.membership !== 'string') {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid membership parameter')
                )
                return
              }
              break

            // TO DO : not found yet in synapse database
            case 'm.room.power_levels':
              break

            // TO DO : take allow conditions into account
            case 'm.room.join_rules':
              if (stateKey.length > 0) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid state key for event type')
                )
                return
              }
              if (typeof eventContent.join_rules !== 'string') {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid join_rules parameter')
                )
                return
              } else {
                if (eventContent.join_rules.length > 0) {
                  clientServer.matrixDb
                    .updateWithConditions(
                      'room_stats_state',
                      { join_rules: eventContent.join_rules },
                      [{ field: 'room_id', value: roomId }]
                    )
                    .then(() => {})
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error updating room name:',
                        err
                      )
                    })
                }
              }
              break

            case 'm.room.history_visibility':
              // verify if the value is one of the following : 'invited' |'joined' |'shared' |'ld_readable'
              if (
                ['invited', 'joined', 'shared', 'ld_readable'].includes(
                  eventContent.history_visibility
                )
              ) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid history_visibility parameter')
                )
                return
              } else {
                clientServer.matrixDb
                  .updateWithConditions(
                    'room_stats_state',
                    { history_visibility: eventContent.history_visibility },
                    [{ field: 'room_id', value: roomId }]
                  )
                  .then(() => {})
                  .catch((err) => {
                    /* istanbul ignore next */
                    send(res, 500, errMsg('unknown', err))
                    /* istanbul ignore next */
                    clientServer.logger.error(
                      'Error updating room history visibility:',
                      err
                    )
                  })
              }
              break

            case 'm.room.guest_access':
              if (
                ['can_join', 'forbidden'].includes(
                  eventContent.history_visibility
                )
              ) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid history_visibility parameter')
                )
                return
              } else {
                clientServer.matrixDb
                  .updateWithConditions(
                    'room_stats_state',
                    { history_visibility: eventContent.history_visibility },
                    [{ field: 'room_id', value: roomId }]
                  )
                  .then(() => {})
                  .catch((err) => {
                    /* istanbul ignore next */
                    send(res, 500, errMsg('unknown', err))
                    /* istanbul ignore next */
                    clientServer.logger.error(
                      'Error updating room history visibility:',
                      err
                    )
                  })
              }
              break

            // TO DO : take rotation periods into account
            case 'm.room.encryption':
              if (stateKey.length > 0) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid state key for event type')
                )
                return
              }
              if (
                typeof eventContent.algorithm !== 'string' ||
                eventContent.algorithm.length === null
              ) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid algorithm parameter')
                )
                return
              } else {
                if (eventContent.algorithm.length > 0) {
                  clientServer.matrixDb
                    .updateWithConditions(
                      'room_stats_state',
                      { encryption: eventContent.algorithm },
                      [{ field: 'room_id', value: roomId }]
                    )
                    .then(() => {})
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error updating room encryption algorithm:',
                        err
                      )
                    })
                }
              }
              break

            // TO DO : check for missing use of pinned events
            case 'm.room.pinned_events':
              if (stateKey.length > 0) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid state key for event type')
                )
                return
              }
              if (!Array.isArray(eventContent.pinned)) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid pinned parameter')
                )
                return
              }
              break

            case 'm.room.tombstone':
              if (stateKey.length > 0) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid state key for event type')
                )
                return
              }
              if (
                typeof eventContent.body !== 'string' ||
                typeof eventContent.replacement_room !== 'string'
              ) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid tombstone parameters')
                )
                return
              }
              break

            case 'm.room.server_acl':
              if (
                !Array.isArray(eventContent.allow) ||
                !Array.isArray(eventContent.deny) ||
                typeof eventContent.allow_ip_literals !== 'boolean'
              ) {
                send(
                  res,
                  400,
                  errMsg('invalidParam', 'Invalid server ACL parameters')
                )
                return
              }
              break

            // TO DO : add call to the third party invite API
            case 'm.room.third_party_invite':
              if (
                typeof eventContent.display_name !== 'string' ||
                typeof eventContent.key_validity_url !== 'string' ||
                typeof eventContent.public_key !== 'string'
              ) {
                send(
                  res,
                  400,
                  errMsg(
                    'invalidParam',
                    'Invalid third party invite parameters'
                  )
                )
                return
              }
              break

            case 'm.room.alias':
              // This event serves no significant meaning in this version of the specification
              break

            default:
              send(
                res,
                400,
                errMsg('unknown', `Unknown event type: ${eventType}`)
              )
              return
          }

          // Insert or update the state event in the database
          if (stateKey.length > 0) {
            clientServer.matrixDb
              .get('events', ['event_id'], {
                room_id: roomId,
                type: eventType,
                state_key: stateKey
              })
              .then((rows) => {
                if (rows.length > 0) {
                  clientServer.matrixDb
                    .updateWithConditions(
                      'events',
                      {
                        event_id: rows[0].event_id as string,
                        content: JSON.stringify(eventContent),
                        origin_server_ts: Date.now(),
                        sender: userId
                      },
                      [
                        { field: 'room_id', value: roomId },
                        { field: 'type', value: eventType },
                        { field: 'state_key', value: stateKey }
                      ]
                    )
                    .then(() => {
                      send(res, 200, { event_id: rows[0].event_id })
                    })
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error handling state event:',
                        err
                      )
                    })
                } else {
                  clientServer.matrixDb
                    .insert('events', {
                      event_id: eventId,
                      room_id: roomId,
                      sender: userId,
                      type: eventType,
                      state_key: stateKey,
                      content: JSON.stringify(eventContent),
                      origin_server_ts: Date.now()
                    })
                    .then(() => {
                      send(res, 200, { event_id: eventId })
                    })
                    .catch((err) => {
                      /* istanbul ignore next */
                      send(res, 500, errMsg('unknown', err))
                      /* istanbul ignore next */
                      clientServer.logger.error(
                        'Error handling state event:',
                        err
                      )
                    })
                }
              })
              .catch((err) => {
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', err))
                /* istanbul ignore next */
                clientServer.logger.error('Error handling state event:', err)
              })
          } else {
            clientServer.matrixDb
              .insert('events', {
                event_id: eventId,
                room_id: roomId,
                sender: userId,
                type: eventType,
                state_key: stateKey,
                content: JSON.stringify(eventContent),
                origin_server_ts: Date.now()
              })
              .then(() => {
                send(res, 200, { event_id: eventId })
              })
              .catch((err) => {
                /* istanbul ignore next */
                send(res, 500, errMsg('unknown', err))
                /* istanbul ignore next */
                clientServer.logger.error('Error handling state event:', err)
              })
          }
        } catch (error) {
          /* istanbul ignore next */
          clientServer.logger.error('Error handling state event:', error)
          /* istanbul ignore next */
          send(res, 500, errMsg('unknown', 'Internal Server Error'))
        }
      })
    })
  }
}

const removeWrongEventFields = (
  event_format: string,
  event_fields?: string[],
  logger?: TwakeLogger
): string[] => {
  if (!event_fields) {
    return []
  }

  if (event_format === 'client') {
    return event_fields.filter((field) => {
      const [fieldName, subField] = field.split('.')

      const isValid =
        validClientEventFields.has(fieldName) &&
        (subField === undefined || subField.length <= 30) // Arbitrary limit to avoid too long subfields

      if (!isValid && logger) {
        logger.warn(`Invalid field given in filter constructor : ${field}`)
      }

      return isValid
    })
  }

  if (event_format === 'federation') {
    // TODO: Implement restrictions for federationEventFields
    return event_fields
  }
  /* istanbul ignore next */
  throw new Error('Missing event format in call to removeWrongEventFields')
}
