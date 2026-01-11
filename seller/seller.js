import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "TWOJ_API_KEY",
  authDomain: "vorexanshop.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginBox = document.getElementById("loginBox");
const panel = document.getElementById("panel");

window.login = async () => {
  await signInWithEmailAndPassword(
    auth,
    email.value,
    password.value
  );
};

onAuthStateChanged(auth, user => {
  if (user) {
    loginBox.style.display = "none";
    panel.style.display = "block";
  }
});
