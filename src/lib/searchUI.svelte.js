import { researchState, pb } from './pb.svelte.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

class SearchUI {
    type = "local";
    files = $state([]); // { name, lines, checked: true }
    // 1. [구조 변경] 입력 중인 글자와 실제 검색어를 분리합니다.
    searchInput = $state(""); // 화면의 input과 바인딩
    searchQuery = $state("");

    // 실험적 코드
    searchFileQuery = $state("")//로컬파일 검색용(Everything)
    // 실험 코드 끝


    scrollTop = $state(0);
    containerHeight = $state(760); 
    itemHeight = $state(180);

    // [개선] searchQuery가 바뀔 때마다 정규식과 컬러맵을 자동 계산
    searchState = $derived.by(() => {
        const q = this.searchQuery.trim();
        if (!q) return { regex: null, colorMap: new Map() };

        const queries = [...new Set(q.split('/').map(v => v.trim()).filter(Boolean))];
        const colorMap = new Map();
        queries.forEach((query, i) => colorMap.set(query.toLowerCase(), i));

        const pattern = queries
            .sort((a, b) => b.length - a.length)
            .map(q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');

        return {
            regex: new RegExp(`(${pattern})`, 'gi'),
            colorMap: colorMap,
            queries: queries
        };
    });

    startSearch() {
        const input = this.searchInput.trim();
        
        // 검색어가 없으면 초기화
        if (!input) {
            this.searchQuery = "";
            return;
        }

        // 실제 검색어($derived가 감시하는 변수)에 값을 전달하여 검색 트리거
        this.searchQuery = input;
        
        // 검색 시 스크롤을 맨 위로 초기화
        this.scrollTop = 0;
        
        console.log("로컬 검색 실행:", this.searchQuery);
    }

    // [검색 결과 계산]
    searchResults = $derived.by(() => {
        const { queries } = this.searchState;
        if (!queries || queries.length === 0) return [];
        
        const results = [];
        this.files.forEach(file => {
            if (!file.checked || !file.lines) return;

            file.lines.forEach((line, i) => {
                // 하나라도 포함되어 있는지 확인
                if (queries.some(q => line.includes(q))) {
                    // [버그 수정] text -> line으로 변경
                    const isAndMatch = queries.length > 1 && queries.every(q => line.includes(q));

                    results.push({
                        id: `${file.name}-${i}`,
                        fileName: file.name,
                        text: line,
                        lineIndex: i,
                        isAndMatch: isAndMatch
                    });
                }
            });
        });

        // AND 매칭된 것을 최상단으로 정렬
        return results.sort((a, b) => b.isAndMatch - a.isAndMatch);
    });

    // [가상 스크롤 가시 범위 계산]
    visibleResults = $derived.by(() => {
        const all = this.searchResults;
        if (all.length === 0) return [];

        const startIdx = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - 2);
        const endIdx = Math.min(all.length, Math.ceil(this.containerHeight / this.itemHeight) + startIdx + 3);

        return all.slice(startIdx, endIdx).map((item, i) => ({
            ...item,
            uniqueKey: `card-${item.id}`, 
            renderTop: (startIdx + i) * this.itemHeight
        }));
    });

    get totalHeight() {
        return this.searchResults.length * this.itemHeight;
    }

    toggleFileCheck(index) {
    // 1. 해당 인덱스의 체크 상태를 반전시킵니다.
        this.files[index].checked = !this.files[index].checked;
        
        // 2. [핵심] 배열을 복사하여 재할당함으로써 Svelte에게 "데이터가 변했다"고 확실히 알려줍니다.
        // 이 과정을 거쳐야 체크박스 UI와 검색 결과가 즉시 동기화됩니다.
        this.files = [...this.files];
        
        console.log(`파일 체크 변경: ${this.files[index].name} -> ${this.files[index].checked}`);
    }

    // [하이라이트 로직]
    highlightText = (fullText, isFinal = false) => {
        const { regex, colorMap } = this.searchState;
        if (!fullText || !regex) return fullText;

        const colors = isFinal 
            ? ['#0000FF', '#FF0000', '#2ecc71', '#e67e22'] 
            : ['#fde047', '#ffcfdf', '#d1fae5', '#e0e7ff']; // 노랑, 핑크...

        return fullText.replace(regex, (match) => {
            const key = match.toLowerCase();
            const qIdx = colorMap.has(key) ? colorMap.get(key) : 0;
            const color = colors[qIdx % colors.length];
            
            if (isFinal) {
                return `<b style="color: ${color}; font-weight: bold;">${match}</b>`;
            } else {
                return `<mark style="background-color: ${color} !important; color: black; border-radius: 2px; padding: 0 2px;">${match}</mark>`;
            }
        });
    }

    copyToClipboard() {
        const results = this.groupedResults;
        const entries = Object.entries(results);
        
        if (entries.length === 0) {
            alert("복사할 결과가 없습니다.");
            return;
        }

        // 1. 일반 텍스트 버전 (메모장용)
        let plainText = `검색어 [${this.searchQuery}] 분석 결과\n\n`;
        
        // 2. HTML 버전 (마진 제거 및 스타일 최적화)
        // margin:0; padding:0; 설정을 통해 좌측 들여쓰기를 원천 차단합니다.
        let htmlText = `<div style="font-family: '맑은 고딕', sans-serif; line-height: 1.6; margin:0; padding:0;">`;
        htmlText += `<h2 style="margin-bottom:20px;">검색어 [${this.searchQuery}] 분석 결과</h2>`;

        for (const [fileName, lines] of entries) {
            plainText += `[출처: ${fileName}] (총 ${lines.length}건)\n`;
            
            // 제목 부분 스타일
            htmlText += `<div style="color: #2563eb; font-weight: bold; font-size: 1.2em; margin-top: 20px; margin-bottom: 10px;">[출처: ${fileName}] (총 ${lines.length}건)</div>`;

            lines.forEach(line => {
                plainText += `○ ${line}\n\n`;
                
                // <li> 대신 <div>를 써서 불필요한 마진과 점(bullet)을 없앱니다.
                // margin-left: 0; padding-left: 0;으로 좌측 벽에 딱 붙입니다.
                htmlText += `<div style="margin: 0 0 15px 0; padding: 0; text-indent: 0;">○ ${this.highlightText(line, true)}</div>`;
            });
            
            plainText += `--------------------------\n\n`;
            htmlText += `<div style="border-top: 1px solid #eee; margin: 20px 0;"></div>`;
        }
        htmlText += `</div>`;

        const type = "text/html";
        const blob = new Blob([htmlText], { type });
        const data = [new ClipboardItem({ 
            [type]: blob,
            ["text/plain"]: new Blob([plainText], { type: "text/plain" }) 
        })];

        navigator.clipboard.write(data).then(() => {
            alert("보고서가 복사되었습니다! (원하는 파일에 붙여 넣으세요)");
        }).catch(err => {
            console.error("복사 실패:", err);
            navigator.clipboard.writeText(plainText);
        });
    }

    // 스크롤 핸들러 (화살표 함수로 this 고정)
    handleScroll = (e) => {
        this.scrollTop = e.target.scrollTop;
    }

    // 클릭과 드롭 어디서든 호출할 수 있는 로컬 파일 처리 함수
    uploadAndProcessFiles = async (files) => {
        const uploadedFiles = Array.from(files);
        let newFilesData = [];

        for (const file of uploadedFiles) {
            // 🌟 [추가] 중복 체크: 이미 있는 파일이면 경고 후 다음 파일로 이동
            const isDuplicate = this.files.some(existingFile => existingFile.name === file.name);
            if (isDuplicate) {
                alert(`'${file.name}' 파일은 이미 추가되어 있습니다.`);
                continue; 
            }
            // 확장자 체크
            const isDocx = file.name.endsWith('.docx');
            const isTxt = file.name.endsWith('.txt');
            if (!isDocx && !isTxt) continue;

            try {
                // 🌟 .docx와 .txt 분기 처리 로직
                let text = isDocx
                    ? (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value 
                    : await file.text();

                if (text) {
                    // 줄 단위로 쪼개고 공백 제거
                    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
                    
                    // 새로운 파일 데이터 객체 생성
                    newFilesData.push({ 
                        name: file.name, 
                        lines: lines, 
                        checked: true 
                    });
                }
            } catch (err) { 
                console.error(`${file.name} 처리 중 오류 발생:`, err); 
            }
        }

        // 기존 목록에 새 파일들 추가
        this.files = [...this.files, ...newFilesData];
    }

    // (A) 기존 파일 선택 버튼 (<input type="file">)
    handleFileUpload = async (e) => {
        await this.uploadAndProcessFiles(e.target.files);
        e.target.value = ''; // 같은 파일 다시 올릴 수 있도록 초기화
    }
    // (B) 드롭존 드래그 앤 드롭
    handleFileDrop = async (e) => {
        e.preventDefault();
        this.isDragging = false; // 드래그 시각 효과 해제
        
        // 드롭된 파일들 전달
        await this.uploadAndProcessFiles(e.dataTransfer.files);
    };
    

    // handleFileUpload = async (e) => {
    //     const uploadedFiles = Array.from(e.target.files);
    //     let newFilesData = [];
    //     for (const file of uploadedFiles) {
    //         const isDocx = file.name.endsWith('.docx');
    //         const isTxt = file.name.endsWith('.txt');
    //         if (!isDocx && !isTxt) continue;

    //         try {
    //             let text = isDocx
    //                 ? (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value 
    //                 : await file.text();
    //             if (text) {
    //                 const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
    //                 newFilesData.push({ name: file.name, lines, checked: true });
    //             }
    //         } catch (err) { console.error(err); }
    //     }
    //     this.files = [...this.files, ...newFilesData];
    //     e.target.value = ""; 
    // }

    get groupedResults() {
       const results = this.searchResults;
        if (!results || results.length === 0) return {}; // 결과 없으면 빈 객체 반환

        return results.reduce((acc, r) => {
            if (!acc[r.fileName]) acc[r.fileName] = [];
            acc[r.fileName].push(r.text);
            return acc;
        }, {});
    }

    reset() {
        this.files = [];
        this.searchQuery = "";
        this.scrollTop = 0;
    }

    clearFiles=()=>{
        this.reset();
        // this.files = [];
        // this.searchQuery = "";
        // this.scrollTop = 0;
        
        // [핵심] 파일 input 태그의 실제 value도 날려줘야, 
        // 해당 input태그의 글자도 사라지고, 다시 같은 파일을 올려도 반응한다.
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) fileInput.value = "";
        
        console.log("모든 파일 및 검색어 초기화 완료");
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
}

export const searchUI = new SearchUI();