<script>
	//역할 데이터 로딩 및 인덱싱 진행 상태를 화면 전체에 덮어 표시합니다.
	//indexSearchUI.isLoading과 indexSearchUI.isIndexing 조건부 렌더링 부분을 하나로 합쳐 관리합니다.

    import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    import { fade } from 'svelte/transition';
</script>

{#if indexSearchUI.isLoading}
    <div class="loading-overlay" transition:fade>
        <div class="loading-card">
            <div class="spinner"></div>
            <h3>인덱스 로딩 중...</h3>
            <p>데이터를 분석하고 검색 준비를 하고 있습니다.</p>
            <div class="progress-container-mini">
                <div class="progress-bar-fill" style="width: {indexSearchUI.progressValue}%"></div>
            </div>
        </div>
    </div>
{:else if indexSearchUI.isIndexing}
    <div class="loading-overlay" transition:fade>
        <div class="loading-card indexing-card">
            <div class="spinner indexing-spinner"></div>
            <h3 class="status-label">{indexSearchUI.progressLabel || "인덱싱 준비 중..."}</h3>
            <p class="status-detail">대용량 파일은 최대 1분 정도 소요될 수 있습니다.</p>
            
            <div class="progress-container-main">
                <div class="progress-bar-fill" style="width: {indexSearchUI.progressValue}%"></div>
                <span class="percentage-text">{indexSearchUI.progressValue}%</span>
            </div>
            
            {#if indexSearchUI.progressValue > 80}
                <p class="final-step-msg">서버에 최종 인덱스를 저장하고 있습니다...</p>
            {/if}
        </div>
    </div>
{/if}

<style>
    /* 원본 스타일 유지: .loading-overlay, .loading-card, .spinner 등 */
    .loading-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 9999; backdrop-filter: blur(4px); }
    .loading-card { background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); text-align: center; min-width: 300px; display: flex; flex-direction: column; align-items: center; gap: 15px; }
    .spinner { width: 50px; height: 50px; border: 5px solid #f3f3f3; border-top: 5px solid #2563eb; border-radius: 50%; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .progress-bar-fill { height: 100%; background: #10b981; transition: width 0.3s ease; }
    .indexing-card { border: 2px solid #9333ea; min-width: 400px; }
    .indexing-spinner { border-top: 5px solid #9333ea; }
    .progress-container-main { width: 100%; height: 24px; background: #f3f4f6; border-radius: 12px; position: relative; overflow: hidden; margin-top: 20px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
    .percentage-text { position: absolute; width: 100%; text-align: center; top: 50%; left: 0; transform: translateY(-50%); font-size: 12px; font-weight: bold; color: #1f2937; }
</style>
