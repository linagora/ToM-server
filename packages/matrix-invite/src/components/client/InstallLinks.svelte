<script lang="ts">
	import type { InstallLink } from '$lib/types';

	export let links: InstallLink[];
</script>

{#each links as { url, platform }}
	{#if platform === 'Web'}
		<a
			class="w-full text-sky-600 rounded-lg p-4 bg-white text-base font-bold items-center justify-center flex flex-row border-sky-600 border"
			href={url}
			target="_blank"
			rel="noopener"
		>
			Continue on your browser
		</a>
	{:else if ['Linux', 'Windows', 'MacOS'].includes(platform)}
		<a
			class="w-full bg-sky-600 rounded-lg p-4 text-white text-base font-bold items-center justify-center flex flex-row"
			href={url}
			target="_blank"
			rel="noopener"
		>
			Install for {platform}
		</a>
	{:else if platform === 'FlatHub'}
		<a href={url} target="_blank" rel="noopener">
			<img src="/images/flathub.svg" alt="Download from FlatHub" class="w-32" />
		</a>
	{:else if platform === 'AppStore'}
		<a href={url} target="_blank" rel="noopener">
			<img src="/images/appstore.svg" alt="Download from App Store" class="w-32" />
		</a>
	{:else if platform === 'FDroid'}
		<a href={url} target="_blank" rel="noopener">
			<img src="/images/fdroid.svg" alt="Download from FDroid" class="w-32" />
		</a>
	{:else if platform === 'PlayStore'}
		<a href={url} target="_blank" rel="noopener">
			<img src="/images/playstore.svg" alt="Download from Goole Play Store" class="w-32" />
		</a>
	{/if}
{/each}
