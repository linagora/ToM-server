import type { IClient } from '$lib/types';
import { ElementClient } from './element';
import { FluffyChatClient } from './fluffychat';

export const getClients = (resource: string): IClient[] => {
	return [new ElementClient(resource), new FluffyChatClient(resource)];
};
