<script>
    import { pb } from './../../lib/pb.svelte.js';
    import mammoth from 'mammoth';
    import { Document, Packer, Paragraph, TextRun } from 'docx';
    import { goto } from '$app/navigation';
    import { researchState, researchActions } from '$lib/pb.svelte.js';
	import { searchUI } from '$lib/searchUI.svelte.js';
	import { onMount } from 'svelte'

    // 1. 초기화 및 데이터 로드
	onMount(async ()=> {
		await researchActions.login(); // 데이터 먼저 로드
		researchActions.fetchAllFromCollection(); // UI 초기화. 현재 곡 등		
	})

    $effect(() => {
        if (researchState.currentCollection) {
            researchActions.fetchAllFromCollection();
        }
    });
	

    $effect(() => {
        const query = searchUI.searchQuery.trim();
        const results = searchUI.searchResults;

        // 기존 타이머가 있다면 취소 (연속 입력 방지)
        if (searchUI.logTimer) clearTimeout(searchUI.logTimer);

        if (query && results.length > 0) {
            // 2초(1000ms) 동안 추가 입력이 없으면 실행
            searchUI.logTimer = setTimeout(() => {
                searchUI.saveSearchLog(query, results);
            }, 2000); 
        }
    });


</script>

<div class="admin-container">
    <aside class="col sidebar">
        <header><h3>📂 파일 임포트</h3></header>
        <div class="file-input-wrapper">
            <label class="custom-file-btn">파일 선택 <input type="file" multiple onchange={searchUI.handleFileUpload} /></label>
            <p class="hint">docx, txt 파일 지원</p>
        </div>
        
        <div class="file-box">
            <ul class="file-list">
                {#each Object.entries(searchUI.allFileData) as [name, data]}
                    <li class={data.isServer ? "server-file" : ""}>
                        <div class="file-info">
                            <span>{data.isServer ? "🌐" : "📄"} {name}</span>
                            <span class="count">({data.lines.length}줄)</span>
                        </div>
                    </li>
                {/each}
                {#if Object.keys(searchUI.allFileData).length === 0}
                    <li class="empty-file">로드된 파일 없음</li>
                {/if}
            </ul>
        </div>

        <div class="preview-section">
            <h4 class="sidebar-sub-title">🔍 내용 미리보기</h4>
            <div class="preview-btn-list">
                {#each Object.keys(searchUI.allFileData) as fileName}
                    <button class="preview-tag-btn" onclick={() => searchUI.previewFile(fileName)}>
                        {fileName.slice(0, 10)}...
                    </button>
                {/each}
            </div>
        </div>

        <div class="menu-section">
            <h3 class="sidebar-title">
                <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
                서버 서재 자동 탐색
            </h3>
            <div class="collection-selector">
                <select bind:value={researchState.currentCollection} class="modern-select">
                    {#each researchState.availableCollections as col}
                        <option value={col}>{col}</option>
                    {/each}
                </select>
                <button class="sync-btn-small" onclick={() => researchActions.fetchAllFromCollection()}>
                    {researchState.isLoading ? "🔄" : "🔄 데이터 갱신"}
                </button>
            </div>
        </div>

        <button class="export-btn" onclick={searchUI.saveAsDocx} disabled={searchUI.searchResults.length === 0}>
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            결과 DOCX 저장
        </button>
    </aside>

    <main class="col main-content">
        <div class="search-header">
            <div class="search-container">
                <input type="text" bind:value={searchUI.searchQuery} placeholder="검색어 입력 (예: 백호)" />
                <div class="info-badge">결과: <strong>{searchUI.searchResults.length}</strong>건</div>
                <button class="go-button" onclick={()=>{
					searchUI.reset(); // 이동 전 초기화
					goto('/')}}>Home</button>
            </div>
        </div>

        <div class="scroll-area">
            <section class="results-list">
                <h4 class="section-title">⚡ 빠른 확인 카드</h4>
                {#each searchUI.searchResults as result}
                    <div class="result-card">
                        <div class="card-edge" style="background: {result.isServer ? '#3b82f6' : '#6eb485'}"></div>
                        <div class="card-body">
                            <div class="file-tag">{result.isServer ? "🌐 " : "📄 "}{result.fileName}</div>
                            <p class="sentence">{@html searchUI.highlightText(result.text, searchUI.processedQueries, false)}</p>
                        </div>
                    </div>
                {/each}
            </section>

            <hr class="divider" />

            <section class="final-summary">
                <div class="summary-header">
                    <h4 class="section-title">📋 종합 정리</h4>
                    <button class="copy-icon-btn" onclick={searchUI.copyToClipboard}>📄 전체 복사하기</button>
                </div>
                
                <div class="summary-paper" bind:this={searchUI.summaryElement}>
                    <h2 class="summary-main-title">검색어 [{searchUI.searchQuery}] 분석 보고서</h2>
                    {#each Object.entries(searchUI.groupedResults) as [fileName, lines]}
                        <div class="summary-group">
                            <h3 class="summary-file-header">
                                [출처: {fileName}] <small>({lines.length}건)</small>
                            </h3>
                            {#each lines as line}
                                <p class="summary-line">{@html searchUI.highlightText(line, searchUI.processedQueries, true)}</p>
                            {/each}
                        </div>
                    {/each}
                </div>
            </section>
        </div>
    </main>
</div>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap');
    :global(body) { margin: 0; background: #9db6c0; font-family: 'Nanum Gothic', sans-serif; overflow: hidden; }
    
    .admin-container { display: grid; grid-template-columns: 340px 1fr; gap: 20px; padding: 20px; height: 100vh; box-sizing: border-box; }
    .col { background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }

    .sidebar { padding: 24px; }
    .custom-file-btn { display: block; text-align: center; background: #20c465; color: white; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 800; box-shadow: 0 4px 0 #1c5032; }
    .custom-file-btn input { display: none; }
    
    .file-box { height: 180px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 15px 0; overflow-y: auto; }
    .file-list { list-style: none; padding: 0; font-size: 0.85rem; }
    .file-list li { padding: 8px 10px; border-bottom: 1px solid #edf2f7; color: #475569; font-weight: 700; }
    .server-file { color: #2563eb !important; }

    /* 미리보기 섹션 스타일 */
    .preview-section { margin-bottom: 20px; }
    .sidebar-sub-title { font-size: 0.9rem; color: #64748b; margin-bottom: 8px; }
    .preview-btn-list { display: flex; flex-wrap: wrap; gap: 5px; max-height: 80px; overflow-y: auto; }
    .preview-tag-btn { font-size: 0.7rem; background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; padding: 3px 8px; border-radius: 4px; cursor: pointer; transition: 0.2s; }
    .preview-tag-btn:hover { background: #dbeafe; }

    /* 사이드바 타이틀 및 DB 아이콘 */
    .sidebar-title { font-size: 1.1rem; font-weight: 800; color: #1e293b; margin: 20px 0 10px 0; display: flex; align-items: center; gap: 8px; }
    .title-icon { width: 22px; height: 22px; color: #f59e0b; flex-shrink: 0; }

    .modern-select { padding: 8px; border-radius: 6px; border: 1px solid #cbd5e1; width: 100%; margin-bottom: 10px; }
    .sync-btn-small { width: 100%; padding: 8px; background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.85rem; }

    /* DOCX 저장 버튼 복원 */
    .export-btn { margin-top: auto; display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; padding: 14px; background: #2b579a; color: white; border-radius: 10px; border: none; font-weight: 800; cursor: pointer; transition: background 0.2s; }
    .export-btn:hover { background: #1e3e6d; }
    .export-btn:disabled { background: #cbd5e1; cursor: not-allowed; }
    .btn-icon { width: 1.2rem; height: 1.2rem; }

    /* 검색창 및 메인 영역 */
    .search-header { padding: 15px 25px; border-bottom: 1px solid #f1f5f9; }
    .search-container { display: flex; align-items: center; gap: 15px; }
    .search-container input { width: 350px; padding: 12px 18px; border: 1px solid #cbd5e1; border-radius: 8px; font-weight: 700; font-family: inherit; }
    .go-button { border: 1.5px solid #2ecc71; color: #27ae60; padding: 8px 18px; border-radius: 20px; cursor: pointer; font-weight: 800; }

    .scroll-area { flex: 1; overflow-y: auto; padding: 25px; background: #f8fafc; }
    
    /* 카드 디자인 */
    .result-card { background: white; border-radius: 0 8px 8px 8px; margin-bottom: 12px; display: flex; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 2px 5px rgba(0,0,0,0.02); }
    .card-edge { width: 6px; flex-shrink: 0; }
    .card-body { padding: 15px; }
    .file-tag { font-size: 0.75rem; color: #3b82f6; font-weight: 800; background: #eff6ff; padding: 2px 8px; border-radius: 4px; margin-bottom: 5px; display: inline-block; }
    .sentence { margin: 0; line-height: 1.6; color: #334155; font-size: 1.05rem; }
    :global(.hl) { background: #fde047; font-weight: 800; }

    /* 보고서 스타일 복원 */
    .summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .copy-icon-btn { background: #ffffff; border: 1.5px solid #2ecc71; color: #27ae60; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-weight: 800; font-size: 0.9rem; }
    .copy-icon-btn:hover { background: #2ecc71; color: white; }
    
    .summary-paper { background: white; padding: 40px; border-radius: 4px; border: 1px solid #e2e8f0; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .summary-main-title { border-bottom: 2px solid #334155; padding-bottom: 15px; margin-bottom: 30px; }
    .summary-file-header { color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; }
    .summary-line { margin: 0 0 10px 15px; line-height: 1.7; font-size: 1rem; color: #1e293b; }
    
    .divider { border: 0; height: 1px; background: #e2e8f0; margin: 40px 0; }
</style>