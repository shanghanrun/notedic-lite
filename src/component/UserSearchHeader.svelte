<script>
	//역할: 검색어 입력창, 검색 버튼, 매칭 건수 표시, 홈 버튼을 담당합니다.
	
    // import { indexSearchUI } from '$lib/indexSearchUI.svelte.js';
    import { goto } from '$app/navigation';
	let { item } = $props()
	let tag = item.type;

</script>

<div class="search-header">
    <div class="search-container">
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
        gap: 12px; 
        align-items: center;
        max-width: 1200px; /* 너무 넓게 퍼지는 걸 방지 */
        margin: 0 auto;    /* 중앙 정렬 */
        width: 100%;
    }

    .search-input { 
        flex: 1; 
        min-width: 200px;  /* 너무 작아지지 않게 방지 */
        padding: 10px 16px; 
        border: 1px solid #d1d5db; 
        border-radius: 6px; 
        font-size: 20px;   /* 24px에서 살짝 줄여서 노트북 가독성 향상 */
        outline-color: #2563eb;
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

    /* 노트북이나 태블릿 등 화면이 작아질 때를 위한 '마법의 코드' */
    @media (max-width: 1024px) {
        .search-container {
            gap: 8px;
        }
        .search-input {
            font-size: 18px;
        }
        .info-badge, .go-button {
            font-size: 0.85rem;
        }
    }
</style>