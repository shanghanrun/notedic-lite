<script>
    import { onMount } from 'svelte';
	import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    import { goto } from '$app/navigation';

	onMount(async () => {
		await indexSearchUI.fetchAllFromCollection('hani');
	});
    
    

    // 인덱싱 핸들러
    async function handleIndexing(file) {
        const isReindexing = file.isIndexed;
        const msg = isReindexing 
            ? `${file.filename} 인덱스를 다시 생성할까요?` 
            : `${file.filename} 인덱싱을 시작합니다.`;
            
        if (!confirm(msg)) return;
        
        // 인덱싱 전, 텍스트가 메모리에 있는지 한 번 더 확인
        if (!file.lines || file.lines.length === 0) {
            await indexSearchUI.loadFileLines(file);
        }

        await indexSearchUI.generateAndUploadIndex(file);
    }
</script>

<div class="admin-container">
    <aside class="col sidebar">
        <header><h3>📂 자료 관리</h3></header>
        {#if indexSearchUI.isLoading}
            <p>로딩 중...</p>
        {:else}
            <p>파일 수: {indexSearchUI.allFiles.length}</p>
            <p>
            전체 키 수:
            {
                Object.values(indexSearchUI.indexMap)
                .reduce((sum, idx) => sum + Object.keys(idx).length, 0)
            }
            </p>
        {/if}
        
        <div class="file-input-wrapper">
            <label class="custom-file-btn">
                📄 로컬 파일 검색 전용 추가 
                <input type="file" multiple onchange={indexSearchUI.handleFileUpload} />
            </label>
            <p class="hint">인덱싱되지 않은 임시 파일들</p>
        </div>

        <div class="file-box">
            <ul class="file-list">
                {#each Object.entries(indexSearchUI.allFileData) as [name, data]}
                    <li class={data.isServer ? "server-file" : ""}>
                        <div class="file-info">
                            <span>{data.isServer ? "🌐" : "📄"} {name}</span>
                            <span class="count">({data.lines?.length || 0}줄)</span>
                        </div>
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
                <button class="sync-btn-small" onclick={() => indexSearchUI.fetchAllFromCollection()}>
                    🔄 목록 갱신
                </button>
            </div>
        </div>

        <div class="indexing-panel">
            <h4 class="sidebar-sub-title">⚡ 인덱스 상태 관리</h4>
            <div class="indexing-list">
                {#each indexSearchUI.allFiles as file}
                    <div class="file-row">
                        <span class="file-name-mini">{file.filename}</span>
                        <button 
                            type="button"
                            class="index-status-btn {file.isIndexed ? 'complete' : 'pending'}"
                            onclick={() => handleIndexing(file)}
                        >
                            {file.isIndexed ? "✅ 완료 (재생성)" : "⚡ 인덱스 생성"}
                        </button>
                    </div>
                {/each}
            </div>
        </div>

        <button class="export-btn" onclick={() => indexSearchUI.saveAsDocx()} disabled={indexSearchUI.searchResults.length === 0}>
            결과 DOCX 저장
        </button>
    </aside>

    <main class="col main-content">
        <div class="search-header">
            <div class="search-container">
                <input type="text" bind:value={indexSearchUI.searchQuery} placeholder="검색어 입력 (예: 시호/백호)" />
                <div class="info-badge">매칭: <strong>{indexSearchUI.searchResults.length}</strong>건</div>
                <button class="go-button" onclick={() => { indexSearchUI.reset(); goto('/'); }}>Home</button>
            </div>
        </div>

        <div class="scroll-area">
            <section class="results-list">
                <h4 class="section-title">⚡ 고속 인덱스 검색 카드</h4>
                {#each indexSearchUI.searchResults as result}
                    <div class="result-card">
                        <div class="card-edge" style="background: {result.isServer ? '#3b82f6' : '#6eb485'}"></div>
                        <div class="card-body">
                            <div class="file-tag">{result.isServer ? "🌐 " : "📄 "}{result.fileName}</div>
                            <p class="sentence">{@html indexSearchUI.highlightText(result.text, indexSearchUI.processedQueries, false)}</p>
                        </div>
                    </div>
                {:else}
                    <div class="empty-state">검색 결과가 없거나 인덱스를 불러오는 중입니다.</div>
                {/each}
            </section>

            <hr class="divider" />

            <section class="final-summary">
                <div class="summary-header">
                    <h4 class="section-title">📋 분석 보고서</h4>
                    <button class="copy-icon-btn" onclick={() => indexSearchUI.copyToClipboard()}>📄 전체 복사</button>
                </div>
                
                <div class="summary-paper" bind:this={indexSearchUI.summaryElement}>
                    <h2 class="summary-main-title">검색어 [{indexSearchUI.searchQuery}] 분석 보고서</h2>
                    {#each Object.entries(indexSearchUI.groupedResults) as [fileName, lines]}
                        <div class="summary-group">
                            <h3 class="summary-file-header">[출처: {fileName}] ({lines.length}건)</h3>
                            {#each lines as line}
                                <p class="summary-line">{@html indexSearchUI.highlightText(line, indexSearchUI.processedQueries, true)}</p>
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

    .custom-file-btn { display: block; text-align: center; background: #20c465; color: white; padding: 12px;}
    /* ... 기존 스타일 유지 및 아래 추가 ... */
    .file-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding: 4px; border-bottom: 1px solid #f1f5f9; }
    .file-name-mini { font-size: 0.8rem; font-weight: bold; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px; }
    
    .index-status-btn { font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; border: none; font-weight: 800; cursor: pointer; color: white; }
    .index-status-btn.pending { background: #8b5cf6; }
    .index-status-btn.complete { background: #10b981; }
    
    .indexing-panel { margin-top: 20px; flex: 1; overflow-y: auto; }
    .empty-state { padding: 40px; text-align: center; color: #94a3b8; }
</style>