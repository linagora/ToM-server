<script lang="ts">
	import { preferredDomains } from '$store/preferred-domains';
	import { parseURL } from './../../../utils/url';
	import Header from './../../../components/Header.svelte';
	import { selectedClient } from '$store/selected-client';
	import type { IClient } from '$lib/types';
	import Client from '../../../components/Client.svelte';
	import Footer from '../../../components/Footer.svelte';
	import Confirmation from '../../../components/Confirmation.svelte';
	import { onMount } from 'svelte';
	import Loading from '../../../components/Loading.svelte';

	interface Props {
		data: { clients: IClient[]; resource: string };
	}

	let { data }: Props = $props();

	const { domain } = parseURL(data.resource);
	let loading = $state(true);

	onMount(() => {
		loading = false;
	});
</script>

<div class="flex flex-col justify-center items-center w-full md:w-2/5 lg:w-1/4 md:pt-10">
	<div
		class="flex flex-col space-y-3 justify-center items-center h-full md:h-3/4 rounded-xl bg-white p-10 shadow-2xl"
	>
		{#if loading}
			<Loading />
		{:else if !$preferredDomains.includes(domain)}
			<Confirmation {domain} />
		{:else}
			<Header resource={data.resource} />
			{#if $selectedClient}
				<div class="border-zinc-300 border px-5 w-full rounded-xl py-6 mx-20">
					<Client client={$selectedClient} />
					<div class="flex flex-row space-x-3 py-5 text-sm">
						<span class="text-zinc-500">You selected {$selectedClient.name}</span>
						<button
							class="text-sky-600 cursor-pointer"
							onclick={() => ($selectedClient = null)}>change</button
						>
					</div>
				</div>
			{:else}
				{#each data.clients as client}
					<div class="border-zinc-300 border px-5 w-full rounded-xl py-6 p- mx-20">
						<Client {client} />
					</div>
				{/each}
			{/if}
		{/if}
	</div>
	<Footer />
</div>
