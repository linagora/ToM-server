import { browser } from '$app/environment';
import { writable } from 'svelte/store';

let domains: string[] = [];

if (browser) {
	const storedDomains = window.localStorage.getItem('domains');

	if (storedDomains) domains = JSON.parse(storedDomains);
}

export const preferredDomains = writable<string[]>(domains);

preferredDomains.subscribe((value: string[]) => {
	browser && window.localStorage.setItem('domains', JSON.stringify(value));
});

export const reset = () => {
	preferredDomains.set([]);
};
