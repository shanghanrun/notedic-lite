<script>
    import { onMount } from 'svelte';
    import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    import { goto } from '$app/navigation';
    import { fade } from 'svelte/transition'; // 부드러운 효과를 위해 추가

    onMount(async () => {
        // [강제 정지 로직] 페이지 로딩 시 검색어가 있어도 검색을 실행하지 않도록 초기화
        indexSearchUI.searchInput = ""; 
        indexSearchUI.searchResults = []; 
        indexSearchUI.summaryElement= null;
        
        await indexSearchUI.fetchAllFromCollection('hani');
    });
    

    // 인덱싱 핸들러
    async function handleIndexing(file) {
        const isReindexing = file.isIndexed;
        const msg = isReindexing 
            ? `${file.filename} 인덱스를 다시 생성할까요?` 
            : `${file.filename} 인덱싱을 시작합니다.`;
            
        if (!confirm(msg)) return;
        
        if (!file.lines || file.lines.length === 0) {
            await indexSearchUI.loadFileLines(file);
        }
        await indexSearchUI.generateAndUploadIndex(file);
    }
</script>

{#if indexSearchUI.isLoading}
    <div class="loading-overlay" transition:fade>
        <div class="loading-card">
            <div class="spinner"></div>
            <h3>인덱스 로딩 중...</h3>
            <p>데이터를 분석하고 검색 준비를 하고 있습니다.</p>
            <div class="progress-container-mini">
                <div class="progress-bar-fill" style="width: {indexSearchUI.progressValue}%"></div>
            </div>
            <!-- <span class="percent">{indexSearchUI.progressValue}%</span> -->
        </div>
    </div>
{/if}

<div class="admin-container">
    <aside class="col sidebar">
        <header><h3>📂 자료 관리</h3></header>
        {#if indexSearchUI.isLoading}
            <p>로딩 중...</p>
        {:else}
            <p>파일 수: {indexSearchUI.allFiles.length}</p>
        {/if}
        
        <div class="file-input-wrapper">
            <label class="custom-file-btn">
                📄 로컬 파일 검색 전용 추가 
                <input type="file" multiple onchange={indexSearchUI.handleFileUpload} />
            </label>
        </div>

        <div class="file-box">
            <h4>파일 상태 모니터</h4>
            <ul class="file-list">
                {#each indexSearchUI.allFiles as file}
                    <li class="flex items-center gap-2 mb-2">
                        <input 
                            type="checkbox" 
                            checked={indexSearchUI.selectedFiles.has(file.id)}
                            onchange={() => indexSearchUI.toggleFileSelection(file.id)}
                            disabled={!file.isIndexed} 
                        />
                        <span class={file.isIndexed ? "text-blue-600" : "text-gray-400"}>
                            {file.filename} ({file.lines?.length || 0}줄)
                        </span>
                        {#if !file.isIndexed}
                            <button onclick={() => indexSearchUI.generateAndUploadIndex(file)} class="px-2 py-1 text-xs bg-purple-500 text-white rounded">인덱스 생성</button>
                        {:else}
                            <span class="text-xs text-green-500 font-bold">✓ 완료</span>
                        {/if}
                    </li>
                {/each}
            </ul>
        </div>

        <div class="menu-section">
            <h3 class="sidebar-title">🌐 서버 서재 (Hani)</h3>
            <div class="collection-selector">
                <select bind:value={indexSearchUI.currentCollection} class="modern-select">
                    {#each indexSearchUI.availableCollections as col}
                        <option value={col}>{col}</option>
                    {/each}
                </select>
                <button class="sync-btn-small" onclick={() => indexSearchUI.fetchAllFromCollection()}>🔄 목록 갱신</button>
            </div>
        </div>

        <div class="indexing-panel">
            <h4 class="sidebar-sub-title">⚡ 인덱스 상태 관리</h4>
            <div class="indexing-list">
                 {#each indexSearchUI.allFiles as file}
                    <div class="flex items-center justify-between p-2 bg-white rounded border shadow-sm mb-1">
                        <div class="flex items-center gap-2 overflow-hidden">
                            <input type="checkbox" checked={indexSearchUI.selectedFiles.has(file.id)} onchange={() => indexSearchUI.toggleFileSelection(file.id)} disabled={!file.isIndexed} class="w-4 h-4 cursor-pointer" />
                            <div class="flex flex-col truncate">
                                <span class="text-xs font-medium truncate">{file.filename}</span>
                                <span class="text-[10px] text-gray-400">{file.lines?.length || 0}줄 로드됨</span>
                            </div>
                        </div>
                        {#if file.isIndexed}
                            <button onclick={() => indexSearchUI.generateAndUploadIndex(file)} class="px-2 py-1 text-[10px] bg-green-100 text-green-700 rounded border border-green-300">완료 (재생성)</button>
                        {:else}
                            <button onclick={() => indexSearchUI.generateAndUploadIndex(file)} class="px-2 py-1 text-[10px] bg-purple-600 text-white rounded animate-pulse">인덱스 생성</button>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        <button class="export-btn" onclick={() => indexSearchUI.saveAsDocx()} disabled={indexSearchUI.searchResults.length === 0}>결과 DOCX 저장</button>
    </aside>

    <main class="col main-content" style="display: flex; flex-direction: column; height: 100%;">
        <div class="search-header p-4 border-b bg-white">
            <div class="search-container flex gap-2 items-center">
                <input 
                    type="text" 
                    bind:value={indexSearchUI.searchInput}
                    onkeydown={(e) => e.key === 'Enter' && indexSearchUI.startSearch()}
                    placeholder="검색어 입력 (예: 氣/血)"
                    class="search-input flex-1 p-2 border rounded shadow-sm"
                />
                <button class="search-button bg-blue-600 text-white px-4 py-2 rounded font-bold" onclick={() => indexSearchUI.startSearch()}>검색</button>
                <div class="info-badge bg-gray-100 px-3 py-2 rounded text-sm">매칭: <span class="font-bold text-blue-600">{indexSearchUI.searchResults.length}</span>건</div>
                <button class="go-button px-3 py-2 bg-gray-500 text-white rounded" onclick={() => { indexSearchUI.reset(); goto('/'); }}>Home</button>
            </div>
        </div>

        <div class="main-scroll-viewport" style="flex: 1; overflow-y: auto; background: #f1f5f9; padding: 20px;">
            <section class="results-list-wrapper mb-8">
                <h4 class="section-title mb-2 font-bold text-gray-700">⚡ 검색 카드</h4>
                <div 
                    class="virtual-viewport" 
                    onscroll={(e) => indexSearchUI.handleScroll(e)}
                    style="height: 500px; overflow-y: auto; position: relative; background: #e2e8f0; border-radius: 12px; border: 1px solid #cbd5e1;"
                >
                    <div style="height: {indexSearchUI.totalHeight}px; width: 100%;"></div>
                    <div class="virtual-content" style="position: absolute; top: 0; left: 0; width: 100%;">
                        {#each indexSearchUI.visibleResults as result (result.uniqueKey)}
                            <div class="result-card-outer" style="position: absolute; top: {result.renderTop}px; left: 0; width: 100%; height: {indexSearchUI.itemHeight}px; padding: 6px 12px; margin-top: 6px">
                                <div class="card-inner">
                                    <div class="card-tag" style="background: {result.isServer ? '#3b82f6' : '#10b981'};"></div>
                                    <div class="card-content">
                                        <div class="file-name">{result.fileName}</div>
                                        <p class="card-text line-clamp-2">
                                            {@html indexSearchUI.highlightText(result.text, indexSearchUI.processedQueries, false)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="p-10 text-center text-gray-400">결과가 없습니다.</div>
                        {/each}
                    </div>
                </div>
            </section>

            <hr class="my-8 border-gray-300" />

            <section class="final-summary pb-20">
                <div class="summary-header flex justify-between items-center mb-4">
                    <h4 class="section-title font-bold text-gray-700">📋 분석 보고서 (전체 결과)</h4>
                    <button class="copy-icon-btn bg-green-600 text-white px-4 py-1 rounded text-sm" onclick={() => indexSearchUI.copyToClipboard()}>📄 전체 복사</button>
                </div>
                <div class="summary-paper bg-white p-8 rounded-xl shadow-lg border border-gray-200" bind:this={indexSearchUI.summaryElement}>
                    <h2 class="text-2xl font-bold mb-6 pb-4 border-b text-center">검색어 [{indexSearchUI.searchQuery}] 분석 보고서</h2>
                    {#each Object.entries(indexSearchUI.groupedResults) as [fileName, lines]}
                        <div class="summary-group mb-8">
                            <h3 class="text-lg font-bold text-blue-800 mb-3 bg-blue-50 p-2 rounded">[출처: {fileName}] ({lines.length}건)</h3>
                            <div class="space-y-2">
                                {#each lines as line, i}
                                    <p class="text-sm border-b border-gray-50 pb-1"><span class="text-gray-300 mr-2 text-xs">○ </span>{@html indexSearchUI.highlightText(line, indexSearchUI.processedQueries, true)}</p>
                                {/each}
                            </div>
                        </div>
                    {:else}
                        <p class="text-center text-gray-400 py-20">분석할 데이터가 없습니다.</p>
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
    .custom-file-btn { display: block; text-align: center; background: #20c465; color: white; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; }
    .indexing-panel { margin-top: 20px; flex: 1; overflow-y: auto; }
    .virtual-viewport::-webkit-scrollbar, .main-scroll-viewport::-webkit-scrollbar { width: 8px; }
    .virtual-viewport::-webkit-scrollbar-thumb, .main-scroll-viewport::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }

    /* ✅ 요청하신 카드 스타일 디자인 */
    .card-inner {
        display: flex;
        height: 100%;
        background: white;        /* 바탕색 흰색 */
        border-radius: 8px;      /* 모서리 라운드 */
        box-shadow: 0 2px 5px rgba(0,0,0,0.1); /* 그림자 살짝 */
        overflow: hidden;
        border: 1px solid #eee;
    }
    .card-tag {
        width: 8px;               /* 좌측 세로선 색상 태그 */
        height: 100%;
    }
    .card-content {
        padding: 10px 15px;
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .file-name {
        font-size: 11px;
        color: #999;
        font-weight: bold;
        margin-bottom: 4px;
    }
    .card-text {
        font-size: 14px;
        color: #333;
        line-height: 1.5;
    }
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    :global(.highlight) { background-color: #ffeb3b; color: #d32f2f; font-weight: bold; padding: 0 2px; border-radius: 2px; }


    /* 로딩 오버레이 */
    .loading-overlay {
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center;
        z-index: 9999; backdrop-filter: blur(4px);
    }
    .loading-card {
        background: white; padding: 40px; border-radius: 20px; text-align: center;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); width: 350px;
    }
    .spinner {
        width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #3498db;
        border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }


    /* 검색창, 버튼, 매칭 정보 등을 한 줄로 정렬하는 컨테이너 */
    .search-container {
        display: flex;
        gap: 12px;
        align-items: center; /* 세로 중앙 정렬 */
        width: 100%;
    }
    .search-header {
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
        background: white;
    }

    /* 검색 입력창이 남은 공간을 다 차지하도록 설정 */
    .search-input {
        flex: 1; 
        padding: 8px;
        border: 1px solid #d1d5db;
        border-radius: 6px;
    }
    .info-badge {
        background: #f3f4f6;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 14px;
        white-space: nowrap; /* 줄바꿈 방지 */
    }


    /* 파일명(예: 동의보감_02.docx) 스타일 클래스 */
    .file-name-tag {
        font-size: 11px; /* 나중에 이 숫자를 2rem 등으로 바꾸시면 됩니다 */
        color: #999;
        font-weight: bold;
        margin-bottom: 4px;
    }

    /* 카드 내 본문 텍스트 스타일 */
    .card-text {
        font-size: 1rem; /* 본문 내용을 더 잘 보이게 1.5rem으로 수정 */
        color: #333;
        line-height: 1.5; /* 글자 크기에 맞춰 줄 간격도 약간 넓힘 */
    }
    /* 텍스트가 두 줄을 넘어가면 ... 처리 (필요시 clamp 숫자를 늘리세요) */
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2; 
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
</style>