<script lang="ts">
	interface Props {
		instructions: string | null;
	}

	let { instructions }: Props = $props();
</script>

{#if instructions}
	<span class="text-base">
		{instructions}
	</span>
{/if}
