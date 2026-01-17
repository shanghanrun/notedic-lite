<script>
import { searchUI } from '$lib/searchUI.svelte';
import { onMount } from 'svelte'
  import SearchResultView from '../component/SearchResultView.svelte';
  import SideBar_FileImport from '../component/SideBar_FileImport.svelte';
  import UserSearchHeader from '../component/UserSearchHeader.svelte';

onMount(() => {
        // 페이지에 들어오자마자 이전 상태 초기화
        searchUI.reset();      
        console.log("🏠 홈 화면 진입: 검색 상태를 초기화했습니다.");
    });

</script>

<div class="admin-container">
    

    <SideBar_FileImport />

    <main class="col main-content">
        <UserSearchHeader item={searchUI} />
        <SearchResultView item={searchUI}/>
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