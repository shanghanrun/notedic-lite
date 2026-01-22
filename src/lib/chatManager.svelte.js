import { pb } from "./pb.svelte";

class ChatManager {
    // --- [상태 변수들] ---
    rooms = $state([]);
    activeRoomId = $state(null);
    messages = $state([]);
    newMessage = $state("");
    newRoomTitle = $state("");
    users = $state([]);
    onlineMap = $state({});

	isInitialized = false  // 중복실행으로 인한, 예를 들어  방생성 한꺼번에 여러개 생기는 것 방지

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

		// 🔥 [핵심 추가] 방이 하나라도 있다면 첫 번째 방을 자동으로 클릭한 것처럼 만듦
		// if (this.rooms.length > 0) {
		// 	// loadMessages를 호출하면 activeRoomId가 세팅되고 메시지를 불러옵니다.
		// 	// 멤버가 아니더라도 loadMessages는 activeRoomId를 바꿔주니까 UI에 '입장하기'가 뜹니다.
		// 	this.loadMessages(this.rooms[0].id);
		// }
    }

    createRoom = async ()=> {  
		// input 태그가 있는 값을 바인딩해서 받을 때, this를 this.newRoomTitle이 아닌 input태그로 인식할 수 있으니, 화살표함수를 사용  
        if (!this.newRoomTitle.trim()) return alert("방 제목을 입력하세요!");

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

    inviteUser = async(targetUser)=> {
        if (!this.activeRoomId) return alert("방을 먼저 선택하고 초대하세요.");

        try {
            await pb.collection("messages").create({
                room: this.activeRoomId,
                user: pb.authStore.model.id,
                content: `🔔 [시스템] ${targetUser.name}님을 초대했습니다.`,
                type: 'invitation', //초대 메시지 타입구분
                target_user: targetUser.id
            });
            alert(`${targetUser.name}님을 초대했습니다!`);
        } catch (err) {
            console.error("❌ 초대 메시지 실패:", err);
        }
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

    sendMessage = async()=> {
		// 🛡️ 방이 선택되지 않았거나 내용이 없으면 중단
		if (!this.activeRoomId) return alert("먼저 대화할 방을 선택해주세요.");
		if (!this.newMessage.trim()) return;

        try {
            await pb.collection("messages").create({
                room: this.activeRoomId,
                user: pb.authStore.model.id,
                content: this.newMessage
            });
            this.newMessage = ""; //전송후 입력창 비우기
        } catch (err) {
            console.error("❌ 메시지 전송 실패:", err);
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
			const list = await pb.collection("messages").getList(1, 50, {
				filter: `room = "${roomId}"`,
				sort: 'created',
				expand: 'user',
				requestKey: null // 👈 이게 있어야 중복 요청 거절을 안 당합니다!
			});
			this.messages = list.items;
			
			// 로드 성공 후 구독 시작
			this.subscribeMessages(); 
		} catch (err) {
			if (err.isAbort) return;
			console.error("메시지 로드 에러", err);
		}
	}

	// 1. 메시지 실시간 구독 메서드
	subscribeMessages = async () => {
		// 기존 구독이 있다면 중복 방지를 위해 해제
		await pb.collection("messages").unsubscribe("*");

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

	// 1. 방 나가기 (멤버 목록에서 나를 제거)
	leaveRoom = async () => {
		if (!confirm("이 방에서 나가시겠습니까?")) return;
		
		try {
			const userId = pb.authStore.model.id;
			const newMembers = this.currentRoom.members.filter(id => id !== userId);
			
			// 1. 서버 업데이트
			await pb.collection("rooms").update(this.activeRoomId, {
				members: newMembers
			});

			// 2. [중요] 나간 직후에는 아예 방 선택을 해제해서 유령 UI를 없앱니다.
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
}

export const chatManager = new ChatManager();