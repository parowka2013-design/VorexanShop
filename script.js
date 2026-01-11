/* =========================
   FIREBASE – INIT
========================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot
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
const auth = getAuth(app);
const db = getFirestore(app);

/* =========================
   GLOBALNE ZMIENNE
========================= */
let userEmail = null;
let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* =========================
   AUTH – LOGOWANIE
========================= */
onAuthStateChanged(auth, user => {
  if (user) {
    userEmail = user.email;
    document.body.classList.add("logged");
    document.getElementById("chatBox").style.display = "flex";
    loadChat();
  } else {
    userEmail = null;
    document.body.classList.remove("logged");
    document.getElementById("chatBox").style.display = "none";
  }
});

window.login = async function () {
  const email = document.getElementById("loginEmail").value;
  const pass = document.getElementById("loginPass").value;

  if (!email || !pass) return alert("Uzupełnij dane");

  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    alert("Błąd logowania");
  }
};

window.logout = async function () {
  await signOut(auth);
};

/* =========================
   KOSZYK
========================= */
window.addToCart = function (name, price) {
  cart.push({ name, price });
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
};

function renderCart() {
  const el = document.getElementById("cartItems");
  const totalEl = document.getElementById("total");
  el.innerHTML = "";
  let total = 0;

  cart.forEach(item => {
    total += item.price;
    el.innerHTML += `<div>${item.name} – ${item.price} zł</div>`;
  });

  totalEl.innerText = total;
}

renderCart();

/* =========================
   STRIPE CHECKOUT
========================= */
window.checkout = async function () {
  if (!userEmail) {
    alert("Musisz być zalogowany");
    return;
  }

  if (cart.length === 0) {
    alert("Koszyk pusty");
    return;
  }

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userEmail,
      items: cart
    })
  });

  const data = await res.json();
  window.location.href = data.url;
};

/* =========================
   CHAT – KLIENT
========================= */
function loadChat() {
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

window.sendMsg = async function () {
  const input = document.getElementById("msgInput");
  if (!input.value || !userEmail) return;

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
