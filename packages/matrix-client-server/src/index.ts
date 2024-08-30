import configParser, { type ConfigDescription } from '@twake/config-parser'
import { type TwakeLogger } from '@twake/logger'
import fs from 'fs'
import defaultConfig from './config.json'
import {
  type clientDbCollections,
  type ClientServerDb,
  type Config
} from './types'
import { type Request, type Response } from 'express'

// Internal libraries
import { IdManager, StreamName } from './utils/idManager'
import { Notifier } from './utils/notifier'
import MatrixDBmodified from './matrixDb'
import MatrixIdentityServer from '@twake/matrix-identity-server'
import UiAuthenticate, {
  type UiAuthFunction
} from './utils/userInteractiveAuthentication'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import Authenticate from './utils/authenticate'

// Endpoints
import {
  getProfile,
  getAvatarUrl,
  getDisplayname
} from './user_data/profiles/getProfiles'
import {
  changeAvatarUrl,
  changeDisplayname
} from './user_data/profiles/changeProfiles'
import whoami from './account/whoami'
import whois from './admin/whois'
import getAccountData from './user/account_data/getAccountData'
import putAccountData from './user/account_data/putAccountData'
import getRoomAccountData from './user/rooms/getRoomAccountData'
import putRoomAccountData from './user/rooms/putRoomAccountData'
import register from './register'
import { getDevices, getDeviceInfo } from './devices/getDevices'
import { changeDeviceName } from './devices/changeDevices'
import GetEventId from './rooms/roomId/getEventId'
import GetJoinedMembers from './rooms/roomId/getJoinedMembers'
import {
  getUserRoomTags,
  addUserRoomTag,
  removeUserRoomTag
} from './rooms/room_information/room_tags'
import { getJoinedRooms } from './rooms/room_information/get_joined_rooms'
import {
  getRoomVisibility,
  setRoomVisibility
} from './rooms/room_information/room_visibilty'
import { getRoomAliases } from './rooms/room_information/room_aliases'
import RequestTokenPasswordEmail from './account/password/email/requestToken'
import RequestTokenPasswordMsisdn from './account/password/msisdn/requestToken'
import RequestTokenEmail from './register/email/requestToken'
import RequestTokenMsisdn from './register/msisdn/requestToken'
import SubmitTokenEmail from './register/email/submitToken'
import getTimestampToEvent from './rooms/roomId/getTimestampToEvent'
import getStatus from './presence/getStatus'
import putStatus from './presence/putStatus'
import getLogin from './login/getLogin'
import add from './account/3pid/add'
import PostFilter from './user/filter/postFilter'
import GetFilter from './user/filter/getFilter'
import refresh from './refresh'
import openIdRequestToken from './user/openid/requestToken'

export default class MatrixClientServer extends MatrixIdentityServer<clientDbCollections> {
  api: {
    get: Record<string, expressAppHandler>
    post: Record<string, expressAppHandler>
    put: Record<string, expressAppHandler>
    delete: Record<string, expressAppHandler>
  }

  matrixDb: MatrixDBmodified
  notifier: Notifier
  declare conf: Config
  declare db: ClientServerDb
  private _uiauthenticate!: UiAuthFunction
  accountDataIdManager!: IdManager
  presenceStreamIdManager!: IdManager
  eventsStreamIdManager!: IdManager

  set uiauthenticate(uiauthenticate: UiAuthFunction) {
    this._uiauthenticate = (req, res, allowedFlows, description, obj, cb) => {
      this.rateLimiter(req as Request, res as Response, () => {
        uiauthenticate(req, res, allowedFlows, description, obj, cb)
      })
    }
  }

  get uiauthenticate(): UiAuthFunction {
    return this._uiauthenticate
  }

  constructor(
    conf?: Partial<Config>,
    confDesc?: ConfigDescription,
    logger?: TwakeLogger
  ) {
    if (confDesc == null) confDesc = defaultConfig
    const serverConf = configParser(
      confDesc,
      /* istanbul ignore next */
      fs.existsSync('/etc/twake/client-server.conf')
        ? '/etc/twake/client-server.conf'
        : process.env.TWAKE_CLIENT_SERVER_CONF != null
        ? process.env.TWAKE_CLIENT_SERVER_CONF
        : conf != null
        ? conf
        : undefined
    ) as Config
    super(serverConf, confDesc, logger) // Add tables in here if we add additional tables to this.db in the tables variable above
    this.api = { get: {}, post: {}, put: {}, delete: {} }
    this.matrixDb = new MatrixDBmodified(serverConf, this.logger)
    this.notifier = new Notifier(this.logger)
    this.uiauthenticate = UiAuthenticate(this.matrixDb, serverConf, this.logger)
    this.authenticate = Authenticate(this.matrixDb, this.logger, this.conf)
    this.ready = new Promise((resolve, reject) => {
      this.ready
        .then(() => {
          const badMethod: expressAppHandler = (req, res) => {
            send(res, 405, errMsg('unrecognized'))
          }
          this.api.get = {
            '/_matrix/client/v3/account/whoami': whoami(this),
            '/_matrix/client/v3/admin/whois': whois(this),
            '/_matrix/client/v3/register': badMethod,
            '/_matrix/client/v3/profile/:userId': getProfile(this),
            '/_matrix/client/v3/profile/:userId/avatar_url': getAvatarUrl(this),
            '/_matrix/client/v3/profile/:userId/displayname':
              getDisplayname(this),
            '/_matrix/client/v3/user/:userId/account_data/:type':
              getAccountData(this),
            '/_matrix/client/v3/user/:userId/rooms/:roomId/account_data/:type':
              getRoomAccountData(this),
            '/_matrix/client/v3/devices': getDevices(this),
            '/_matrix/client/v3/devices/:deviceId': getDeviceInfo(this),
            '/_matrix/client/v3/rooms/:roomId/event/:eventId': GetEventId(this),
            '/_matrix/client/v3/rooms/:roomId/joined_members':
              GetJoinedMembers(this),
            '/_matrix/client/v3/user/:userId/rooms/:roomId/tags':
              getUserRoomTags(this),
            '/_matrix/client/v3/joined_rooms': getJoinedRooms(this),
            '/_matrix/client/v3/directory/list/room/:roomId':
              getRoomVisibility(this),
            '/_matrix/client/v3/rooms/:roomId/aliases': getRoomAliases(this),
            '/_matrix/client/v3/account/password/email/requestToken': badMethod,
            '/_matrix/client/v3/account/password/msisdn/requestToken':
              badMethod,
            '/_matrix/client/v3/register/email/requestToken': badMethod,
            '/_matrix/client/v3/register/msisdn/requestToken': badMethod,
            '/_matrix/client/v3/account/3pid/email/requestToken ': badMethod,
            '/_matrix/client/v3/account/3pid/msisdn/requestToken ': badMethod,
            '/_matrix/client/v3/register/email/submitToken':
              SubmitTokenEmail(this),
            '/_matrix/client/v3/rooms/:roomId/timestamp_to_event':
              getTimestampToEvent(this),
            '/_matrix/client/v3/account/password/email/requestToken': badMethod,
            '/_matrix/client/v3/register/email/requestToken': badMethod,
            '/_matrix/client/v3/register/email/submitToken':
              SubmitTokenEmail(this)
          }
          this.api.post = {
            '/_matrix/client/v3/account/whoami': badMethod,
            '/_matrix/client/v3/admin/whois': badMethod,
            '/_matrix/client/v3/register': register(this),
            '/_matrix/client/v3/profile/:userId': badMethod,
            '/_matrix/client/v3/profile/:userId/avatar_url': badMethod,
            '/_matrix/client/v3/profile/:userId/displayname': badMethod,
            '/_matrix/client/v3/user/:userId/account_data/:type': badMethod,
            '/_matrix/client/v3/user/:userId/rooms/:roomId/account_data/:type':
              badMethod,
            '/_matrix/client/v3/devices': badMethod,
            '/_matrix/client/v3/devices/:deviceId': badMethod,
            '/_matrix/client/v3/rooms/:roomId/event/:eventId': badMethod,
            '/_matrix/client/v3/rooms/:roomId/joined_members': badMethod,
            '/_matrix/client/v3/user/:userId/rooms/:roomId/tags': badMethod,
            '/_matrix/client/v3/joined_rooms': badMethod,
            '/_matrix/client/v3/directory/list/room/:roomId': badMethod,
            '/_matrix/client/v3/rooms/:roomId/aliases': badMethod,
            '/_matrix/client/v3/account/password/email/requestToken':
              RequestTokenPasswordEmail(this),
            '/_matrix/client/v3/account/password/msisdn/requestToken':
              RequestTokenPasswordMsisdn(this),
            '/_matrix/client/v3/register/email/requestToken':
              RequestTokenEmail(this),
            '/_matrix/client/v3/register/msisdn/requestToken':
              RequestTokenMsisdn(this),
            '/_matrix/client/v3/account/3pid/email/requestToken':
              RequestTokenEmail(this),
            '/_matrix/client/v3/account/3pid/msisdn/requestToken':
              RequestTokenMsisdn(this),
            '/_matrix/client/v3/register/email/submitToken':
              SubmitTokenEmail(this),
            '/_matrix/client/v3/rooms/:roomId/timestamp_to_event': badMethod
          }
          this.api.put = {
            '/_matrix/client/v3/account/whoami': badMethod,
            '/_matrix/client/v3/admin/whois': badMethod,
            '/_matrix/client/v3/register': badMethod,
            '/_matrix/client/v3/profile/:userId': badMethod,
            '/_matrix/client/v3/profile/:userId/avatar_url':
              changeAvatarUrl(this),
            '/_matrix/client/v3/profile/:userId/displayname':
              changeDisplayname(this),
            '/_matrix/client/v3/user/:userId/account_data/:type':
              putAccountData(this),
            '/_matrix/client/v3/user/:userId/rooms/:roomId/account_data/:type':
              putRoomAccountData(this),
            '/_matrix/client/v3/devices': badMethod,
            '/_matrix/client/v3/devices/:deviceId': changeDeviceName(this),
            '/_matrix/client/v3/rooms/:roomId/event/:eventId': badMethod,
            '/_matrix/client/v3/rooms/:roomId/joined_members': badMethod,
            '/_matrix/client/v3/user/:userId/rooms/:roomId/tags': badMethod,
            '/_matrix/client/v3/user/:userId/rooms/:roomId/tags/:tag':
              addUserRoomTag(this),
            '/_matrix/client/v3/joined_rooms': badMethod,
            '/_matrix/client/v3/directory/list/room/:roomId':
              setRoomVisibility(this),
            '/_matrix/client/v3/rooms/:roomId/aliases': badMethod,
            '/_matrix/client/v3/account/password/email/requestToken': badMethod,
            '/_matrix/client/v3/account/password/msisdn/requestToken':
              badMethod,
            '/_matrix/client/v3/register/email/requestToken': badMethod,
            '/_matrix/client/v3/register/msisdn/requestToken': badMethod,
            '/_matrix/client/v3/account/3pid/email/requestToken ': badMethod,
            '/_matrix/client/v3/account/3pid/msisdn/requestToken ': badMethod,
            '/_matrix/client/v3/register/email/submitToken': badMethod,
            '/_matrix/client/v3/rooms/:roomId/timestamp_to_event': badMethod
          }
          this.api.delete = {
            '/_matrix/client/v3/account/whoami': badMethod,
            '/_matrix/client/v3/admin/whois': badMethod,
            '/_matrix/client/v3/register': badMethod,
            '/_matrix/client/v3/profile/:userId': badMethod,
            '/_matrix/client/v3/profile/:userId/avatar_url': badMethod,
            '/_matrix/client/v3/profile/:userId/displayname': badMethod,
            '/_matrix/client/v3/devices': badMethod,
            '/_matrix/client/v3/devices/:deviceId': deleteDevice(this),
            '/_matrix/client/v3/user/:userId/rooms/:roomId/tags': badMethod,
            '/_matrix/client/v3/user/:userId/rooms/:roomId/tags/:tag':
              removeUserRoomTag(this),
            '/_matrix/client/v3/joined_rooms': badMethod,
            '/_matrix/client/v3/directory/list/room/:roomId': badMethod,
            '/_matrix/client/v3/rooms/:roomId/aliases': badMethod,
            '/_matrix/client/v3/account/password/email/requestToken': badMethod,
            '/_matrix/client/v3/account/password/msisdn/requestToken':
              badMethod,
            '/_matrix/client/v3/register/email/requestToken': badMethod,
            '/_matrix/client/v3/register/email/submitToken': badMethod
          }
          resolve(true)
        })
        /* istanbul ignore next */
        .catch(reject)
    })
  }

  public async init(): Promise<void> {
    // This method is bound to be largely developped in the future
    // It helps to initialize the server with actions that require async operations
    this.accountDataIdManager = await IdManager.createIdManager(
      this.matrixDb,
      this.logger,
      StreamName.ACCOUNT_DATA
    )
    this.presenceStreamIdManager = await IdManager.createIdManager(
      this.matrixDb,
      this.logger,
      StreamName.PRESENCE
    )
    this.eventsStreamIdManager = await IdManager.createIdManager(
      this.matrixDb,
      this.logger,
      StreamName.EVENTS
    )
  }

  // Class methods that determines if a user is hosted in the server or in a remote one
  isMine(userId: string): boolean {
    const parts = userId.split(':')
    return parts[1] === this.conf.server_name
  }

  cleanJobs(): void {
    clearTimeout(this.db?.cleanJob)
    this.cronTasks?.stop()
    this.db?.close()
    this.userDB.close()
    this.logger.close()
    this.matrixDb.close()
  }
}
