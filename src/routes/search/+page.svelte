<script>
	import SideBar_FileImport from './../../component/SideBar_FileImport.svelte';
  import { searchUI } from '$lib/searchUI.svelte';
  import { page } from '$app/stores';
  import SearchHeader from '../../component/AdminSearchHeader.svelte';
  import SearchResultView from '../../component/SearchResultView.svelte';
  import {onMount} from 'svelte'
  import UserSearchHeader from '../../component/UserSearchHeader.svelte';

  // src/routes/search/+page.svelte

let isLoading = $state(false);

async function loadData() {
    isLoading = true;
    let retryCount = 0;
    const maxRetries = 10;

    while (retryCount < maxRetries) {
        // 1. 먼저 localStorage 확인
        let targetText = localStorage.getItem("shared_pendingText");
        
        // 2. 만약 localStorage가 비어있다면? 클립보드에서 직접 긁어오기 시도!
        if (!targetText || targetText.trim() === "") {
            try {
                // 브라우저 팝업이 활성화된 상태에서만 작동합니다.
                targetText = await navigator.clipboard.readText();
                if (targetText && targetText.trim() !== "") {
                    console.log("📋 [클립보드 수령] 복사된 텍스트를 발견했습니다!");
                }
            } catch (err) {
                // 권한 거부 시 조용히 넘어갑니다 (사용자가 복사 안 했을 수도 있으니까요)
                console.warn("클립보드 접근 권한이 없거나 비어있습니다.");
            }
        }

        // 최종적으로 데이터가 확보되었다면 처리 시작!
        if (targetText && targetText.trim() !== "") {
            console.log("✅ [데이터 로드 성공] 시도 횟수:", retryCount + 1);
            
            const lines = targetText.split('\n').filter(l => l.trim() !== "");
            
            // Svelte 5 룬 할당 (반응성 유지)
            searchUI.files = [{ 
                name: "웹페이지 추출 원문", 
                lines: lines, 
                checked: true 
            }];
            
            // 사용한 데이터 정리 (localStorage만 비워줌)
            localStorage.removeItem("shared_pendingText");
            
            isLoading = false;
            return true;
        }

        console.log("⏳ 데이터 대기 중... 재시도:", retryCount + 1);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.warn("⚠️ 모든 수단 실패 (일반 검색 모드로 전환)");
    isLoading = false;
    return false;
}
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
    /* 뷰포트 높이에 맞춘 메인 컨텐츠 영역 최적화 */
    .main-content {
        display: flex;
        flex-direction: column;
        height: 100%;
        border: 1px solid #eef2f6; /* 연한 테두리로 섹션 구분 */
    }

    /* 사이드바와 메인 사이의 구분선 강조 */
    .admin-container {
        background-color: #f8fafc; /* 전체 배경을 살짝 회색조로 잡아 컨텐츠 부각 */
    }

    /* 스크롤바 커스텀 (현대적인 UI 느낌) */
    :global(::-webkit-scrollbar) {
        width: 8px;
    }
    :global(::-webkit-scrollbar-track) {
        background: #f1f1f1;
    }
    :global(::-webkit-scrollbar-thumb) {
        background: #ccc;
        border-radius: 4px;
    }
    :global(::-webkit-scrollbar-thumb:hover) {
        background: #aaa;
    }

</style>


<!-- <div class="search-container" onscroll={(e) => searchUI.handleScroll(e)}>
  <header>
    <h2>검색어: <span class="query">{searchUI.searchQuery}</span></h2>
    {#if isLoading}
      <p>데이터를 분석 중입니다...</p>
    {:else}
      <p>총 <strong>{searchUI.searchResults.length}</strong>건의 결과가 발견되었습니다.</p>
    {/if}
  </header>

  <hr />

  <div class="results-viewport" style="height: {searchUI.containerHeight}px; position: relative; overflow-y: auto;">
    <div class="total-padding" style="height: {searchUI.totalHeight}px;">
      {#each searchUI.visibleResults as item (item.uniqueKey)}
        <div 
          class="result-card {item.isAndMatch ? 'and-match' : ''}"
          style="position: absolute; top: {item.renderTop}px; height: {searchUI.itemHeight}px; width: 100%;"
        >
          <div class="file-name">{item.fileName} - {item.lineIndex + 1}행</div>
          <div class="content">
            {@html searchUI.highlightText(item.text)}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .search-container { padding: 20px; }
  .query { color: #2980b9; font-weight: bold; }
  .result-card { border-bottom: 1px solid #eee; padding: 10px; box-sizing: border-box; background: white; }
  .and-match { border-left: 4px solid #2ecc71; background-color: #fafffa; }
  .file-name { font-size: 0.8rem; color: #7f8c8d; margin-bottom: 5px; }
  .content { line-height: 1.6; word-break: break-all; }
</style> -->