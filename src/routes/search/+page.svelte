<script>
	import SideBar_FileImport from './../../component/SideBar_FileImport.svelte';
  import { searchUI } from '$lib/searchUI.svelte';
  import { page } from '$app/stores';
  import SearchHeader from '../../component/SearchHeader.svelte';
  import SearchResultView from '../../component/SearchResultView.svelte';
  
  let isLoading = $state(false); // Svelte 5 룬 사용

  // 1. URL 변경 감지 및 검색 엔진 가동
  $effect(() => {
    const rawQuery = $page.url.searchParams.get('q') || "";    
    
    // 비동기 프로세스 실행
    runSearchWorkflow(rawQuery);
  });

  async function runSearchWorkflow(rawQuery) {
    // [순서 1] 쿼리 디코딩 및 설정
    const decodedQuery = decodeURIComponent(rawQuery);
    searchUI.searchQuery = decodedQuery; 

    // [순서 2] localStorage(chrome 금고)에서 데이터 로드
    await loadData();

    // [순서 3] 로드된 데이터를 바탕으로 정규식 및 하이라이트 엔진 가동
    searchUI.startSearch();      
  }

  async function loadData() {
    isLoading = true;
    
    try {
      // 팝업에서 "pendingText"라는 이름으로 저장했던 데이터를 가져옵니다.
      // 확장 프로그램 환경에서는 chrome.storage를, 일반 브라우저 테스트는 localStorage를 참조
      let targetText = "";

      if (typeof chrome !== 'undefined' && chrome.storage) {
        // 확장 프로그램 스토리지 사용 (Promise로 래핑하여 await 처리)
        const result = await new Promise((resolve) => {
          chrome.storage.local.get(["pendingText"], (res) => resolve(res));
        });
        targetText = result.pendingText || "";
      } else {
        // 개발/테스트용 로컬 스토리지 폴백
        targetText = localStorage.getItem("pendingText") || "";
      }

      if (!targetText) {
        console.warn("검색할 원문 데이터가 없습니다.");
        searchUI.files = [];
        return;
      }

      // 텍스트를 줄 단위로 분리
      const lines = targetText.split('\n').filter(l => l.trim() !== "");

      // searchUI 엔진에 파일 형태로 주입
      searchUI.files = [
        {
          name: "웹페이지 추출 원문",
          lines: lines,
          checked: true
        }
      ];

      // (선택 사항) 사용한 데이터는 금고에서 비워줍니다.
      // if (typeof chrome !== 'undefined') chrome.storage.local.remove("pendingText");

    } catch (err) {
      console.error("데이터 로드 실패:", err);
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="admin-container">
    

    <SideBar_FileImport />

    <main class="col main-content">
        <SearchHeader item={searchUI} />
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