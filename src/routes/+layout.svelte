<script lang="ts">
    import { page } from '$app/state';
    import favicon from '$lib/assets/favicon.svg';

    // [이식 가이드] 특정 프로젝트의 상태 관리 객체가 있다면 여기에 임포트하세요.
    // import { bookWork } from '$lib/BookWork.svelte'; 

    let { children } = $props();
    let isVisible = $state(true);

    //페이지 성격에 따른 스타일 분기 및 상태 관리
    let isMusicPage = $derived(page.url.pathname.includes('music')); 
    // 뮤직페이지는, 투명도를 블러로 해서 더 멋지게, 일반페이지는 글자가 보여야 되니 블러처리 안함

    // ⭐️ 초기값을 'down'으로 설정하여 시작부터 파란색 도트가 보이게 합니다.
    let activeDirection = $state<'up' | 'down'>('down');

    function handleAction(direction: 'up' | 'down') {
        // 1. 시각적 피드백 활성화 (파란색으로 변경)
        activeDirection = direction;

        // 2. 스크롤 여부 확인
        const hasScroll = document.documentElement.scrollHeight > window.innerHeight;

        if (hasScroll) {
            // [상황 A] 스크롤바가 있는 경우: 시원하게 90% 이동
            const moveDistance = window.innerHeight * 0.9;
            window.scrollBy({
                top: direction === 'up' ? -moveDistance : moveDistance,
                behavior: 'smooth'
            });
        } 
        else {
            // [상황 B] 스크롤바가 없는 경우: 외부 객체(bookWork) 연동
            try {
                // @ts-ignore
                const target = typeof bookWork !== 'undefined' ? bookWork : null;
                if (target && target.doc) {
                    if (direction === 'up' && target.selectedIndex > 0) {
                        target.selectedIndex--;
                    } else if (direction === 'down' && target.selectedIndex < target.doc.textSegments.length - 1) {
                        target.selectedIndex++;
                    }
                }
            } catch (e) {
                // console.log("Navigation target not found.");
            }
        }

        // 3. 형님의 핵심 요구사항: 2초(2000ms) 후에 원래 색으로 복귀
        // setTimeout(() => {
        //     activeDirection = null;
        // }, 2000);
    }
</script>
<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}

<div class="three-dots-layer" class:use-blur={isMusicPage}>
    <button class="dot green" onclick={() => isVisible = !isVisible}></button>

    {#if isVisible}
        <div class="control-group">
            <button 
                class="dot gray" 
                class:active={activeDirection === 'up'}
                onclick={() => handleAction('up')}
            ></button>
            
            <button 
                class="dot gray" 
                class:active={activeDirection === 'down'}
                onclick={() => handleAction('down')}
            ></button>
        </div>
    {/if}
</div>

<style>
    /* 1. 모바일 최적화 및 레이아웃 */
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

    /* 2. 공통 도트 스타일 */
    .dot {
        pointer-events: auto;
        width: 45px;
        height: 45px;
        border-radius: 50%;
        border: 1.2px solid rgb(222, 220, 220);
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.23, 0, 0.2, 1);
        background-color: rgba(148, 163, 184, 0.25);

    }

    /* 3. 활성화 상태 (클릭 후 2초간 유지되는 파란색) */
    .dot.active {
        background-color: rgba(93, 202, 249, 0.7) !important;
        /* transform: scale(1.15); */
        box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);
    }

    /* 뮤직앱 전용 블러 */
    .use-blur .dot {
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
    }

    .green { 
        background-color: rgba(34, 197, 94, 0.45); 
        margin-bottom: auto;
    }

    .control-group {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        display: flex;
        flex-direction: column;
        gap: 30px;
    }

    /* 호버 피드백 */
    .dot:hover:not(.active) {
        background-color: rgba(56, 189, 248, 0.5);
        transform: scale(1.1);
    }

    /* 4. 모바일 대응 미디어 쿼리 */
    @media (max-width: 768px) {
        .three-dots-layer {
            right: 15px; /* 모바일에선 조금 더 벽에 붙임 */
        }
        .dot {
            width: 40px; /* 약간 작게 조정 */
            height: 40px;
        }
    }
</style>