<script lang="ts">
	import '../app.css';
	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<div class="min-h-screen w-full flex justify-center items-center overflow-hidden bg-hero text-zinc-800 bg-zinc-100 bg-fixed">
	{@render children?.()}
</div>

<svelte:head>
	<title>You're invited to Talk on Matrix</title>
</svelte:head>