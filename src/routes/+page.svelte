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
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

    :global(body), :global(html) {
        margin: 0;
        padding: 0;
        /* 모바일에서 스크롤이 막히지 않도록 수정 */
        height: auto !important; 
        overflow-x: hidden;
    }

    :global(*) {
        font-family: 'Noto Sans KR', sans-serif !important;
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box;
    }
    
    .admin-container { 
        display: grid; 
        /* PC 기본값 */
        grid-template-columns: 310px 1fr; 
        gap: 20px; 
        padding: 20px; 
        min-height: 100vh; 
    }

    .col { 
        background: white; 
        border-radius: 12px; 
        display: flex; 
        flex-direction: column; 
        overflow: hidden; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.03); 
    }

    /* 🔥 모바일 핵심 브레이크포인트 (768px 이하) */
    @media (max-width: 768px) {
        .admin-container {
            /* 1열 세로 배열로 변경 */
            grid-template-columns: 1fr; 
            padding: 10px; /* 여백 줄이기 */
            gap: 15px;
            height: auto;
        }

        .sidebar-wrapper {
            /* 모바일에서는 사이드바가 위로 올라오거나, 
               필요 없다면 display: none; 처리도 고려해보세요 */
            width: 100%;
            order: 2; /* 검색창이 먼저 보이게 하고 싶다면 2로 설정 */
        }

        .main-content {
            width: 100%;
            order: 1; /* 검색창을 상단으로 배치 */
            min-height: 80vh; /* 음악 목록이 보일 정도의 최소 높이 */
        }
        
        /* 모바일 폰트 크기 미세 조정 */
        :global(body) {
            font-size: 14px;
        }
    }
</style>