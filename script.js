import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const db = getFirestore();
let currentUserEmail = null;

// po zalogowaniu
onAuthStateChanged(auth, user => {
  if (user) {
    currentUserEmail = user.email;
    document.getElementById("chatBox").style.display = "flex";
    loadChat();
  }
});

function loadChat() {
  const q = query(
    collection(db, "chats", currentUserEmail, "messages"),
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
  if (!input.value) return;

  await addDoc(
    collection(db, "chats", currentUserEmail, "messages"),
    {
      text: input.value,
      sender: "user",
      time: Date.now()
    }
  );

  input.value = "";
};
