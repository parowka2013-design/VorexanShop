// ===== FIREBASE =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
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

// ===== SPRAWDZENIE ADMINA =====
onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = "/";
    return;
  }

  if (user.email !== "parowka2013@gmail.com") {
    alert("Brak dostępu");
    window.location.href = "/";
    return;
  }

  // OK – ADMIN
  document.getElementById("adminEmail").innerText = user.email;
});

// ===== WYLOGOWANIE ADMINA =====
window.logoutAdmin = function () {
  signOut(auth).then(() => {
    window.location.href = "/";
  });
};
