<script>
    import { onMount } from 'svelte';
    import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    
    // 분리한 컴포넌트들 임포트
    import SideBar from '../../component/SideBar.svelte';
    import SearchResultView from '../../component/SearchResultView.svelte';
    import LoadingOverlay from '../../component/LoadingOverlay.svelte';
  import AdminSearchHeader from '../../component/AdminSearchHeader.svelte';

	let showStatusMonitor = $state(true);

    onMount(async () => {
        // 페이지 진입 시 초기화
        indexSearchUI.searchInput = ""; 
        indexSearchUI.searchResults = []; 
        indexSearchUI.summaryElement = null;
        
        // 기본 데이터 로딩
        await indexSearchUI.fetchAllFromCollection('hani');
    });


</script>

{#if indexSearchUI.isLoading || indexSearchUI.isIndexing}
    <LoadingOverlay />
{/if}

<div class="admin-container">
    <SideBar bind:showStatusMonitor />

    <main class="col main-content">
        <AdminSearchHeader item={indexSearchUI}/>
        <SearchResultView item={indexSearchUI}/>
    </main>
</div>

<style>
	/* Google Fonts에서 Noto Sans KR 임포트 */
	@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

	:global(body), :global(*) {
		/* 폰트 적용 (나눔고딕보다 더 현대적이고 깔끔합니다) */
		font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
		
		/* 글자를 더 선명하게 만드는 옵션 */
		-webkit-font-smoothing: antialiased;
		-moz-osx-font-smoothing: grayscale;
		text-rendering: optimizeLegibility;
	}
    /* 전체 레이아웃 스타일 */
    .admin-container { 
        display: grid; 
        grid-template-columns: 400px 1fr; 
        gap: 20px; 
        padding: 20px; 
        height: 100vh; 
        box-sizing: border-box; 
    }
    .col { 
        background: white; 
        border-radius: 12px; 
        display: flex; 
        flex-direction: column; 
        overflow: hidden; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.03); 
    }
    .main-content { position: relative; }
</style>