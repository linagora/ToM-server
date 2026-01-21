import fs from 'fs'
import { randomString } from '@twake-chat/crypto'

/**
 * builds the email body from a template
 *
 * @param config
 * @param templatePath
 * @param from
 * @returns {string | undefined}
 */
export const buildEmailBody = (
  templatePath: string,
  inviter: string,
  destination: string,
  link: string,
  from: string
): string | undefined => {
  const templateContent = fs.readFileSync(templatePath).toString()
  return templateContent
    .replace(/__from__/g, from)
    .replace(/__to__/g, destination)
    .replace(/__multipart_boundary__/g, randomString(32))
    .replace(/__inviter_name__/g, inviter)
    .replace(/__link__/g, link)
    .replace(/__date__/g, new Date().toUTCString())
    .replace(/__messageid__/g, randomString(32))
}

/**
 * builds the sms body from a template
 *
 * @param templatePath
 * @param inviter
 * @param link
 * @returns {string | undefined}
 */
export const buildSmsBody = (
  templatePath: string,
  inviter: string,
  link: string,
  footer?: string
): string | undefined => {
  try {
    const templateContent = fs.readFileSync(templatePath).toString()
    return templateContent
      .replace(/__inviter__/g, inviter)
      .replace(/__invitation_link__/g, link)
      .replace(/__footer__/g, footer ?? '') // include a footer if present
  } catch (error) {
    console.error('Failed to build sms body', { error })
    return undefined
  }
}
