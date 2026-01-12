<script>
    import { pb } from './../../lib/pb.svelte.js';
    import { researchState, researchActions } from '$lib/pb.svelte.js';
    import mammoth from 'mammoth';
    import { Document, Packer, Paragraph, TextRun } from 'docx';
    import { goto } from '$app/navigation';

    // 1. 초기화 및 데이터 로드
    $effect(() => { researchActions.login(); });
    $effect(() => {
        if (researchState.currentCollection) {
            researchActions.fetchAllFromCollection();
        }
    });

    let files = $state([]); 
    let searchQuery = $state(""); 
    let summaryElement = $state(null);

	// ==========================================
    // [추가] 서치로그 저장 로직
    // 검색어가 바뀔 때마다 실시간으로 서버에 기록을 남깁니다.
    // ==========================================
    // [수정] 감시자: 사용자가 타이핑을 멈추고 1초 뒤에 로그 저장
	let logTimer = null; // 디바운스를 위한 타이머 변수
    $effect(() => {
        const query = searchQuery.trim();
        const results = searchResults;

        // 기존 타이머가 있다면 취소 (연속 입력 방지)
        if (logTimer) clearTimeout(logTimer);

        if (query && results.length > 0) {
            // 2초(1000ms) 동안 추가 입력이 없으면 실행
            logTimer = setTimeout(() => {
                saveSearchLog(query, results);
            }, 2000); 
        }
    });

	// [수정] 로그 저장 로직: 디바운스 적용
    async function saveSearchLog(query, results) {
        if (!query.trim() || results.length === 0) return;
        
        const usedFilesList = [...new Set(results.map(r => r.fileName))];
        
        try {
            await pb.collection('search_logs').create({
                query: query,
                used_files: usedFilesList,
                total_count: results.length,
                search_date: new Date().toISOString()
            });
            console.log("📝 자동 로그 기록 완료:", query);
        } catch (err) {
            console.error("로그 저장 실패:", err);
        }
    }

    // 2. 통합 데이터 맵 (미리보기 및 검색용)
    const allFileData = $derived.by(() => {
        const combined = [...files, ...researchState.allFiles];
        return combined.reduce((acc, f) => {
            const name = f.name || f.filename || "이름 없는 파일";
            acc[name] = {
                lines: f.lines || [],
                isServer: !!f.id
            };
            return acc;
        }, {});
    });

    // 3. 검색 로직
    let searchResults = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return [];
        
        let results = [];
        Object.entries(allFileData).forEach(([fileName, data]) => {
            data.lines.forEach(line => {
                if (line.toLowerCase().includes(query)) {
                    results.push({ fileName, text: line, isServer: data.isServer });
                }
            });
        });
        return results;
    });

    let groupedResults = $derived.by(() => {
        return searchResults.reduce((acc, curr) => {
            if (!acc[curr.fileName]) acc[curr.fileName] = [];
            acc[curr.fileName].push(curr.text);
            return acc;
        }, {});
    });

    // 4. 액션 함수
    function previewFile(fileName) {
        const data = allFileData[fileName];
        if (data && data.lines.length > 0) {
            const text = data.lines.slice(0, 15).join('\n');
            alert(`[${fileName}] 미리보기 (상위 15줄):\n\n${text}...`);
        } else {
            alert("표시할 내용이 없습니다.");
        }
    }

    async function handleFileUpload(e) {
        const uploadedFiles = Array.from(e.target.files);
        let newFilesData = [];
        for (const file of uploadedFiles) {
            try {
                let text = file.name.endsWith('.docx') 
                    ? (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value 
                    : await file.text();
                if (text) {
                    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
                    newFilesData.push({ name: file.name, lines });
                }
            } catch (err) { console.error(err); }
        }
        files = [...files, ...newFilesData];
        e.target.value = ""; 
    }

    function highlightText(fullText, query, isFinal = false) {
        if (!query) return fullText;
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return fullText.replace(regex, isFinal ? `<b style="color: blue;">$1</b>` : `<mark class="hl">$1</mark>`);
    }

    function copyToClipboard() {
        if (!summaryElement || searchResults.length === 0) return;
        const range = document.createRange();
        range.selectNode(summaryElement);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        alert("📋 보고서 내용이 복사되었습니다!");
        window.getSelection().removeAllRanges();
    }

    async function saveAsDocx() {
        if (searchResults.length === 0) return;
        const sections = [
            new Paragraph({ children: [new TextRun({ text: `검색어 [${searchQuery}] 분석 결과`, bold: true, size: 36 })], spacing: { after: 400 } })
        ];
        for (const fileName in groupedResults) {
            sections.push(new Paragraph({
                children: [
                    new TextRun({ text: `[출처: ${fileName}] `, color: "3498db", bold: true, size: 24 }),
                    new TextRun({ text: `총 ${groupedResults[fileName].length}건`, color: "666666", size: 20 })
                ], spacing: { before: 400, after: 200 }
            }));
            groupedResults[fileName].forEach(lineText => {
                const parts = lineText.split(new RegExp(`(${searchQuery})`, 'gi'));
                sections.push(new Paragraph({
                    children: parts.map(part => {
                        const isMatch = part.toLowerCase() === searchQuery.toLowerCase();
                        return new TextRun({ text: part, bold: isMatch, color: isMatch ? "0000FF" : "000000", size: 22 });
                    }), spacing: { after: 120 }, indent: { left: 240 }
                }));
            });
        }
        const blob = await Packer.toBlob(new Document({ sections: [{ children: sections }] }));
        const a = document.createElement("a");
        a.href = window.URL.createObjectURL(blob);
        a.download = `${searchQuery}_연구자료.docx`;
        a.click();
    }
</script>

<div class="admin-container">
    <aside class="col sidebar">
        <header><h3>📂 파일 임포트</h3></header>
        <div class="file-input-wrapper">
            <label class="custom-file-btn">파일 선택 <input type="file" multiple onchange={handleFileUpload} /></label>
            <p class="hint">docx, txt 파일 지원</p>
        </div>
        
        <div class="file-box">
            <ul class="file-list">
                {#each Object.entries(allFileData) as [name, data]}
                    <li class={data.isServer ? "server-file" : ""}>
                        <div class="file-info">
                            <span>{data.isServer ? "🌐" : "📄"} {name}</span>
                            <span class="count">({data.lines.length}줄)</span>
                        </div>
                    </li>
                {/each}
                {#if Object.keys(allFileData).length === 0}
                    <li class="empty-file">로드된 파일 없음</li>
                {/if}
            </ul>
        </div>

        <div class="preview-section">
            <h4 class="sidebar-sub-title">🔍 내용 미리보기</h4>
            <div class="preview-btn-list">
                {#each Object.keys(allFileData) as fileName}
                    <button class="preview-tag-btn" onclick={() => previewFile(fileName)}>
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

        <button class="export-btn" onclick={saveAsDocx} disabled={searchResults.length === 0}>
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
                <input type="text" bind:value={searchQuery} placeholder="검색어 입력 (예: 백호)" />
                <div class="info-badge">결과: <strong>{searchResults.length}</strong>건</div>
                <button class="go-button" onclick={()=>goto('/')}>Home</button>
            </div>
        </div>

        <div class="scroll-area">
            <section class="results-list">
                <h4 class="section-title">⚡ 빠른 확인 카드</h4>
                {#each searchResults as result}
                    <div class="result-card">
                        <div class="card-edge" style="background: {result.isServer ? '#3b82f6' : '#6eb485'}"></div>
                        <div class="card-body">
                            <div class="file-tag">{result.isServer ? "🌐 " : "📄 "}{result.fileName}</div>
                            <p class="sentence">{@html highlightText(result.text, searchQuery)}</p>
                        </div>
                    </div>
                {/each}
            </section>

            <hr class="divider" />

            <section class="final-summary">
                <div class="summary-header">
                    <h4 class="section-title">📋 종합 정리</h4>
                    <button class="copy-icon-btn" onclick={copyToClipboard}>📄 전체 복사하기</button>
                </div>
                
                <div class="summary-paper" bind:this={summaryElement}>
                    <h2 class="summary-main-title">검색어 [{searchQuery}] 분석 보고서</h2>
                    {#each Object.entries(groupedResults) as [fileName, lines]}
                        <div class="summary-group">
                            <h3 class="summary-file-header">
                                [출처: {fileName}] <small>({lines.length}건)</small>
                            </h3>
                            {#each lines as line}
                                <p class="summary-line">• {@html highlightText(line, searchQuery, true)}</p>
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