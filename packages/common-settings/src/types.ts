export interface UserInformationPayload {
  displayName?: string
  avatarUrl?: string
}

interface SettingsPayload {
  language?: string
  timezone?: string
  avatar?: string
  last_name?: string
  first_name?: string
  email?: string
  phone?: string
  matrix_id?: string
  display_name?: string
}

export interface CommonSettingsMessage {
  source: string
  nickname: string
  request_id: string
  timestamp: number
  version: number
  payload: SettingsPayload
}

export interface UserSettings {
  matrix_id: string
  settings: SettingsPayload
  version: number
}
