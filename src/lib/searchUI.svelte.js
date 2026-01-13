// searchUI.svelte.js
import { researchState, pb } from './pb.svelte.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

class SearchUI {
    // 1. 상태 (State)
	files = $state([]) // 각 파일은 { name, lines, checked: true } 형태
    searchQuery = $state("");
    logTimer = null;
	summaryElement = $state(null)
	// korHanjaMap = $state({})

	// [유니코드 검사] 한글이 포함되어 있는지 판별
    // isHangul(text) {
    //     return /[가-힣]/.test(text);
    // }

    // [단순 쿼리 생성] '시호/백호' -> ['시호', '백호']
    get processedQueries() {
        const query = this.searchQuery.trim();
        if (!query) return [];

        // 1. '/' 구분자로 OR 키워드 분리
        return query.split('/').map(t => t.trim()).filter(Boolean);
    }

    // 2. 파생 데이터 (Derived) - 원본 데이터는 researchState에서 참조
	// 체크된 파일만 대상으로 검색 결과 도출
    searchResults = $derived.by(() => {
        const queries = this.processedQueries;
        if (queries.length === 0) return [];
        
        let results = [];
        const allData = Object.entries(this.allFileData);

        allData.forEach(([fileName, data]) => {
            if (data.checked === false) return;
            data.lines.forEach(line => {
                // 하나라도 포함되면 결과에 추가
                const hasMatch = queries.some(q => 
                    line.toLowerCase().includes(q.toLowerCase())
                );
                if (hasMatch) {
                    results.push({ fileName, text: line });
                }
            });
        });
        return results;
    });
	
   
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
        if (!this.summaryElement || this.searchResults.length === 0) return;
        const range = document.createRange();
        range.selectNode(summaryElement);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
        document.execCommand('copy');
        alert("📋 보고서 내용이 복사되었습니다!");
        window.getSelection().removeAllRanges();
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

	// [3. 화면용 & 보고서용 하이라이트 통합]

	// highlightText(fullText, query, isFinal = false) {
    //     if (!query) return fullText;
    //     const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    //     const regex = new RegExp(`(${escapedQuery})`, 'gi');
    //     const replacement = isFinal ? `<b style="color: blue;">$1</b>` : `<mark class="hl">$1</mark>`;
    //     return fullText.replace(regex, replacement);
    // }
    highlightText(fullText, queries, isFinal = false) {
		// 1. 안전장치: 텍스트가 없거나 검색어가 없으면 원본 반환
		if (!fullText) return "";
		
		// 인자로 넘어온 queries가 있으면 그것을 쓰고, 없으면 클래스의 processedQueries를 사용
		const targetQueries = (queries && queries.length > 0) 
			? queries.flat() // 혹시 이중 배열로 들어올 경우를 대비해 평탄화
			: this.processedQueries;

		if (targetQueries.length === 0) return fullText;

		let highlighted = fullText;
		
		// 2. 색상 설정 (화면용: 노랑/핑크, 보고서용: 파랑/빨강)
		const colors = isFinal 
			? ['#0000FF', '#FF0000', '#2ecc71', '#e67e22'] 
			: ['#fde047', '#ffcfdf', '#d1fae5', '#e0e7ff'];

		// 3. 중복 하이라이트 방지를 위해 긴 단어부터 정렬
		const sortedQueries = [...new Set(targetQueries)].sort((a, b) => b.length - a.length);

		sortedQueries.forEach((query) => {
			if (!query) return;
			const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const regex = new RegExp(`(${escapedQuery})`, 'gi');
			
			// 원본 쿼리에서의 인덱스를 찾아 색상 매칭
			const colorIndex = targetQueries.indexOf(query);
			const color = colors[colorIndex % colors.length];
			
			if (isFinal) {
				// 보고서용: <b> 태그와 글자색
				highlighted = highlighted.replace(regex, `<b style="color: ${color}; font-weight: bold;">$1</b>`);
			} else {
				// 화면용: <mark> 태그와 배경색
				highlighted = highlighted.replace(regex, `<mark style="background: ${color}; font-weight: bold; border-radius: 2px;">$1</mark>`);
			}
		});

		return highlighted;
	}

    // [4. 그룹화된 결과 (보고서용)]
    groupedResults = $derived.by(() => {
        return this.searchResults.reduce((acc, curr) => {
            if (!acc[curr.fileName]) acc[curr.fileName] = [];
            acc[curr.fileName].push(curr.text);
            return acc;
        }, {});
    });

	reset() {
		this.files = [];             // 업로드한 로컬 파일 비우기
		this.searchQuery = "";       // 검색어 비우기
		this.logTimer = null;        // 타이머 초기화
		// researchState.allFiles = []; // 필요하다면 서버 데이터도 비울 수 있습니다.
		console.log("🧹 SearchUI 상태 초기화 완료");
	}

}

export const searchUI = new SearchUI();