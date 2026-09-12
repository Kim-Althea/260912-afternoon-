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

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyDFNQTOI5xwJlflfy3XpeG0Xx_i108P_30",
  authDomain: "hackathon202609.firebaseapp.com",
  projectId: "hackathon202609",
  storageBucket: "hackathon202609.firebasestorage.app",
  messagingSenderId: "79151396949",
  appId: "1:79151396949:web:f95d92e8851c33fc897cdc"
};

// Firebase 및 Firestore 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


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
// 백엔드 2: 여기에 "누가 썼는지"(uid)를 함께 저장하게 됩니다.
async function addMemo(text) {
  await addDoc(collection(db, "memos"), {
    text: text,
    createdAt: Date.now()
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

  const del = document.createElement("button");
  del.textContent = "×";
  del.addEventListener("click", async function () {
    await deleteMemo(memo.id);
    await render();
  });
  div.appendChild(del);

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

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

    // 규칙에 맞춰 5글자 이상인지 확인합니다
    if (text.length < 5) {
      alert("메모는 5글자 이상 작성해주세요! ✏️");
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

    // 규칙에 맞춰 5글자 이상인지 확인합니다
    if (text.length < 5) {
      alert("메모는 5글자 이상 작성해주세요! ✏️");
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


// 첫 화면 그리기
render();
input.focus();
