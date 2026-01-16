// searchUI.svelte.js
import { researchState, pb } from './pb.svelte.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

class SearchUI {
    type ="local"; // 일반 파일을 다루는 페이지용
    // 1. 상태 (State)
	files = $state([]) // 각 파일은 { name, lines, checked: true } 형태
    allFiles = $state([]);  
    searchQuery = $state("");
    logTimer = null;
	summaryElement = $state(null)
    selectedFiles = $state(new Set()); 

    // 가상 스크롤 상태
    scrollTop = $state(0);
    containerHeight = $state(760); 
    itemHeight = $state(180);    

    // [최적화 핵심] 정규식 및 컬러 맵 캐싱
    cachedRegex = $state(null); 
    queryColorMap = new Map();
	colorMap = new Map();


    get processedQueries() {
        const q = this.searchQuery.trim();
        if (!q) return [];
        // 중복 제거 및 긴 단어 우선순위 정렬된 배열 반환
        return [...new Set(q.split('/').map(v => v.trim()).filter(Boolean))];
    }

    // [핵심] 현재 눈에 보이는 결과만 실시간 계산 (가상 스크롤)
    visibleResults = $derived.by(() => {
        const all = this.searchResults;
        if (all.length === 0) return [];

        const startIdx = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - 2);
        const endIdx = Math.min(all.length, Math.ceil(this.containerHeight / this.itemHeight) + startIdx + 3);

        return all.slice(startIdx, endIdx).map((item, i) => ({
            ...item,
            uniqueKey: `card-${item.id}-${item.lineIndex}`, 
            renderTop: (startIdx + i) * this.itemHeight
        }));
    });

    get totalHeight() {
        return this.searchResults.length * this.itemHeight;
    }

    /* =========================
      3. SEARCH LOGIC
    ========================= */
    startSearch() {
		const input = this.searchInput.trim();
		if (!input) {
			this.searchQuery = "";
			this.cachedRegex = null;
			this.colorMap.clear();
			return;
		}
		
		this.searchQuery = input;
		this.scrollTop = 0;

		// 1. 색상 매칭용 맵 구성
		const queries = this.processedQueries;
		this.colorMap.clear();
		queries.forEach((q, i) => {
			this.colorMap.set(q.toLowerCase(), i);
		});

		// 2. 정규식 생성
		const pattern = [...queries]
			.sort((a, b) => b.length - a.length)
			.map(q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('|');
		
		this.cachedRegex = new RegExp(`(${pattern})`, 'gi');
	}

    searchResults = $derived.by(() => {
        const queries = this.processedQueries;
        if (!queries.length) return [];
        
        const results = [];
        // allFiles 대신 로컬 업로드된 files를 직접 참조하거나, 
        // allFileData derived를 활용하세요.
        this.files.forEach(file => {
            if (!file.checked) return; // 체크된 파일만 검색
            if (!file.lines) return;

            file.lines.forEach((line, i) => {
                if (queries.some(q => line.includes(q))) {
                    const isAndMatch = queries.every(q => line.includes(q));
                    results.push({
                        id: file.name + i, // 고유 키
                        fileName: file.name,
                        text: line,
                        lineIndex: i,
                        isAndMatch: isAndMatch
                    });
                }
            });
        });

        return results.sort((a, b) => b.isAndMatch - a.isAndMatch);
    });

    groupedResults = $derived.by(() => {
        return this.searchResults.reduce((acc, r) => {
            if (!acc[r.fileName]) acc[r.fileName] = [];
            acc[r.fileName].push(r.text);
            return acc;
        }, {});
    });

    /* =========================
      4. UI HELPERS (Highlight)
    ========================= */
    highlightText(fullText, isFinal = false) {
		if (!fullText || !this.cachedRegex) return fullText;

		const colors = isFinal 
			? ['#0000FF', '#FF0000', '#2ecc71', '#e67e22'] 
			: ['#fde047', '#ffcfdf', '#d1fae5', '#e0e7ff'];

		return fullText.replace(this.cachedRegex, (match) => {
			// match된 단어로 바로 색상 번호(Index) 추출
			const key = match.toLowerCase();
			const qIdx = this.colorMap.has(key) ? this.colorMap.get(key) : 0;
			const color = colors[qIdx % colors.length];
			
			if (isFinal) {
				return `<b style="color: ${color}; font-weight: normal;">${match}</b>`;
			} else {
				// mark 태그가 안 보일 경우를 대비해 확실한 인라인 스타일 부여
				return `<mark style="background-color: ${color} !important; color: black; border-radius: 2px; padding: 0 2px;">${match}</mark>`;
			}
		});
	}

    /* =========================
      5. FILE & INDEX ACTIONS (기존 로직 유지)
    ========================= */
    handleScroll(e) {
        this.scrollTop = e.target.scrollTop;
    }
    
   
    async saveSearchLog(query, results) {
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

	previewFile(fileName) {
        const data = this.allFileData[fileName];
        if (data && data.lines.length > 0) {
            const text = data.lines.slice(0, 15).join('\n');
            alert(`[${fileName}] 미리보기 (상위 15줄):\n\n${text}...`);
        } else {
            alert("표시할 내용이 없습니다.");
        }
    }

	 // 2. 통합 데이터 맵 (Derived) - 로컬 + 서버 데이터 합치기
    get allFileData() {
		// 로컬 파일은 자기 자신의 checked 상태를, 서버 파일은 기본 true(혹은 별도 관리)를 부여
        const localFiles = this.files.map(f => ({ ...f, isServer: false }));
        const serverFiles = researchState.allFiles.map(f => ({
            name: f.name || f.filename,
            lines: f.lines,
            checked: true, // 서버 파일은 기본적으로 체크된 상태로 간주 (필요시 관리 가능)
            isServer: true
        }));

        const combined = [...localFiles, ...serverFiles];
        return combined.reduce((acc, f) => {
            const name = f.name || f.filename || "이름 없는 파일";
            acc[name] = {
                lines: f.lines || [],
				checked: f.checked,
                isServer: f.isServer
            };
            return acc;
        }, {});
    }

	copyToClipboard() {
        if (!this.summaryElement) return;
        const r = document.createRange();
        r.selectNodeContents(this.summaryElement);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
        document.execCommand('copy');
        sel.removeAllRanges();
    }

	async saveAsDocx() {
        if (this.searchResults.length === 0) return;
        const sections = [
            new Paragraph({ children: [new TextRun({ text: `검색어 [${this.searchQuery}] 분석 결과`, bold: true, size: 36 })], spacing: { after: 400 } })
        ];
        for (const fileName in this.groupedResults) {
            sections.push(new Paragraph({
                children: [
                    new TextRun({ text: `[출처: ${fileName}] `, color: "3498db", bold: true, size: 24 }),
                    new TextRun({ text: `총 ${this.groupedResults[fileName].length}건`, color: "666666", size: 20 })
                ], spacing: { before: 400, after: 200 }
            }));
            this.groupedResults[fileName].forEach(lineText => {
                const parts = lineText.split(new RegExp(`(${this.searchQuery})`, 'gi'));
                sections.push(new Paragraph({
                    children: parts.map(part => {
                        const isMatch = part.toLowerCase() === this.searchQuery.toLowerCase();
                        return new TextRun({ text: part, bold: isMatch, color: isMatch ? "0000FF" : "000000", size: 22 });
                    }), spacing: { after: 120 }, indent: { left: 240 }
                }));
            });
        }
        const blob = await Packer.toBlob(new Document({ sections: [{ children: sections }] }));
        const a = document.createElement("a");
        a.href = window.URL.createObjectURL(blob);
        a.download = `${this.searchQuery}_연구자료.docx`;
        a.click();
    }

	// [수정 전]
// async handleFileUpload(e) { ... }
// 브라우저는 onchange={searchUI.handleFileUpload}처럼 함수를 전달하면, 실행될 때 그 함수 내부의 this를 이벤트를 일으킨 엘리먼트(input)로 바꿔버립니다. 그래서 input.files에 엉뚱한 값을 넣으려다 에러가 난 것이죠.

// [수정 후] 화살표 함수로 바꾸면 this가 고정됩니다.
	handleFileUpload= async(e)=> {
        const uploadedFiles = Array.from(e.target.files);
        let newFilesData = [];
        for (const file of uploadedFiles) {
			// docx, txt 파일만 업로드되게
			const isDocx = file.name.endsWith('.docx');
            const isTxt = file.name.endsWith('.txt');
			if (!isDocx && !isTxt) {
                alert(`[${file.name}]은 지원하지 않는 형식입니다.\n.docx 또는 .txt 파일만 올려주세요.`);
                continue;
            }

            try {
                let text = isDocx
                    ? (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value 
                    : await file.text();
                if (text) {
                    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
					 // 업로드 시 checked: true 기본 부여
                    newFilesData.push({ 
						name: file.name, 
						lines,
						checked: true
					 });
                }
            } catch (err) { console.error(err); }
        }
        this.files = [...this.files, ...newFilesData];

		// input 비우기
        e.target.value = ""; 
    }

	 // 개별 파일 체크박스 토글 함수
    toggleFileCheck(index) {
        this.files[index].checked = !this.files[index].checked;
    }

    // 올린 파일 일괄 취소 (Clear)
    clearFiles = () => {
        if (confirm("업로드한 모든 파일을 삭제하시겠습니까?")) {
            this.files = [];
            console.log("🗑️ 업로드 파일 일괄 삭제 완료");
        }
    }

	
	reset() {
		this.files = [];             // 업로드한 로컬 파일 비우기
		this.searchQuery = "";       // 검색어 비우기
		this.logTimer = null;        // 타이머 초기화
		// researchState.allFiles = []; // 필요하다면 서버 데이터도 비울 수 있습니다.
		console.log("🧹 SearchUI 상태 초기화 완료");
	}

}

export const searchUI = new SearchUI();