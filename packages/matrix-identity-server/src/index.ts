// Internal libraries
import versions from './versions'

// types
import type { expressAppHandler } from './utils'

type IdServerAPI = Record<string, expressAppHandler>

export default class MatrixServer {
  api: {
    get: IdServerAPI
    post: IdServerAPI
    put?: IdServerAPI
  }

  constructor () {
    // TODO: insert here all endpoints
    this.api = {
      get: {
        '/_matrix/identity/versions': versions
      },
      post: {
      }
    }
  }
}
