import PocketBase from 'pocketbase';
import mammoth from 'mammoth';
import { PUBLIC_PB_URL } from '$env/static/public';

export const pb = new PocketBase(PUBLIC_PB_URL);

/**
 * 1. 전역 상태 (Svelte 5 Proxy State)
 */
export const researchState = $state({
    allFiles: [],           // 선택된 컬렉션의 파싱된 파일들
    availableCollections: [], // 서버에서 자동 탐색된 컬렉션 목록
    currentCollection: '',  // 현재 선택된 컬렉션 명
    isLoading: false,
    lastSynced: null,
    isAdmin: false          // 로그인 상태 확인
});

/**
 * 2. 연구 자료 액션 (Auth + Auto-Discovery + CRUD)
 */
export const researchActions = {
    // [AUTH] 관리자 로그인 수정본
    async login() {
        try {
            // 1. 기존 토큰 삭제 (깨끗한 상태에서 시작)
            pb.authStore.clear();

            // 2. 관리자(Admin) 계정으로 로그인 시도
            // 만약 'users' 컬렉션의 일반 유저라면 authWithPassword가 맞지만,
            // 시스템 컬렉션 목록을 보려면 pb.admins.authWithPassword를 써야 할 수도 있습니다.
            
            // 일반 유저 계정이 '관리자 권한'을 가지고 있는 경우:
            // const authData = await pb.admins.authWithPassword('idim7@naver.com', 'iioo789456');
            // SDK의 자동 경로 대신 직접 관리자 인증 엔드포인트로 쏩니다.
            const authData = await pb.send("/api/admins/auth-with-password", {
                method: "POST",
                body: {
                    identity: "idim7@naver.com", //
                    password: "iioo789456" 
                },
            });

            // 받아온 데이터를 authStore에 수동으로 저장하여 인증 상태를 유지합니다.
            pb.authStore.save(authData.token, authData.admin);
            
            // 3. 토큰이 제대로 들어왔는지 확인
            if (pb.authStore.isValid) {
                // console.log("🔓 로그인 성공! 토큰 유효함");
                researchState.isAdmin = true;
                
                // 4. 약간의 지연을 주어 토큰이 헤더에 완전히 안착하게 한 뒤 목록 호출
                setTimeout(async () => {
                    await this.loadCollections();
                }, 100); 
            }
        } catch (err) {
            console.error("❌ 로그인 실패:", err);
            researchState.isAdmin = false;
        }
    },

    // [DISCOVERY] 컬렉션 목록 탐색
    async loadCollections() {
        try {
            // 5. 요청 시점에 토큰이 있는지 다시 한번 체크
            if (!pb.authStore.isValid) {
                console.warn("⚠️ 유효한 인증 토큰이 없습니다. 다시 로그인합니다.");
                return;
            }

            const collections = await pb.collections.getFullList();
            const filtered = collections
                .filter(col => col.type === 'base')
                .map(col => col.name);

            researchState.availableCollections = filtered;
            
            if (filtered.length > 0) {
                researchState.currentCollection = filtered.includes('hani') ? 'hani' : filtered[0];
            }
        } catch (err) {
            // 6. 여기서 401이 뜬다면 포켓베이스 설정에서 'Admin' 계정으로 로그인해야 함을 의미합니다.
            console.error("❌ 컬렉션 목록 탐색 실패:", err);
        }
    },

    // [READ] 선택된 컬렉션의 모든 파일 로드 및 파싱
    async fetchAllFromCollection(collectionName) {
        const target = collectionName || researchState.currentCollection;
        if (!target) return;

        researchState.isLoading = true;
        researchState.currentCollection = target;

        try {
            const records = await pb.collection(target).getFullList({
                sort: '-created',
            });

            const parsedFiles = await Promise.all(records.map(async (record) => {
                const fileUrl = pb.files.getURL(record, record.file);
                const response = await fetch(fileUrl);
                const blob = await response.blob();
                
                let lines = [];
                // record.type 필드나 확장자로 docx 판별
                if (record.type === 'docx' || record.filename?.endsWith('.docx')) {
                    const arrayBuffer = await blob.arrayBuffer();
                    const result = await mammoth.extractRawText({ arrayBuffer });
                    lines = result.value.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
                } else {
                    const text = await blob.text();
                    lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
                }

                return {
                    ...record,
                    lines: lines,
                    collectionName: target // 출처 기록
                };
            }));

            researchState.allFiles = parsedFiles;
            researchState.lastSynced = new Date();
            // console.log(`📚 [${target}] 로드 완료: ${parsedFiles.length}개 파일`);
        } catch (err) {
            console.error("❌ 데이터 로드 실패:", err);
        } finally {
            researchState.isLoading = false;
        }
    },

    // [CREATE] 새로운 연구 파일 추가
    async uploadFile(formData) {
        try {
            const record = await pb.collection(researchState.currentCollection).create(formData);
            await this.init(); // 목록 갱신
            return record;
        } catch (err) {
            console.error("❌ 업로드 실패:", err);
            throw err;
        }
    },

    // [UPDATE] 정보(info) 수정
    async updateFileInfo(id, updatedData) {
        try {
            const record = await pb.collection(researchState.currentCollection).update(id, updatedData);
            researchState.allFiles = researchState.allFiles.map(f => 
                f.id === id ? { ...f, ...record } : f
            );
            return record;
        } catch (err) {
            console.error("❌ 수정 실패:", err);
            throw err;
        }
    },

    // [DELETE] 파일 삭제
    async deleteFile(id) {
        if (!confirm("이 자료를 서버에서 영구 삭제하시겠습니까?")) return;
            try {
                await pb.collection(researchState.currentCollection).delete(id);
                researchState.allFiles = researchState.allFiles.filter(f => f.id !== id);
            } catch (err) {
                console.error("❌ 삭제 실패:", err);
            }
    },

    
};

// 관리자 비밀번호 확인 함수
export function verifyAdmin() {
    const password = prompt("관리자 비밀번호를 입력하세요:");
    if (password === "741852") {
        return true;
    } else {
        alert("비밀번호가 올바르지 않습니다.");
        return false;
    }
}

