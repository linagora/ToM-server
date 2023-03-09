import { type expressAppHandler, send } from './utils'

const status: expressAppHandler = (req, res, next) => {
  send(res, 200, {})
}

export default status
