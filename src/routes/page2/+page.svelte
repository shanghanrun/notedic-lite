<script>
import { searchUI } from '$lib/searchUI.svelte';
import { onMount } from 'svelte'
import SideBar_FileImport from '../../component/SideBar_FileImport.svelte';
import UserSearchHeader from '../../component/UserSearchHeader.svelte';
import SearchResultView from '../../component/SearchResultView.svelte';


let localFiles = $state([]);
onMount(() => {
        // 페이지에 들어오자마자 이전 상태 초기화
        searchUI.reset();      
        console.log("🏠 홈 화면 진입: 검색 상태를 초기화했습니다.");

		//실험적 코드, everything연계
		// 결과 받아오기 리스너
		window.addEventListener("TO_PAGE", (event) => {
            console.log("📥 [Page] 익스텐션으로부터 응답 받음:", event.detail);
			if (event.detail && event.detail.results) {
				localFiles = event.detail.results;
                console.log(`✅ [Page] ${localFiles.length}개의 파일을 리스트에 업데이트함`);
			}
		});
    });

function handleLocalFileSearch() {
    const query = searchUI.searchFileQuery; // 분리된 쿼리 사용
    if (!query) return;

    console.log(`🚀 [Page] Everything 검색 요청 시작: "${query}"`);

    // 익스텐션(Content Script)에게 신호 보내기
    window.dispatchEvent(new CustomEvent("FROM_PAGE", {
        detail: { action: "FETCH_EVERYTHING", query: query }
    }));
}


</script>

<div class="admin-container">
    <aside class="col sidebar">
        <div class="local-search-section">
            <h3 class="section-title">💻 내 컴퓨터 파일 검색</h3>
            <div class="search-box">
                <input 
                    type="text" 
                    bind:value={searchUI.searchFileQuery} 
                    placeholder="파일명 입력 (예: 상한론)"
                    onkeydown={(e) => e.key === 'Enter' && handleLocalSearch()}
                />
                <button onclick={handleLocalFileSearch}>검색</button>
            </div>

            {#if localFiles.length > 0}
                <ul class="local-result-list">
                    {#each localFiles as file}
                        <li>
                            <div class="file-info">
                                <span class="file-name" title={file.path}>{file.name}</span>
                                <!-- <span class="file-size">{file.size}</span> -->
                            </div>
                            <div class="file-path">
                                {file.path}
                            </div>
                        </li>
                    {/each}
                </ul>
            {:else if searchUI.searchFileQuery}
                 <p class="no-result">검색 결과가 없습니다.</p>
            {/if}
        </div>

        <hr class="divider" />

        <SideBar_FileImport />
    </aside>

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




    .sidebar {
        padding: 20px;
        background: #f8fafc; /* 사이드바 배경색 살짝 차별화 */
        border-right: 1px solid #e2e8f0;
    }

    .section-title {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 12px;
        color: #1e293b;
    }

    .search-box {
        display: flex;
        gap: 8px;
        margin-bottom: 15px;
    }

    .search-box input {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 6px;
        font-size: 14px;
    }

    .search-box button {
        padding: 8px 16px;
        background: #ff6b00;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
    }

    .local-result-list {
        list-style: none;
        padding: 0;
        margin: 0;
        max-height: 300px; /* 너무 길어지지 않게 조절 */
        overflow-y: auto;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: white;
    }

    .local-result-list li {
        padding: 10px;
        border-bottom: 1px solid #f1f5f9;
        display: flex;
        flex-direction: column;
        /* align-items: center; */
        font-size: 13px;
    }
    /* 각 리스트 카드 호버 시 밝은 파란색 백그라운드 */
    .local-result-list li:hover {
        background-color: #f0f7ff; /* 아주 밝은 파란색 */
    }

    .file-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .file-name {
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #334155;
    }

    .file-size {
        font-size: 11px;
        color: #94a3b8;
    }
    .file-path{
        color: rgb(89, 142, 248)
    }

    .import-btn {
        padding: 4px 8px;
        font-size: 11px;
        background: #2563eb;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .divider {
        margin: 20px 0;
        border: 0;
        border-top: 1px solid #e2e8f0;
    }

</style>