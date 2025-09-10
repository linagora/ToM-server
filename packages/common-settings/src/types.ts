export interface UserInformationPayload {
  displayName?: string;
  avatarUrl?: string;
}

export interface CommonSettingsMessage {
  source: string
  nickname: string
  request_id: string
  timestamp: number
  version: number
  payload: {
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
}

export interface UserSettings {
  matrix_id: string;
  settings: string;
  version: number;
}