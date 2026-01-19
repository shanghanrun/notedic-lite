import { researchState, pb } from './pb.svelte.js';
import mammoth from 'mammoth';
import { Document, Packer, Paragraph, TextRun } from 'docx';

class SearchUI {
    type = "local";
    files = $state([]); // { name, lines, checked: true }
    searchQuery = $state("");
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

    handleFileUpload = async (e) => {
        const uploadedFiles = Array.from(e.target.files);
        let newFilesData = [];
        for (const file of uploadedFiles) {
            const isDocx = file.name.endsWith('.docx');
            const isTxt = file.name.endsWith('.txt');
            if (!isDocx && !isTxt) continue;

            try {
                let text = isDocx
                    ? (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value 
                    : await file.text();
                if (text) {
                    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
                    newFilesData.push({ name: file.name, lines, checked: true });
                }
            } catch (err) { console.error(err); }
        }
        this.files = [...this.files, ...newFilesData];
        e.target.value = ""; 
    }

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
}

export const searchUI = new SearchUI();