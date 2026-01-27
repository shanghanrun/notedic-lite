<script lang="ts">
    import { searchUI } from '$lib/searchUI.svelte';
    import { onMount } from 'svelte';
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
    <main class="col main-content">
        <UserSearchHeader item={searchUI} />
        <SearchResultView item={searchUI}/>
    </main>

    <aside class="col sidebar-column">
        <SideBar_FileImport />
    </aside>
</div>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');

    /* 1. 전역 리셋 및 모바일 최적화 */
    :global(body), :global(html) {
        margin: 0;
        padding: 0;
        width: 100%;
        max-width: 100vw;
        overflow-x: hidden; /* 가로 스크롤 절대 방지 */
        background-color: #f8fafc; /* 연한 배경색으로 가독성 향상 */
    }

    :global(*) {
        font-family: 'Noto Sans KR', sans-serif !important;
        -webkit-font-smoothing: antialiased;
        box-sizing: border-box; /* 패딩이 폭을 넓히지 않도록 고정 */
    }
    
    /* 2. 레이아웃: 모바일 우선 (Mobile First) */
    .admin-container { 
        display: flex;
        flex-direction: column; /* 모바일에선 위아래로 */
        gap: 15px; 
        padding: 10px; 
        width: 100%;
        min-height: 100vh; 
    }

    .col { 
        background: white; 
        border-radius: 12px; 
        display: flex; 
        flex-direction: column; 
        overflow: hidden; 
        box-shadow: 0 2px 10px rgba(0,0,0,0.03); 
        width: 100%;
    }

    /* 3. 데스크톱 대응 (768px 이상) */
    @media (min-width: 768px) {
        .admin-container { 
            display: grid; 
            grid-template-columns: 310px 1fr; /* 사이드바 고정, 나머지 본문 */
            gap: 20px; 
            padding: 20px; 
            max-width: 1400px; /* 너무 넓어지지 않게 상한선 */
            margin: 0 auto;
        }

        .main-content {
            order: 2; /* 데스크톱에선 오른쪽에 배치 */
        }

        .sidebar-column {
            order: 1; /* 데스크톱에선 왼쪽에 배치 */
            position: sticky;
            top: 20px;
            height: calc(100vh - 40px); /* 화면에 고정 */
        }
    }

    /* 4. 모바일 디테일 조정 (767px 이하) */
    @media (max-width: 767px) {
        .admin-container {
            display: flex;
            flex-direction: column; /* 위아래 배치 */
        }

        .sidebar-column {
            order: 1; /* 🥇 작업 순서 1순위: 파일 임포트가 맨 위로! */
            margin-bottom: 5px; 
        }

        .main-content {
            order: 2; /* 🥈 그 다음이 검색창과 결과 리스트 */
            min-height: 60vh;
        }

        :global(body) {
            font-size: 14px;
        }
    }
</style>