<script>
  import { pb } from "$lib/pb.svelte";
  import { onMount, onDestroy } from "svelte";
  import { chatManager } from "$lib/chatManager.svelte";
  import { untrack } from "svelte";

  // --- 상태 관리 ($state) ---
  let currentUser = $state(pb.authStore.model);
  let isLogged = $state(pb.authStore.isValid)

  // 🔥 핵심: 유저 상태가 바뀔 때마다 실행되는 효과
  $effect(() => {
    if (isLogged && currentUser) {
      updateMyStatus();
      const interval = setInterval(updateMyStatus, 30000);
      return () => clearInterval(interval);
    }
  })

  $effect(() => {
    const roomId = chatManager.activeRoomId;
    const isMember = chatManager.isMember;

    if (roomId && isMember) {
        chatManager.loadMessages(roomId);
    } else {
        pb.collection("messages").unsubscribe("*").catch(() => {});
        chatManager.messages = [];
    }
});

  // 메시지창 요소를 참조하기 위한 변수
  let messageContainer = $state();
  let lastScrollHeight = 0; // 이전 높이를 기억할 변수

  // 메시지 목록이 바뀔 때마다 스크롤을 맨 아래로 내림
  $effect(() => {
    // chatManager.messages가 변경되는 것을 감지
    const msgCount = chatManager.messages.length;

    // messageContainer가 없으면(null이면) 아예 실행 안 함
    // messageContainer가 인식되기도 전에 작동하면 에러가 발생했기 때문에 추가된 코드
    if (!messageContainer) {
      // console.log('messageContainer가 없어서 return합니다.')
      return
    };
    
    if (messageContainer) { 
      // DOM 업데이트 후 실행되도록 약간의 여유를 줌
      if (chatManager.isLoadingMore) {
        // 🚀 [Case 1] 더보기로 데이터가 추가된 경우
        const newHeight = messageContainer.scrollHeight;
        const heightDifference = newHeight - lastScrollHeight;
        
        console.log("더 보기 위치로 고정시작합니다.")
        // 늘어난 만큼만 아래로 밀어서 보던 위치 고정
        messageContainer.scrollTop = heightDifference;
        
        // 처리가 끝났으니 스위치 OFF
        // chatManager.isLoadingMore = false;
      } else {
        // 🚀 [Case 2] 새 메시지가 왔거나 방에 처음 들어온 경우
        setTimeout(() => {
          if (messageContainer) {
            messageContainer.scrollTo({
              top: messageContainer.scrollHeight,
              behavior: 'smooth'
            });
          }
        }, 50);
      }

      // 다음 비교를 위해 현재 높이 저장
      lastScrollHeight = messageContainer.scrollHeight;
      }
  });

  let heartbeatInterval;
  let email = $state("");
  let password = $state("");
  
  async function handleLogin() {
    try {
      pb.authStore.clear();
      await pb.collection("users").authWithPassword(email, password);
      currentUser = pb.authStore.model;
      isLogged = true;
      await chatManager.initChat();
      alert(`${currentUser.name || "유저"}님 환영합니다!`);
    } catch (err) {
      alert("로그인 실패: 이메일이나 비번을 확인하세요!");
    }
  }

  function isOnline(userIdToCheck) {
    if (!userIdToCheck) return false;
    if (userIdToCheck === pb.authStore.model?.id) return true;
    
    const lastSeenStr = chatManager.onlineMap[userIdToCheck];
    if (!lastSeenStr) return false;

    const lastSeenTime = new Date(lastSeenStr).getTime();
    return Date.now() - lastSeenTime < 90000;
  }

  function logout() {
    pb.authStore.clear();
    isLogged = false;
    location.reload();
  }

  async function updateMyStatus() {
        if (!pb.authStore.model) return;
        const userId = pb.authStore.model.id;
        try {
            const existing = await pb.collection("online_status").getFirstListItem(`userId="${userId}"`).catch(() => null);
            if (existing) {
                await pb.collection("online_status").update(existing.id, { last_seen: new Date().toISOString() });
            } else {
                await pb.collection("online_status").create({ userId, last_seen: new Date().toISOString() });
            }
        } catch (err) { console.error("하트비트 에러", err); }
  }

  async function init() {
        if (chatManager.isInitialized) return;
        chatManager.isInitialized = true;

        try {
            chatManager.users = await pb.collection("users").getFullList();
            await chatManager.initChat();

            pb.collection("online_status").subscribe("*", ({ action, record }) => {
                chatManager.onlineMap = { ...chatManager.onlineMap, [record.userId]: record.last_seen };
            });

            pb.collection("messages").subscribe("*", ({ action, record }) => {
                if (action === "create" && record.room === chatManager.activeRoomId) {
                    chatManager.messages = [...chatManager.messages, record];
                }
            }, { expand: "user" });
            pb.collection("rooms").subscribe("*", ({ action, record }) => {
              if (action === "delete") {
                  // 1. 목록에서 해당 방 제거
                  chatManager.rooms = chatManager.rooms.filter(r => r.id !== record.id);
                  
                  // 2. 만약 내가 보고 있던 방이 삭제된 거라면 선택 해제
                  if (chatManager.activeRoomId === record.id) {
                      chatManager.activeRoomId = null;
                      chatManager.messages = [];
                      alert("방장이 방을 폐쇄하였습니다.");
                  }
              }
              // (참고) action === "create" 일 때 목록에 추가하는 로직도 여기 넣으면 실시간성이 더 좋아집니다.
            });
            
        } catch(err){
          chatManager.isInitialized = false;
          console.error("데이터 로드 실패:", err);
        }
  }

  // 메시지 더 보기 버튼 클릭시 호출 될 함수
  async function handleLoadMore() { 
    lastScrollHeight = messageContainer.scrollHeight; //버튼 누른시점 높이 저장
    console.log('lastScrollHeight : ', lastScrollHeight)
    chatManager.isLoadingMore = true
 
    // 2. 데이터 더 가져오기
    await chatManager.loadMore();    
  }

  onMount(() => {
        init();
        return () => {
            clearInterval(heartbeatInterval);
            pb.collection("messages").unsubscribe();
            pb.collection("online_status").unsubscribe();
            pb.collection("rooms").unsubscribe();
        };
  });
</script>


<div class="chat-layout">
  <aside class="user-list">
    {#if !isLogged}
      <div class="login-container">
        <h2>🚀 메신저 로그인</h2>
        <input type="email" bind:value={email} placeholder="이메일 입력" />
        <input type="password" bind:value={password} placeholder="비밀번호 입력" />
        <button onclick={handleLogin}>접속하기</button>
      </div>
    {:else}
      <div class="logout-area" style="padding: 10px; text-align: right;">
        <button onclick={logout}>로그아웃</button>
      </div>
    {/if}

    <div class="room-input-group">
      <input bind:value={chatManager.newRoomTitle} placeholder="방 제목 입력..." />
      <button onclick={() => chatManager.createRoom()}>새 채팅방 만들기</button>
    </div>

    <h3>👥 접속자 목록</h3>
    <ul>
      {#each chatManager.users as user}
        <li class="user-item" onclick={() => chatManager.inviteUser(user)} style="cursor: pointer; padding: 5px;">
          <span class="status-dot {isOnline(user.id) ? 'online' : 'offline'}"></span>
          <span>{user.name || user.id.slice(0, 5)}</span>
        </li>
      {/each}
    </ul>
  </aside>

  <main class="chat-area">
    <nav class="tabs">
      {#each chatManager.rooms as room}
        <button
          class:active={chatManager.activeRoomId === room.id}
          onclick={() => chatManager.loadMessages(room.id)}
        >
          {room.title}
        </button>
      {/each}
    </nav>
    <div style="height: 20px; background: white"></div>
    {#if chatManager.currentRoom}
      <div class="room-control-bar">
        <div>
          <strong style="font-size: 1.1rem; color: #856404;">{chatManager.currentRoom.title}</strong>
          <small style="color: #856404;">({chatManager.currentRoom.members?.length || 0}명 참여 중)</small>
        </div>

        <div class="buttons">          
          {#if chatManager.isMember}
            <button class="outBtn" onclick={() => chatManager.leaveRoom()} style="padding: 5px 10px; cursor: pointer;">방 나가기</button>
            {#if chatManager.currentRoom.owner === pb.authStore.model?.id}
              <button class="closeBtn" onclick={() => chatManager.closeRoom()} >방 폐쇄</button>
            {/if}
          {:else}
            <div class="join-prompt" style="display: flex; align-items: center; gap: 10px;">
              <span style="font-weight: bold; color: #856404;">🔒 내용을 보려면 입장하세요.</span>
              <button onclick={() => chatManager.joinRoom()} style="background: #ff6b00; color: white; border: none; padding: 8px 15px; border-radius: 5px; cursor: pointer; font-weight: bold;">입장하기</button>
              <button onclick={() => (chatManager.activeRoomId = null)} style="padding: 8px 15px; background: #ddd; border: none; border-radius: 5px; cursor: pointer;">보류</button>
            </div>
          {/if}
        </div>
      </div>

      <div class="member-list-bar" style="padding: 5px 20px; background: #dddddd; border-bottom: 1px solid #eeeee; display: flex; align-items: center; gap: 10px; overflow-x: auto; white-space: nowrap;">
        <span style="font-size: 0.8rem; color: #888; flex-shrink: 0;">👥 참여중:</span>
        <div style="display: flex; gap: 8px; font-size: 0.9rem;">
          {#each chatManager.currentRoomMembers as member}
            <span class="member-name" style="color: {member.id === pb.authStore.model?.id ? '#4caf50' : '#333'}; font-weight: {member.id === pb.authStore.model?.id ? 'bold' : 'normal'};">
              {member.name || member.id.slice(0, 5)}{member.id === pb.authStore.model?.id ? '(나)' : ''}
            </span>
          {/each}
          {#if chatManager.currentRoomMembers.length === 0}
            <span style="color: #ccc; font-size: 0.8rem;">참여자가 없습니다.</span>
          {/if}
        </div>
      </div>

      <div class="messages" bind:this={messageContainer} style="background: {chatManager.isMember ? '#f9f9f9' : '#eee'};">
        {#if chatManager.isMember}

          {#if chatManager.hasMore}
            <div class="load-more-container">
              <button onclick={handleLoadMore} class="load-more-btn">
                이전 메시지 50개 더 보기
              </button>
            </div>
          {/if}

          {#each chatManager.messages as msg}
            <div class="message {msg.user === pb.authStore.model?.id ? 'mine' : ''}">
              <small>{msg.expand?.user?.name || msg.user?.slice(0,5)}</small>
              <p>{msg.content}</p>
            </div>
          {/each}
        {:else}
          <div class="lock-screen" style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #999;">
            <div style="font-size: 50px; margin-bottom: 10px;">🛡️</div>
            <p style="font-size: 1.2rem; font-weight: bold;">비공개 대화방</p>
            <p>상단의 [입장하기] 버튼을 클릭하면 대화에 참여할 수 있습니다.</p>
          </div>
        {/if}
      </div>

      {#if chatManager.isMember}
        <div class="input-box" style="padding: 20px; background: white; display: flex; gap: 10px; border-top: 1px solid #ddd;">
          <input
            bind:value={chatManager.newMessage}
            onkeydown={(e) => e.key === "Enter" && chatManager.sendMessage()}
            placeholder="메시지를 입력하세요..."
            style="flex: 1; padding: 12px; border: 1px solid #ddd; border-radius: 20px; outline: none;"
          />
          <button 
            onclick={() => chatManager.sendMessage()}
            style="padding: 0 20px; background: #ff6b00; color: white; border: none; border-radius: 20px; cursor: pointer; font-weight: bold;"
          >
            전송
          </button>
        </div>
      {/if}
    {/if}
  </main>
</div>


<style>
  /* 최상단에 추가하여 브라우저 기본 여백 제거 */
:global(body), :global(html) {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden; /* 바디 스크롤 원천 봉쇄 */
}

  .chat-layout {
    display: flex;
    height: 100vh; 
    overflow: hidden; /* 밖으로 삐져나오는 건 다 숨김 */
    background: #d7e1f0;
    font-family: sans-serif;
  }
  /* 1. 로그아웃 버튼 (핑크색, 80% 폭) */
  .logout-area {
    width: 100%;
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
  }
  .logout-area button {
    width: 80%;
    padding: 10px;
    background: #ff85a1; /* 이쁜 핑크색 */
    color: white;
    border: none;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
  }
  .logout-area button:hover {
    background: #ff5c8d;
    transform: scale(1.02);
  }

  /* login */
  .login-container input{
    width: 88%;
    padding: 12px; /* 위아래 폭 키움 */
    font-size: 1rem; /* 글자 크기 키움 */
    border: 1px solid #ddd;
    border-radius: 6px;
    outline: none;
  }
  .login-container button{
    width: 100%;
    padding: 10px;
    background: #476efd; /* 밝은 초록색 */
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }
    /* 2. 방 생성 영역 (입력칸 크게, 버튼 초록색) */
  .room-input-group {
    padding: 10px;
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 30px;
  }
  .room-input-group input {
    width: 70%;
    padding: 12px; /* 위아래 폭 키움 */
    font-size: 1rem; /* 글자 크기 키움 */
    border: 1px solid #ddd;
    border-radius: 6px;
    outline: none;
  }
  .room-input-group button {
    width: 80%;
    padding: 10px;
    background: #2ecc71; /* 밝은 초록색 */
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
  }


  /* 사이드바 전체 배경색 설정 (우측과 맞춤) 그리고 여기서 스크롤 발생해야 됨*/
  .user-list {
    width: 240px;
    background: #f8f9fa; /* 연한 회색 배경 */
    border-right: 1px solid #ddd;
    padding: 20px 10px;
    display: flex;
    flex-direction: column;
    align-items: center; /* 내부 요소들 중앙 정렬 */
    overflow-y: auto;   /* 내용 많아지면 사이드바 자체에 스크롤 생성 */
    overflow-x: hidden;
    flex-shrink: 0;     /* 너비 유지 */
  }
  /* 3. 접속자 목록 (밝은 초록 테두리) */
  .user-list h3 {
    width: 80%;
    text-align: left;
    margin-bottom: 10px;
    font-size: 1.1rem;
  }
  .user-list ul {
    width: 70%;
    list-style: none;
    padding: 10px;
    background: white; /* 목록은 흰색으로 대비 */
    border: 2px solid #2ecc71; /* 밝은 초록색 테두리 */
    border-radius: 8px;
    /* min-height: 200px; */
    /* 🔥 중요: 고정 높이를 주지 말고, 부모 안에서 유연하게 작동하도록 설정 */
    margin-top: 10px;
    margin-bottom: 20px;
  }
  .user-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px;
    border-bottom: 1px solid #f0f0f0;
  }
  .user-item:last-child {
    border-bottom: none;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #bbb;
    transition: all 0.3s;
  }
  .status-dot.online {
    background: #4caf50;
    box-shadow: 0 0 8px #4caf50;
  }

  .chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;       /* 전체 높이 사용 */
    overflow: hidden;   /* 바깥 스크롤 방지 */
  }
  .tabs button {
    padding: 10px 20px;
    border: 1px solid #ccc;
    border-bottom: none;   /* 아래쪽 테두리 제거 */
    border-radius: 8px 8px 0 0; /* 위쪽만 둥글게 */
    cursor: pointer;
    background: #f0f0f0;
    color: #666;
    transition: all 0.2s;
    font-weight: normal;
  }

  /* 마우스 올렸을 때 */
  .tabs button:hover {
    background: #fff;
    color: #333;
  }

  /* 🔥 핵심: 선택된 활성 탭 스타일 */
  .tabs button.active {
    background: white;       /* 배경 흰색으로 강조 */
    color: #3cba74;          /* 텍스트 포인트 컬러 */
    font-weight: bold;       /* 글씨 두껍게 */
    border: 1px solid #ddd;  /* 더 진한 테두리 */
    border-bottom: 2px solid white; /* 아래쪽 테두리를 흰색으로 덮어 본문과 연결된 느낌 */
    margin-bottom: -1px;     /* 아래쪽 선과 겹치게 살짝 내림 */
    z-index: 1;              /* 앞으로 튀어나오게 */
    box-shadow: 0 -2px 5px rgba(0,0,0,0.05); /* 살짝 그림자 효과 */
  }

  .messages {
    flex: 1;
    padding: 20px;
    overflow-y: auto;   /* 메시지 길어지면 여기서 스크롤 */
    overflow-x: hidden; /* 가로 스크롤 방지 */
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: #f9f9f9;
  }

  /* 🔥 추가된 메시지 버블 스타일 */
  .message {
    padding: 10px 14px;
    border-radius: 12px;
    background: white;
    max-width: 70%;
    align-self: flex-start;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  .message.mine {
    align-self: flex-end;
    background: #ffefd5;
  }
  .message small {
    display: block;
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 4px;
  }
  .message p {
    margin: 0;
    line-height: 1.4;
  }

  .input-box {
    flex-shrink: 0;
    padding: 20px;
    background: white;
    display: flex;
    gap: 10px;
    border-top: 1px solid #ddd;
  }
  .login-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-width: 300px;
    margin: 100px auto;
    padding: 20px;
    border: 1px solid #ddd;
    border-radius: 8px;
  }
  .outBtn{
    border-radius: 4px;
    background: rgb(136, 186, 252);
    border: 1px solid rgb(131, 172, 254);
    cursor: pointer;
  }
  .outBtn:hover{
    background: rgb(54, 168, 249);
  }
  .closeBtn{
    background: rgb(250, 92, 92); 
    color: white; 
    margin-left: 10px; 
    margin-right: 5px;
    border:none; 
    border-radius: 4px;
    padding: 5px 10px; 
    cursor: pointer;
  }
  .closeBtn:hover{
    background: rgb(250, 33, 33);
  }
  .room-control-bar{
    padding: 15px; 
    background: #fff3cd; 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    border-bottom: 2px solid #ffeeba;
  }
</style>