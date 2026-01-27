<script lang="ts">
    import { page } from '$app/state'; // SvelteKit 기본 기능

    // [이식 가이드] 특정 프로젝트의 상태 관리 객체가 있다면 여기에 임포트하세요.
    // 만약 다른 프로젝트라면 이 부분만 수정하거나 주석 처리하면 됩니다.
    // import { bookWork } from '$lib/BookWork.svelte'; 

    let { children } = $props();
    let isVisible = $state(true);

    // 페이지 성격에 따른 스타일 분기 (URL 기반)
    let isMusicPage = $derived(page.url.pathname.includes('music')); 

    function handleAction(direction: 'up' | 'down') {
        // 1. 현재 화면에 실질적인 스크롤바가 생겼는지 확인
        const hasScroll = document.documentElement.scrollHeight > window.innerHeight;

        if (hasScroll) {
            // [상황 A] 스크롤바가 있는 경우: 뷰포트의 90%만큼 이동
            const moveDistance = window.innerHeight * 0.9;
            window.scrollBy({
                top: direction === 'up' ? -moveDistance : moveDistance,
                behavior: 'smooth'
            });
        } 
        else {
            // [상황 B] 스크롤바가 없는 경우: 외부 객체(bookWork 등) 연동 시도
            // typeof를 사용해 객체가 정의되어 있는지 안전하게 확인합니다.
            try {
                // @ts-ignore (임포트 주석 시 발생할 타입 에러 방지)
                if (typeof bookWork !== 'undefined' && bookWork?.doc) {
                    if (direction === 'up' && bookWork.selectedIndex > 0) {
                        bookWork.selectedIndex--;
                    } else if (direction === 'down' && bookWork.selectedIndex < bookWork.doc.textSegments.length - 1) {
                        bookWork.selectedIndex++;
                    }
                }
            } catch (e) {
                // 객체가 없으면 아무 작업도 하지 않고 에러를 흘려보냅니다.
                console.log("Navigation object not found, skipping block move.");
            }
        }
    }
</script>

{@render children()}

<div class="three-dots-layer" class:use-blur={isMusicPage}>
    <button class="dot green" onclick={() => isVisible = !isVisible}></button>

    {#if isVisible}
        <div class="control-group">
            <button class="dot gray" onclick={() => handleAction('up')}></button>
            <button class="dot gray" onclick={() => handleAction('down')}></button>
        </div>
    {/if}
</div>

<style>
    /* 상단 고정 및 중앙 배치를 위한 레이아웃 */
    .three-dots-layer {
        position: fixed;
        right: 25px;
        top: 25px;
        bottom: 25px;
        z-index: 99999;
        display: flex;
        flex-direction: column;
        align-items: center;
        pointer-events: none;
    }

    .dot {
        pointer-events: auto;
        width: 45px;
        height: 45px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background-color: rgba(148, 163, 184, 0.25); /* 기본 반투명 */
    }

    /* 뮤직앱 등 이미지 중심 페이지용 블러 효과 */
    .use-blur .dot {
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }

    .green { 
        background-color: rgba(34, 197, 94, 0.45); 
        margin-bottom: auto; /* 초록 점을 상단으로 배치 */
    }

    .control-group {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    /* 밝은 파란색 호버 효과 */
    .dot:hover {
        background-color: rgba(56, 189, 248, 0.8) !important;
        transform: scale(1.1);
        box-shadow: 0 0 20px rgba(56, 189, 248, 0.4);
    }
</style>