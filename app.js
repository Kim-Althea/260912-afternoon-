// ===================================================
// 우리 반 담벼락
//
// Firebase Firestore와 연동하여 메모를 저장하고 읽어옵니다.
// ===================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  setDoc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDFNQTOI5xwJlflfy3XpeG0Xx_i108P_30",
  authDomain: "hackathon202609.firebaseapp.com",
  projectId: "hackathon202609",
  storageBucket: "hackathon202609.firebasestorage.app",
  messagingSenderId: "79151396949",
  appId: "1:79151396949:web:f95d92e8851c33fc897cdc"
};

// Firebase, Firestore, Auth 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자 정보 및 역할 (백엔드 2: UID 기반 역할 분리)
let currentUser = null;
let currentRole = "STUDENT"; // 기본값은 STUDENT (학생), 교사는 TEACHER

// 교사 관리자 이메일 목록 (전체 관리자 권한 부여)
const TEACHER_EMAILS = [
  "altheakim261@gmail.com"
];

// 교사로 사전 지정할 UID 목록 (필요 시 교사 계정의 UID를 여기에 추가할 수 있습니다)
const TEACHER_UIDS = [];

// 사용자의 역할을 Firestore(/users/{uid})에서 조회하고 동기화합니다
async function syncUserRole(user) {
  if (!user) {
    currentUser = null;
    currentRole = "STUDENT";
    return;
  }

  // 관리자 이메일(altheakim261@gmail.com)인 경우 교사(TEACHER) 권한 자동 부여
  const isTeacherByEmail = user.email && TEACHER_EMAILS.includes(user.email.toLowerCase());

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const data = userSnap.data();
      currentRole = data.role || (isTeacherByEmail ? "TEACHER" : (TEACHER_UIDS.includes(user.uid) ? "TEACHER" : "STUDENT"));
    } else {
      // 신규 사용자인 경우 프로필 문서 생성
      currentRole = isTeacherByEmail ? "TEACHER" : (TEACHER_UIDS.includes(user.uid) ? "TEACHER" : "STUDENT");
      await setDoc(userRef, {
        uid: user.uid,
        userName: user.displayName || "사용자",
        email: user.email || "",
        role: currentRole,
        createdAt: Date.now()
      });
    }
  } catch (error) {
    console.warn("사용자 역할 동기화 중 오류:", error);
    // Firestore 통신 실패 시에도 관리자 이메일이면 즉시 교사 권한 부여
    currentRole = isTeacherByEmail ? "TEACHER" : (TEACHER_UIDS.includes(user.uid) ? "TEACHER" : "STUDENT");
  }
}

// 실습 및 테스트를 위해 교사 ↔ 학생 역할을 전환하는 함수
async function toggleUserRole() {
  if (!currentUser) return;
  const targetRole = currentRole === "TEACHER" ? "STUDENT" : "TEACHER";
  const isTeacherByEmail = currentUser.email && TEACHER_EMAILS.includes(currentUser.email.toLowerCase());

  try {
    const userRef = doc(db, "users", currentUser.uid);
    await setDoc(userRef, {
      uid: currentUser.uid,
      userName: currentUser.displayName || "사용자",
      email: currentUser.email || "",
      role: targetRole,
      updatedAt: Date.now()
    }, { merge: true });

    currentRole = targetRole;
    renderUserArea();
    render();
    alert(`역할이 [${targetRole === "TEACHER" ? "🍎 교사(TEACHER)" : "🌱 학생(STUDENT)"}]로 변경되었습니다!`);
  } catch (error) {
    console.error("역할 변경 실패:", error);
    // 관리자 이메일 계정인 경우, 콘솔에 아직 규칙이 적용되지 않았더라도 로컬에서 바로 교사 역할을 활성화합니다
    if (isTeacherByEmail) {
      currentRole = targetRole;
      renderUserArea();
      render();
      alert(`[알림] 관리자 계정(${currentUser.email})으로 확인되어 [${targetRole === "TEACHER" ? "🍎 교사(전체 관리자)" : "🌱 학생"}] 모드로 전환되었습니다!\n\n💡 Firestore의 영구 저장을 위해 Firebase 콘솔의 Firestore [규칙] 탭에서 최신 규칙을 게시(Publish)해 주세요.`);
    } else {
      alert("역할 변경에 실패했습니다: " + error.message + "\n\n💡 Firebase 콘솔의 Firestore 규칙(Rules) 탭에 최신 보안 규칙을 게시(Publish)했는지 확인해 주세요.");
    }
  }
}


// ===================================================
// 데이터를 다루는 함수 세 개 (Firestore 연동)
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 memos 컬렉션에서 가져오며, 순서는 orderBy("createdAt") 으로 맞춥니다.
// 백엔드 2: 메모를 불러올 때 로그인한 사람의 uid와 글쓴이(userName) 정보도 함께 가져옵니다.
async function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt"));
  const querySnapshot = await getDocs(q);
  const memos = [];
  querySnapshot.forEach(function (docSnap) {
    const data = docSnap.data();
    memos.push({
      id: docSnap.id,
      text: data.text,
      createdAt: data.createdAt,
      uid: data.uid,           // 작성자 uid 가져오기
      userName: data.userName, // 글쓴이(이름) 가져오기
      role: data.role          // 역할(TEACHER 또는 STUDENT) 가져오기
    });
  });
  return memos;
}

// 메모를 새로 씁니다.
// 백엔드 2: 로그인하지 않은 사람은 메모를 아예 쓰지 못하게 막고,
// 메모를 저장할 때 로그인한 사람의 uid와 글쓴이(userName)를 함께 저장합니다.
async function addMemo(text) {
  // 로그인하지 않은 사람은 메모 저장을 차단합니다.
  if (!currentUser) {
    alert("로그인 후 메모를 작성할 수 있습니다! 먼저 상단의 구글 로그인을 진행해 주세요. 🔒");
    return;
  }

  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now(),
    uid: currentUser.uid,                         // 로그인한 사람의 uid
    userName: currentUser.displayName || "익명", // 글쓴이(작성자) 이름
    role: currentRole                             // 교사/학생 역할
  });
}

// 메모를 지웁니다.
// 백엔드 2: 교사는 모든 메모를 지울 수 있고, 학생은 본인이 쓴 메모만 지울 수 있습니다.
async function deleteMemo(id) {
  await deleteDoc(doc(db, "memos", id));
}



// ===================================================
// 화면 그리기
// ===================================================

async function render() {
  const wall = document.getElementById("wall");
  wall.innerHTML = "";

  const memos = await loadMemos();

  // 등록된 메모가 없을 때 친절하고 아기자기한 안내 표시
  if (memos.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-wall";
    empty.innerHTML = "💭 아직 등록된 메모가 없어요.<br>친구들과 나누고 싶은 첫 번째 이야기를 남겨보세요! ✨";
    wall.appendChild(empty);
    return;
  }

  memos.forEach(function (memo) {
    wall.appendChild(makeMemo(memo));
  });
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 삭제 권한 구분 (백엔드 2):
  // 1) 교사(TEACHER): 담벼락의 모든 메모를 삭제할 수 있습니다.
  // 2) 학생(STUDENT): 본인이 작성한 메모(uid 일치)만 삭제할 수 있습니다. 타인의 메모는 삭제 불가!
  const isMyMemo = currentUser && memo.uid && currentUser.uid === memo.uid;
  const isTeacherUser = currentRole === "TEACHER";
  const canDelete = currentUser && (isTeacherUser || isMyMemo);

  if (canDelete) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = isTeacherUser && !isMyMemo ? "교사 권한으로 메모 삭제" : "내 메모 삭제";
    del.addEventListener("click", async function () {
      const confirmMsg = isTeacherUser && !isMyMemo
        ? "교사 권한으로 이 메모를 삭제하시겠습니까?"
        : "이 메모를 삭제하시겠습니까?";
      if (confirm(confirmMsg)) {
        try {
          await deleteMemo(memo.id);
          await render();
        } catch (error) {
          console.error("메모 삭제 실패:", error);
          alert("메모를 삭제하지 못했습니다 (권한 오류): " + error.message);
        }
      }
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 정보 및 역할(교사/학생) 뱃지 표시
  if (memo.userName) {
    const author = document.createElement("div");
    author.className = "memo-author";

    const roleBadge = document.createElement("span");
    const isMemoTeacher = memo.role === "TEACHER";
    roleBadge.className = isMemoTeacher ? "memo-role-teacher" : "memo-role-student";
    roleBadge.textContent = isMemoTeacher ? "🍎 교사" : "🌱 학생";

    author.appendChild(roleBadge);
    author.appendChild(document.createTextNode(" " + memo.userName));
    div.appendChild(author);
  }

  return div;
}



// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    // 로그인하지 않은 사람은 메모 작성을 차단합니다
    if (!currentUser) {
      alert("로그인하지 않은 사용자는 메모를 작성할 수 없습니다! 상단의 구글 로그인을 먼저 진행해 주세요. 🔒");
      return;
    }

    const text = input.value.trim();
    if (text === "") return;

    // 규칙에 맞춰 5글자 이상 50글자 미만인지 확인합니다
    if (text.length < 5) {
      alert("메모는 5글자 이상 작성해주세요! ✏️");
      return;
    }
    if (text.length >= 50) {
      alert("메모는 50글자 미만으로 작성해주세요! (현재 " + text.length + "자) ⚠️");
      return;
    }

    try {
      await addMemo(text);
      input.value = "";
      await render();
    } catch (error) {
      console.error("메모 저장 실패:", error);
      alert("메모를 저장하지 못했습니다 (규칙 위반 또는 권한 오류): " + error.message);
    }
  }
});

// '등록하기' 버튼 클릭 시에도 메모를 추가합니다
const submitBtn = document.getElementById("submitBtn");
if (submitBtn) {
  submitBtn.addEventListener("click", async function () {
    // 로그인하지 않은 사람은 메모 작성을 차단합니다
    if (!currentUser) {
      alert("로그인하지 않은 사용자는 메모를 작성할 수 없습니다! 상단의 구글 로그인을 먼저 진행해 주세요. 🔒");
      return;
    }

    const text = input.value.trim();
    if (text === "") return;

    // 규칙에 맞춰 5글자 이상 50글자 미만인지 확인합니다
    if (text.length < 5) {
      alert("메모는 5글자 이상 작성해주세요! ✏️");
      return;
    }
    if (text.length >= 50) {
      alert("메모는 50글자 미만으로 작성해주세요! (현재 " + text.length + "자) ⚠️");
      return;
    }

    try {
      await addMemo(text);
      input.value = "";
      await render();
    } catch (error) {
      console.error("메모 저장 실패:", error);
      alert("메모를 저장하지 못했습니다 (규칙 위반 또는 권한 오류): " + error.message);
    }
  });
}



// ===================================================
// 구글 로그인 및 사용자 인증 처리 (백엔드 2)
// ===================================================

// 구글 팝업 로그인
async function login() {
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("로그인 실패:", error);
    if (error.code !== "auth/popup-closed-by-user") {
      alert("로그인 중 오류가 발생했습니다: " + error.message);
    }
  }
}

// 로그아웃
async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("로그아웃 실패:", error);
  }
}

// 상단 로그인 영역 화면 그리기
function renderUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;

  userArea.innerHTML = "";

  if (currentUser) {
    const wrapper = document.createElement("div");
    wrapper.className = "user-logged-in";

    const isSuperAdmin = currentUser.email && TEACHER_EMAILS.includes(currentUser.email.toLowerCase());
    const isTeacherUser = currentRole === "TEACHER";
    const roleBadgeHtml = isSuperAdmin && isTeacherUser
      ? `<span class="badge-role badge-teacher">👑 관리자 교사 (TEACHER)</span>`
      : (isTeacherUser
          ? `<span class="badge-role badge-teacher">🍎 교사 (TEACHER)</span>`
          : `<span class="badge-role badge-student">🌱 학생 (STUDENT)</span>`);

    const greeting = document.createElement("div");
    greeting.className = "user-greeting";
    greeting.innerHTML = `👋 <strong>${currentUser.displayName || "선생님/친구"}</strong>님 ${roleBadgeHtml}`;
    wrapper.appendChild(greeting);

    // UID 복사 버튼 (내 UID 확인 및 복사용)
    const uidSpan = document.createElement("span");
    uidSpan.className = "user-uid-pill";
    const shortUid = currentUser.uid.slice(0, 6) + "...";
    uidSpan.innerHTML = `🔑 UID: <code>${shortUid}</code>`;
    uidSpan.title = `전체 UID: ${currentUser.uid}\n(클릭 시 UID가 복사됩니다)`;
    uidSpan.addEventListener("click", () => {
      navigator.clipboard.writeText(currentUser.uid);
      alert(`UID가 복사되었습니다!\n${currentUser.uid}`);
    });
    wrapper.appendChild(uidSpan);

    // 교사 ↔ 학생 역할 전환 버튼 (관리자 교사에게만 실습 테스트용으로 제공)
    if (isSuperAdmin) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "btn-role-toggle";
      toggleBtn.innerHTML = isTeacherUser ? "🌱 학생 모드로 전환" : "🍎 교사 모드로 전환";
      toggleBtn.title = "실습 테스트를 위해 교사와 학생 역할을 변경합니다";
      toggleBtn.addEventListener("click", toggleUserRole);
      wrapper.appendChild(toggleBtn);
    }

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn-logout";
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", logout);
    wrapper.appendChild(logoutBtn);

    userArea.appendChild(wrapper);

    // 로그인한 사용자는 메모 작성 가능 (입력창 활성화)
    input.disabled = false;
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
    }

    // 역할별 안내 문구
    if (isTeacherUser) {
      input.placeholder = "선생님, 남기고 싶은 메모를 적어보세요! (교사는 전체 관리 및 삭제 권한이 있습니다)";
    } else {
      input.placeholder = "남기고 싶은 메모를 5자 이상 50자 미만으로 적어보세요... (Shift + Enter로 줄바꿈)";
    }
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.type = "button";
    loginBtn.className = "btn-google";
    loginBtn.innerHTML = `
      <svg class="google-icon" viewBox="0 0 24 24" width="18" height="18">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
      </svg>
      <span>Google 계정으로 로그인</span>
    `;
    loginBtn.addEventListener("click", login);
    userArea.appendChild(loginBtn);

    // 로그인하지 않은 사람은 메모를 아예 작성할 수 없도록 비활성화합니다
    input.disabled = true;
    input.value = "";
    input.placeholder = "🔒 로그인한 사용자만 메모를 작성할 수 있습니다 (상단 구글 로그인 클릭)";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.style.opacity = "0.5";
      submitBtn.style.cursor = "not-allowed";
    }
  }
}

// 로그인 상태 변화를 실시간으로 감지합니다
onAuthStateChanged(auth, async function (user) {
  currentUser = user;
  await syncUserRole(user);
  renderUserArea();
  render();
});

// 첫 화면 그리기
renderUserArea();
render();
input.focus();

