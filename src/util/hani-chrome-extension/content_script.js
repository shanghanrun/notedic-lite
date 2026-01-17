// 금고에서 꺼내서 주머니에 넣어주기
chrome.storage.local.get("shared_pendingText", (data) => {
  if (data.shared_pendingText) {
    localStorage.setItem("shared_pendingText", data.shared_pendingText);
    // 배달 완료 후 금고는 비워주는 센스!
    chrome.storage.local.remove("shared_pendingText");
  }
});