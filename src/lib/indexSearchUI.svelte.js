import { pb } from './pb.svelte.js';
import { researchState, researchActions } from './pb.svelte.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { verifyAdmin } from './pb.svelte.js';

class IndexSearchUI {
	type = 'server'; // 인덱스화된 것을 다루는 용도
    /* =========================
      1. STATE
    ========================= */
    files = $state([]);                  
    allFiles = $state([]);  
    searchInput = $state(""); 
    searchQuery = $state(""); 
    summaryElement = $state(null);
	availableCollections =$state(['hani', 'hani2'])
    indexDataMap = $state({});           
    isLoading = $state(false);
    isPreloading = $state(false);
    currentCollection = $state('hani');

    progressLabel = $state("");    
    progressValue = $state(0);     
    isIndexing = $state(false);   

    selectedFiles = $state(new Set()); 

    // 가상 스크롤 상태
    scrollTop = $state(0);
    containerHeight = $state(760); 
    itemHeight = $state(180);    

    // [최적화 핵심] 정규식 및 컬러 맵 캐싱
    cachedRegex = $state(null); 
    queryColorMap = new Map();
	colorMap = new Map(); 

    /* =========================
      2. DERIVED
    ========================= */
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

        this.allFiles.forEach(file => {
            if (!this.selectedFiles.has(file.id)) return;
            if (!file.lines || file.lines.length === 0) return;

            const indexData = this.indexDataMap[file.id];
            const matchedIndices = new Set();

            if (file.isIndexed && indexData) {
                queries.forEach(q => {
                    if (indexData[q]) indexData[q].forEach(i => matchedIndices.add(i));
                });
            } else {
                file.lines.forEach((line, i) => {
                    if (queries.some(q => line.includes(q))) matchedIndices.add(i);
                });
            }

            matchedIndices.forEach(i => {
                const text = file.lines[i];
                if (!text) return;
                const isAndMatch = queries.every(q => text.includes(q));

                results.push({
                    id: file.id,
                    fileName: file.filename,
                    text: text,
                    lineIndex: i,
                    isAndMatch: isAndMatch
                });
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

    toggleFileSelection(fileId) {
        if (this.selectedFiles.has(fileId)) {
            this.selectedFiles.delete(fileId);
        } else {
            this.selectedFiles.add(fileId);
        }
        this.selectedFiles = new Set(this.selectedFiles);
        if (this.searchQuery) this.scrollTop = 0;
    }

	handleFileUpload = async (e) => {
        if(!verifyAdmin()) return;
        const files = Array.from(e.target.files);
		if (files.length === 0) return;

		this.isIndexing = true;

        for (const f of files) {
			this.progressLabel = `${f.name} 서버 업로드 중...`;

            // 1. 서버 전송용 FormData 생성
            const formData = new FormData();
            formData.append('file', f); // 실제 파일 데이터
            formData.append('filename', f.name);
            formData.append('type', f.name.endsWith('.docx') ? 'docx' : 'text');
            formData.append('isIndexed', false); // 서버에 인덱싱 완료 상태로 보냄
            try {
                // 2. 서버(Pocketbase)에 업로드 및 결과 받기
                // 스크린샷의 pb.uploadFile(formData) 호출
                const record = await researchActions.uploadFile(formData, this.currentCollection);
				this.progressLabel = `${f.name} 본문 텍스트 분석 중...`;

                // 3. 로컬 메모리용 객체 생성 (mammoth 등으로 텍스트 추출 포함)
                const buffer = await f.arrayBuffer();
                const text = f.name.endsWith('.docx')
                    ? (await mammoth.extractRawText({ arrayBuffer: buffer })).value
                    : await f.text();

                const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

				// 4. UI 상태 업데이트용 객체 생성
                const newFileForUI = {
					...record,                    
                    filename: f.name,
                    lines: lines,
                    isIndexed: true,
                    isServer: true
                };

                // 4. UI 상태 업데이트
                this.allFiles = [newFileForUI, ...this.allFiles];
                this.selectedFiles.add(newFileForUI.id);
				this.selectedFiles = new Set(this.selectedFiles)

				this.progressLabel = "업로드 완료!";

				// 5. 의학입문 같은 대용량 파일을 위한 즉시 인덱싱 제안
				if (confirm(`${f.name} 업로드 성공! 지금 바로 '3글자 제한' 인덱스를 생성할까요?`)) {
					await this.generateAndUploadIndex(newFileForUI);
				}
            } catch (err) {
                console.error("❌ 서버 업로드 실패:", err);
                alert(`${f.name} 업로드에 실패했습니다. (인덱싱용 파일용량 제한을 확인해 주세요.)`);
            }
        }
		this.isIndexing = false;
		this.progressValue = 0;
        e.target.value = '';
    };

    // ... fetchAllFromCollection, loadFileLines, generateAndUploadIndex 등 기존 로직 동일하게 유지 ...
    async fetchAllFromCollection(collectionName = this.currentCollection) {
        this.isLoading = true;
        this.currentCollection = collectionName;
        try {
            const records = await pb.collection(collectionName).getFullList({ sort: '-created' });
            this.allFiles = records.filter(r => {
                const name = String(r.filename || r.file || "").toLowerCase();
                return name.endsWith('.docx') && !name.includes('kor_hanja');
            }).map(r => ({ ...r, filename: r.filename || r.file || "이름 없음", lines: [] }));
            this.allFiles.forEach(f => { if(f.isIndexed) this.selectedFiles.add(f.id); });
            await this.preloadIndices();
        } catch (e) { console.error(e); } finally { this.isLoading = false; }
    }


	// [핵심] 인덱스 생성 및 서버 업로드 로직 (3글자 제한 버전)
    async generateAndUploadIndex(file) {
		console.log(`${file.filename}을 인덱싱 합니다.`)
        this.isIndexing = true;
        try {
            this.progressLabel = "텍스트 분석 중...";
            const colName = this.currentCollection;
			console.log('current collection: ', colName)
            
            // 최신 레코드 정보 가져오기
            const freshRecord = await pb.collection(colName).getOne(file.id);

            const fileUrl = pb.files.getURL(freshRecord, freshRecord.file || freshRecord.filename);
            console.log('curr fileUrl: ', fileUrl )
            // 파일 본문 다운로드 및 텍스트 추출
            const response = await fetch(`${fileUrl}?t=${Date.now()}`);
            const arrayBuffer = await response.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            const lines = result.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

            const tempMap = new Map();
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // 한글/한자 블록만 추출하여 인덱싱 효율 극대화
                const blocks = line.match(/[\u4E00-\u9FFF]+|[\uAC00-\uD7AF]+/g) || [];
                
                blocks.forEach(block => {
                    // 최대 3글자까지만 인덱싱 (용량 15MB 제한 대비)
                    const maxN = Math.min(block.length, 3);
                    for (let len = 1; len <= maxN; len++) {
                        for (let start = 0; start <= block.length - len; start++) {
                            const token = block.substring(start, start + len);
                            if (!tempMap.has(token)) tempMap.set(token, new Set());
                            tempMap.get(token).add(i);
                        }
                    }
                });

                // 진행률 표시
                if (i % 1000 === 0) {
                    this.progressValue = 20 + Math.floor((i / lines.length) * 50);
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            this.progressLabel = "인덱스 압축 및 서버 전송 중...";
            
            // JSON 수동 조립 (메모리 절약형)
            let jsonParts = ["{"];
            let isFirst = true;
            for (const [token, lineSet] of tempMap.entries()) {
                if (!isFirst) jsonParts.push(",");
                jsonParts.push(`"${token}":[${Array.from(lineSet).join(',')}]`);
                isFirst = false;
            }
            jsonParts.push("}");

            const jsonBlob = new Blob(jsonParts, { type: 'application/json' });
            console.log(`최종 인덱스 용량: ${(jsonBlob.size / 1024 / 1024).toFixed(2)}MB`);

            const formData = new FormData();
            formData.append('index_file', jsonBlob, `index_${freshRecord.id}.json`);
            formData.append('isIndexed', 'true');

            // Pocketbase 서버 업데이트
            await pb.collection(colName).update(freshRecord.id, formData);

            // 로컬 메모리 상태 즉시 반영
            this.indexDataMap[file.id] = JSON.parse(await jsonBlob.text());
            file.isIndexed = true;
            file.lines = lines;

            // Svelte 5 UI 갱신 트리거
            this.allFiles = [...this.allFiles];
            this.selectedFiles.add(file.id);
            this.selectedFiles = new Set(this.selectedFiles);

            this.progressValue = 100;
            this.progressLabel = "완료!";
            setTimeout(() => { this.isIndexing = false; }, 1000);
            
        } catch (err) {
            console.error("인덱싱 실패:", err);
            this.isIndexing = false;
            alert("인덱스 생성 중 오류가 발생했습니다.");
        }
    }

    // 전체 인덱싱 실행
    async generateIndex() {
        for (const file of this.allFiles) {
            if (!file.file && !file.filename) continue;
            if (file.isIndexed) continue;
            await this.generateAndUploadIndex(file);
        }
    }

    // 페이지 로드 시 인덱스 및 본문 미리 가져오기
    async preloadIndices() {
        const targets = this.allFiles.filter(f => f.isIndexed);
        await Promise.all(targets.map(async f => {
            try {
                // 인덱스 JSON 로드
                if (!this.indexDataMap[f.id] && f.index_file) {
                    const idxUrl = pb.files.getURL(f, f.index_file);
                    const res = await fetch(idxUrl);
                    if (res.ok) this.indexDataMap[f.id] = await res.json();
                }
                // 화면 표시를 위한 본문 텍스트 로드
                if (!f.lines || f.lines.length === 0) {
                    await this.loadFileLines(f);
                }
            } catch (e) {
                console.error(`파일(${f.filename}) 로딩 누락:`, e);
            }
        }));
    }







    async loadFileLines(file) {
        if (file.lines?.length > 0) return;
        try {
            const fileUrl = pb.files.getURL(file, file.file);
            const response = await fetch(fileUrl);
            const arrayBuffer = await response.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            file.lines = result.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        } catch (err) { console.error(err); }
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
        if (!this.searchResults.length) return;
        const children = [new Paragraph({ children: [new TextRun({ text: this.searchQuery, bold: true })] })];
        Object.entries(this.groupedResults).forEach(([f, lines]) => {
            children.push(new Paragraph({ children: [new TextRun({ text: `[${f}]`, bold: true })] }));
            lines.forEach(l => children.push(new Paragraph(l)));
        });
        const blob = await Packer.toBlob(new Document({ sections: [{ children }] }));
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${this.searchQuery}.docx`;
        a.click();
    }

    reset() {
        this.searchQuery = '';
        this.searchInput = '';
        this.cachedRegex = null;
    }
}

export const indexSearchUI = new IndexSearchUI();