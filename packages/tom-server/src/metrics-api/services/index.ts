import type { MatrixDBBackend } from '@twake-chat/matrix-identity-server'
import type {
  IMetricsService,
  MatrixUserInfo,
  MatrixUserIpInfo,
  UserActivityStats,
  UserMessageCount,
  UserMessageEvent
} from '../types.ts'
import type { TwakeLogger } from '@twake-chat/logger'

class MetricsService implements IMetricsService {
  private readonly ONE_DAY_IN_MS = 24 * 60 * 60 * 1000
  private readonly ONE_WEEK_IN_MS = 7 * this.ONE_DAY_IN_MS
  private readonly ONE_MONTH_IN_MS = 30 * this.ONE_DAY_IN_MS

  constructor(
    private readonly matrixDb: MatrixDBBackend,
    private readonly logger: TwakeLogger
  ) {
    this.logger.info('[MetricsService] initialized.')
  }

  /**
   * Fetches the user activity stats.
   *
   * new signups and login in the last 24 hours, 7 days and 30 days
   *
   * @returns {Promise<UserActivityStats>}
   */
  getUserActivityStats = async (): Promise<UserActivityStats> => {
    try {
      const users = await this._fetchUsersList()
      const dailyActiveUsers = this._getDailyActiveUsers(users)
      const weeklyActiveUsers = this._getWeeklyActiveUsers(users)
      const monthlyActiveUsers = this._getMonthlyActiveUsers(users)
      const weeklyNewUsers = this._getWeeklyNewUsers(users)
      const monthlyNewUsers = this._getMonthlyNewUsers(users)

      return {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        weeklyNewUsers,
        monthlyNewUsers
      }
    } catch (error) {
      this.logger.error(`Failed to fetch user activity stats`, { error })

      throw Error('Failed to fetch user activity stats')
    }
  }

  /**
   * Fetches the message count of each user.
   *
   * @returns {Promise<UserMessageCount[]>}
   */
  getUserMessageStats = async (): Promise<UserMessageCount[]> => {
    try {
      const stats: UserMessageCount[] = []
      const users = await this._fetchUsersList()

      await Promise.all(
        users.map(async (user) => {
          const messageCount = await this._getUserMessageCount(user.name)
          stats.push(messageCount)
        })
      )

      return stats.sort((a, b) => b.message_count - a.message_count)
    } catch (error) {
      this.logger.error(`Failed to fetch user message count`, { error })

      throw Error('Failed to fetch user message count')
    }
  }

  /**
   * Fetches the list of users from the database
   * @returns {Promise<MatrixUserInfo[]>}
   */
  private readonly _fetchUsersList = async (): Promise<MatrixUserInfo[]> => {
    try {
      const matrixUsers: MatrixUserInfo[] = []
      const usersList = (await this.matrixDb.getAll('users', [
        'name',
        'creation_ts'
      ])) as unknown as MatrixUserInfo[]

      await Promise.all(
        usersList.map(async (user) => {
          const lastSeenTs = await this._fetchUserLastSeenTime(user.name)

          matrixUsers.push({
            ...user,
            creation_ts: user.creation_ts * 1000,
            last_seen_ts: lastSeenTs
          })
        })
      )

      return matrixUsers
    } catch (error) {
      this.logger.error(`Failed to fetch users list`, { error })

      throw Error('Failed to fetch users list')
    }
  }

  /**
   * Gets the Daily active users
   *
   * @returns {MatrixUserInfo[]}
   */
  private readonly _getDailyActiveUsers = (
    users: MatrixUserInfo[]
  ): MatrixUserInfo[] => {
    const currentEpochTime = new Date().getTime()
    const oneDayAgo = currentEpochTime - this.ONE_DAY_IN_MS

    return users.filter(
      (user) => user.last_seen_ts >= oneDayAgo || user.creation_ts >= oneDayAgo
    )
  }

  /**
   * Gets the weekly active users
   *
   * @returns {MatrixUserInfo[]}
   */
  private readonly _getWeeklyActiveUsers = (
    users: MatrixUserInfo[]
  ): MatrixUserInfo[] => {
    const currentEpochTime = new Date().getTime()
    const oneWeekAgo = currentEpochTime - this.ONE_WEEK_IN_MS

    return users.filter(
      (user) =>
        user.last_seen_ts >= oneWeekAgo || user.creation_ts >= oneWeekAgo
    )
  }

  /**
   * Gets the monthly active users
   *
   * @returns {MatrixUserInfo[]}
   */
  private readonly _getMonthlyActiveUsers = (
    users: MatrixUserInfo[]
  ): MatrixUserInfo[] => {
    const currentEpochTime = new Date().getTime()
    const oneMonthAgo = currentEpochTime - this.ONE_MONTH_IN_MS

    return users.filter(
      (user) =>
        user.last_seen_ts >= oneMonthAgo || user.creation_ts >= oneMonthAgo
    )
  }

  /**
   * Gets the weekly new users
   *
   * @returns {MatrixUserInfo[]}
   */
  private readonly _getWeeklyNewUsers = (
    users: MatrixUserInfo[]
  ): MatrixUserInfo[] => {
    const currentEpochTime = new Date().getTime()
    const oneWeekAgo = currentEpochTime - this.ONE_WEEK_IN_MS

    return users.filter((user) => user.creation_ts >= oneWeekAgo)
  }

  /**
   * Gets the monthly new users
   *
   * @returns {MatrixUserInfo[]}
   */
  private readonly _getMonthlyNewUsers = (
    users: MatrixUserInfo[]
  ): MatrixUserInfo[] => {
    const currentEpochTime = new Date().getTime()
    const oneMonthAgo = currentEpochTime - this.ONE_MONTH_IN_MS

    return users.filter((user) => user.creation_ts >= oneMonthAgo)
  }

  /**
   * Fetches the message count of a specific user.
   *
   * @param {string} userId - the user id.
   * @returns {Promise<UserMessageCount>} - the message count of the user.
   */
  private readonly _getUserMessageCount = async (
    userId: string
  ): Promise<UserMessageCount> => {
    try {
      const queryResult = (await this.matrixDb.get('events', ['sender'], {
        sender: userId,
        type: 'm.room.message'
      })) as unknown as UserMessageEvent[]

      return {
        user_id: userId,
        message_count: queryResult.length
      }
    } catch (error) {
      this.logger.error(`Failed to fetch user message count`, { error })

      throw Error('Failed to fetch user message count')
    }
  }

  /**
   * Fetches the last time a user was seen.
   *
   * @param {string} userId - the user id.
   * @returns {Promise<number>} - the last time the user was seen.
   */
  private readonly _fetchUserLastSeenTime = async (
    userId: string
  ): Promise<number> => {
    try {
      const queryResult = (await this.matrixDb.get(
        'user_ips',
        ['user_id', 'last_seen'],
        {
          user_id: userId
        }
      )) as unknown as MatrixUserIpInfo[]

      const latestSeenTime = queryResult.reduce(
        (latestTime, userIpInfo) =>
          userIpInfo.last_seen > latestTime ? userIpInfo.last_seen : latestTime,
        0
      )

      return latestSeenTime
    } catch (error) {
      this.logger.warn(`Failed to fetch user access info`, { error })

      return 0
    }
  }
}

export default MetricsService
