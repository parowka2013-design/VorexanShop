// script.js
// UWAGA: Plik musi być ładowany jako <script type="module" src="script.js"></script>

// Importy modułowe Firebase v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  addDoc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Konfiguracja Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBSV9Pnlqa038C-6RM6kU_-YCP7wSfRxk4",
  authDomain: "vorexanshop.firebaseapp.com",
  projectId: "vorexanshop",
  storageBucket: "vorexanshop.firebasestorage.app",
  messagingSenderId: "902150803176",
  appId: "1:902150803176:web:ca92a610675e671532835d"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ELEMENTY
const authSection = document.getElementById("auth");
const authStatus = document.getElementById("authStatus");
const cartEl = document.getElementById("cartItems");
const totalEl = document.getElementById("total");

// REJESTRACJA
export async function register() {
  const email = document.getElementById("authEmail").value.trim();
  const pass = document.getElementById("authPass").value.trim();
  const name = document.getElementById("authName").value.trim();

  if (!email || !pass || !name) {
    authStatus.textContent = "Uzupełnij wszystkie pola!";
    authStatus.style.color = "red";
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
    const uid = userCredential.user.uid;
    await setDoc(doc(db, "users", uid), { displayName: name, email });
    authStatus.textContent = "Konto utworzone!";
    authStatus.style.color = "lime";
    location.reload();
  } catch(err) {
    authStatus.textContent = err.message;
    authStatus.style.color = "red";
  }
}

// LOGOWANIE
export async function login() {
  const email = document.getElementById("authEmail").value.trim();
  const pass = document.getElementById("authPass").value.trim();

  if (!email || !pass) {
    authStatus.textContent = "Uzupełnij dane!";
    authStatus.style.color = "red";
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    authStatus.textContent = "Zalogowano!";
    authStatus.style.color = "lime";
    location.reload();
  } catch(err) {
    authStatus.textContent = err.message;
    authStatus.style.color = "red";
  }
}

// WYLOGOWANIE
export function logout() {
  signOut(auth).then(() => location.reload());
}

// OBSERWOWANIE STANU ZALOGOWANIA
onAuthStateChanged(auth, user => {
  if(user) {
    if(authSection) authSection.style.display = "none";
    renderCart();
  } else {
    if(authSection) authSection.style.display = "block";
    if(cartEl) cartEl.innerHTML = "";
    if(totalEl) totalEl.textContent = "0";
  }
});

// KOSZYK
export async function addToCart(name, price) {
  const user = auth.currentUser;
  if(!user) return alert("Musisz się zalogować, aby dodać do koszyka!");

  const cartRef = doc(db, "carts", user.uid);
  const cartSnap = await getDoc(cartRef);

  let cart = cartSnap.exists() ? cartSnap.data().items : [];
  cart.push({ name, price });
  await setDoc(cartRef, { items: cart });
  alert("Dodano do koszyka!");
  renderCart();
}

// WYŚWIETLANIE KOSZYKA
export async function renderCart() {
  const user = auth.currentUser;
  if(!user) return;

  const cartRef = doc(db, "carts", user.uid);
  const cartSnap = await getDoc(cartRef);

  let cart = cartSnap.exists() ? cartSnap.data().items : [];
  let total = 0;
  cartEl.innerHTML = "";
  cart.forEach(item => {
    total += item.price;
    cartEl.innerHTML += `<div class="cart-item">${item.name} – ${item.price} zł</div>`;
  });
  totalEl.textContent = total;
}

// ZAMÓWIENIE
export async function checkout() {
  const user = auth.currentUser;
  if(!user) return alert("Musisz być zalogowany, aby zamówić!");

  const cartRef = doc(db, "carts", user.uid);
  const cartSnap = await getDoc(cartRef);

  if(!cartSnap.exists() || cartSnap.data().items.length === 0) return alert("Koszyk jest pusty!");

  await addDoc(collection(db, "orders"), {
    userId: user.uid,
    items: cartSnap.data().items,
    date: new Date()
  });

  await setDoc(cartRef, { items: [] }); // wyczyszczenie koszyka
  alert("Zamówienie wysłane!");
  renderCart();
}
