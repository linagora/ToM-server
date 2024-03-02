export enum EOpenSearchIndexingAction {
  CREATE = 'create',
  INDEX = 'index'
}

export interface Document {
  id: string
  [key: string]: string
}

export interface DocumentWithIndexingAction extends Document {
  action: EOpenSearchIndexingAction.CREATE | EOpenSearchIndexingAction.INDEX
}

export interface IOpenSearchClientError<T> {
  name: string
  meta: {
    body: T
    statusCode: number
    headers: {
      server: string
      date: string
      'content-type': string
      'content-length': string
      connection: string
      'strict-transport-security': string
    }
    meta: {
      context: string | null
      request: {
        params: {
          method: string
          path: string
          body: string
          querystring: string
          headers: {
            'user-agent': string
            'content-type': string
            'content-length': string
          }
          timeout: number
        }
        options: {
          maxRetries: number
        }
        id: number
      }
      name: string
      connection: {
        url: string
        id: string
        headers: Record<string, unknown>
        deadCount: number
        resurrectTimeout: number
        _openRequests: number
        status: string
        roles: {
          data: boolean
          ingest: boolean
        }
      }
      attempts: number
      aborted: boolean
    }
  }
}

export interface IErrorOnMultipleDocuments {
  took: number
  timed_out: boolean
  total: number
  updated: number
  deleted: number
  batches: number
  version_conflicts: number
  noops: number
  retries: {
    bulk: number
    search: number
  }
  throttled_millis: number
  requests_per_second: number
  throttled_until_millis: number
  failures: Array<{
    index: string
    id: string
    cause: {
      type: string
      reason: string
      index: string
      shard: string
      index_uuid: string
    }
    status: number
  }>
}

export interface IErrorOnSingleDocument {
  _index: string
  _id: string
  _version: number
  result: string
  _shards: {
    total: number
    successful: number
    failed: number
  }
  _seq_no: number
  _primary_term: number
}

export interface IOpenSearchRepository {
  createIndex: (index: string, mappings: Record<string, any>) => Promise<void>
  indexDocument: (index: string, document: Document) => Promise<void>
  indexDocuments: (
    documentsByIndex: Record<
      string,
      DocumentWithIndexingAction | DocumentWithIndexingAction[]
    >
  ) => Promise<void>
  updateDocument: (index: string, document: Document) => Promise<void>
  updateDocuments: (
    index: string,
    script: string,
    query: Record<string, unknown>
  ) => Promise<void>
  indexExists: (index: string) => Promise<boolean>
  deleteDocument: (index: string, id: string) => Promise<void>
  deleteDocuments: (
    index: string,
    query: Record<string, unknown>
  ) => Promise<void>
  close: () => void
}
