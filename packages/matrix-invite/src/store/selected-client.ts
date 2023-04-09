import type { IClient } from '$lib/types';
import { writable } from 'svelte/store';

export const selectedClient = writable<IClient | null>();
