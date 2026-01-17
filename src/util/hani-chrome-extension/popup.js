// popup.js

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// 엔터키 처리
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') doSearch();
});

// 클릭 처리
searchBtn.addEventListener('click', doSearch);


function doSearch() {
  const query = searchInput.value.trim();
  if (!query) return;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    
    // 1. 여기서 탭 ID가 없거나 주소가 적절하지 않으면 바로 경고!
    if (!activeTab || !activeTab.id) {
        alert("유효한 탭을 찾을 수 없습니다.");
        return;
    }

    // 2. 텍스트 추출 시도
    chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      // body뿐만 아니라 문서 전체에서 텍스트를 긁어옵니다.
      func: () => {
        return document.body ? document.body.innerText : "본문을 찾을 수 없음";
      }
    }, (results) => {
      // 3. 결과값 디버깅
      let pageText = "";
      if (chrome.runtime.lastError) {
          pageText = "에러 발생: " + chrome.runtime.lastError.message;
      } else {
          pageText = (results && results[0]) ? results[0].result : "데이터가 비어있음";
      }

      // 4. [확인용] 이제 텍스트가 들어있는지 확인!
      // const debugHtml = `<html><body><h1>검색어: ${query}</h1><pre>${pageText}</pre></body></html>`;
      // const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(debugHtml);
      // chrome.tabs.create({ url: dataUrl });  --> 성공함
      
      
      chrome.storage.local.set({ "shared_pendingText": pageText }, () => {
        // 쿼리는 주소창에, 본문은 금고에!
        chrome.tabs.create({ url: `https://hani.chois.cloud/search?q=${encodeURIComponent(query)}` });
      });
    });
  });
}