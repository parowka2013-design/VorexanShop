let chatMessages = JSON.parse(localStorage.getItem("chatMessages")) || [];
const chatWindow = document.getElementById("chatWindow");

function renderChat() {
  chatWindow.innerHTML = "";
  chatMessages.forEach(m => {
    const div = document.createElement("div");
    div.className = "message " + (m.sender==="Ty"?"client":"seller");
    div.textContent = m.message;
    chatWindow.appendChild(div);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function sendMessage() {
  const input = document.getElementById("chatMessage");
  if(!input.value) return;
  chatMessages.push({sender:"Ty", message:input.value});
  localStorage.setItem("chatMessages", JSON.stringify(chatMessages));
  renderChat();
  input.value="";
}

// Funkcja symulująca wiadomość sprzedawcy
function receiveMessage(msg) {
  chatMessages.push({sender:"Sprzedawca", message:msg});
  localStorage.setItem("chatMessages", JSON.stringify(chatMessages));
  renderChat();
}

// Automatyczne scrollowanie
window.addEventListener("load", renderChat);
