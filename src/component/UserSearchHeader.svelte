<script>
	//역할: 검색어 입력창, 검색 버튼, 매칭 건수 표시, 홈 버튼을 담당합니다.
	
    // import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    import { goto } from '$app/navigation';
	let { item } = $props()
	let tag = item.type;

</script>

<div class="search-header">
    <div class="search-container">
        <div class="main-search-group">
            <input 
                type="text" 
                bind:value={item.searchQuery}
                onkeydown={(e) => e.key === 'Enter' && item.startSearch()}
                placeholder="검색어 입력 (예: 氣/血)"
                class="search-input"
                autofocus
            />
            <button class="search-button" onclick={() => item.startSearch()}>
                검색
            </button>
        </div>

        <div class="sub-action-group">
            <div class="info-badge">
                매칭: <span class="match-count">{item.searchResults.length}</span>건
            </div>

            {#if tag === 'local'}
                <button class="go-button" onclick={() => { item.reset(); goto('/admin'); }}>
                    기존자료 검색
                </button>
            {:else if tag === 'server'}
                <button class="go-button" onclick={() => { item.reset(); goto('/'); }}>
                    Home
                </button>
            {/if}
            
            <a href="https://music.chois.cloud" class="music-link">
                음악감상 <span class="icon">&rarr;</span>
            </a>
        </div>
    </div>
</div>

<style>
    .search-header { 
        padding: 16px; 
        border-bottom: 1px solid #e5e7eb; 
        background: white;
        /* 헤더가 항상 상단에 고정되게 하려면 아래 주석을 해제하세요 */
        /* position: sticky; top: 0; z-index: 100; */
    }
    
    .search-container { 
        display: flex; 
        flex-wrap: wrap; /* 좁아지면 다음 줄로 넘어가게 허용 */
        gap: 12px; 
        align-items: center;
        max-width: 1200px;
        margin: 0 auto;
        width: 100%;
    }
    /* 검색창 그룹: 가능한 넓게 차지 */
    .main-search-group {
        display: flex;
        flex: 1;
        min-width: 300px; /* 이 너비보다 작아지면 다음 그룹이 아래로 내려감 */
        gap: 8px;
    }

    /* 버튼 그룹: 내용물에 맞춰 정렬 */
    .sub-action-group {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap; /* 버튼들도 너무 많으면 줄바꿈 */
    }

    .search-input { 
        flex: 1; 
        padding: 10px 16px; 
        border: 1px solid #d1d5db; 
        border-radius: 6px; 
        font-size: 18px; 
        outline-color: #2563eb;
        min-width: 0; /* flex 환경에서 줄어들 수 있게 설정 */
    }

    .search-button { 
        background: #2563eb; 
        color: white; 
        padding: 10px 24px; 
        border-radius: 6px; 
        font-weight: bold; 
        border: none; 
        cursor: pointer; 
        white-space: nowrap; /* 글자가 밑으로 떨어지지 않게 고정 */
        transition: background 0.2s;
    }
    .search-button:hover { background: #1d4ed8; }

    .info-badge { 
        white-space: nowrap;
        font-size: 1rem;
        color: #4b5563;
        padding: 0 10px;
    }
    .match-count { 
        font-weight: 800; 
        color: #ef4444; 
    }

    .go-button { 
        border: 1.5px solid #2ecc71; 
        color: #27ae60; 
        padding: 8px 20px; 
        border-radius: 20px; 
        cursor: pointer; 
        font-weight: 800; 
        font-size: 0.9rem;
        white-space: nowrap;
        transition: all 0.2s;
    }
    .go-button:hover { 
        background: #2ecc71; 
        color: white; 
    }
    .music-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-decoration: none;
        color: #171717; /* 음악 느낌의 초록 계열 */
        background: #cdd0cf;
        padding: 8px 16px;
        border-radius: 12px;
        font-weight: 300;
        font-size: 0.9rem;
        transition: all 0.3s ease;
    }

    .music-link:hover {
        background: #aabcb2;
        color:#2563eb;
        font-weight: 500;
        transform: translateX(5px); /* 오른쪽으로 슥 이동 */
    }

    /* 🔥 모바일 마법 (768px 이하) */
    @media (max-width: 768px) {
        .search-header {
            padding: 12px;
        }

        .search-container {
            flex-direction: column; /* 세로로 쌓기 */
            align-items: stretch; /* 자식들이 가로로 꽉 차게 */
            gap: 15px;
        }

        .main-search-group {
            width: 100%;
        }

        .sub-action-group {
            width: 100%;
            justify-content: space-between; /* 배지와 버튼들 사이 간격 벌리기 */
        }

        .music-link {
            flex: 1; /* 음악감상 버튼이 남은 공간 다 채우게 */
            justify-content: center;
        }

        .search-input {
            font-size: 16px; /* 모바일 입력창 줌 현상 방지 */
        }
    }
</style>