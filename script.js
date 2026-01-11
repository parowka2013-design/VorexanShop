// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 konfiguracja
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

// ===== CHAT KLIENT =====
let userEmail = null;

// sprawdzanie logowania
onAuthStateChanged(auth, user => {
  if (user) {
    userEmail = user.email;
    document.getElementById("chatBox").style.display = "flex";
    loadMessages();
  }
});

// wczytywanie wiadomości
function loadMessages() {
  const q = query(
    collection(db, "chats", userEmail, "messages"),
    orderBy("time")
  );

  onSnapshot(q, snap => {
    const box = document.getElementById("messages");
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

// wysyłanie wiadomości
window.sendMsg = async function () {
  const input = document.getElementById("msgInput");
  if (!input.value) return;

  await addDoc(
    collection(db, "chats", userEmail, "messages"),
    {
      text: input.value,
      sender: "user",
      time: Date.now()
    }
  );

  input.value = "";
};
