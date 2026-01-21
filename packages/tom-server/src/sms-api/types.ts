import { type NextFunction, type Response } from 'express'
import { type AuthRequest } from '../types.ts'

export interface ISmsApiController {
  send: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>
}

export interface ISmsApiMiddleware {
  checkSendRequirements: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => void

  validateMobilePhone: (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => void
}

export interface ISmsService {
  send: (sms: SMS) => Promise<void>
}

export interface SMS {
  to: string[]
  text: string
}

export interface SendSmsPayload {
  text: string
  recipients: Recipient[]
  type: 'sms_premium' | 'sms_low_cost'
  sender: string
}

interface Recipient {
  phone_number: string
}
