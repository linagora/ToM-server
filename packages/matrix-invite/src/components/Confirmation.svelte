<script lang="ts">
	import { preferredDomains } from '$store/preferred-domains';

  interface Props {
    domain: string;
  }

  let { domain }: Props = $props();

  // Use Svelte 5 derived state (fixes memory leak and initialization)
  let existingDomains = $derived($preferredDomains);

  const trustDomain = () => {
    preferredDomains.set([...existingDomains, domain]);
  }
</script>

<div class="flex flex-col space-y-5">
	<p class="text-base">
		this link uses the
		<span class="font-bold">{domain}</span> homeserver. <a href="/" class="text-sky-600" rel="noopener">use another server</a> or do you wish to continue?
	</p>

  <button class="w-full bg-sky-600 rounded-xl p-4 text-white text-base font-bold flex justify-center flex-row" onclick={trustDomain}>
    continue
  </button>
</div>
