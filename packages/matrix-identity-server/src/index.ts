// types
import type {expressAppHandler} from './utils'

type IdServerAPI = {
  [url: string]: expressAppHandler
}

// Internal libraries
import versions from './versions'

export default class MatrixServer {
  api: {
    get: IdServerAPI,
    post: IdServerAPI,
    put?: IdServerAPI,
  };

  constructor () {
    // TODO: insert here all endpoints
    this.api = {
      get: {
        '/_matrix/identity/versions': versions,
      },
      post: {
      },
    }
  }

}
