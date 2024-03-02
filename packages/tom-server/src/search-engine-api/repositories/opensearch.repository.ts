import { Client, type ApiResponse } from '@opensearch-project/opensearch'
import { type TwakeLogger } from '@twake/logger'
import { type Config } from '../../types'
import { OpenSearchConfiguration } from '../conf/opensearch-configuration'
import { OpenSearchClientException } from '../utils/error'
import {
  type Document,
  type DocumentWithIndexingAction,
  type IErrorOnMultipleDocuments,
  type IErrorOnSingleDocument,
  type IOpenSearchClientError,
  type IOpenSearchRepository
} from './interfaces/opensearch-repository.interface'

export class OpenSearchRepository implements IOpenSearchRepository {
  private _numberOfShards!: number
  private _numberOfReplicas!: number
  private _waitForActiveShards!: string
  private readonly _openSearchClient: Client
  private readonly _requestOptions: Record<string, any>

  constructor(config: Config, private readonly logger: TwakeLogger) {
    this._setNumberOfShards(config.opensearch_number_of_shards)
    this._setNumberOfReplicas(config.opensearch_number_of_replicas)
    this._setWaitForActiveShards(config.opensearch_wait_for_active_shards)
    const openSearchConfiguration = new OpenSearchConfiguration(config)
    this._openSearchClient = new Client(
      openSearchConfiguration.getClientOptions()
    )
    this._requestOptions = {
      maxRetries: openSearchConfiguration.getMaxRetries()
    }
  }

  private _setNumberOfShards(numberOfShards: number | undefined | null): void {
    if (numberOfShards != null && typeof numberOfShards !== 'number') {
      throw new Error('opensearch_number_of_shards must be a number')
    }
    this._numberOfShards = numberOfShards ?? 1
  }

  private _setNumberOfReplicas(
    numberOfReplicas: number | undefined | null
  ): void {
    if (numberOfReplicas != null && typeof numberOfReplicas !== 'number') {
      throw new Error('opensearch_number_of_replicas must be a number')
    }
    this._numberOfReplicas = numberOfReplicas ?? 1
  }

  private _setWaitForActiveShards(
    waitForActiveShards: string | undefined | null
  ): void {
    if (waitForActiveShards != null) {
      if (typeof waitForActiveShards !== 'string') {
        throw new Error('opensearch_wait_for_active_shards must be a string')
      } else if (waitForActiveShards?.match(/all|\d+/g) == null) {
        throw new Error(
          'opensearch_wait_for_active_shards must be a string equal to a number or "all"'
        )
      }
    }
    this._waitForActiveShards = waitForActiveShards ?? '1'
  }

  private _checkOpenSearchApiResponse(
    response: ApiResponse<boolean | Record<string, any>>,
    additionalsValidStatusCode: number[] = []
  ): void {
    if (
      response.statusCode != null &&
      String(response.statusCode).match(/^20[0-8]$/g) == null &&
      !additionalsValidStatusCode.includes(response.statusCode)
    ) {
      throw new OpenSearchClientException(
        JSON.stringify(response.body, null, 2),
        response.statusCode ?? 500
      )
    }
  }

  private _checkException(
    e:
      | IOpenSearchClientError<
          IErrorOnMultipleDocuments | IErrorOnSingleDocument
        >
      | Error
  ): never {
    if ('meta' in e) {
      throw new OpenSearchClientException(
        JSON.stringify(
          'failures' in e.meta.body ? e.meta.body.failures : e.meta.body,
          null,
          2
        ),
        e.meta.statusCode ?? 500
      )
    }
    throw e
  }

  async createIndex(
    index: string,
    mappings: Record<string, any>
  ): Promise<void> {
    try {
      const response = await this._openSearchClient.indices.create(
        {
          index,
          wait_for_active_shards: this._waitForActiveShards,
          body: {
            mappings,
            settings: {
              index: {
                number_of_shards: this._numberOfShards,
                number_of_replicas: this._numberOfReplicas
              }
            }
          }
        },
        this._requestOptions
      )
      this._checkOpenSearchApiResponse(response)
      this.logger.info(`Index ${index} created`)
    } catch (e) {
      this._checkException(e as Error)
    }
  }

  async indexDocument(index: string, document: Document): Promise<void> {
    try {
      const { id, ...body } = document
      const response = await this._openSearchClient.index(
        {
          id,
          index,
          wait_for_active_shards: this._waitForActiveShards,
          body,
          refresh: true
        },
        this._requestOptions
      )
      this._checkOpenSearchApiResponse(response)
    } catch (e) {
      this._checkException(e as IOpenSearchClientError<IErrorOnSingleDocument>)
    }
  }

  async indexDocuments(
    documentsByIndex: Record<
      string,
      DocumentWithIndexingAction | DocumentWithIndexingAction[]
    >
  ): Promise<void> {
    try {
      const response = await this._openSearchClient.bulk(
        {
          wait_for_active_shards: this._waitForActiveShards,
          refresh: true,
          body: Object.keys(documentsByIndex).reduce<
            Array<Record<string, any>>
          >((acc, index) => {
            let documentDetails: any
            if (Array.isArray(documentsByIndex[index])) {
              documentDetails = (
                documentsByIndex[index] as DocumentWithIndexingAction[]
              ).reduce<Array<Record<string, any>>>((acc, doc) => {
                const { action, id, ...properties } = doc
                return [
                  ...acc,
                  {
                    [action]: {
                      _id: id,
                      _index: index
                    }
                  },
                  properties
                ]
              }, [])
            } else {
              const { action, id, ...properties } = documentsByIndex[
                index
              ] as DocumentWithIndexingAction
              documentDetails = [
                {
                  [action]: {
                    _id: id,
                    _index: index
                  }
                },
                properties
              ]
            }
            return [...acc, ...documentDetails]
          }, [])
        },
        this._requestOptions
      )
      this._checkOpenSearchApiResponse(response)
    } catch (e) {
      this._checkException(
        e as IOpenSearchClientError<IErrorOnMultipleDocuments>
      )
    }
  }

  async updateDocument(index: string, document: Document): Promise<void> {
    try {
      const { id, ...updatedFields } = document

      const response = await this._openSearchClient.update(
        {
          id,
          index,
          wait_for_active_shards: this._waitForActiveShards,
          body: { doc: updatedFields },
          refresh: true
        },
        this._requestOptions
      )
      this._checkOpenSearchApiResponse(response)
    } catch (e) {
      this._checkException(e as IOpenSearchClientError<IErrorOnSingleDocument>)
    }
  }

  async updateDocuments(
    index: string,
    script: string,
    query: Record<string, unknown>
  ): Promise<void> {
    try {
      const response = await this._openSearchClient.update_by_query(
        {
          index,
          refresh: true,
          conflicts: 'proceed',
          wait_for_active_shards: this._waitForActiveShards,
          body: { script: { source: script }, query }
        },
        this._requestOptions
      )
      this._checkOpenSearchApiResponse(response)
    } catch (e) {
      this._checkException(
        e as IOpenSearchClientError<IErrorOnMultipleDocuments>
      )
    }
  }

  async deleteDocument(index: string, id: string): Promise<void> {
    try {
      const documentExists = (
        await this._openSearchClient.exists({
          index,
          id
        })
      )?.body
      if (documentExists) {
        const response = await this._openSearchClient.delete({
          index,
          id,
          refresh: true,
          wait_for_active_shards: this._waitForActiveShards
        })
        this._checkOpenSearchApiResponse(response)
      }
    } catch (e) {
      this._checkException(e as IOpenSearchClientError<IErrorOnSingleDocument>)
    }
  }

  async deleteDocuments(
    index: string,
    query: Record<string, unknown>
  ): Promise<void> {
    try {
      const response = await this._openSearchClient.delete_by_query(
        {
          index,
          refresh: true,
          wait_for_active_shards: this._waitForActiveShards,
          conflicts: 'proceed',
          body: {
            query
          }
        },
        this._requestOptions
      )
      this._checkOpenSearchApiResponse(response)
    } catch (e) {
      this._checkException(e as IOpenSearchClientError<IErrorOnSingleDocument>)
    }
  }

  async indexExists(index: string): Promise<boolean> {
    try {
      const roomsIndexExists = await this._openSearchClient.indices.exists(
        {
          index
        },
        this._requestOptions
      )
      this._checkOpenSearchApiResponse(roomsIndexExists, [404])
      return roomsIndexExists?.body
    } catch (e) {
      this._checkException(e as Error)
    }
  }

  close(): void {
    void this._openSearchClient.close()
  }
}
