import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  orderBy,
  query,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* 🔧 FIREBASE CONFIG */
const firebaseConfig = {
  apiKey: "TWOJ_API_KEY",
  authDomain: "vorexanshop.firebaseapp.com",
  projectId: "vorexanshop"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ELEMENTY */
const loginView = document.getElementById("loginView");
const panelView = document.getElementById("panelView");
const ordersList = document.getElementById("ordersList");
const chatMessages = document.getElementById("chatMessages");

/* LOGOWANIE */
window.login = async () => {
  try {
    await signInWithEmailAndPassword(
      auth,
      email.value,
      password.value
    );
  } catch {
    loginError.textContent = "Błędne dane logowania";
  }
};

window.logout = () => signOut(auth);

/* AUTH */
onAuthStateChanged(auth, user => {
  if (user) {
    loginView.classList.add("hidden");
    panelView.classList.remove("hidden");
    loadOrders();
    loadChat();
  } else {
    loginView.classList.remove("hidden");
    panelView.classList.add("hidden");
  }
});

/* SEKCJE */
window.showSection = (name) => {
  ordersSection.classList.add("hidden");
  chatSection.classList.add("hidden");

  if (name === "orders") ordersSection.classList.remove("hidden");
  if (name === "chat") chatSection.classList.remove("hidden");
};

/* ZAMÓWIENIA */
function loadOrders() {
  onSnapshot(collection(db, "orders"), snap => {
    ordersList.innerHTML = "";

    snap.forEach(d => {
      const o = d.data();
      const div = document.createElement("div");
      div.className = "order" + (o.done ? " done" : "");

      div.innerHTML = `
        <b>${o.email}</b><br>
        ${o.items?.join(", ") || "Brak danych"}<br><br>
        <label>
          <input type="checkbox" ${o.done ? "checked" : ""}>
          Zlecenie gotowe
        </label>
      `;

      div.querySelector("input").onchange = e => {
        updateDoc(doc(db, "orders", d.id), {
          done: e.target.checked
        });
      };

      ordersList.appendChild(div);
    });
  });
}

/* CHAT */
function loadChat() {
  const q = query(collection(db, "chat"), orderBy("time"));
  onSnapshot(q, snap => {
    chatMessages.innerHTML = "";
    snap.forEach(d => {
      const m = d.data();
      const div = document.createElement("div");
      div.className = "msg admin";
      div.textContent = m.text;
      chatMessages.appendChild(div);
    });
  });
}

window.sendMessage = async () => {
  if (!chatInput.value.trim()) return;

  await addDoc(collection(db, "chat"), {
    text: chatInput.value,
    role: "admin",
    time: serverTimestamp()
  });

  chatInput.value = "";
};
