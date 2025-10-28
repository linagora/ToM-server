import { type Response } from 'express'
import type http from 'http'

export type SearchFunction = (
  res: Response | http.ServerResponse,
  data: Query
) => Promise<void>

export interface Query {
  scope: string[]
  fields?: string[]
  limit?: number
  offset?: number
  val?: string
  owner?: string
}

export const SearchFields = new Set<string>([
  'mail',
  'mobile',
  'uid',
  'displayName',
  'givenName',
  'cn',
  'sn',
  'matrixAddress'
])
