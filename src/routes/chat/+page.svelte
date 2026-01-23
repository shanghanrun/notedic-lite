<script>
  import { pb } from "$lib/pb.svelte";
  import { onMount, onDestroy } from "svelte";
  import { chatManager } from "$lib/chatManager.svelte";


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

      //1. 채팅 데이터 및 유저 목록 초기화
      await chatManager.initChat();
      alert(`${currentUser.name || "유저"}님 환영합니다!`);

      // 새로운 유저 목록 갱신 (반응성을 위해 다시 할당)
        const freshUsers = await pb.collection("users").getFullList();
        chatManager.users = freshUsers;
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

  async function logout() {
    pb.authStore.clear();
    isLogged = false;
    // 새로운 유저 목록 갱신 (반응성을 위해 다시 할당)
        const freshUsers = await pb.collection("users").getFullList();
        chatManager.users = freshUsers;
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

            // pb.collection("messages").subscribe("*", ({ action, record }) => {
            //     if (action === "create" && record.room === chatManager.activeRoomId) {
            //         chatManager.messages = [...chatManager.messages, record];
            //     }
            // }, { expand: "user" }); // subscribeMessage함수와 중복된다.
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

  async function inviteUser(targetUser) {
    if (!chatManager.activeRoomId) return alert("방을 먼저 선택하고 초대하세요.");

    const targetUserName = targetUser.name || targetUser.username || "익명"

    // 1. 초대장 생성 (상대방 알림용)   
    await pb.collection('invitation').create({
      from: pb.authStore.model.id,
      to: targetUser.id,
      room: chatManager.activeRoomId,
      message: `${pb.authStore.model.name}님이 '${chatManager.activeRoomName}' 방으로 초대하셨습니다!`,
      success: false, // 초기값은 false
      type:'invite'
    });

    await chatManager.sendSystemMessage(`[시스템] ${targetUserName}님을 초대했습니다.`);
    alert(`${targetUserName}님께 초대장을 보냈습니다!`);

  }


  async function acceptInvitation(invite) {
    try {
        // 1. 방 멤버로 추가 (이미 입장 함수가 있다면 활용)
        // invite.room에 방 ID가 들어있습니다.
        // invite.expand.room: { id: "...", title: "초코의 방", active: true ... } (방 전체 정보)
        chatManager.activeRoomId = invite.room;
        await chatManager.joinRoom(); 

        // 2. 초대장 처리 완료 (success = true)
        await pb.collection('invitation').update(invite.id, { success: true });

        // 3. 팝업 닫고, 알람 UI끄기
        chatManager.isPopupOpen = false;
        chatManager.hasNewInvite = false;

        // 로컬 목록 갱신 및 팝업 닫기
        updateInviteUI(invite.id);
        alert(`입장 완료!`);
    } catch (err) {
        console.error("초대 수락 실패:", err);
        alert("입장 처리 중 오류가 발생했습니다.");
    }
  }

  // [보류] - 사실상 거절 및 삭제
async function declineInvitation(invite) {
    if (!confirm("이 초대를 삭제하시겠습니까?")) return;
    
    try {
        await pb.collection('invitation').delete(invite.id); // DB에서 삭제
        updateInviteUI(invite.id); // UI에서 제거
    } catch (err) {
        console.error("초대 삭제 실패:", err);
    }
}

// UI 리스트 갱신 공통 함수
async function updateInviteUI(id) {
    chatManager.invitations = chatManager.invitations.filter(i => i.id !== id);
    if (chatManager.invitations.length === 0) {
        chatManager.isPopupOpen = false;
        chatManager.hasNewNotification = false;
    }
    try {
        await pb.collection('invitation').delete(id); // DB에서 삭제
    } catch (err) {
        console.error("초대 삭제 실패:", err);
    }
}

async function sendDirectMessage(user, type = 'message') {
    
    const msg = prompt(`${user.name}님께 보낼 내용을 입력하세요.`);
    if (!msg) return;

    try {
          await pb.collection('invitation').create({
          from: pb.authStore.model.id,
          to: user.id,
          message: msg,
          type: 'dm', // 🔥 도장 쾅!
          success: false
          });

        alert("쪽지를 보냈습니다!");
    } catch (err) {
        alert("전송 실패!");
    }
}


async function sendEmail(user) {
    let title = prompt(`${user.name}님께 보낼 이메일 제목`);
    let content = prompt(`${user.name}님께 이메일 내용`);
    if (!title || !content) return; // 취소 누르면 중단
    
    if (!user.email) {
        alert("이 유저는 이메일 정보가 없습니다.");
        return;
    }
    
    try {
          await pb.collection('invitation').create({
          from: pb.authStore.model.id,
          to: user.id,
          message: content,
          type: 'email', // 🔥 도장 쾅!
          success: false
          });

          console.log('invitation발송 성공')

          // 2. 상대방 이메일로 알림 엔진 가동 (네이버 SMTP 출격)
        // 이 함수가 실행되면 형님이 고친 '한글 템플릿'이 날아갑니다.
        await pb.collection('users').requestPasswordReset(user.email);
        alert("메일을 보냈습니다!");
    } catch (err) {
        alert("전송 실패: ");
    }

}

// 사용자 팝업메뉴
let selectedUserForMenu = $state(null); // 메뉴를 띄울 대상 유저
let menuPosition = $state({ x: 0, y: 0 });
let isMenuBottom = $state(false); // 메뉴가 위로 열려야 하는지 여부

function openUserMenu(e, user) {
    e.preventDefault();
    selectedUserForMenu = user;
    
    const menuHeight = 200; // 메뉴의 대략적인 높이
    const windowHeight = window.innerHeight;
    
    // 클릭 위치가 하단에 너무 가까우면 '위로' 띄우기
    if (windowHeight - e.clientY < menuHeight) {
        isMenuBottom = true;
        menuPosition = { 
            x: e.clientX, 
            y: windowHeight - e.clientY // 바닥에서의 거리
        };
    } else {
        isMenuBottom = false;
        menuPosition = { x: e.clientX, y: e.clientY };
    }
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

    <div class="my-profile-container">
      <div class="my-info">
        <span class="status-dot online"></span>
        <span class="user-name">me: {chatManager.myName} </span>
      </div>
      
      <button 
        class="noti-btn {chatManager.hasNewNotification ? 'bling-bling' : ''}" 
        onclick={async() => { 
                  await chatManager.loadInvitations(); // 팝업 열 때 목록 가져오기
                  //먼저 확실히 데이터를 받은 이후에 팝업시키기
                  chatManager.isPopupOpen = true; 
                  chatManager.hasNewNotification = false; 
                  }}
      >
        <i class="icon-mail">✉️</i> </button>
    </div>

    {#if chatManager.isPopupOpen}
      <div class="modal-overlay" onclick={() => chatManager.isPopupOpen = false}>
        <div class="invite-modal" onclick={(e) => e.stopPropagation()}>
          
          <div class="modal-header">
            <h3>💌 알림 센터</h3>
          </div>
          
          <div class="invite-list">
            {#if (chatManager.invitations.length===0)}
              <p class="msg-content">"no items"</p>
              <div class="btn-group">
                <button class="accept-btn" onclick={() => {chatManager.isPopupOpen = false;}}>닫기</button>
              </div>

            {/if}
              {#each chatManager.invitations as invite}
                <div class="invite-card">
                  
                  {#if invite.type === 'invite'}
                    <p class="type-tag invite">🏠 방 초대</p>
                    <p><strong>{invite.expand?.from?.name}</strong>님이 초대하셨습니다.</p>
                    <p class="msg-content">"{invite.message}"</p>
                    <div class="btn-group">
                      <button class="accept-btn" onclick={() => acceptInvitation(invite)}>수락 및 입장</button>
                      <button class="decline-btn" onclick={() => declineInvitation(invite)}>거절</button>
                    </div>

                  {:else if invite.type === 'dm'}
                    <p class="type-tag dm">💬 쪽지</p>
                    <p><strong>{invite.expand?.from?.name}</strong>님의 메시지</p>
                    <p class="msg-content">"{invite.message}"</p>
                    <div class="btn-group">
                      <button class="accept-btn" onclick={() => updateInviteUI(invite.id)}>확인</button>
                    </div>
                  {:else if invite.type === 'email'}
                    <p class="type-tag email">📧 이메일 도착</p>
                    <p><strong>{invite.expand?.from?.name}</strong>님의 메시지</p>
                    <p class="msg-content">"{invite.message}"</p>
                    <div class="btn-group">
                      <button class="accept-btn" onclick={() => updateInviteUI(invite.id)}>확인</button>
                    </div>
                  {/if}

                </div>
              {/each}
          
          </div>
        </div>
      </div>
    {/if}


    <h3>👥 접속자 목록</h3>
    <ul>
      {#each chatManager.users as user}
        <li class="user-item" 
              onclick={(e) => {openUserMenu(e, user)}}
              oncontextmenu={(e) => openUserMenu(e, user)}
              >
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
          onclick={() => {
            chatManager.activeRoomName = room.title;
            chatManager.loadMessages(room.id)}}
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



  {#if selectedUserForMenu}
    <div class="menu-overlay" onclick={() => selectedUserForMenu = null}>
      <div class="user-context-menu" 
            style="left: {menuPosition.x}px; 
                    {isMenuBottom ? `bottom: ${menuPosition.y}px;` : `top: ${menuPosition.y}px;`}"
            onclick={(e) => e.stopPropagation()}>
            <div class="menu-header">👤 {selectedUserForMenu.name || '익명'}</div>
        
              <button onclick={() => { inviteUser(selectedUserForMenu); selectedUserForMenu = null; }}>
                📩 채팅방 초대하기
              </button>
              
              <button onclick={() => { sendDirectMessage(selectedUserForMenu); selectedUserForMenu = null; }}>
                💬 쪽지 보내기
              </button>
              
              <button onclick={() => { sendEmail(selectedUserForMenu); selectedUserForMenu = null; }}>
                📧 이메일 보내기
              </button>

              <button onclick={() => selectedUserForMenu = null} class="close-btn">
                취소
              </button>
            </div>
     </div>
      
  {/if}
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
    cursor: pointer; 
    padding: 5px;
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



  .my-profile-container {
    width: 70%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 5px;
  margin-bottom: 10px;
}

.noti-btn {
  background: #eee; /* 기본 비활성 톤 */
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.3s;
}
/* 알림 왔을 때 - 블링블링 활성 상태 */
.noti-btn.bling-bling {
  background: #fff3bf; /* 부드러운 노란색 */
  border: 1px solid #fab005;
  animation: pulse 0.8s infinite alternate;
}
.user-name{
  color: rgb(28, 66, 254);
  font-weight: 500;
}

/* 🔥 알림 왔을 때의 블링블링 효과 */
.noti-btn.bling-bling {
  background: #ffeb3b; /* 활성 바탕색 (노란색 계열) */
  animation: pulse 0.5s infinite alternate;
}

@keyframes pulse {
  from { transform: scale(1); box-shadow: 0 0 0px rgba(255, 235, 59, 0); }
  to { transform: scale(1.1); box-shadow: 0 0 10px rgba(255, 235, 59, 0.8); }
}

  .menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 1000;
}

.user-context-menu {
  position: absolute;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.15);
  min-width: 150px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.menu-header {
  padding: 10px;
  background: #f8f9fa;
  font-size: 0.9rem;
  font-weight: bold;
  border-bottom: 1px solid #eee;
  color: #555;
}

.user-context-menu button {
  padding: 12px 15px;
  border: none;
  background: white;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
}

.user-context-menu button:hover {
  background: #f0f7ff;
  color: #007bff;
}

.user-context-menu .close-btn {
  border-top: 1px solid #eee;
  color: #999;
}


/* 팝업 전체 배경 (어둡게 처리) */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; width: 100vw; height: 100vh;
  background: rgba(0, 0, 0, 0.6); /* 뒷배경 어둡게 */
  display: flex; justify-content: center; align-items: center;
  z-index: 9999; /* 최상단 */
}

/* 팝업 본체 */
.invite-modal {
  background: white; width: 380px; border-radius: 20px;
  box-shadow: 0 15px 35px rgba(0,0,0,0.3);
  overflow: hidden; animation: popIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal-header {
  padding: 15px 20px; background: #f8f9fa;
  border-bottom: 1px solid #eee; text-align: center;
}

.invite-list { padding: 20px; max-height: 50vh; overflow-y: auto; }

.invite-card {
  background: #fff; border: 1px solid #e0e0e0; border-radius: 12px;
  padding: 15px; margin-bottom: 15px; text-align: center;
}

/* 버튼 그룹 */
.btn-group {
  display: flex; gap: 10px; margin-top: 15px;
}

.btn-group button {
  flex: 1; padding: 10px; border: none; border-radius: 8px;
  font-weight: bold; cursor: pointer; transition: 0.2s;
}

.accept-btn { background: #4caf50; color: white; }
.accept-btn:hover { background: #43a047; }

.decline-btn { background: #eeeeee; color: #666; }
.decline-btn:hover { background: #e0e0e0; }

@keyframes popIn {
  from { transform: scale(0.8); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}


.type-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: bold;
  margin-bottom: 8px;
}
.type-tag.invite { background: #e3f2fd; color: #1976d2; } /* 파란색 계열 */
.type-tag.dm { background: #f3e5f5; color: #7b1fa2; }     /* 보라색 계열 */
.type-tag.email { background: #fff0f6; color: #d6336c; } /* 핑크/레드 계열 */

.msg-content {
  background: #fdfdfd;
  padding: 10px;
  border-radius: 8px;
  font-style: italic;
  color: #555;
  margin: 10px 0;
}
</style>