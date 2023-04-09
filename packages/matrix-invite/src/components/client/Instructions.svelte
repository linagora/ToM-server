<script lang="ts">
	export let instructions: string | null;
</script>

{#if instructions}
	<span class="text-base">
		{instructions}
	</span>
{/if}
