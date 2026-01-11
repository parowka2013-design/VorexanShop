// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBSV9Pnlqa038C-6RM6kU_-YCP7wSfRxk4",
  authDomain: "vorexanshop.firebaseapp.com",
  projectId: "vorexanshop",
  storageBucket: "vorexanshop.firebasestorage.app",
  messagingSenderId: "902150803176",
  appId: "1:902150803176:web:ca92a610675e671532835d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// ===== ELEMENTY =====
const loginBox = document.getElementById("loginBox");
const accountBox = document.getElementById("accountBox");
const adminBtn = document.getElementById("adminPanelBtn");

// ===== LOGOWANIE =====
window.loginUser = function () {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      alert("Zalogowano");
    })
    .catch(err => {
      alert("Błąd logowania: " + err.message);
    });
};

// ===== WYLOGOWANIE =====
window.logoutUser = function () {
  signOut(auth).then(() => {
    location.reload();
  });
};

// ===== SPRAWDZANIE STANU =====
onAuthStateChanged(auth, user => {
  if (user) {
    loginBox.style.display = "none";
    accountBox.style.display = "flex";

    document.getElementById("accountName").innerText =
      user.displayName || user.email;

    // ADMIN
    if (user.email === "parowka2013@gmail.com") {
      adminBtn.style.display = "block";
    } else {
      adminBtn.style.display = "none";
    }
  } else {
    loginBox.style.display = "block";
    accountBox.style.display = "none";
    adminBtn.style.display = "none";
  }
});

// ===== PRZEJŚCIE DO PANELU ADMINA =====
window.goToAdmin = function () {
  window.location.href = "/seller/";
};
