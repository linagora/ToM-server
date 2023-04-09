<script lang="ts">
	import { selectedClient } from '$store/selected-client';
	import type { IClient } from '$lib/types';

	export let link: string | null;
	export let client: IClient;
</script>

{#if $selectedClient && $selectedClient.webLink}
	<a
		class="w-full text-sky-600 rounded-lg p-4 bg-white text-base font-bold items-center justify-center flex flex-row border-sky-600 border"
		href={$selectedClient.webLink}
		target="_blank"
		rel="noopener"
	>
		Continue on your browser
	</a>
{:else if link && link.length}
	<a
		class="w-full bg-sky-600 rounded-lg p-4 text-white text-base font-bold items-center justify-center flex flex-row"
		on:click={() => ($selectedClient = client)}
		href={link}
	>
		Continue
	</a>
{/if}
