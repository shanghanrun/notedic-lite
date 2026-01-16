<script>
    import { onMount } from 'svelte';
    import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    import { goto } from '$app/navigation';
    import { fade, slide } from 'svelte/transition';
    
    // UI 표시 제어용 로컬 상태
    let showStatusMonitor = $state(true); 

    onMount(async () => {
        indexSearchUI.searchInput = ""; 
        indexSearchUI.searchResults = []; 
        indexSearchUI.summaryElement= null;
        await indexSearchUI.fetchAllFromCollection('hani');
        await refreshFileList();
    });

     // 목록을 갱신하고 상태를 체크하는 함수
    async function refreshFileList() {
        // 1. 데이터를 가져오기 전에 모니터를 즉시 다시 보이게 설정
        showStatusMonitor = true; 
        
        // 2. 검색 결과 및 이전 데이터 초기화 (선택사항)
        indexSearchUI.allFiles = []; 
        
        try {
            // 3. 데이터 로딩 (비동기)
            await indexSearchUI.fetchAllFromCollection(indexSearchUI.currentCollection);
            
            // 4. 데이터가 들어온 후, 모든 인덱싱이 완료되었는지 확인하여 닫기 예약
            checkAllDoneAndHide();
        } catch (error) {
            console.error("목록 갱신 실패:", error);
        }
    }

    function checkAllDoneAndHide() {
        // 파일이 있고, 모든 파일의 isIndexed가 true인지 확인
        const allDone = indexSearchUI.allFiles.length > 0 && 
                        indexSearchUI.allFiles.every(f => f.isIndexed);
        
        if (allDone) {
            // 이미 예약된 타이머가 있을 경우를 대비해 확실히 2초 뒤에 닫기
            setTimeout(() => {
                showStatusMonitor = false; 
            }, 2500);
        }
    }

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
        </div>
    </div>
{/if}

{#if indexSearchUI.isIndexing}
    <div class="loading-overlay" transition:fade>
        <div class="loading-card indexing-card">
            <div class="spinner indexing-spinner"></div>
            <h3 class="status-label">{indexSearchUI.progressLabel || "인덱싱 준비 중..."}</h3>
            <p class="status-detail">대용량 파일은 최대 1분 정도 소요될 수 있습니다.</p>
            
            <div class="progress-container-main">
                <div class="progress-bar-fill" style="width: {indexSearchUI.progressValue}%"></div>
                <span class="percentage-text">{indexSearchUI.progressValue}%</span>
            </div>
            
            {#if indexSearchUI.progressValue > 80}
                <p class="final-step-msg">서버에 최종 인덱스를 저장하고 있습니다...</p>
            {/if}
        </div>
    </div>
{/if}

<div class="admin-container">
    <aside class="col sidebar">
        <header><h3>📂 자료 관리</h3></header>
        <div class="file-status-info">
            {#if indexSearchUI.isLoading}
                <span>로딩 중...</span>
            {:else}
                <span>파일 수: {indexSearchUI.allFiles.length}</span>
            {/if}
        </div>
        
        {#if showStatusMonitor && indexSearchUI.allFiles.length > 0}
            <div class="file-box" transition:slide={{ duration: 800 }}>
                <h4 style="display:flex; justify-content:space-between; align-items:center;">
                    파일 상태 모니터
                    <button onclick={() => showStatusMonitor = false} style="border:none; background:none; cursor:pointer; font-size:12px; color:#999;">[닫기]</button>
                </h4>
                <ul class="file-list">
                    {#each indexSearchUI.allFiles as file}
                        <li class="file-item-row">
                            <span class="file-name-text {file.isIndexed ? 'indexed' : 'not-indexed'}">
                                {file.filename} ({file.lines?.length || 0}줄)
                            </span>
                            {#if !file.isIndexed}
                                <button onclick={async () => { 
                                    await indexSearchUI.generateAndUploadIndex(file);
                                    checkAllDoneAndHide(); // 개별 생성 완료 시에도 체크
                                }} class="btn-index-small">인덱스 생성</button>
                            {:else}
                                <span class="status-done">✓ 완료</span>
                            {/if}
                        </li>
                    {/each}
                </ul>
                <hr style="border:0; border-top:1px dashed #eee; margin:10px 0;"/>
            </div>
        {/if}

        <div class="menu-section">
            <h3 class="sidebar-title">🌐 서버 서재 </h3>
            <div class="collection-selector">
                <select bind:value={indexSearchUI.currentCollection} class="modern-select">
                    {#each indexSearchUI.availableCollections as col}
                        <option value={col}>{col}</option>
                    {/each}
                </select>
                <button class="sync-btn-small" onclick={() => indexSearchUI.fetchAllFromCollection(indexSearchUI.currentCollection)}>🔄 목록 갱신</button>
            </div>
        </div>

        <div class="file-input-wrapper">
            <label class="custom-file-btn">
                📄 로컬 파일 검색 전용 추가 
                <input type="file" multiple onchange={indexSearchUI.handleFileUpload} />
            </label>
        </div>

        <div class="indexing-panel">
            <h4 class="sidebar-sub-title">⚡ 인덱스 상태 관리</h4>
            <div class="indexing-list">
                 {#each indexSearchUI.allFiles as file}
                    <div class="indexing-item-card" 
                        class:unselected={!indexSearchUI.selectedFiles.has(file.id)}
                        onclick={() => indexSearchUI.toggleFileSelection(file.id)} 
                        >
                        <div class="indexing-item-info">
                            <input 
                                type="checkbox" 
                                checked={indexSearchUI.selectedFiles.has(file.id)} 
                                onclick={(e) => {
                                    e.stopImmediatePropagation(); 
                                    indexSearchUI.toggleFileSelection(file.id)}} 
                                disabled={!file.isIndexed} 
                            />
                            <div class="text-group">
                                <span class="filename">{file.filename.replace('.docx', '')}</span>
                            </div>
                        </div>
                        
                        {#if file.isIndexed}
                            <button onclick={() => indexSearchUI.generateAndUploadIndex(file)} class="btn-reindex">완료 (재생성)</button>
                        {:else}
                            <button onclick={() => indexSearchUI.generateAndUploadIndex(file)} class="btn-generate-index pulse">인덱스 생성</button>
                        {/if}
                    </div>
                {/each}
            </div>
        </div>

        <button 
            class="export-btn {indexSearchUI.searchResults.length > 0 ? 'active' : ''}" 
            onclick={() => indexSearchUI.saveAsDocx()} 
            disabled={indexSearchUI.searchResults.length === 0}
        >
            {#if indexSearchUI.searchResults.length > 0}
                📄 결과 DOCX 저장 ({indexSearchUI.searchResults.length}건)
            {:else}
                검색 후 저장 가능
            {/if}
        </button>
    </aside>

    <main class="col main-content">
        <div class="search-header">
            <div class="search-container">
                <input 
                    type="text" 
                    bind:value={indexSearchUI.searchInput}
                    onkeydown={(e) => e.key === 'Enter' && indexSearchUI.startSearch()}
                    placeholder="검색어 입력 (예: 氣/血)"
                    class="search-input"
                />
                <button class="search-button" onclick={() => indexSearchUI.startSearch()}>검색</button>
                <div class="info-badge">매칭: <span class="match-count">{indexSearchUI.searchResults.length}</span>건</div>
                <button class="go-button" onclick={() => { indexSearchUI.reset(); goto('/'); }}>Home</button>
            </div>
        </div>

        <div class="main-scroll-viewport">
            <section class="results-list-wrapper">
                <h4 class="section-title">⚡ 검색 카드 (OR 검색 기본, AND 결과 우선 배치)</h4>
                <div class="virtual-viewport" onscroll={(e) => indexSearchUI.handleScroll(e)}>
                    <div class="virtual-spacer" style="height: {indexSearchUI.totalHeight}px;"></div>
                    <div class="virtual-content">
                        {#each indexSearchUI.visibleResults as result (result.uniqueKey)}
                            <div class="result-card-outer" style="top: {result.renderTop}px; height: {indexSearchUI.itemHeight}px;">
                                <div class="card-inner" class:and-match-highlight={result.isAndMatch}>
                                    <div class="card-tag" style="background: {result.isAndMatch ? '#10b981' : (result.isServer ? '#3b82f6' : '#f59e0b')};"></div>
                                    <div class="card-content">
                                        <div class="card-header-row">
                                            <div class="file-name-tag">[{result.fileName}]</div>
                                            {#if result.isAndMatch}
                                                <span class="and-badge">교집합(AND) 발견</span>
                                            {/if}
                                        </div>
                                        <p class="card-text line-clamp-2">
                                            {@html indexSearchUI.highlightText(result.text, false)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="no-result">결과가 없습니다.</div>
                        {/each}
                    </div>
                </div>
            </section>

            <hr class="section-divider" />

            <section class="final-summary">
                <div class="summary-header">
                    <h4 class="section-title">📋 분석 보고서 (전체 결과)</h4>
                    <button class="copy-btn" onclick={() => indexSearchUI.copyToClipboard()}>📄 전체 복사</button>
                </div>
                <div class="summary-paper" bind:this={indexSearchUI.summaryElement}>
                    <h2 class="report-title">검색어 [{indexSearchUI.searchQuery}] 분석 보고서</h2>
                    {#each Object.entries(indexSearchUI.groupedResults) as [fileName, lines]}
                        <div class="summary-group">
                            <h3 class="group-source-title">[출처: {fileName}] ({lines.length}건)</h3>
                            <div class="group-lines">
                                {#each lines as line}
                                    <p class="summary-line">
                                        <span class="bullet">○ </span>
                                        {@html indexSearchUI.highlightText(line, true)}
                                    </p>
                                {/each}
                            </div>
                        </div>
                    {:else}
                        <p class="no-data-text">분석할 데이터가 없습니다.</p>
                    {/each}
                </div>
            </section>
        </div>
    </main>
</div>

<style>
    @import url('https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700;800&display=swap');
    
    :global(body) { margin: 0; background: #9db6c0; font-family: 'Nanum Gothic', sans-serif; overflow: hidden; }
    .admin-container { display: grid; grid-template-columns: 400px 1fr; gap: 20px; padding: 20px; height: 100vh; box-sizing: border-box; }
    .col { background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }
    
    /* 사이드바 */
    .sidebar { padding: 24px; }
    .file-status-info { margin-bottom: 15px; font-size: 14px; color: #666; }
    .custom-file-btn { display: block; text-align: center; background: #20c465; color: white; padding: 12px; border-radius: 6px; cursor: pointer; font-weight: bold; margin-bottom: 20px; }
    .custom-file-btn input { display: none; }
    .file-list { list-style: none; padding: 0; margin: 0; }
    .file-item-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .file-name-text { flex: 1; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .file-name-text.indexed { color: #2563eb; }
    .status-done { color: #10b981; font-size: 12px; font-weight: bold; }
    .btn-index-small { background: #a855f7; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer; }

    /* 컬렉션 및 인덱싱 패널 */
    .modern-select { flex: 1; padding: 6px; border-radius: 4px; border: 1px solid #ddd; width:200px; margin-right: 45px }
    .file-input-wrapper{
        margin-top: 30px;
    }
    .sync-btn-small { padding: 6px 10px; font-size: 12px; background: #f3f4f6; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; }
    .indexing-panel { margin-top: 20px; flex: 1; overflow-y: auto; }
    .indexing-item-card { 
        display: flex; 
        align-items: center; /* 모든 요소를 세로 중앙(일직선)에 배치 */
        justify-content: space-between; 
        padding: 8px 12px; 
        background: #fff; 
        border-radius: 6px; 
        border: 1px solid #e5e7eb; 
        margin-bottom: 6px;
        gap: 10px; /* 요소 간 간격 */
        cursor: pointer; /* 카드 전체에 포인터 커서 적용 */
        transition: all 0.2s ease; /* 부드러운 색상 전환 */
    }
    .indexing-item-info {
        display: flex;
        align-items: center; /* 체크박스와 파일명을 세로 중앙 정렬 */
        gap: 10px; /* 체크박스와 이름 사이 간격 */
        flex: 1; /* 가용한 공간을 다 차지하여 완료 버튼을 오른쪽으로 밀어냄 */
        min-width: 0; /* flex 자식의 텍스트 생략 처리를 위한 설정 */
    }
    /* 호버 시 효과: 살짝 푸른 빛이 도는 배경색 */
    .indexing-item-card:hover {
        background-color: #3d7bc3;
        border-color: #bfdbfe;
        /* transform: translateX(2px); 우측으로 살짝 이동하는 디테일 */
    }
    /* 체크된 상태일 때의 미세한 강조 (선택 사항) */
    .indexing-item-card:has(input:checked) {
        background-color: #93c9ff;
    }

    /* 내부 체크박스 크기 및 정렬 유지 */
    .indexing-item-info input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
    }

    /* 파일명을 감싸는 그룹 (위아래 어긋남 방지) */
    .text-group {
        display: flex;
        align-items: center; /* 내부 텍스트를 세로 중앙 정렬 */
        overflow: hidden;
    }

    .filename {
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis; 
        font-weight: 500;
        line-height: 1; /* 텍스트 높이를 1로 잡아 어긋남 최소화 */
    }

    /* 완료 버튼 크기 조절 (일직선을 방해하지 않도록) */
    .btn-reindex, .btn-generate-index {
        flex-shrink: 0; /* 버튼이 찌그러지지 않게 설정 */
        white-space: nowrap;
        padding: 6px 10px;
    }
    .btn-reindex { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 4px 8px; font-size: 10px; border-radius: 4px; }
    .btn-generate-index { background: #9333ea; color: white; border: none; padding: 5px 10px; font-size: 10px; border-radius: 4px; }
    .pulse { animation: pulse-animation 2s infinite; }
    @keyframes pulse-animation { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }

    /* 검색창 */
    .search-header { padding: 16px; border-bottom: 1px solid #e5e7eb; }
    .search-container { display: flex; gap: 12px; align-items: center; }
    .search-input { flex: 1; padding: 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 24px; 
    margin-left: 140px}
    .search-button { background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; font-weight: bold; border: none; cursor: pointer; margin-left: 40px }

    /* 결과 리스트 및 카드 (핵심 수정 영역) */
    .main-scroll-viewport { flex: 1; overflow-y: auto; background: #f1f5f9; padding: 20px; }
    .virtual-viewport { height: 600px; overflow-y: auto; position: relative; background: #e2e8f0; border-radius: 12px; border: 1px solid #cbd5e1; }
    .result-card-outer { position: absolute; left: 0; width: 100%; padding: 8px 16px; box-sizing: border-box; }
    .card-inner { display: flex; height: 100%; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #eee; transition: all 0.2s; }
    
    /* AND 매칭 강조 스타일 */
    .and-match-highlight { border: 2px solid #10b981 !important; background-color: #f0fdf4 !important; }
    .and-badge { background: #10b981; color: white; font-size: 0.9rem; padding: 2px 10px; border-radius: 20px; font-weight: bold; margin-left: 15px; }

    .card-tag { width: 10px; height: 100%; }
    .card-content { padding: 16px 20px; flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .card-header-row { display: flex; align-items: center; margin-bottom: 10px; }

    /* 요청하신 폰트 크기 적용 */
    .file-name-tag { font-size: 1rem !important; color: #2563eb !important; font-weight: 800; display: block; }
    .card-text { font-size: 1.2rem !important; color: #1e293b; line-height: 1.4; font-weight: 400; }
    
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    :global(.highlight) { background-color: #ffeb3b; color: #d32f2f; 
        /* font-weight: bold;  */
        padding: 0 2px; }

    /* 분석 보고서 */
    .summary-paper { background: white; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb; }
    .report-title { font-size: 24px; font-weight: 800; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; }
    .group-source-title { font-size: 18px; font-weight: bold; color: #1e40af; background: #eff6ff; padding: 10px; border-radius: 6px; }

    /* 버튼 상태 */
    .export-btn { width: 100%; padding: 14px; border-radius: 8px; border: none; font-weight: bold; background: #e5e7eb; color: #9ca3af; cursor: not-allowed; margin-top: 10px; }
    .export-btn.active { background: #059669; color: white; cursor: pointer; }
    .indexing-item-card:has(input:not(:checked)) { opacity: 0.4; }

    /* 로딩 */
    /* 로딩 스피너 및 팝업 레이아웃 복구 */
    .loading-overlay { 
        position: fixed; 
        top: 0; left: 0; 
        width: 100%; height: 100%; 
        background: rgba(0, 0, 0, 0.5); /* 어두운 반투명 배경 */
        display: flex; 
        align-items: center; 
        justify-content: center; 
        z-index: 9999; 
        backdrop-filter: blur(4px); 
    }

    .loading-card {
        background: white; /* 흰색 배경 복구 */
        padding: 40px;
        border-radius: 16px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        text-align: center; /* 글자 가운데 정렬 */
        min-width: 300px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 15px;
    }

    /* 회전하는 스피너 애니메이션 */
    .spinner {
        width: 50px;
        height: 50px;
        border: 5px solid #f3f3f3;
        border-top: 5px solid #2563eb;
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    .progress-container-mini {
        width: 100%;
        height: 8px;
        background: #eee;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 10px;
    }
    .progress-bar-fill {
        height: 100%;
        background: #10b981;
        transition: width 0.3s ease;
    }


    /* 전체 복사 버튼: 크고 파란색 바탕 */
    .copy-btn {
        background: #2563eb; /* 파란색 배경 */
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 1rem;
        font-weight: bold;
        border: none;
        cursor: pointer;
        transition: background 0.2s;
        margin-right: 20px;
    }
    .copy-btn:hover {
        background: #1d4ed8;
    }

    /* 체크박스 크기 키우기 */
    .indexing-item-info input[type="checkbox"] {
        width: 20px;
        height: 20px;
        cursor: pointer;
    }

    .summary-header{
        display:flex;
        justify-content: space-between;
    }
    .no-result{
        margin-top: 20px;
        margin-left: 20px;
        font-size: 1.2rem;
        color:#666
    }
    .go-button{
		border: 1.5px solid #2ecc71; color: #27ae60; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-weight: 800; font-size: 0.9rem;
		margin-left: 40px;
        margin-right: 50px;
	}
    .info-badge{
        margin-left: 40px;
    }



    /* 인덱싱 전용 카드 스타일 */
    .indexing-card {
        border: 2px solid #9333ea; /* 인덱싱 테마색 (보라색) */
        min-width: 400px;
    }

    .indexing-spinner {
        border-top: 5px solid #9333ea;
    }

    .status-label {
        color: #4b5563;
        font-size: 1.5rem;
        margin-top: 10px;
    }

    .progress-container-main {
        width: 100%;
        height: 24px; /* 좀 더 두껍게 */
        background: #f3f4f6;
        border-radius: 12px;
        position: relative;
        overflow: hidden;
        margin-top: 20px;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
    }

    .percentage-text {
        position: absolute;
        width: 100%;
        text-align: center;
        top: 50%;
        left: 0;
        transform: translateY(-50%);
        font-size: 12px;
        font-weight: bold;
        color: #1f2937;
    }

    .final-step-msg {
        font-size: 13px;
        color: #2563eb;
        margin-top: 10px;
        animation: flash 1.5s infinite;
    }

    @keyframes flash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
</style>