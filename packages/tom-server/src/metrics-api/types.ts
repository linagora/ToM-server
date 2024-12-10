export interface IMetricsService {
  getUserActivityStats: () => Promise<UserActivityStats>
  getUserMessageStats: () => Promise<UserMessageCount[]>
}

export interface UserActivityStats {
  /**
   * active users stats
   */
  dailyActiveUsers: MatrixUserInfo[]
  weeklyActiveUsers: MatrixUserInfo[]
  monthlyActiveUsers: MatrixUserInfo[]

  /**
   * New sign-ups stats
   */
  weeklyNewUsers: MatrixUserInfo[]
  monthlyNewUsers: MatrixUserInfo[]
}

export interface MatrixUserInfo {
  name: string
  displayname: string
  avatar_url: string
  last_seen_ts: number
  creation_ts: number
}

export interface UserMessageCount {
  user_id: string
  message_count: number
}

export interface UserMessageEvent {
  sender: string
  type: string
  room_id: string
  content: string
}