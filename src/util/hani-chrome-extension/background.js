chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "haniQuickSearch",
    title: "한의학 퀵 검색",
    contexts: ["selection"] // 텍스트 선택했을 때만 나오게 최적화
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "haniQuickSearch") {
    const selectedText = info.selectionText || "";
    
    // storage에 저장하고 배지(알림) 띄우기
    chrome.storage.local.set({ "pendingSearch": selectedText }, () => {
      chrome.action.setBadgeText({ text: "GO" }); // 아이콘에 GO 표시
      chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
    });
  }
});