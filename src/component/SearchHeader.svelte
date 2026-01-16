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
            bind:value={item.searchInput}
            onkeydown={(e) => e.key === 'Enter' && item.startSearch()}
            placeholder="검색어 입력 (예: 氣/血)"
            class="search-input"
        />
        
        <button class="search-button" onclick={() => item.startSearch()}>
            검색
        </button>

        <div class="info-badge">
            매칭: <span class="match-count">{item.searchResults.length}</span>건
        </div>

		
		{#if tag === 'local'}
			<button class="go-button" onclick={() => { item.reset(); goto('/admin'); }}>
				admin
			</button>
		{:else if tag === 'server'}
			<button class="go-button" onclick={() => { item.reset(); goto('/'); }}>
				Home
			</button>
		{/if}
    </div>
</div>

<style>
    .search-header { 
        padding: 16px; 
        border-bottom: 1px solid #e5e7eb; 
        background: white;
    }
    
    .search-container { 
        display: flex; 
        gap: 12px; 
        align-items: center; 
    }

    .search-input { 
        flex: 1; 
        padding: 10px; 
        border: 1px solid #d1d5db; 
        border-radius: 6px; 
        font-size: 24px; 
        margin-left: 140px; /* 원본 레이아웃 여백 유지 */
    }

    .search-button { 
        background: #2563eb; 
        color: white; 
        padding: 10px 20px; 
        border-radius: 6px; 
        font-weight: bold; 
        border: none; 
        cursor: pointer; 
        margin-left: 40px;
        transition: background 0.2s;
    }
    .search-button:hover { background: #1d4ed8; }

    .info-badge { 
        margin-left: 40px; 
        font-size: 1.1rem;
        color: #4b5563;
    }
    .match-count { 
        font-weight: 800; 
        color: #ef4444; 
    }

    .go-button { 
        border: 1.5px solid #2ecc71; 
        color: #27ae60; 
        padding: 8px 15px; 
        border-radius: 20px; 
        cursor: pointer; 
        font-weight: 800; 
        font-size: 0.9rem;
        margin-left: 40px;
        margin-right: 50px;
        transition: all 0.2s;
    }
    .go-button:hover { 
        background: #2ecc71; 
        color: white; 
    }
</style>