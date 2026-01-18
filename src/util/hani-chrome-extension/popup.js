const state = {
    searchQuery: "",
    cachedRegex: null,
    colorMap: new Map(),
    colors: ['#fde047', '#ffcfdf', '#d1fae5', '#e0e7ff']
};

// function getSmartQuery(q) {
//     if (!q) return "";
//     q = q.trim();
//     const len = q.length;
//     if (len === 4) return q.substring(0, 2) + " " + q.substring(2, 4);
//     if (len === 5) return q.substring(0, 3) + " " + q.substring(3, 5);
//     if (len === 6) return q.substring(0, 3) + " " + q.substring(3, 6);
//     return q;
// }

function prepareSearch(query) {
    state.searchQuery = query;
    const queries = query.split('/').map(v => v.trim()).filter(Boolean);
    state.colorMap.clear();
    queries.forEach((q, i) => state.colorMap.set(q.toLowerCase(), i));
    const pattern = [...queries].sort((a, b) => b.length - a.length)
        .map(q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    state.cachedRegex = pattern ? new RegExp(`(${pattern})`, 'gi') : null;
}

function highlightText(text) {
    if (!text || !state.cachedRegex) return text;
    return text.replace(state.cachedRegex, (match) => {
        const key = match.toLowerCase();
        const idx = state.colorMap.has(key) ? state.colorMap.get(key) : 0;
        return `<mark style="background-color: ${state.colors[idx % state.colors.length]}; border-radius: 2px; padding: 0 2px;">${match}</mark>`;
    });
}

window.onload = function () {
    const clipBtn = document.getElementById('clipBtn');
    const resultArea = document.getElementById('resultArea');
    const input = document.getElementById('searchInput');

    clipBtn.onclick = async function () {
        try {
            const clipText = await navigator.clipboard.readText();
            // if (input.value) input.value = getSmartQuery(input.value);
            const finalQuery = input.value.trim();

            if (!finalQuery || !clipText) {
                alert("검색어 입력 혹은 클립보드 복사를 확인해주세요.");
                return;
            }

            prepareSearch(finalQuery);
            const lines = clipText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
            const matchedLines = lines.filter(line => 
                finalQuery.split('/').some(q => line.includes(q.trim()))
            );

            if (matchedLines.length > 0) {
                document.body.style.width = "780px"; 
                renderReport(resultArea, finalQuery, matchedLines);
            } else {
                document.body.style.width = "400px";
                resultArea.innerHTML = `<p style="color:red; text-align:center;">❌ 결과 없음</p>`;
            }
        } catch (err) { alert("오류: " + err); }
    };
};

function renderReport(container, query, lines) {
    container.innerHTML = `
        <div style="margin-top: 15px; text-align: left; width: 100%;"> 
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px; border-bottom: 2px solid #333; padding-bottom: 8px;">
                <h2 style="font-size: 18px; margin: 0; white-space: nowrap;">📊 분석 결과 보고서</h2>
                <button id="copyAllBtn" style="padding: 4px 12px; font-size: 12px; background: #2563eb; color: white; border-radius: 4px; border: none; cursor: pointer; white-space: nowrap;">
                    📄 전체 복사
                </button>
            </div>
            
            <div id="reportPaper" style="background: white; padding: 15px; border: 1px solid #eee; margin-right: 10px;">
                <div id="wordTitle" style="margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #444;">
                    <span style="font-size: 20px; font-weight: bold; color: #000;">
                        [${query}] 분석 : [${lines.length}]개 항목
                    </span>
                </div>

                <div style="max-height: 480px; overflow-y: auto;">
                    ${lines.map(line => `
                        <div class="report-line" style="font-size: 14px; line-height: 1.4; margin: 4px 0; padding: 2px 0; border-bottom: 1px solid #f9f9f9; word-break: break-all;">
                            <span style="color: #2563eb; font-weight: bold;">○</span>
                            ${highlightText(line)}
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    document.getElementById('copyAllBtn').onclick = function() {
        // --- 1. 워드용(HTML) 서식 가공 ---
        const reportContent = document.getElementById('reportPaper').cloneNode(true);
        
        // 타이틀 서식 강화
        const titleDiv = reportContent.querySelector('#wordTitle');
        if (titleDiv) {
            titleDiv.innerHTML = `<b><font size="5" color="#000000">${titleDiv.innerText}</font></b><br>`;
        }

        // 하이라이트 -> 파랑/빨강 볼드체 변환
        const marks = reportContent.querySelectorAll('mark');
        marks.forEach(mark => {
            const bg = mark.style.backgroundColor;
            let finalColor = "#000000";
            if (bg.includes('253') || bg.includes('fde047')) finalColor = "#0000FF";
            else if (bg.includes('255') || bg.includes('ffcfdf')) finalColor = "#FF0000";
            mark.outerHTML = `<b><font color="${finalColor}">${mark.innerText}</font></b>`;
        });

        // --- 2. 메모장용(Plain Text) 서식 가공 ---
        // 불필요한 공백을 없애기 위해 직접 문자열을 조합합니다.
        const plainTitle = `[${query}] 분석 : [${lines.length}]개 항목`;
        const plainLines = lines.map(line => `○ ${line}`).join('\n');
        const finalPlainText = `${plainTitle}\n\n${plainLines}`;

        // --- 3. 클립보드에 두 가지 형식 모두 주입 ---
        const blob = new Blob([reportContent.innerHTML], { type: 'text/html' });
        const data = [new ClipboardItem({ 
            'text/html': blob, 
            'text/plain': new Blob([finalPlainText], { type: 'text/plain' }) 
        })];

        navigator.clipboard.write(data).then(() => {
            alert("📊 복사 완료!\n(워드: 서식 유지 / 메모장: 깔끔한 텍스트)");
        }).catch(() => alert("복사 실패"));
    };
}