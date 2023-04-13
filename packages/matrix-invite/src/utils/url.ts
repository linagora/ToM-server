import { ResourceType, type ParsedUrl } from '$lib/types'
import { valid } from './validation'

/**
 * Parses a matrix resource URL.
 *
 * @param {string} url - the matrix resource URL.
 * @returns {ParsedUrl}
 */
export const parseURL = (url: string): ParsedUrl => {
  if (!valid(url)) {
    throw Error('invalid resource URL')
  }

  const domain = url.split(':').pop() as string
  const resource = url.slice(1).split(':')[0]
  const prefix = url[0]
  let type: ResourceType

  switch (prefix) {
    case '#':
      type = ResourceType.ROOM_ALIAS
      break

    case '!':
      type = ResourceType.ROOM_ID
      break

    case '+':
      type = ResourceType.GROUP
      break

    case '@':
      type = ResourceType.USER
      break

    case '$':
      type = ResourceType.EVENT
      break

    default:
      throw Error('Invalid resource type')
  }

  return {
    domain,
    resource,
    type
  }
}
