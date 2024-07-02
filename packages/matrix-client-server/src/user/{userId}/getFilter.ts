import MatrixClientServer from '../..'
import { errMsg } from '@twake/matrix-identity-server'
import {
  send,
  type expressAppHandler
} from '@twake/matrix-identity-server/dist/utils'

interface parameters {
  userID: string
  filterID: string
}

const GetFilter = (ClientServer: MatrixClientServer): expressAppHandler => {
  return (req, res) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    const prms: parameters = (req as Request).params as parameters
    if (prms.userID?.length != null && prms.filterID?.length != null) {
      ClientServer.authenticate(req, res, (data, id) => {
        let responseBody = {}
        // aller récupérer les informations stockées cf postFilter
        send(res, 200, responseBody)
      })
    } else {
      send(res, 400, errMsg('missingParams'))
    }
  }
}

export default GetFilter
