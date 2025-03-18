import { Config } from '../../types'
import EmailService from './email-service'

const sendMailMock = jest.fn()
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation(() => ({
    sendMail: sendMailMock
  }))
}))

describe('the Email Service', () => {
  const configMock = {
    server_name: 'example.com',
    matrix_server: 'example.com',
    smtp_server: 'smtp.example.com',
    smtp_port: 587,
    smtp_user: 'XXXX',
    smtp_password: 'XXXX',
    smtp_sender: 'from@example.com',
    smtp_tls: true,
    smtp_verify_certificate: true
  } as unknown as Config

  const service = new EmailService(configMock)

  describe('the send method', () => {
    it('should attempt to send en email', async () => {
      await service.send({
        to: 'to@example.com',
        subject: 'subject',
        text: 'text'
      })

      expect(sendMailMock).toHaveBeenCalledWith({
        from: 'from@example.com',
        to: 'to@example.com',
        subject: 'subject',
        text: 'text'
      })
    })
  })
})
