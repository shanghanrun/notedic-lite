import { pb } from './pb.svelte.js';
import { researchState, researchActions } from './pb.svelte.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import { verifyAdmin } from './pb.svelte.js';

class IndexSearchUI {
    /* =========================
      1. STATE
    ========================= */
    files = $state([]);                  
    allFiles = $state([]);  
    searchInput = $state(""); 
    searchQuery = $state(""); 
    summaryElement = $state(null);
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

    async preloadIndices() {
        const targets = this.allFiles.filter(f => f.isIndexed);
        await Promise.all(targets.map(async f => {
            if (!this.indexDataMap[f.id] && f.index_file) {
                const idxUrl = pb.files.getURL(f, f.index_file);
                const res = await fetch(idxUrl);
                if (res.ok) this.indexDataMap[f.id] = await res.json();
            }
            if (!f.lines || f.lines.length === 0) await this.loadFileLines(f);
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