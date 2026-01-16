<script>
    import SearchResultList from "./SearchResultList.svelte";
    import Reporter from "./Reporter.svelte";
	let { item } = $props()
</script>

<div class="main-scroll-viewport">    
    <SearchResultList item={item} />

    <hr class="section-divider" />
    
    <Reporter item={item}/>
</div>

<style>
    .main-scroll-viewport { flex: 1; overflow-y: auto; background: #f1f5f9; padding: 20px; }
    .section-divider { border: 0; border-top: 2px solid #e2e8f0; margin: 40px 0; }
    /* .no-result { margin-top: 20px; margin-left: 20px; font-size: 1.2rem; color:#666; } */
</style>