import { type TwakeLogger } from '@twake/logger'
import {
  AppServerAPIError,
  EHttpMethod,
  validationErrorHandler
} from '@twake/matrix-application-server'
import { type UserDB } from '@twake/matrix-identity-server'
import { type NextFunction, type Response } from 'express'
import { type AuthRequest } from '../../types'
import { type ISearchEngineService } from '../services/interfaces/search-engine-service.interface'
import { logError } from '../utils/error'

export class SearchEngineController {
  searchRoute = '/_twake/app/v1/search'

  constructor(
    private readonly _searchEngineService: ISearchEngineService,
    private readonly _userDB: UserDB,
    private readonly _logger: TwakeLogger
  ) {}

  postSearch = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const userId = req.userId as string
    try {
      validationErrorHandler(req)
      const match = userId.match(/^@(.*):/)
      if (match == null) {
        throw new Error(`Cannot extract user uid from matrix user id ${userId}`)
      }
      const results = await this._userDB.get('users', ['mail'], {
        uid: match[1]
      })
      if (results.length === 0) {
        throw new Error(`User with user id ${match[1]} not found`)
      }
      const responseBody =
        await this._searchEngineService.getMailsMessagesRoomsContainingSearchValue(
          req.body.searchValue as string,
          userId,
          results[0].mail as string
        )
      res.json(responseBody)
    } catch (e: any) {
      logError(this._logger, e, {
        httpMethod: EHttpMethod.POST,
        endpointPath: this.searchRoute,
        matrixUserId: userId
      })

      next(
        e instanceof AppServerAPIError
          ? e
          : new AppServerAPIError({
              status: 500
            })
      )
    }
  }
}
