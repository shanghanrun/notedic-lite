import { pb } from "./pb.svelte";

class ChatManager {
    // --- [상태 변수들] ---
    rooms = $state([]);
    activeRoomId = $state(null); // 실제로 입장한 방
	activeRoomName =$state(""); // 실제 입장한 방 이름
    messages = $state([]);
    newMessage = $state("");
    newRoomTitle = $state("");
    users = $state([]);
    onlineStatusMap = $state({});

	isInitialized = false  // 중복실행으로 인한, 예를 들어  방생성 한꺼번에 여러개 생기는 것 방지

	msgCount = $state(50)
	isLoadingMore = $state(false) // 메시지 더보기 중인지 알려주는 스위치
	hasMore = $state(true) // 더 가져올 데이터가 있는 지 여부

	
	
    // --- [유도된 상태 (Derived)] ---
	// 현재 user가 선택한 방 객체
    get currentRoom() {
        return this.rooms.find(r => r.id === this.activeRoomId);
    }

	// 내가 현재 방의 맴버인지 확인
    get isMember() {
        if (!this.currentRoom || !pb.authStore.model) return false;
        return this.currentRoom.members?.includes(pb.authStore.model.id);
    }

	// 현재 선택된 방의 멤버 객체(ID + 이름) 목록을 가져오는 유도 상태
	get currentRoomMembers() {
		if (!this.currentRoom || this.users.length === 0) return [];
		// 방의 members ID 배열을 순회하며 전체 유저 목록에서 해당 유저 객체를 찾습니다.
		return this.currentRoom.members.map(memberId => {
			return this.users.find(u => u.id === memberId) || { id: memberId, name: '익명' };
		});
	}


	// 내상태와 초대알림 위해
	// myName = $state(pb.authStore.model?.name || "로그인 필요"); 
	// myEmail = $state(pb.authStore.model?.email || "" )
	hasNewInvite =$state(false);
	hasNewNotification = $state(false); // 새로운 알림이 있는지 여부
	notificationMessage = $state(""); // 팝업에 띄울 내용
	isPopupOpen = $state(false); // 팝업창 열림 상태
	invitations = $state([]); // 초대장 목록 저장용
	


    // --- [메서드 (함수들)] ---

    initChat= async()=> {
        // 초기 로드 시 active=true인 방만 가져오는 게 깔끔할 수 있습니다.
        this.rooms = await pb.collection("rooms").getFullList({ 
            filter: "active = true",
            sort: "-created" 
        });
        
        //실시간 방 목록 구독
		//init 안에 구독을 넣어, 컴포넌트가 켜질 때 딱 한번만 실행되게 만들어야 효율적이다.
		await pb.collection("rooms").unsubscribe("*");

        pb.collection("rooms").subscribe("*", ({ action, record }) => {
            if (action === "create") this.rooms = [record, ...this.rooms];
            if (action === "update") {
                this.rooms = this.rooms.map(r => r.id === record.id ? record : r);
            }
        });

		// pb.collection('online_status').subscribe('*', ({ action, record }) => {
		// 	// 누군가의 상태가 바뀌면 맵을 즉시 업데이트 (반응성)
		// 	this.onlineStatusMap[record.userId] = record;
		// }); // init()와 중복이라서 지운다.

		// 🔥 [추가] 초대장(invitation) 실시간 구독 시작!
		await pb.collection("invitation").unsubscribe("*");
		pb.collection("invitation").subscribe("*", ({ action, record }) => {
			// 나에게 온 초대장이고, 새로 생성된(create) 경우라면?
			if (action === "create" && record.to === pb.authStore.model?.id) {
				console.log("💌 새로운 초대가 도착했습니다!");
				this.hasNewNotification = true; // 블링블링 스위치 ON
				this.notificationMessage = record.message; // 알림 내용 저장
				
				// (선택사항) 브라우저 기본 알림도 띄우고 싶다면
				// new Notification("새로운 초대", { body: record.message });
			}
		});
    }

    createRoom = async ()=> {  
		// input 태그가 있는 값을 바인딩해서 받을 때, this를 this.newRoomTitle이 아닌 input태그로 인식할 수 있으니, 화살표함수를 사용  
        if (!this.newRoomTitle.trim()) return alert("방 제목을 입력하세요!");

		if (!pb.authStore.isValid){
			alert("로그인 먼저 해주세요.")
		}

		// 🛡️ 서버에 쏘기 전에 내 리스트에서 이름 중복 체크!
		const isDuplicate = this.rooms.some(r => r.title === this.newRoomTitle.trim());
		if (isDuplicate) {
			return alert("동일한 이름의 방이 이미 존재합니다.");
		}

        try {
            const data = {
                title: this.newRoomTitle,
                active: true,
                owner: pb.authStore.model.id,
                members: [pb.authStore.model.id] //성성자를 맴버에 자동 포함
            };

            const record = await pb.collection("rooms").create(data);
			// this.rooms = [...this.rooms, record];   // 방만 추가하고, 방의 목록은 구독로직에서 알아서 처리하게 해야 중복이 안된다.

			this.messages =[]; // 새로 만든 방이므로, 혹시라도 남아 있는 messages 스테이트값을 비워둔다.
            this.selectRoom(record.id); // 방 생성 후 즉시 해당 방으로 이동
            this.newRoomTitle = ""; // 변수 비워두기
        } catch (err) {
            console.error("❌ 방 생성 실패:", err);
        }
    }

    // 방 선택 시 호출할 함수 (메시지 로드까지 한 번에!)
    selectRoom= async(roomId)=> {
        this.activeRoomId = roomId;
        this.loadMessages(roomId); //기존 50개 대화불러오기
    }

    joinRoom = async () => {
		if (!this.activeRoomId || !pb.authStore.model) return;
		
		try {
			const userId = pb.authStore.model.id;
			// 1. 현재 방의 기존 멤버 가져오기 (이미 currentRoom getter가 있으니 활용)
			const currentMembers = this.currentRoom.members || [];
			
			// 중복 입장 방지
			if (currentMembers.includes(userId)) return;

			// 2. 멤버 목록에 나를 추가해서 업데이트
			const newMembers = [...currentMembers, userId];
			await pb.collection("rooms").update(this.activeRoomId, {
				members: newMembers
			});

			// 3. 입장 성공 후 시스템 메시지 발송
			await this.sendSystemMessage(`📢 ${pb.authStore.model.name || '유저'}님이 입장하셨습니다.`);

			// 4. [핵심] 입장했으니 이제 이 방의 메시지를 새로고침해서 보여줌
			await this.loadMessages(this.activeRoomId);
			
			console.log("✅ 방 입장 완료!");
		} catch (err) {
			console.error("❌ 입장 실패:", err);
			alert("방 입장에 실패했습니다.");
		}
	}

	
	
	currentType = $state('message') //email, dm, 카톡, 탤레그램
	targetAddress = $state('')
	emailContent = $state('')

	

    sendMessage = async()=> {
		// 🛡️ 방이 선택되지 않았거나 내용이 없으면 중단
		if (!this.activeRoomId) return alert("먼저 대화할 방을 선택해주세요.");
		const text = this.newMessage.trim();
		console.log("채팅창에서 작성한 메시지: ", text)
		
		if (!text) return;

        try {
			console.log('here!!')
			if (text.startsWith('#')){
				this.currentType ='message'

				await pb.collection("messages").create({
					room: this.activeRoomId,
					user: pb.authStore.model.id,
					content: this.newMessage,
					type: 'message'
            	});
			} else{
				console.log('#이 아니라서 넘어옴')
				await this.handleSpecialCommand(text)
			}
			
            this.newMessage = ""; //전송후 입력창 비우기
        } catch (err) {
            console.error("❌ 메시지 전송 실패:", err);
        }
    }

	async handleSpecialCommand(text) {
		console.log('#이 아니라서 handleSpecialCommand로 넘어옴')
		this.newMessage ="" // 채팅창에는 아무 메시지 안 남김
		
		const parsed = this.parseCommand(text);
		if (!parsed) return false; // 일반 채팅으로 진행

		const { command, target, content } = parsed;

		switch (command) {
			case '#email':
				this.currentType = 'email'
				console.log('이메일 전송함')
				await this.sendEmail2(target, content); // target이 이메일 주소일 때
				break;
			case '#dm':
				this.currentType = 'message'
				await this.sendDirectMessage(target, content); // target이 유저 ID일 때
				break;
			case '#notice':
				await this.broadcastNotice(content); // 전역 공지
				break;
			case '#카톡':
				this.currentType = '카톡'
				this.messageToKakao(target, content);
				// 여기서 target은 사실상 보내는 사람 이름이다.
			case '#텔레그램':
				this.currentType ='텔레그램'
				alert(`${command} 연동은 다음 Push에서 만나요! 😉`);
				break;
			default:
				this.currentType ='message'
				return false; // 매칭되는 명령어가 없으면 일반 채팅
		}
		return true; // 명령어 처리 완료
	}

	parseCommand(text) {
		console.log("parseCommand로 넘어옴")
		// 공백 기준으로 최대 3덩어리까지만 나눔
		const parts = text.trim().split(/\s+/, 3); 
		if (parts.length < 2) return null;

		let command = parts[0]; // #email
		let target = parts[1];  // idim7@naver.com
		let content = ""

		// @초코  경우 처리하기 :: #email,  그리고 주소를 받아와야 된다.
		if (command.startsWith('@')){  // @초코 email 안녕하세요. / @초코 카톡 안녕하세요 형식
			console.log("@로 시작하여 처리함")
			const nickname = command.substring(1);
			const user = this.users.find(u => u.name === nickname);		
			
			console.log("nickname: ", nickname)
			console.log("user: ", user)

			if (user){				
				if(parts.length === 2){ // @초코 안녕 -> 기본 이메일 모드로 '안녕' 전송
					command = '#email'
					target = user.email
					content = parts[1]	

					console.log('@초코 형태를 처리함')
				} else { // 3 단위로 될 경우
					//@초코 뒤에 오는 단어(parts[1])가 실제로는 '수단(command)'가 된다.
					const method = parts[1]
					target = user.email; // 기본적으로 타겟을 이메일로 설정
					
					if (method.includes('email')) command = "#email";
					else if (parts[1].includes('dm')) {
						command = "#dm";
						target = user.id; // DM은 이메일주소가 아니라 유저 ID가 타겟!
					}
					else if (parts[1].includes('카톡')) command = "#카톡";
					else if (parts[1].includes('텔레그램')) command = "#텔레그램";
					else if (parts[1].includes('notice')) command = "#notice";
					
					// 최종적으로 두번째 공백 이후의 모든 텍스트를 content로 확보
					content = text.substring(text.indexOf(parts[1]) + parts[1].length).trim();
				}
			} else{
				alert('해당 유저를 찾을 수 없습니다!');
			}
		} else if(command.startsWith('#')){
			if(parts.length=== 2){ // #명령과 내용만 있는 경우
				target = this.user.name || "Hani Station"  
				//이때 target은 보내는 사람. 예를 들어, #카톡 안녕하세요.의 경우 보내는 사람이 생략됨
				content = parts[1] // 두번째 덩어리가 내용이 된다.
			} else{
				target = parts[1]; // 앞에 했지만, 확실하게
				content = text.split(/\s+/).slice(2).join(' ');
			}			
		}
		return { command, target, content };
	}

	async sendEmail2(address, content) {
		try {
			let targetEmail = address;
			let targetUserId = null; // 👈 초대장에 넣을 상대방 ID
			
			// 해당 이메일을 가진 유저를 DB에서 검색, invitation(실제는 password변경폼)에는 to에 userId가 들어가야 된다.
			// 이메일만으로는 안된다. 그래서 어쩔 수 없이 userId를 찾아와야 된다.
			try {
				const userByEmail = await pb.collection('users').getFirstListItem(`email="${address}"`);
				targetUserId = userByEmail.id;
				targetEmail = userByEmail.email;
				console.log('targetEmail: ', targetEmail)
			} catch (e) {
				// DB에 없는 외부 이메일 주소일 경우, 기록용 ID가 없으므로 에러가 날 수 있음
				// 이럴 땐 'invitation'의 'to' 필드 제약을 풀거나, 비워둬야 합니다.
				console.log("DB에 없는 외부 이메일입니다.");
			}			

			// 2. DB 기록 (invitation)
			// 만약 'to' 필드가 필수(Required)라면 반드시 valid한 ID가 들어가야 합니다.
			await pb.collection('invitation').create({
				from: pb.authStore.model.id,
				to: targetUserId, // 👈 여기가 진짜 유저 ID여야 400 에러가 안 납니다!
				targetEmail: targetEmail,
				message: content,
				type: 'email',
				success: false // false로 해 두어야 안 읽은 것
			});

			// 3. 실제 메일 발송 엔진 (비밀번호 초기화 템플릿 이용)
			await pb.collection('users').requestPasswordReset(targetEmail);
			
			alert(`💌 ${targetEmail}님께 메일을 보냈습니다!`);
		} catch (err) {
			console.error("400 에러 상세:", err.data); // 여기서 어떤 필드가 문제인지 알려줍니다.
			alert("발송 실패: 주소가 정확한지, 혹은 가입된 유저인지 확인해주세요.");
		}
	}


	// 메시지 로드 (방 바뀔 때마다 실행)  '과거 내역'을 가져오는 역할만 수행
    async loadMessages(roomId) {
		if (!roomId) return;
		this.activeRoomId = roomId;
				
		// 🔥 1. 여기서 activeRoomId를 직접 바꾸지 마세요. (이미 탭 클릭 시 바뀌어 있음)
		// 🔥 2. 멤버가 아니면 시도도 하지 않음
		if (!this.isMember) return;

		try {
			// 1. 최근 것부터 msgCount만큼 가져옴 (최신이 0번 인덱스에 옴)
			const result = await pb.collection("messages").getList(1, this.msgCount, {
			filter: `room = "${roomId}"`,
			sort: "-created", 
			expand: "user",
			});

			// 2. 화면엔 옛날게 위, 최신게 아래로 가야 하니 뒤집어줌
			this.messages = result.items.reverse();
			// 3. 전체 개수랑 비교해서 버튼 보여줄지 결정
			this.hasMore = result.totalItems > this.messages.length;
			
			// 로드 성공 후 구독 시작
			this.subscribeMessages(); 
		} catch (err) {
			if (err.isAbort) return;
			console.error("메시지 로드 에러", err);
		}
	}

	
	

	async broadcastNotice(content){

	}

	

	async loadMore() {
		if (!this.hasMore) {
		alert("더 이상 불러올 메시지가 없습니다, 형님!");
		return;
		}

		// 개수만 50개 늘리고 다시 로드! 
		this.msgCount += 50;
		await this.loadMessages(this.activeRoomId);
	}

	// 1. 메시지 실시간 구독 메서드
	subscribeMessages = async () => {
		//1. 혹시나 남아있을지 모를 '이전 방'의 구독을 깨끗이 지웁니다. (중복 방지 핵심!)
		await pb.collection("messages").unsubscribe("*");
		// 2. 현재 선택된 방이 없으면 구독 안 함
		if (!this.activeRoomId) return;

		// 현재 선택된 방(activeRoomId)의 메시지만 실시간 감시
		pb.collection("messages").subscribe("*", ({ action, record }) => {
			if (action === "create" && record.room === this.activeRoomId) {
				// 새 메시지가 오면 기존 배열 뒤에 추가 (반응성 유지)
				this.messages = [...this.messages, record];
			}
		}, { expand: "user" });
	};

    async sendSystemMessage(content) {
        try {
            await pb.collection("messages").create({
                room: this.activeRoomId,
                user: pb.authStore.model.id,//시스템 계정이 따로 없다면 현재 유저로
                content: content
            });
        } catch (err) {
            console.error("❌ 시스템 메시지 전송 실패:", err);
        }
    }

	// 나에게 온 초대장 목록 불러오기
	loadInvitations = async () => {
		try {
			this.invitations = await pb.collection('invitation').getFullList({
				filter: `to = "${pb.authStore.model.id}" && success = false`,
				expand: 'from,room', // 보낸 사람과 방 정보를 함께 가져와야 이름이 뜹니다!
				sort: '-created'
			});
		} catch (err) {
			console.error("초대장 로드 실패:", err);
		}
	}

	// 1. 방 나가기 (멤버 목록에서 나를 제거)
	leaveRoom = async () => {
		if (!confirm("이 방에서 나가시겠습니까?")) return;
		
		const roomIdToLeave = this.activeRoomId; // 나갈 방 ID 임시 저장
		this.isLoadingMore = false;     
		
		try {
			// 1. 퇴장 메시지 먼저 발송 (방 ID가 살아있을 때!)
			await this.sendSystemMessage(`📢 ${pb.authStore.model.name || '유저'}님이 퇴장하셨습니다.`);

			const userId = pb.authStore.model.id;
			const newMembers = this.currentRoom.members.filter(id => id !== userId);
			
			// 2. 서버 업데이트
			await pb.collection("rooms").update(roomIdToLeave, {
				members: newMembers
			});

			// 3. 마지막에 상태 정리
			this.activeRoomId = null; 
			this.messages = [];
			console.log("✅ 퇴장 완료");
		} catch (err) {
			console.error("퇴장 실패", err);
		}
	};

	// 2. 방 폐쇄 (방을 비활성화하거나 삭제)
	closeRoom = async () => {
		if (!this.activeRoomId) return;
		if (!confirm("방을 폐쇄하시겠습니까? 모든 대화 내용이 사라집니다.")) return;

		try {
			// 실제 삭제하거나, 혹은 active 플래그를 false로 바꿉니다.
			// 여기서는 깔끔하게 삭제(Delete)로 가겠습니다.
			await pb.collection("rooms").delete(this.activeRoomId);

			this.activeRoomId = null;
			this.messages = [];
			alert("방이 폐쇄되었습니다.");
		} catch (err) {
			console.error("방 폐쇄 실패:", err);
		}
	}


	messageToKakao = (senderName="", message="") => {
		// 채팅창에서 [#카톡 이름 메시지] 형태로 카톡메시지 보낼 경우를 위해 함수기능 확장함 
		const { Kakao, location } = window;
		
		if (!Kakao || !Kakao.isInitialized()) {
			console.error("카카오 SDK가 초기화되지 않았습니다.");
			return;
		}

		// 인자가 없을 때만 prompt를 띄우고, 변수에 값을 할당함
		let finalUser = senderName;
		let finalMessage = message;
		// 스코프 해결: if 블록 안에서 const로 선언하면 Kakao.Share 부분에서 그 값을 읽지 못하는 문제를 해결했습니다.

		if (!finalUser || !finalMessage) {
			finalUser = prompt("보내는 분의 이름(닉네임)을 적어주세요:") || "Hani Station";
			finalMessage = prompt("전달할 메시지를 입력하세요:") || "초대 메시지";
		}

		Kakao.Share.sendDefault({
			objectType: 'feed',
			content: {
			title: `${finalUser}의 메시지`,
			description: finalMessage,
			imageUrl: 'https://hani.chois.cloud/hani_logo.png', 
			link: {
				mobileWebUrl: location.origin, // hani.chois.cloud 로 연결
				webUrl: location.origin,
			},
			},
			buttons: [
			{
				title: '사이트 방문은 아래 링크로~',
				link: {
				mobileWebUrl: location.origin,
				webUrl: location.origin,
				},
			},
			],
		});
		};
}

export const chatManager = new ChatManager();