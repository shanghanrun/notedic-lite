<script>
	let {item} =$props()
</script>

<section class="final-summary">
    <div class="summary-header">
        <h4 class="section-title">📋 분석 보고서 (전체 결과)</h4>
        <div class="button-group">
            <button class="copy-btn" onclick={() => item.copyToClipboard()}>📄 전체 복사</button>
        </div>
    </div>

    <div class="summary-paper" bind:this={item.summaryElement}>
        <h2 class="report-title">검색어 [{item.searchQuery}] 분석 보고서</h2>
        
        {#each Object.entries(item.groupedResults) as [fileName, lines]}
            <div class="summary-group">
                <h3 class="group-source-title">[출처: {fileName}] ({lines.length}건)</h3>
                <div class="group-lines">
                    {#each lines as line}
                        <p class="summary-line">
                            <span class="bullet">○ </span>
                            {@html item.highlightText(line, true)}
                        </p>
                    {/each}
                </div>
            </div>
        {:else}
            <p class="no-data-text">분석할 데이터가 없습니다.</p>
        {/each}
    </div>
</section>

<style>
    .final-summary { margin-top: 20px; }
    .summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
    .section-title { font-weight: bold; color: #475569; }
    .copy-btn { background: #2563eb; color: white; padding: 10px 20px; border-radius: 8px; font-weight: bold; border: none; cursor: pointer; transition: background 0.2s; }
    .copy-btn:hover { background: #1d4ed8; }
    
    .summary-paper { background: white; padding: 40px; border-radius: 12px; border: 1px solid #e5e7eb; min-height: 200px; }
    .report-title { font-size: 24px; font-weight: 800; text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .summary-group { margin-bottom: 30px; }
    .group-source-title { font-size: 18px; font-weight: bold; color: #1e40af; background: #eff6ff; padding: 10px; border-radius: 6px; margin-bottom: 15px; }
    .summary-line { font-size: 1.1rem; line-height: 1.6; color: #334155; margin: 8px 0; }
    .bullet { color: #2563eb; font-weight: bold; }
    .no-data-text { text-align: center; color: #94a3b8; padding: 40px; }
</style>