<script>
//역할: 컬렉션 선택, 로컬 파일 추가, 인덱스 상태 관리(체크박스 리스트), DOCX 저장 버튼을 포함하는 사이드바의 본체입니다.
//하위 컴포넌트: FileStatusMonitor를 내부에 포함하거나 위아래로 배치합니다


    import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    import { slide } from 'svelte/transition';

    let { showStatusMonitor = $bindable() } = $props();

    // 상태 체크 후 자동 닫기
    function checkAllDoneAndHide() {
        const allDone = indexSearchUI.allFiles.length > 0 && 
                        indexSearchUI.allFiles.every(f => f.isIndexed);
        if (allDone) {
            setTimeout(() => { showStatusMonitor = false; }, 2500);
        }
    }

    // 목록 갱신
    async function refreshFileList() {
        showStatusMonitor = true; 
        indexSearchUI.allFiles = []; 

		// [수정 포인트] 목록을 갱신하기 전에 기존 검색어와 검색 결과를 즉시 비웁니다.
        // indexSearchUI 내부의 검색 관련 상태를 초기화하는 메서드가 있다면 호출하세요.
        indexSearchUI.searchQuery = ""; 
        indexSearchUI.searchResults = [];
		if (indexSearchUI.reset) {
            indexSearchUI.reset(); 
        } 

        try {
            await indexSearchUI.fetchAllFromCollection(indexSearchUI.currentCollection);
            checkAllDoneAndHide();
        } catch (error) {
            console.error("목록 갱신 실패:", error);
        }
    }
</script>

<aside class="col sidebar">
    <header class="sidebar-header">
        <h3 class="main-title">📂 자료 관리</h3>
        <div class="file-status-info">
            {#if indexSearchUI.isLoading} <span class="loading-text">로딩 중...</span>
            {:else} <span class="count-badge">파일 수: {indexSearchUI.allFiles.length}</span> {/if}
        </div>
    </header>

    {#if showStatusMonitor && indexSearchUI.allFiles.length > 0}
        <div class="status-monitor-box" transition:slide={{ duration: 500 }}>
            <div class="monitor-header">
                <h4>파일 상태 모니터</h4>
                <button class="close-text-btn" onclick={() => showStatusMonitor = false}>[닫기]</button>
            </div>
            <ul class="monitor-list">
                {#each indexSearchUI.allFiles as file}
                    <li class="monitor-item">
                        <span class="file-info-text">
                            {file.filename} <small>({file.lines?.length || 0}줄)</small>
                        </span>
                        {#if !file.isIndexed}
                            <button class="btn-generate-mini pulse" onclick={async () => { await indexSearchUI.generateAndUploadIndex(file); checkAllDoneAndHide(); }}>생성</button>
                        {:else}
                            <span class="status-check">✓ 완료</span>
                        {/if}
                    </li>
                {/each}
            </ul>
        </div>
    {/if}

    <section class="menu-section">
        <h4 class="sidebar-sub-title">🌐 서버 서재</h4>
        <div class="collection-selector">
            <select bind:value={indexSearchUI.currentCollection} class="modern-select">
                {#each indexSearchUI.availableCollections as col}
                    <option value={col}>{col}</option>
                {/each}
            </select>
            <button class="sync-btn" onclick={refreshFileList}>🔄 목록 갱신</button>
        </div>
    </section>

    <div class="file-input-wrapper">
        <label class="custom-file-btn">
            📄 로컬 파일 검색 전용 추가 
            <input type="file" multiple 
            onclick={(e) => indexSearchUI.handleFileClick(e)}
            onchange={(e)=>indexSearchUI.handleFileUpload(e)} />
        </label>
    </div>

    <section class="indexing-panel">
        <h4 class="sidebar-sub-title">⚡ 검색에 사용할 인덱스(선택)</h4>
        <div class="indexing-list">
            {#each indexSearchUI.allFiles as file}
                <div class="indexing-item-card" 
                     class:is-selected={indexSearchUI.selectedFiles.has(file.id)} 
					 class:unselected={!indexSearchUI.selectedFiles.has(file.id)} 
                     class:is-not-indexed={!file.isIndexed}
                     onclick={() => file.isIndexed && indexSearchUI.toggleFileSelection(file.id)}>
                    
                    <div class="item-main">
                        <input type="checkbox" 
                               class="custom-checkbox"
                               checked={indexSearchUI.selectedFiles.has(file.id)} 
                               onclick={(e) => { e.stopImmediatePropagation(); indexSearchUI.toggleFileSelection(file.id)}} 
                               disabled={!file.isIndexed} />
                        <span class="filename">{file.filename.replace('.docx', '').replace('.txt','')}</span>
                    </div>

                    <button class="status-btn" 
                            class:done={file.isIndexed} 
                            class:need={!file.isIndexed}
                            onclick={(e) => { e.stopPropagation(); indexSearchUI.generateAndUploadIndex(file); }}>
                        {file.isIndexed ? "완료 (재생성)" : "인덱스 생성"}
                    </button>
                </div>
            {/each}
        </div>
    </section>

    <button class="export-btn" 
            class:active={indexSearchUI.searchResults.length > 0} 
            onclick={() => indexSearchUI.saveAsDocx()} 
            disabled={indexSearchUI.searchResults.length === 0}>
        {indexSearchUI.searchResults.length > 0 ? `📄 결과 DOCX 저장 (${indexSearchUI.searchResults.length}건)` : '검색 결과가 없습니다'}
    </button>
</aside>

<style>
    .sidebar { padding: 20px; display: flex; flex-direction: column; gap: 18px; height: 100vh; background: #fff; box-sizing: border-box; }
    
    /* 헤더 */
    .sidebar-header { border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; }
    .main-title { font-size: 1.3rem; font-weight: 800; margin: 0; color: #1e293b; }
    .count-badge { font-size: 0.9rem; color: #64748b; font-weight: 600; }

    /* 모니터 박스 (이미지 스타일) */
    .status-monitor-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; }
    .monitor-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; }
    .monitor-header h4 { margin: 0; font-size: 0.9rem; color: #475569; }
    .close-text-btn { border: none; background: none; cursor: pointer; font-size: 11px; color: #94a3b8; }
    .monitor-list { list-style: none; padding: 0; margin: 0; max-height: 150px; overflow-y: auto; }
    .monitor-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; font-size: 0.85rem; border-bottom: 1px dotted #e2e8f0; }
    .status-check { color: #10b981; font-weight: 800; }

    /* 메뉴 섹션 */
    .sidebar-sub-title { font-size: 1rem; font-weight: 800; margin: 0 0 10px 0; color: #334155; }
    .collection-selector { display: flex; gap: 8px; }
    .modern-select { flex: 1; padding: 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-family: inherit; font-weight: 600; }
    .sync-btn { padding: 8px 12px; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; white-space: nowrap; }

    /* 로컬 추가 버튼 (녹색) */
    .custom-file-btn { 
        display: block; width: 93%; text-align: center; 
        background: #10b981; color: white; padding: 12px; 
        border-radius: 8px; cursor: pointer; font-weight: 800; 
        box-shadow: 0 4px 0 #059669; transition: all 0.1s;
		margin-bottom: 40px;
    }
    .custom-file-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #059669; }
    .custom-file-btn input { display: none; }

    /* 인덱스 카드 리스트 (핵심 레이아웃) */
    .indexing-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .indexing-list { flex: 1; overflow-y: auto; padding-right: 4px; }
    
    .indexing-item-card { 
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 12px; background: #fff; border: 1px solid #e2e8f0;
        border-radius: 8px; margin-bottom: 8px; cursor: pointer; /* transition을 0s로 설정하여 즉시 변화하게 함 */
        transition: none !important; 
    }
	.indexing-item-card:hover{
		background-color: #7bb9ff !important; /* 흐릿한 푸른색 */
        border-color: #4a97f5 !important;
        opacity: 0.9 !important; /* 흐릿함을 살짝 선명하게 */
	}
	/* 2. 비활성화(체크 안 된) 상태에서 호버 시 푸른색 피드백 */
    .indexing-item-card.unselected{
        background-color: #f0f7ff !important; /* 흐릿한 푸른색 */
        border-color: #bfdbfe !important;
		color: rgb(158, 157, 157);
        opacity: 0.9 !important; /* 흐릿함을 살짝 선명하게 */
    }
	.indexing-item-card.unselected:hover{
		background-color: #7bb9ff !important; /* 흐릿한 푸른색 */
        border-color: #4a97f5 !important;
        opacity: 0.9 !important; /* 흐릿함을 살짝 선명하게 */
	}

    /* 선택 시 파란색 배경 (이미지 반영) */
    .indexing-item-card.is-selected { background: #eff6ff; border-color: #3b82f6; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.1); }
    /* 인덱스 미생성 시 흐릿하게 */
    .indexing-item-card.is-not-indexed { opacity: 0.5; background: #fdfdfd; }
    .indexing-item-card.is-not-indexed .filename { color: #94a3b8; }

    .item-main { display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden; }
    .custom-checkbox { width: 18px; height: 18px; cursor: pointer; flex-shrink: 0; }
    .filename { font-weight: 700; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* 상태 버튼 스타일 */
    .status-btn { 
        padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; 
        font-weight: 700; border: 1px solid transparent; cursor: pointer; white-space: nowrap;
    }
    .status-btn.done { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
    .status-btn.need { background: #fff7ed; color: #ea580c; border-color: #ffedd5; }

    /* 저장 버튼 (하단 고정 스타일) */
    .export-btn { 
        width: 100%; padding: 15px; border-radius: 10px; border: none; 
        font-weight: 800; font-size: 1rem; background: #e2e8f0; color: #94a3b8; 
        cursor: not-allowed; transition: all 0.2s;
		margin-bottom: 20px;
    }
    .export-btn.active { background: #059669; color: white; cursor: pointer; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2); }
    .export-btn.active:hover { background: #047857; transform: translateY(-1px); }

    /* 애니메이션 */
    .pulse { animation: pulse-animation 2s infinite; }
    @keyframes pulse-animation { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

	.file-info-text{
		color: rgb(61, 124, 251)
	}
</style>