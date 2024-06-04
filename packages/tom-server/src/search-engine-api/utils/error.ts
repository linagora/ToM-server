import { type TwakeLogger } from '@twake/logger'
import { AppServerAPIError } from '@twake/matrix-application-server'

export class OpenSearchClientException extends Error {
  constructor(
    message?: string,
    public readonly statusCode = 500,
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}

export const formatErrorMessageForLog = (
  error: OpenSearchClientException | AppServerAPIError | Error | string
): string => {
  return error instanceof OpenSearchClientException ||
    error instanceof AppServerAPIError ||
    error instanceof Error
    ? error.message
    : JSON.stringify(error, null, 2)
}

export const logError = (
  logger: TwakeLogger,
  error: OpenSearchClientException | AppServerAPIError | Error | string,
  additionnalDetails?: Record<string, string>
): void => {
  const errorDetail = additionnalDetails ?? {}
  if (
    (error instanceof OpenSearchClientException ||
      error instanceof AppServerAPIError) &&
    error.statusCode != null
  ) {
    errorDetail.status = error.statusCode.toString()
  }

  logger.error(formatErrorMessageForLog(error), errorDetail)
}
