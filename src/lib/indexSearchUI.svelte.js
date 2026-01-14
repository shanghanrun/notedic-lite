import { pb } from './pb.svelte.js';
import { researchState } from './pb.svelte.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';
// import { renderAsync } from 'docx-preview';

class IndexSearchUI {
    /* =========================
      1. STATE
    ========================= */
    files = $state([]);                  // 로컬 파일
    allFiles = $state([]);               // 서버 파일
    searchQuery = $state("");
    summaryElement = $state(null);
    indexDataMap = $state({});           // { fileId: indexJSON }
    indexMap = $state({});               // admin UI용 alias
    isLoading = $state(false);
    isPreloading = $state(false);
    currentCollection = $state('hani');
    availableCollections = $state(['hani']);

    /* =========================
      2. DERIVED
    ========================= */
    get processedQueries() {
        const q = this.searchQuery.trim();
        if (!q) return [];
        return q.split('/').map(v => v.trim()).filter(Boolean);
    }

    get allFileData() {
        // 로컬과 서버 파일을 통합하여 표시용 객체 생성
        const local = this.files.map(f => ({ ...f, isServer: false }));
        const server = this.allFiles.map(f => ({ ...f, isServer: true }));
        
        // UI에서 {#each Object.entries...} 로 쓰기 위한 변환
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

            console.log("📥 서버에서 받은 원본 데이터:", records);

            // 1. 유연한 필터링 및 이름 통일
            this.allFiles = records.filter(r => {
                // PocketBase 필드명이 'file'일 수도, 'filename'일 수도 있으므로 둘 다 체크
                const actualName = r.filename || r.file || "";
                const name = String(actualName).toLowerCase();
                
                // .docx 확장자 확인 (kor_hanja 제외)
                return name.endsWith('.docx') && !name.includes('kor_hanja');
            }).map(r => {
                // Svelte Proxy 객체 내에서 다루기 쉽도록 속성 표준화
                return {
                    ...r, // 원본 ID 및 PocketBase 메타데이터 유지
                    filename: r.filename || r.file || "이름 없음",
                    lines: [] // 초기화
                };
            });

            console.log("✅ 필터링 후 allFiles 상태:", $state.snapshot(this.allFiles));

            // 2. 인덱스 데이터 미리 가져오기
            await this.preloadIndices();
            
        } catch (e) {
            console.error('❌ 파일 목록 로딩 실패:', e);
            alert("서버 서재 목록을 불러오지 못했습니다.");
        } finally {
            this.isLoading = false;
        }
    }


    async loadFileLines(file) {
		if (file.lines?.length > 0) return;

		try {
			// file.file이 실제 파일 데이터가 저장된 필드명이라고 가정합니다.
			const fileUrl = pb.files.getURL(file, file.file);
			const response = await fetch(`${fileUrl}?t=${Date.now()}`);
			
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const arrayBuffer = await response.arrayBuffer();

			// [수정] import한 mammoth를 직접 쓰거나, 없으면 window.mammoth를 사용
			const m = mammoth || window.mammoth; 
			if (!m) throw new Error("Mammoth 라이브러리를 찾을 수 없습니다.");

			const result = await m.extractRawText({ arrayBuffer });
			if (!result?.value) throw new Error("텍스트 추출 결과가 비어있습니다.");

			// 텍스트 정제 및 라인 분할
			file.lines = result.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
			console.log(`✅ [${file.filename}] ${file.lines.length}줄 로드 성공`);
		} catch (err) {
			console.error("❌ 파일 로드 실패:", err);
			throw err;
		}
	}

    /* =========================
   5. INDEX GENERATION (대용량 최적화 버전)
	========================= */
	async generateAndUploadIndex(file) {
		try {
			// 1. 작업 직전 서버에서 최신 레코드 가져오기 (Proxy 오염 방지)
			const colName = this.currentCollection || 'hani';
			const freshRecord = await pb.collection(colName).getOne(file.id);
			
			// 2. 텍스트 추출 실행
			await this.loadFileLines(freshRecord); 
			if (!freshRecord.lines?.length) return;

			console.log(`🚀 [${freshRecord.filename}] 인덱싱 시작 (총 ${freshRecord.lines.length}행)`);

			// 3. 인덱스 빌드 (Map & Set 사용으로 고속 처리)
			const tempMap = new Map();
			freshRecord.lines.forEach((line, lineIdx) => {
				if (!line) return;
				// 한글/한자 연속된 블록 추출
				const blocks = line.match(/[\u4E00-\u9FFF]+|[\uAC00-\uD7AF]+/g) || [];
				blocks.forEach(block => {
					// N-gram (1글자부터 블록 전체 길이까지 모든 조합)
					for (let len = 1; len <= block.length; len++) {
						for (let start = 0; start <= block.length - len; start++) {
							const token = block.substring(start, start + len);
							if (!tempMap.has(token)) tempMap.set(token, new Set());
							tempMap.get(token).add(lineIdx);
						}
					}
				});
			});

			// 4. [RangeError 해결책] 수동 JSON 직렬화 (문자열 조각 이어붙이기)
			// 큰 객체를 한꺼번에 JSON.stringify 하면 메모리 터짐. 조각조각 Blob화.
			let jsonParts = ["{"];
			let isFirst = true;
			for (const [token, lineSet] of tempMap.entries()) {
				if (!isFirst) jsonParts.push(",");
				jsonParts.push(`${JSON.stringify(token)}:${JSON.stringify(Array.from(lineSet))}`);
				isFirst = false;
			}
			jsonParts.push("}");

			const jsonBlob = new Blob(jsonParts, { type: 'application/json' });
			tempMap.clear(); // 메모리 즉시 해제

			// 5. 서버에 인덱스 파일 업로드
			const formData = new FormData();
			formData.append('index_file', jsonBlob, `index_${freshRecord.id}.json`);
			formData.append('isIndexed', 'true');

			await pb.collection(colName).update(freshRecord.id, formData);
			
			// 6. 현재 UI 상태 업데이트
			this.indexDataMap[file.id] = JSON.parse(await jsonBlob.text());
			file.isIndexed = true;
			file.lines = freshRecord.lines; // 검색을 위해 lines도 유지
			
			alert(`✅ [${file.filename}] 인덱싱 완료!`);
		} catch (err) {
			console.error("❌ 인덱싱 치명적 오류:", err);
			alert(`인덱싱 실패: ${err.message}`);
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
        const targets = this.allFiles.filter(f => f.isIndexed && f.index_file);
        await Promise.all(targets.map(async f => {
            if (this.indexDataMap[f.id]) return;
            const url = pb.files.getURL(f, f.index_file);
            const res = await fetch(url);
            if (res.ok) {
                this.indexDataMap[f.id] = await res.json();
            }
        }));
        this.indexMap = this.indexDataMap;
    }

    /* =========================
      6. LOCAL FILE
    ========================= */
    handleFileUpload = async (e) => {
        const uploaded = Array.from(e.target.files);
        for (const f of uploaded) {
            const text = f.name.endsWith('.docx')
                ? (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value
                : await f.text();
            this.files.push({
                name: f.name,
                lines: text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
            });
        }
        e.target.value = '';
    };

    /* =========================
      7. UTIL
    ========================= */
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