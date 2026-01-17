// chrome.commands.onCommand.addListener(async (command) => {
//   if (command === "open_search") {
//     // 1. 현재 보고 있는 탭 찾기
//     const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    
//     if (tab) {
//       // 2. 현재 탭의 텍스트 추출 (화면이 없으니 바로 긁습니다)
//       chrome.scripting.executeScript({
//         target: { tabId: tab.id },
//         func: () => document.body.innerText,
//       }, (results) => {
//         const pageText = (results && results[0]) ? results[0].result : "";

//         // 3. 텍스트 저장 후 검색 페이지 열기
//         // (단축키는 검색어가 없으니 빈 검색어로 페이지부터 띄웁니다)
//         chrome.storage.local.set({ "pendingText": pageText }, () => {
//           chrome.tabs.create({ url: "https://hani.chois.cloud/search" });
//         });
//       });
//     }
//   }
// });