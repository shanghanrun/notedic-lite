import { pb } from './pb.svelte.js';
import { researchState } from './pb.svelte.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

class IndexSearchUI {
    /* =========================
      1. STATE
    ========================= */
    files = $state([]);                  
    allFiles = $state([]);               
    searchQuery = $state("");
	actualQuery = $state(""); // 실제 검색에 사용될 쿼리
    summaryElement = $state(null);
    indexDataMap = $state({});           
    indexMap = $state({});               
    isLoading = $state(false);
    isPreloading = $state(false);
    currentCollection = $state('hani');
    availableCollections = $state(['hani']);

    progressLabel = $state("");    
    progressValue = $state(0);     
    isIndexing = $state(false);   
	//검색어 입력에 대한 즉각반응성 완화위한 것
	_searchTimeout = null;

	selectedFiles = $state(new Set()); //체크박스 선택된 파일 ID들
	

    /* =========================
      2. DERIVED
    ========================= */
    get processedQueries() {
        // searchQuery가 아니라 actualQuery를 바라봄으로써 
        // 타이핑 중에는 이 계산이 실행되지 않도록 차단합니다.
        const q = this.actualQuery.trim();
        if (!q) return [];
        return q.split('/').map(v => v.trim()).filter(Boolean);
    }
	// 입력 시 호출할 함수 (검색창의 bind:value 대신 oninput으로 연결 추천)
	handleInput(e) {
        // 이벤트 객체에서 안전하게 값을 가져옵니다.
		const value = e?.target?.value ?? ""; 
		
		this.searchQuery = value; // 입력창 즉시 반영 (반응성)

        // 이전에 예약된 검색이 있다면 취소
        if (this._searchTimeout) clearTimeout(this._searchTimeout);

        // 300ms(0.3초) 동안 추가 입력이 없으면 그때 actualQuery를 업데이트
        this._searchTimeout = setTimeout(() => {
            this.actualQuery = this.searchQuery;
            console.log("🔍 검색 실행:", this.actualQuery);
        }, 300);
    }


    get allFileData() {
        const local = this.files.map(f => ({ ...f, isServer: false }));
        const server = this.allFiles.map(f => ({ ...f, isServer: true }));
        
        return [...local, ...server].reduce((acc, f, index) => {
            const key = f.filename || f.name || `file_${index}`;
            acc[key] = f;
            return acc;
        }, {});
    }

    searchResults = $derived.by(() => {
        const queries = this.processedQueries;
        if (!queries.length) return [];
        const results = [];
        this.allFiles.forEach(file => {
			// 체크박스에 체크되지 않은 파일은 건너뜀
            if (!this.selectedFiles.has(file.id)) return;

            const indexData = this.indexDataMap[file.id];
            if (!file.isIndexed || !indexData || !file.lines) return;
            const matched = new Set();
            queries.forEach(q => {
                if (indexData[q]) {
                    indexData[q].forEach(i => matched.add(i));
                }
            });
            matched.forEach(i => {
                if (file.lines[i]) {
                    results.push({
                        fileName: file.filename,
                        text: file.lines[i],
                        isServer: true
                    });
                }
            });
        });
        return results;
    });

    groupedResults = $derived.by(() => {
        return this.searchResults.reduce((acc, r) => {
            if (!acc[r.fileName]) acc[r.fileName] = [];
            acc[r.fileName].push(r.text);
            return acc;
        }, {});
    });

    /* =========================
      3. FILE FETCH
    ========================= */
    async fetchAllFromCollection(collectionName = this.currentCollection) {
        this.isLoading = true;
        this.currentCollection = collectionName;
        
        try {
            const records = await pb.collection(collectionName).getFullList({ 
                sort: '-created' 
            });

            this.allFiles = records.filter(r => {
                const actualName = r.filename || r.file || "";
                const name = String(actualName).toLowerCase();
                return name.endsWith('.docx') && !name.includes('kor_hanja');
            }).map(r => {
                return {
                    ...r,
                    filename: r.filename || r.file || "이름 없음",
                    lines: [] 
                };
            });

			// 이미 인덱싱된 파일은 미리 선택 상태로 둠
            this.allFiles.forEach(f => { if(f.isIndexed) this.selectedFiles.add(f.id); });

            await this.preloadIndices();
            
        } catch (e) {
            console.error('❌ 목록 로딩 실패:', e);
            alert("서버 서재 목록을 불러오지 못했습니다.");
        } finally {
            this.isLoading = false;
        }
    }

    async loadFileLines(file) {
        if (file.lines?.length > 0) return;
        try {
            const fileUrl = pb.files.getURL(file, file.file);
            const response = await fetch(`${fileUrl}?t=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const m = mammoth || window.mammoth; 
            const result = await m.extractRawText({ arrayBuffer });
            file.lines = result.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        } catch (err) {
            console.error("❌ 파일 로드 실패:", err);
            throw err;
        }
    }

    /* =========================
      5. INDEX GENERATION (다이어트 & 4글자 제한 버전)
    ========================= */
	// 체크박스 토글 함수
    toggleFileSelection(fileId) {
        if (this.selectedFiles.has(fileId)) {
            this.selectedFiles.delete(fileId);
        } else {
            this.selectedFiles.add(fileId);
        }
    }

    // [강력 다이어트] 인덱스 생성 로직 (3글자 제한)
    async generateAndUploadIndex(file) {
        this.isIndexing = true;
        try {
            this.progressLabel = "텍스트 분석 중...";
            const colName = 'hani';
            const freshRecord = await pb.collection(colName).getOne(file.id);
            
            const fileUrl = pb.files.getURL(freshRecord, freshRecord.file || freshRecord.filename);
            const response = await fetch(`${fileUrl}?t=${Date.now()}`);
            const arrayBuffer = await response.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });
            const lines = result.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

            const tempMap = new Map();
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                // 한글/한자 블록만 추출 (숫자/기호 인덱싱 제외로 용량 절감)
                const blocks = line.match(/[\u4E00-\u9FFF]+|[\uAC00-\uD7AF]+/g) || [];
                blocks.forEach(block => {
                    // 최대 3글자로 제한하여 15MB 이하 유지
                    const maxN = Math.min(block.length, 3); 
                    for (let len = 1; len <= maxN; len++) {
                        for (let start = 0; start <= block.length - len; start++) {
                            const token = block.substring(start, start + len);
                            if (!tempMap.has(token)) tempMap.set(token, new Set());
                            tempMap.get(token).add(i);
                        }
                    }
                });
                if (i % 1000 === 0) {
                    this.progressValue = 20 + Math.floor((i / lines.length) * 50);
                    await new Promise(r => setTimeout(r, 0));
                }
            }

            this.progressLabel = "인덱스 압축 및 서버 전송 중...";
            let jsonParts = ["{"];
            let isFirst = true;
            for (const [token, lineSet] of tempMap.entries()) {
                if (!isFirst) jsonParts.push(",");
                jsonParts.push(`"${token}":[${Array.from(lineSet).join(',')}]`);
                isFirst = false;
            }
            jsonParts.push("}");

            const jsonBlob = new Blob(jsonParts, { type: 'application/json' });
            
            // 용량 체크 로그
            console.log(`최종 인덱스 용량: ${(jsonBlob.size / 1024 / 1024).toFixed(2)}MB`);

            const formData = new FormData();
            formData.append('index_file', jsonBlob, `index_${freshRecord.id}.json`);
            formData.append('isIndexed', 'true');

            await pb.collection(colName).update(freshRecord.id, formData);
            
            this.indexDataMap[file.id] = JSON.parse(await jsonBlob.text());
            file.isIndexed = true;
            file.lines = lines;
            this.selectedFiles.add(file.id); // 생성 후 자동 선택
            this.progressValue = 100;
            this.progressLabel = "완료!";
            setTimeout(() => { this.isIndexing = false; }, 1000);
        } catch (err) {
            console.error(err);
            this.isIndexing = false;
            alert("용량 초과 혹은 네트워크 오류가 발생했습니다.");
        }
    }

    async generateIndex() {
        for (const file of this.allFiles) {
            if (!file.file) continue;
            if (file.isIndexed) continue;
            await this.generateAndUploadIndex(file);
        }
    }

    async preloadIndices() {
		const targets = this.allFiles.filter(f => f.isIndexed);
		
		await Promise.all(targets.map(async f => {
			// 1. 인덱스 파일 로드 (이미 로드된 경우 패스)
			if (!this.indexDataMap[f.id] && f.index_file) {
				const idxUrl = pb.files.getURL(f, f.index_file);
				const res = await fetch(idxUrl);
				if (res.ok) this.indexDataMap[f.id] = await res.json();
			}

			// 2. 본문 텍스트 로드 (이게 있어야 검색 결과가 화면에 뜹니다!)
			if (!f.lines || f.lines.length === 0) {
				await this.loadFileLines(f);
			}
		}));
	}

    handleFileUpload = async (e) => {
        const uploaded = Array.from(e.target.files);
        for (const f of uploaded) {
            const buffer = await f.arrayBuffer();
            const text = f.name.endsWith('.docx')
                ? (await mammoth.extractRawText({ arrayBuffer: buffer })).value
                : await f.text();
            this.files.push({
                name: f.name,
                lines: text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
            });
        }
        e.target.value = '';
    };

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
        const children = [
            new Paragraph({
                children: [new TextRun({ text: this.searchQuery, bold: true })]
            })
        ];
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

    highlightText(fullText, queries, isFinal = false) {
        if (!fullText) return "";
        const targetQueries = (queries && queries.length > 0) ? queries.flat() : this.processedQueries;
        if (targetQueries.length === 0) return fullText;
        
        let highlighted = fullText;
        const colors = isFinal ? ['#0000FF', '#FF0000', '#2ecc71', '#e67e22'] : ['#fde047', '#ffcfdf', '#d1fae5', '#e0e7ff'];
        const sortedQueries = [...new Set(targetQueries)].sort((a, b) => b.length - a.length);
        
        sortedQueries.forEach((query) => {
            if (!query) return;
            const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escapedQuery})`, 'gi');
            const colorIndex = targetQueries.indexOf(query);
            const color = colors[colorIndex % colors.length];
            if (isFinal) {
                highlighted = highlighted.replace(regex, `<b style="color: ${color}; font-weight: bold;">$1</b>`);
            } else {
                highlighted = highlighted.replace(regex, `<mark style="background: ${color}; font-weight: bold; border-radius: 2px;">$1</mark>`);
            }
        });
        return highlighted;
    }

    reset() {
        this.searchQuery = '';
        this.files = [];
    }
}

export const indexSearchUI = new IndexSearchUI();