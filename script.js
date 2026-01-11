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
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "TWOJ_API_KEY",
  authDomain: "vorexanshop.firebaseapp.com",
  projectId: "vorexanshop"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const chatBox = document.getElementById("chatBox");
const chatMessages = document.getElementById("chatMessages");

window.toggleChat = () => chatBox.classList.toggle("hidden");

document.getElementById("chatToggle").onclick = toggleChat;

let currentUser = null;

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    loadMessages();
  } else {
    document.getElementById("chatToggle").style.display = "none";
  }
});

function loadMessages() {
  const q = query(collection(db, "chat"), orderBy("time"));
  onSnapshot(q, snap => {
    chatMessages.innerHTML = "";
    snap.forEach(doc => {
      const d = doc.data();
      const div = document.createElement("div");
      div.className = "message " + d.role;
      div.textContent = d.text;
      chatMessages.appendChild(div);
    });
  });
}

window.sendMessage = async () => {
  const input = document.getElementById("chatInput");
  if (!input.value.trim()) return;

  await addDoc(collection(db, "chat"), {
    text: input.value,
    role: "user",
    uid: currentUser.uid,
    time: serverTimestamp()
  });

  input.value = "";
};
// Weryfikacja źródła webhooka
app.post('/webhook', express.raw({type: 'application/json'}), 
  (req, res) => {
    const sig = req.headers['stripe-signature']
    
    let event
    try {
      event = stripe.webhooks.constructEvent(
        req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
      )
    } catch (err) {
      return res.status(400).send(`Webhook Error: ${err.message}`)
    }
    
    // Obsługa eventu
    res.json({received: true})
})

