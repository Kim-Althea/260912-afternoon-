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

// 현재 로그인한 사용자 정보 (백엔드 2)
let currentUser = null;


// ===================================================
// 데이터를 다루는 함수 세 개 (Firestore 연동)
// ===================================================

// 메모를 읽어 옵니다.
// Firestore의 memos 컬렉션에서 가져오며, 순서는 orderBy("createdAt") 으로 맞춥니다.
async function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt"));
  const querySnapshot = await getDocs(q);
  const memos = [];
  querySnapshot.forEach(function (docSnap) {
    memos.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  return memos;
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid, userName)를 함께 저장합니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("로그인 후 메모를 남길 수 있습니다! 상단의 구글 로그인 버튼을 눌러주세요. 🔒");
    return;
  }

  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now(),
    uid: currentUser.uid,
    userName: currentUser.displayName || "익명"
  });
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
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

  // 백엔드 2: 내가 쓴 메모(또는 작성자 정보가 없는 기존 메모)만 삭제 버튼을 보여줍니다
  if (currentUser && (!memo.uid || currentUser.uid === memo.uid)) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "메모 삭제";
    del.addEventListener("click", async function () {
      if (confirm("이 메모를 삭제하시겠습니까?")) {
        await deleteMemo(memo.id);
        await render();
      }
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 정보가 있으면 하단에 표시
  if (memo.userName) {
    const author = document.createElement("div");
    author.className = "memo-author";
    author.textContent = "✍️ " + memo.userName;
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

    const greeting = document.createElement("span");
    greeting.className = "user-greeting";
    greeting.innerHTML = `👋 <strong>${currentUser.displayName || "선생님/친구"}</strong>님 환영합니다!`;
    wrapper.appendChild(greeting);

    const logoutBtn = document.createElement("button");
    logoutBtn.type = "button";
    logoutBtn.className = "btn-logout";
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", logout);
    wrapper.appendChild(logoutBtn);

    userArea.appendChild(wrapper);
    input.placeholder = "남기고 싶은 메모를 5자 이상 50자 미만으로 적어보세요... (Shift + Enter로 줄바꿈)";
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
    input.placeholder = "🔒 로그인 후 메모를 작성할 수 있습니다 (상단 구글 로그인 클릭)";
  }
}

// 로그인 상태 변화를 실시간으로 감지합니다
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  renderUserArea();
  render();
});

// 첫 화면 그리기
renderUserArea();
render();
input.focus();
