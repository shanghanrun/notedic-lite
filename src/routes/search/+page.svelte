<script>
	import SideBar_FileImport from './../../component/SideBar_FileImport.svelte';
  import { searchUI } from '$lib/searchUI.svelte';
  import { page } from '$app/stores';
  import SearchHeader from '../../component/SearchHeader.svelte';
  import SearchResultView from '../../component/SearchResultView.svelte';
  import {onMount} from 'svelte'

  let isLoading = $state(false); // Svelte 5 룬 사용


async function loadData() {
    isLoading = true;
    let retryCount = 0;
    const maxRetries = 4; // 0.3초 간격으로 최대 3초간 기다림

    while (retryCount < maxRetries) {
        const targetText = localStorage.getItem("shared_pendingText");
        
        if (targetText) {
            console.log("✅ 드디어 데이터를 찾았습니다! (시도 횟수:", retryCount + 1, ")");
            const lines = targetText.split('\n').filter(l => l.trim() !== "");
            searchUI.files = [{ name: "웹페이지 추출 원문", lines: lines, checked: true }];
            
            // localStorage.removeItem("shared_pendingText"); // 사용 후 삭제
            // 위의 코드는 로컬스토리지로 들어온 것이 확인되면 주석해제한다.
            
            isLoading = false;
            return true; // 성공 반환
        }

        console.log("⏳ 데이터 대기 중... 재시도:", retryCount + 1);
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 300)); // 0.3초 대기
    }

    console.error("❌ 데이터 로드 최종 실패");
    isLoading = false;
    return false; // 실패 반환
}

onMount(()=>{
  const rawQuery = $page.url.searchParams.get('q') || "";
    if (rawQuery) {
        searchUI.searchQuery = decodeURIComponent(rawQuery);
        const searchTerm = searchUI.searchQuery
        console.log('searchQuery : ', searchTerm)

        // 데이터를 기다렸다가 로드에 성공하면 검색 시작!
        loadData().then((success) => {
            if (success && searchUI.files.length > 0) {
                searchUI.startSearch();
            }
        });
    }
})
// $effect(() => {
//     const rawQuery = $page.url.searchParams.get('q') || "";
//     if (rawQuery) {
//         searchUI.searchQuery = decodeURIComponent(rawQuery);
//         // searchUI.searchInput = searchUI.searchQuery;

//         // 데이터를 기다렸다가 로드에 성공하면 검색 시작!
//         loadData().then((success) => {
//             if (success && searchUI.files.length > 0) {
//                 searchUI.startSearch();
//             }
//         });
//     }
// });

//   async function runSearchWorkflow(rawQuery, rawBody) {
//     isLoading = true;
//     searchUI.searchQuery = decodeURIComponent(rawQuery);

//     if (rawBody) {
//       // [방법 A] URL 파라미터에 데이터가 실려온 경우 (가장 빠름)
//       console.log("URL을 통해 데이터를 로드합니다.");
//       processTextToFiles(decodeURIComponent(rawBody));
//     } else {
//       // [방법 B] URL이 비었거나 너무 길어 실패한 경우 스토리지 확인
//       console.log("URL 데이터가 없어 스토리지를 확인합니다.");
//       await loadFromStorage();
//     }

//     searchUI.startSearch();
//     isLoading = false;
//   }

//   // 텍스트를 searchUI 형식에 맞게 변환하는 공통 함수
//   function processTextToFiles(text) {
//     if (!text) return;
//     const lines = text.split('\n').filter(l => l.trim() !== "");
//     searchUI.files = [{ name: "추출 원문", lines: lines, checked: true }];
//   }

//   // 확장 프로그램이 content_script를 통해 넣어준 스토리지 읽기
//   async function loadFromStorage() {
//     // content_script가 localStorage에 동기화해줬다고 가정
//     const storageText = localStorage.getItem("shared_pendingText");
//     if (storageText) {
//       processTextToFiles(storageText);
//       // 사용 후 깔끔하게 비워주기 (선택)
//       // localStorage.removeItem("shared_pendingText");
//     } else {
//       console.warn("모든 방법으로 데이터 로드 실패");
//     }
//   }
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