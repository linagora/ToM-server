import type MatrixClientServer from '..'
import { errMsg, send, type expressAppHandler } from '@twake/utils'

const getUploadConfig = (
  clientServer: MatrixClientServer
): expressAppHandler => {
  return (req, res) => {
    if (
      clientServer.conf.media === undefined ||
      clientServer.conf.media.uploadSizeLim === null
    ) {
      send(res, 500, errMsg('unknown', 'No upload config found'))
    } else {
      send(res, 200, {
        'm.upload.size': clientServer.conf.media.uploadSizeLim
      })
    }
  }
}

export default getUploadConfig
