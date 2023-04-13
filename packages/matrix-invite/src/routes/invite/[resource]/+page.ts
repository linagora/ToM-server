import { getClients } from '$lib/clients'
import { error } from '@sveltejs/kit'
import { valid } from '../../../utils/validation'
import type { PageLoad } from './$types'

export const load: PageLoad = ({ params }) => {
  const { resource } = params

  if (!resource || !valid(resource)) {
    throw error(400, 'Invalid resource')
  }

  return {
    clients: getClients(resource),
    resource
  }
}
