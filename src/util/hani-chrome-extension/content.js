chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getAllText") {
    sendResponse({ text: document.body.innerText });
  }
  return true; // 비동기 응답을 위해 유지
});