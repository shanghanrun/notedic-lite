// // content_script.js (보안 사이트 탈취 강화 버전)

// (function() {
//     function getCleanText() {
//         // [1순위] 사용자가 마우스로 드래그(선택)한 텍스트가 있다면 무조건 이걸 씁니다.
//         // 드래그 방식은 보안 프레임이나 로그인 여부를 따지지 않고 '눈에 보이는 것'을 가져옵니다.
//         const selection = window.getSelection().toString();
//         if (selection && selection.trim().length > 0) {
//             console.log("🎯 드래그된 텍스트를 우선 추출합니다.");
//             return selection;
//         }

//         // [2순위] 드래그가 없다면, 본문 전체를 긁되 '가장 큰 덩어리'를 찾습니다.
//         // 다음/네이버 카페 등 특정 구조 대응
//         const articleBody = document.querySelector('.article_view, #articleBody, #primaryContent, .se-viewer');
//         if (articleBody) return articleBody.innerText;

//         // [3순위] 최후의 수단: 보이지 않는 프레임까지 다 뒤집니다.
//         let fullText = document.body ? document.body.innerText : "";
//         document.querySelectorAll('frame, iframe').forEach(f => {
//             try {
//                 const fDoc = f.contentDocument || f.contentWindow.document;
//                 fullText += "\n" + fDoc.body.innerText;
//             } catch (e) {
//                 // 보안 차단된 프레임은 여기서 걸러지지만, 1순위(드래그)를 쓰면 해결됩니다.
//             }
//         });
//         return fullText;
//     }

//     const text = getCleanText();
//     if (text) {
//         chrome.storage.local.set({ "shared_pendingText": text }, () => {
//             // 금고에서 주머니로 배달... (기존 로직 동일)
//         });
//     }
// })();