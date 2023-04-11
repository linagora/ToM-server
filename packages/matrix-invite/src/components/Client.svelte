<script lang="ts">
	import type { IClient } from '$lib/types';
	import DeepLink from './client/DeepLink.svelte';
	import Information from './client/Information.svelte';
	import InstallLinks from './client/InstallLinks.svelte';
	import Instructions from './client/Instructions.svelte';
	import Platforms from './client/Platforms.svelte';

	export let client: IClient;
</script>

<div class="flex flex-col space-y-3">
	<Information {client} />
	<Platforms platforms={client.platforms} />
	<Instructions instructions={client.instructions}/>
	<InstallLinks links={client.installLinks} />
	<DeepLink link={client.deepLink} {client} />
</div>
