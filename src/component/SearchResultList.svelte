<script>
    // import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    import { onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition'; // 애니메이션 효과

	let {item} = $props()

    // 1. 컴포넌트가 마운트될 때 초기 스크롤 위치 계산
    onMount(() => {
        if (item.searchResults.length > 0) {
            triggerInitialScroll();
        }
    });

    // 2. 검색 결과(searchResults)가 변경될 때마다 첫 화면 계산 강제 실행
    $effect(() => {
        if (item.searchResults.length > 0) {
            // 결과가 바뀌면 잠시 후(DOM 반영 후) 계산 실행
            setTimeout(triggerInitialScroll, 10);
        }
    });

    function triggerInitialScroll() {
        const viewport = document.querySelector('.virtual-viewport');
        if (viewport) {
            // 실제 스크롤 이벤트를 시뮬레이션하여 visibleResults를 채움
            item.handleScroll({ target: viewport });
        }
    }

	let selectedResult = $state(null); // 팝업에 표시할 데이터
    let showModal = $state(false);     // 팝업 표시 여부

    function openDetail(result) {
        selectedResult = result;
        showModal = true;
    }

    function closeModal() {
        showModal = false;
        selectedResult = null;
    }

</script>

<section class="results-list-wrapper">
    <h4 class="section-title">⚡ 검색 카드 (매칭: {item.searchResults.length}건)</h4>
    
    <div class="virtual-viewport" onscroll={(e) => item.handleScroll(e)}>
        <div class="virtual-spacer" style="height: {item.totalHeight}px;"></div>
        
        <div class="virtual-content">
            {#each item.visibleResults as result (result.uniqueKey)}
                <div class="result-card-outer" style="top: {result.renderTop}px; height: {item.itemHeight}px;">
                    <div class="card-inner" 
						class:and-match-highlight={result.isAndMatch}
						onclick={() => openDetail(result)} 
         				style="cursor: pointer;"
						>
                        <div class="card-tag" style="background: {result.isAndMatch ? '#10b981' : (result.isServer ? '#3b82f6' : '#f59e0b')};"></div>
                        <div class="card-content">
                            <div class="card-header-row">
                                <div class="file-name-tag">[{result.fileName}]</div>
                                {#if result.isAndMatch}
                                    <span class="and-badge">교집합(AND) 발견</span>
                                {/if}
                            </div>
                            <p class="card-text line-clamp-2">
                                {@html item.highlightText(result.text, false)}
                            </p>
                        </div>
                    </div>
                </div>

				{#if showModal && selectedResult}
					<div class="modal-overlay" onclick={closeModal}>
						<div class="modal-card" onclick={(e) => e.stopPropagation()}>
							<div class="modal-header">
								<div class="file-name-tag" style="font-size: 1.2rem;">[{selectedResult.fileName}]</div>
								<button class="close-btn" onclick={closeModal}>✕</button>
							</div>
							<hr />
							<div class="modal-body">
								<p class="full-text">
									{@html item.highlightText(selectedResult.text, false)}
								</p>
							</div>
							<div class="modal-footer">
								<button class="copy-btn-small" onclick={() => {
									navigator.clipboard.writeText(selectedResult.text);
									// alert('텍스트가 복사되었습니다.');
								}}>이 단락 복사</button>
							</div>
						</div>
					</div>
				{/if}
				<!-- {:else}
					{#if item.searchInput && !item.isLoading}
                    	<div class="no-result">데이터를 불러오는 중이거나 결과가 없습니다.</div>
                	{/if} -->
            {/each}
        </div>
    </div>
</section>

<style>
    /* ⚠️ 핵심: 부모와 본인에게 확실한 높이를 부여해야 함 */
    .results-list-wrapper {
        display: flex;
        flex-direction: column;
        /* ⚠️ 핵심: 사용 가능한 높이를 꽉 채우도록 설정 */
        height: calc(100vh - 350px); 
        min-height: 500px;
        margin-bottom: 20px;
    }

    .virtual-viewport {
        flex: 1;
        overflow-y: auto;
        position: relative;
        background: #f8fafc; /* 좀 더 연한 배경 */
        border-radius: 12px;
        border: 1px solid #e2e8f0;
    }

    .virtual-spacer {
        width: 1px;
    }

    .virtual-content {
        position: absolute; /* spacer 위에 띄움 */
        top: 0;
        left: 0;
        width: 100%;
    }

    /* 카드 스타일 (생략 - 위와 동일) */
    .result-card-outer { position: absolute; left: 0; width: 100%; padding: 8px 16px; box-sizing: border-box; }
    .card-inner { display: flex; height: 100%; background: white; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #eee; }
    .card-tag { width: 10px; height: 100%; flex-shrink: 0; }
    .card-content { padding: 12px 20px; flex: 1; display: flex; flex-direction: column; justify-content: center; }
    .file-name-tag { font-size: 1rem; color: #2563eb; font-weight: 800; }
    .card-text { font-size: 1.2rem; color: #1e293b; line-height: 1.4; }
    .and-match-highlight { border: 2px solid #10b981 !important; background-color: #f0fdf4 !important; }
    .and-badge { background: #10b981; color: white; padding: 2px 10px; border-radius: 20px; font-size: 0.8rem; margin-left: 10px; font-weight: bold; }
    .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

	.card-header-row{
		display: flex;
		gap: 20px
	}

	/* 모달 레이아웃 */
    .modal-overlay {
        position: fixed;
        top: 0; left: 0; width: 100%; height: 100%;        
        display: flex; align-items: center; justify-content: center;
        z-index: 10000;
        /* 배경색을 거의 투명하게 설정하여 기존 화면이 그대로 보이게 함 */
        background: rgba(255, 255, 255, 0.05); 
        
        /* 핵심: 현재 화면(뒷배경)을 그대로 블러 처리 */
        /* backdrop-filter: blur(15px) brightness(0.9);  */
        /* -webkit-backdrop-filter: blur(5px) brightness(0.5); */
        
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        
        /* 팝업이 나타날 때 부드러운 전환을 위해 */
        transition: all 0.3s ease;
    }

    .modal-card {
        background: white;
        width: 80%;
        max-width: 800px;
        max-height: 80vh;
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        display: flex;
        flex-direction: column;
        padding: 24px;
        overflow: hidden;
    }

    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .close-btn { background: none; border: none; font-size: 24px; cursor: pointer; color: #666; }

    .modal-body {
        flex: 1;
        overflow-y: auto; /* 내용이 아주 길 경우 스크롤 */
        padding: 10px 0;
    }

    /* 상세 화면 폰트 설정 (사용자 지정 폰트 적용) */
    .full-text {
        font-family: 'Noto Sans KR', sans-serif;
        font-size: 1.4rem; /* 팝업인 만큼 더 크게 */
        line-height: 1.8;
        color: #1e293b;
        white-space: pre-wrap; /* 줄바꿈 유지 */
        word-break: break-all;
    }

    .modal-footer { margin-top: 20px; display: flex; justify-content: flex-end; }
    .copy-btn-small { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }

    /* 카드 호버 효과 추가 */
    .card-inner:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0,0,0,0.15);
        border-color: #3b82f6;
    }
</style>