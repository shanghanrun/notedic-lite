<script>
    import { searchUI } from '$lib/searchUI.svelte.js';
    import { slide } from 'svelte/transition';
</script>

<aside class="col sidebar">
    <header class="sidebar-header">
        <h3 class="main-title">📂 파일 임포트</h3>
        <span class="count-badge">파일 수: {searchUI.files.length}</span>
    </header>

    <div class="file-input-wrapper">
        <label class="custom-file-btn">
            📄 검색할 파일 추가 (docx, txt)
            <input type="file" multiple onchange={searchUI.handleFileUpload} />
        </label>
        <p class="hint">다중 선택이 가능합니다.</p>
    </div>

    <section class="file-panel">
        <div class="panel-header">
            <h4 class="sidebar-sub-title">⚡ 선택된 파일 목록</h4>
            {#if searchUI.files.length > 0}
                <button class="clear-text-btn" onclick={searchUI.clearFiles}>[일괄취소]</button>
            {/if}
        </div>

        <div class="file-list-container">
            {#if searchUI.files.length > 0}
                {#each searchUI.files as file, i}
                    <div class="indexing-item-card" 
                         class:is-selected={file.checked}
                         class:unselected={!file.checked}
                         onclick={() => searchUI.toggleFileCheck(i)}>
                        
                        <div class="item-main">
                            <input type="checkbox" 
                                   class="custom-checkbox"
                                   checked={file.checked} 
                                   onclick={(e) => { e.stopImmediatePropagation(); searchUI.toggleFileCheck(i)}} />
                            <span class="filename">{file.name.replace('.docx', '').replace('.txt','')}</span>
                        </div>
                        
                        <div class="file-info-tag">
                            {file.lines?.length || 0} lines
                        </div>
                    </div>
                {/each}
            {:else}
                <div class="empty-state" transition:slide>
                    <p>파일을 추가해 주세요.</p>
                </div>
            {/if}
        </div>
    </section>

    <button class="export-btn" 
            class:active={searchUI.searchResults.length > 0} 
            onclick={() => searchUI.saveAsDocx()} 
            disabled={searchUI.searchResults.length === 0}>
        {searchUI.searchResults.length > 0 ? `📄 결과 DOCX 저장 (${searchUI.searchResults.length}건)` : '검색 결과가 없습니다'}
    </button>
</aside>

<style>
    .sidebar { padding: 20px; display: flex; flex-direction: column; gap: 20px; height: 100vh; background: #fff; box-sizing: border-box; border-right: 1px solid #f1f5f9; }
    
    .sidebar-header { border-bottom: 2px solid #f1f5f9; padding-bottom: 10px; display: flex; justify-content: space-between; align-items: baseline; }
    .main-title { font-size: 1.2rem; font-weight: 800; margin: 0; color: #1e293b; }
    .count-badge { font-size: 0.85rem; color: #64748b; font-weight: 600; }

    .custom-file-btn { 
        display: block; width: 100%; text-align: center; 
        background: #10b981; color: white; padding: 14px; 
        border-radius: 8px; cursor: pointer; font-weight: 800; 
        box-shadow: 0 4px 0 #059669; transition: none;
        box-sizing: border-box;
    }
    .custom-file-btn:active { transform: translateY(2px); box-shadow: 0 2px 0 #059669; }
    .custom-file-btn input { display: none; }
    .hint { font-size: 0.75rem; color: #94a3b8; text-align: center; margin-top: 8px; }

    .file-panel { flex: 1; display: flex; flex-direction: column; min-height: 0; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .sidebar-sub-title { font-size: 0.95rem; font-weight: 700; color: #475569; margin: 0; }
    .clear-text-btn { background: none; border: none; color: #ef4444; font-size: 0.8rem; cursor: pointer; font-weight: 600; }

    .file-list-container { flex: 1; overflow-y: auto; padding-right: 4px; }

    /* 카드 스타일 (관리자 페이지와 통일) */
    .indexing-item-card { 
        display: flex; justify-content: space-between; align-items: center;
        padding: 10px 12px; background: #fff; border: 1px solid #e2e8f0;
        border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: none !important;
    }
    .indexing-item-card.is-selected { background: #eff6ff !important; border-color: #3b82f6 !important; }
    .indexing-item-card.unselected:hover { background-color: #f8fafc; border-color: #cbd5e1; }
    
    .item-main { display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden; }
    .custom-checkbox { width: 17px; height: 17px; cursor: pointer; }
    .filename { font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #334155; }
    .file-info-tag { font-size: 0.7rem; color: #94a3b8; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }

    .empty-state { text-align: center; padding: 40px 0; color: #cbd5e1; border: 2px dashed #f1f5f9; border-radius: 12px; }

    .export-btn { 
        width: 100%; padding: 16px; border-radius: 10px; border: none; 
        font-weight: 800; font-size: 1rem; background: #e2e8f0; color: #94a3b8; 
        cursor: not-allowed; transition: all 0.2s;
    }
    .export-btn.active { background: #059669; color: white; cursor: pointer; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.2); }
</style>