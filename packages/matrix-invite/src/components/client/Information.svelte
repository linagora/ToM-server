<script lang="ts">
	import type { IClient } from '$lib/types';

	interface Props {
		client: IClient;
	}

	let { client }: Props = $props();
</script>

<div class="flex flex-row justify-center items-center">
	<div class="flex flex-col space-y-5">
		<span class="text-2xl font-bold">{client.name}</span>
			<p>
				{client.description}
				<a href={client.homepage} target="_blank" rel="noopener" class="text-sky-500">learn more</a>
			</p>
	</div>
	<div>
		<img
			src="/images/{client.icon}"
			alt="{client.name} icon"
			class="h-20 w-20 rounded-lg bg-cover"
		/>
	</div>
</div>
