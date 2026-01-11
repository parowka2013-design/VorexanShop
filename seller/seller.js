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

<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <title>Panel Sprzedawcy – Zamówienia</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

<h1>📦 Zamówienia</h1>

<div id="ordersList"></div>

<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSV9Pnlqa038C-6RM6kU_-YCP7wSfRxk4",
  authDomain: "vorexanshop.firebaseapp.com",
  projectId: "vorexanshop",
  storageBucket: "vorexanshop.appspot.com",
  messagingSenderId: "902150803176",
  appId: "1:902150803176:web:ca92a610675e671532835d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const ordersContainer = document.getElementById("ordersList");

// Pobieramy zamówienia z Firestore
const ordersRef = collection(db, "orders");
const q = query(ordersRef, orderBy("date", "desc"));

onSnapshot(q, snapshot => {
  ordersContainer.innerHTML = "";
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const div = document.createElement("div");
    div.className = "orderCard";
    
    const items = data.items.map(i => i.name + " (" + i.price + " zł)").join(", ");
    
    div.innerHTML = `
      <b>Email:</b> ${data.email} <br>
      <b>Data:</b> ${new Date(data.date).toLocaleString()} <br>
      <b>Produkty:</b> ${items} <br>
      <label>
        <input type="checkbox" ${data.done ? "checked" : ""} class="doneCheckbox"> Gotowe
      </label>
    `;

    // Obsługa checkboxa
    const checkbox = div.querySelector(".doneCheckbox");
    checkbox.addEventListener("change", async () => {
      await updateDoc(doc(db, "orders", docSnap.id), {
        done: checkbox.checked
      });
    });

    ordersContainer.appendChild(div);
  });
});
</script>

</body>
</html>
