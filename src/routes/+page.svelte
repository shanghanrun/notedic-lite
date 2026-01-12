<script>
    import mammoth from 'mammoth';
    import { Document, Packer, Paragraph, TextRun } from 'docx';
  import { goto } from '$app/navigation';
  import { verifyAdmin } from '$lib/pb.svelte';

    let files = $state([]); 
    let searchQuery = $state(""); 
    let summaryElement = $state(null);

    let searchResults = $derived.by(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return [];
        let results = [];
        files.forEach(file => {
            file.lines.forEach(line => {
                if (line.toLowerCase().includes(query)) {
                    results.push({ fileName: file.name, text: line });
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

    function copyToClipboard() {
        if (!summaryElement || searchResults.length === 0) return;
        const range = document.createRange();
        range.selectNode(summaryElement);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        try {
            document.execCommand('copy');
            alert("📋 종합 정리 내용이 복사되었습니다!");
        } catch (err) { alert("복사 실패..."); }
        window.getSelection().removeAllRanges();
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

    function highlightText(fullText, query, isFinal = false) {
        if (!query) return fullText;
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        const replacement = isFinal ? `<b style="color: blue;">$1</b>` : `<mark class="hl">$1</mark>`;
        return fullText.replace(regex, replacement);
    }
</script>

<div class="admin-container">
    <aside class="col sidebar">
        <header><h3>📂 파일 임포트</h3></header>
        <div class="file-input-wrapper">
            <label class="custom-file-btn">파일 선택 <input type="file" multiple onchange={handleFileUpload} /></label>
            <p class="hint">docx, txt 파일(다중 선택 가능)</p>
        </div>
        <div class="file-box">
            <ul class="file-list">
                {#each files as file}
                    <li>📄 {file.name} <span class="count">({file.lines.length}줄)</span></li>
                {:else}
                    <li class="empty-file">업로드된 파일이 없습니다.</li>
                {/each}
            </ul>
        </div>
        <button class="export-btn" onclick={saveAsDocx} disabled={searchResults.length === 0}>
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <polyline points="9 15 12 18 15 15"></polyline>
            </svg>
            결과 DOCX 저장
        </button>
    </aside>

    <main class="col main-content">
        <div class="search-header">
            <div class="search-container">
                <input type="text" bind:value={searchQuery} placeholder="검색어 입력 (예: 백호)" />
                <div class="info-badge">결과: <strong>{searchResults.length}</strong>건</div>
				<button class="go-button" 
					onclick={()=>{
						if (verifyAdmin()) goto('/admin')}}>admin</button>
            </div>
        </div>

        <div class="scroll-area">
            <section class="results-list">
                <div class="section-title-wrapper">
                    <svg class="modern-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <h4 class="section-title">빠른 확인 카드</h4>
                </div>
                
                {#each searchResults as result}
                    <div class="result-card">
                        <div class="card-edge"></div>
                        <div class="card-body">
                            <div class="file-tag">{result.fileName}</div>
                            <p class="sentence">{@html highlightText(result.text, searchQuery)}</p>
                        </div>
                    </div>
                {/each}
            </section>

            <hr class="divider" />

            <section class="final-summary">
                <div class="summary-header">
                    <h4 class="section-title">📋 종합 정리</h4>
                    <button class="copy-icon-btn" onclick={copyToClipboard}>
                        <span>📄 전체 복사하기</span>
                    </button>
                </div>
                
                <div class="summary-paper" bind:this={summaryElement}>
                    <h2 class="summary-main-title">검색어 [{searchQuery}] 분석 보고서</h2>
                    {#each Object.entries(groupedResults) as [fileName, lines]}
                        <div class="summary-group">
                            <h3 style="color: #2563eb; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 10px;">
                                [출처: {fileName}] <small style="color: #64748b; font-size: 0.9rem; font-weight: normal;">({lines.length}건)</small>
                            </h3>
                            {#each lines as line}
                                <p style="margin: 0 0 8px 15px; line-height: 1.6; font-size: 1rem; color: #000;">
                                    {@html highlightText(line, searchQuery, true)}
                                </p>
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
    :global(body) { margin: 0; background: #9db6c0; font-family: 'Nanum Gothic', sans-serif; overflow: hidden; color: #334155; }
    
    .admin-container { display: grid; grid-template-columns: 340px 1fr; gap: 20px; padding: 20px; height: 100vh; box-sizing: border-box; }
    .col { background: white; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }

    .sidebar { padding: 24px; }
    .custom-file-btn { display: block; text-align: center; background: #20c465; color: white; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 800; box-shadow: 0 4px 0 #1c5032; }
    .custom-file-btn input { display: none; }
    .file-box { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; margin: 15px 0; overflow-y: auto; }
    .file-list { list-style: none; padding: 0; font-size: 0.85rem; }
    .file-list li { padding: 8px 10px; border-bottom: 1px solid #edf2f7; color: #475569; font-weight: 700; }
    /* 수정된 DOCX 저장 버튼 스타일 */
    .export-btn { 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        gap: 10px;          /* 아이콘과 글자 사이 간격 */
        width: 100%;        /* 사이드바 너비에 맞춤 */
        padding: 14px 10px; /* 상하 패딩 조절 */
        background: #2b579a; 
        color: white; 
        border-radius: 10px; 
        border: none; 
        font-weight: 800; 
        font-size: 0.95rem; /* 글자 크기 살짝 조정 */
        cursor: pointer;
        transition: background 0.2s;
        white-space: nowrap; /* 글자가 절대 줄바꿈되지 않도록 설정 */
    }

    .export-btn:hover { background: #1e3e6d; }
    .export-btn:disabled { background: #cbd5e1; cursor: not-allowed; }

    /* 아이콘 크기를 텍스트 높이에 맞춰 최적화 */
    .btn-icon { 
        width: 1.2rem; 
        height: 1.2rem; 
        flex-shrink: 0; /* 버튼이 좁아져도 아이콘이 찌그러지지 않음 */
    }

    /* --- 수정: 은은한 검색창 디자인 --- */
    .search-header { padding: 15px 25px; border-bottom: 1px solid #f1f5f9; background: #ffffff; }
    .search-container { display: flex; align-items: center; gap: 15px; }
    .search-container input { 
        width: 300px; 
        padding: 12px 18px; 
        border: 1px solid #cbd5e1; /* 테두리 색을 연하게 */
        background: #fcfdfe; /* 배경색에 아주 살짝 변화 */
        border-radius: 8px; 
        font-size: 1rem; 
        font-weight: 700; 
        font-family: inherit;
        transition: all 0.2s;
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.05);
    }
    .search-container input:focus {
        outline: none;
        border-color: #3b82f6;
        background: #fff;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); /* 포커스 시 은은한 광채 */
    }
    .info-badge { font-size: 0.95rem; color: #64748b; background: #f1f5f9; padding: 8px 15px; border-radius: 8px; white-space: nowrap; }
    .info-badge strong { color: #3b82f6; }

    .scroll-area { flex: 1; overflow-y: auto; padding: 20px; background: #f8fafc; }

    /* --- 수정: 직각형 카드 디자인 --- */
    .section-title-wrapper { display: flex; align-items: center; gap: 10px; margin-bottom: 15px; }
    .modern-search-icon { width: 22px; height: 22px; color: #3b82f6; }
    .section-title { color: #1e293b; font-size: 1.15rem; font-weight: 800; margin: 0; }

    .result-card { 
        background: white; 
        /* 핵심 수정: 좌측 위(0), 좌측 아래(0), 우측 아래(8px), 우측 위(8px) */
        border-radius: 0 8px 8px 8px; 
        margin-bottom: 12px; 
        display: flex; 
        overflow: hidden; 
        border: 1px solid #e2e8f0; 
        box-shadow: 0 2px 5px rgba(0,0,0,0.02); 
    }
    
    .card-edge { 
        width: 6px;             /* 원장님이 정해주신 든든한 6px 굵기 */
        background: #6eb485; 
        flex-shrink: 0; 
        /* 개별 border-radius를 0으로 확실히 고정 */
        /* border-radius: 0 !important;  */
    }

    /* 검색창 디자인도 조금 더 부드럽게 유지 */
    .search-container input { 
        width: 300px; 
        padding: 12px 18px; 
        border: 1px solid #cbd5e1; 
        background: #fcfdfe;
        border-radius: 8px; 
        font-size: 1rem; 
        font-weight: 700;
        transition: all 0.2s;
    }
    
    .card-body { padding: 15px; flex-grow: 1; }
    .file-tag { font-size: 0.75rem; color: #3b82f6; font-weight: 800; background: #eff6ff; padding: 2px 8px; border-radius: 4px; margin-bottom: 5px; display: inline-block; }
    .sentence { margin: 0; line-height: 1.6; color: #334155; font-weight: 500; font-size: 1.05rem; }
    :global(.hl) { background: #fde047; font-weight: 800; padding: 0 2px; }

    .divider { border: 0; height: 1px; background: #e2e8f0; margin: 40px 0; }
    .summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .copy-icon-btn { background: #ffffff; border: 1.5px solid #2ecc71; color: #27ae60; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-weight: 800; font-size: 0.9rem; }
    .copy-icon-btn:hover { background: #2ecc71; color: white; }
    .summary-paper { background: white; padding: 40px; border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; min-height: 400px; }
    .summary-main-title { border-bottom: 2px solid #334155; padding-bottom: 10px; margin-bottom: 30px; font-weight: 800; }
    .empty-file { text-align: center; color: #94a3b8; padding: 40px 0; }
	.go-button{
		border: 1.5px solid #2ecc71; color: #27ae60; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-weight: 800; font-size: 0.9rem;
		margin-left: 40px;
	}
</style>