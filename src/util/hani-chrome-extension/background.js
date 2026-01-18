chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "haniQuickSearch",
    title: "한의학 퀵 검색",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "haniQuickSearch") {
    const selectedText = info.selectionText || "";

    // 탭이 유효한지 확인 후 메시지 전송
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { action: "getAllText" }, (response) => {
        // 에러 발생 시(통신 불가 사이트 등) 무시하고 선택된 텍스트만 저장
        const pageText = (chrome.runtime.lastError || !response) ? "" : response.text;
        
        chrome.storage.local.set({ 
          "pendingSearch": selectedText,
          "pageContent": pageText 
        }, () => {
          chrome.action.setBadgeText({ text: "GO" });
          chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
        });
      });
    }
  }
});