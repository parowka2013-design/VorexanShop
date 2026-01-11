import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: "TU_WPISZ_API_KEY",
  authDomain: "TU_WPISZ_AUTH_DOMAIN",
  projectId: "TU_WPISZ_PROJECT_ID",
  storageBucket: "TU_WPISZ_STORAGE_BUCKET",
  messagingSenderId: "TU_WPISZ_MESSAGING_SENDER_ID",
  appId: "TU_WPISZ_APP_ID"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore();

// Koszyk
let cart = [];

// --- FUNKCJE LOGOWANIA / REJESTRACJI ---
async function register() {
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPass").value;
  const name = document.getElementById("authName").value;
  if(!email || !pass || !name) return alert("Wypełnij wszystkie pola");

  const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;

  // Tworzenie dokumentu użytkownika w Firestore
  await addDoc(collection(db, "users"), {
    uid: user.uid,
    displayName: name,
    email,
    role: "user"
  });

  alert("Zarejestrowano pomyślnie!");
}

async function login() {
  const email = document.getElementById("authEmail").value;
  const pass = document.getElementById("authPass").value;
  if(!email || !pass) return alert("Podaj email i hasło");

  const userCredential = await signInWithEmailAndPassword(auth, email, pass);
  const user = userCredential.user;

  // Pobierz dane użytkownika
  const usersSnap = await getDocs(collection(db, "users"));
  let userData = null;
  usersSnap.forEach(u => {
    if(u.data().uid === user.uid) userData = u.data();
  });

  if(!userData) return alert("Błąd logowania");

  if(userData.role === "admin") {
    showAdminPanel();
  } else {
    showUserPanel();
  }
}

// Automatyczne logowanie po odświeżeniu
onAuthStateChanged(auth, async user => {
  if(user) {
    const usersSnap = await getDocs(collection(db, "users"));
    let userData = null;
    usersSnap.forEach(u => {
      if(u.data().uid === user.uid) userData = u.data();
    });

    if(userData.role === "admin") showAdminPanel();
    else showUserPanel();
  } else {
    document.getElementById("auth").style.display = "block";
    document.getElementById("productsSection").style.display = "none";
    document.getElementById("adminSection").style.display = "none";
  }
});

function logout() {
  signOut(auth).then(() => location.reload());
}

// --- FUNKCJE PANEL ADMINA ---
async function showAdminPanel() {
  document.getElementById("auth").style.display = "none";
  document.getElementById("productsSection").style.display = "none";
  document.getElementById("adminSection").style.display = "block";

  const productsSnap = await getDocs(collection(db, "products"));
  const table = document.getElementById("adminProductsTable");
  table.innerHTML = "<tr><th>Nazwa</th><th>Cena</th><th>Zdjęcie</th></tr>";
  productsSnap.forEach(docSnap => {
    const p = docSnap.data();
    table.innerHTML += `
      <tr>
        <td>${p.name}</td>
        <td><input type="number" value="${p.price}" onchange="updatePrice('${docSnap.id}', this.value)"></td>
        <td><img src="${p.image}" width="50"></td>
      </tr>
    `;
  });

  renderOrders();
}

async function updatePrice(productId, newPrice) {
  await updateDoc(doc(db, "products", productId), { price: Number(newPrice) });
  alert("Cena zaktualizowana!");
}

async function renderOrders() {
  const ordersSnap = await getDocs(collection(db, "orders"));
  const table = document.getElementById("adminOrdersTable");
  table.innerHTML = "<tr><th>Data</th><th>Użytkownik</th><th>Produkty</th></tr>";

  ordersSnap.forEach(docSnap => {
    const o = docSnap.data();
    table.innerHTML += `
      <tr>
        <td>${o.date || "-"}</td>
        <td>${o.email || "-"}</td>
        <td>${o.items?.map(i => i.name).join(", ") || "-"}</td>
      </tr>
    `;
  });
}

// --- FUNKCJE UŻYTKOWNIKA / KOSZYK ---
async function showUserPanel() {
  document.getElementById("auth").style.display = "none";
  document.getElementById("productsSection").style.display = "block";
  document.getElementById("adminSection").style.display = "none";

  const productsSnap = await getDocs(collection(db, "products"));
  const container = document.getElementById("productsContainer");
  container.innerHTML = "";
  productsSnap.forEach(docSnap => {
    const p = docSnap.data();
    container.innerHTML += `
      <div class="card">
        <img src="${p.image}" alt="${p.name}">
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <b>${p.price} zł</b>
        <button onclick="addToCart('${p.name}', ${p.price})">Dodaj do koszyka</button>
      </div>
    `;
  });
}

// --- KOSZYK ---
function toggleCart() {
  document.getElementById("cart").classList.toggle("active");
  renderCart();
}

function addToCart(name, price) {
  cart.push({name, price});
  alert("Dodano do koszyka");
  renderCart();
}

function renderCart() {
  const cartEl = document.getElementById("cartItems");
  const totalEl = document.getElementById("total");
  cartEl.innerHTML = "";
  let total = 0;
  cart.forEach(item => {
    total += item.price;
    cartEl.innerHTML += `<div class="cart-item">${item.name} – ${item.price} zł</div>`;
  });
  totalEl.textContent = total;
}

async function checkout() {
  const user = auth.currentUser;
  if(!user) return alert("Zaloguj się, aby zamówić");

  await addDoc(collection(db, "orders"), {
    email: user.email,
    items: cart,
    date: new Date().toLocaleString()
  });
  alert("Zamówienie wysłane!");
  cart = [];
  toggleCart();
}
