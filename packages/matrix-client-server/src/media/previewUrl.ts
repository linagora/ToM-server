/**
 * https://spec.matrix.org/v1.11/client-server-api/#get_matrixclientv1mediapreview_url
 *
 * This API returns a preview of the content at a given URL.
 * The server will fetch the URL and use the OpenGraph data if available to generate a preview.
 *
 *
 *
 *
 * It it specified in the spec that clients should consider avoiding this endpoint for URLs posted in encrypted rooms.
 * Encrypted rooms often contain more sensitive information the users do not want to share with the homeserver,
 * and this can mean that the URLs being shared should also not be shared with the homeserver.
 */

import type MatrixClientServer from '..'
import { errMsg, send, type expressAppHandler } from '@twake/utils'
import { type Request } from 'express'

const getPreviewUrl = (clientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    const url = (req as Request).query.url as string
    if (url === null || url === undefined || url.length > 2048) {
      send(res, 400, errMsg('invalidParam', 'Wrong URL parameter'))
      return
    }
    let ts = parseInt((req as Request).query.ts as string)
    if (ts === null || ts === undefined) {
      ts = Date.now()
    }

    clientServer.authenticate(req, res, (token) => {
      const requesterUserId = token.sub

      // TODO : create the OpenGraph data for the URL, which may be empty.
      // Some values are replaced with matrix equivalents if they are provided in the response.
      // The differences from the OpenGraph protocol are described here.

      // Send created openGraph data to the client.
    })
  }
}

export default getPreviewUrl
