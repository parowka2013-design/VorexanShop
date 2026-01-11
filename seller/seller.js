// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 config
const firebaseConfig = {
  apiKey: "AIzaSyBSV9Pnlqa038C-6RM6kU_-YCP7wSfRxk4",
  authDomain: "vorexanshop.firebaseapp.com",
  projectId: "vorexanshop",
  storageBucket: "vorexanshop.appspot.com",
  messagingSenderId: "902150803176",
  appId: "1:902150803176:web:ca92a610675e671532835d"
};

// init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ADMIN EMAIL
const ADMIN_EMAIL = "parowka2013@gmail.com";

let activeChat = null;

// zabezpieczenie admina
onAuthStateChanged(auth, user => {
  if (!user || user.email !== ADMIN_EMAIL) {
    window.location.href = "/";
  } else {
    loadChatList();
  }
});

// lista chatów
async function loadChatList() {
  const chats = await getDocs(collection(db, "chats"));
  const list = document.getElementById("chatList");
  list.innerHTML = "";

  chats.forEach(doc => {
    const btn = document.createElement("button");
    btn.innerText = doc.id;
    btn.onclick = () => openChat(doc.id);
    list.appendChild(btn);
  });
}

// otwieranie chatu
function openChat(email) {
  activeChat = email;
  document.getElementById("adminChat").style.display = "flex";
  document.getElementById("chatTitle").innerText = email;

  const q = query(
    collection(db, "chats", email, "messages"),
    orderBy("time")
  );

  onSnapshot(q, snap => {
    const box = document.getElementById("adminMessages");
    box.innerHTML = "";

    snap.forEach(doc => {
      const d = doc.data();
      const div = document.createElement("div");
      div.className = "msg " + d.sender;
      div.innerText = d.text;
      box.appendChild(div);
    });

    box.scrollTop = box.scrollHeight;
  });
}

// wysyłanie admin
window.sendAdminMsg = async function () {
  const input = document.getElementById("adminMsg");
  if (!input.value || !activeChat) return;

  await addDoc(
    collection(db, "chats", activeChat, "messages"),
    {
      text: input.value,
      sender: "admin",
      time: Date.now()
    }
  );

  input.value = "";
};
