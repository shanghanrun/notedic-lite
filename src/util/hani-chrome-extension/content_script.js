// content_script.js
chrome.storage.local.get(["pendingText"], (result) => {
  if (result.pendingText) {
    // 웹페이지의 localStorage에 데이터를 복사해줍니다.
    localStorage.setItem("shared_pendingText", result.pendingText);
    console.log("확장 프로그램 데이터가 웹페이지로 동기화되었습니다.");
  }
});