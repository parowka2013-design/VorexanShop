// ====== LOGOWANIE SPRZEDAWCY ======
const sellerPassword = "admin123"; // hasło sprzedawcy
let sellerLogged = false;
let currentChatClient = null;

function loginSeller() {
  const pass = document.getElementById("sellerPass").value.trim();
  if(pass !== sellerPassword) return alert("Złe hasło!");

  sellerLogged = true;
  document.getElementById("sellerLogin").style.display = "none";
  document.getElementById("sellerPanel").style.display = "block";

  loadOrders();
  loadClients();
}

// Wylogowanie sprzedawcy
function logoutSeller() {
  sellerLogged = false;
  location.reload();
}

// ====== ZAMÓWIENIA ======
function loadOrders() {
  const orders = JSON.parse(localStorage.getItem("orders")) || [];
  const ordersList = document.getElementById("ordersList");
  ordersList.innerHTML = "";

  orders.forEach((order, index) => {
    let div = document.createElement("div");
    div.className = "card";
    div.style.marginBottom = "10px";

    div.innerHTML = `<b>${order.email}</b> | ${order.date}<br>
                     Produkty: ${order.items.map(i=>i.name).join(", ")}
                     <button onclick="checkClient('${order.email}')">Szczegóły</button>`;
    ordersList.appendChild(div);
  });
}

// ====== WERYFIKACJA KLIENTA ======
function checkClient(email) {
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const client = users.find(u => u.email === email);
  if(!client) return alert("Nie znaleziono takiego klienta");
  alert(`Gmail: ${client.email}\nHasło: ${client.pass}`);
}

// ====== CHAT ======
let chats = JSON.parse(localStorage.getItem("chats")) || [];
const sellerChatList = document.getElementById("sellerChatList");
const sellerChatWindow = document.getElementById("sellerChatWindow");

function loadClients() {
  // lista klientów którzy pisali do sprzedawcy
  const clients = [...new Set(chats.filter(c=>c.to==="sprzedawca").map(c=>c.user))];
  sellerChatList.innerHTML = "";
  clients.forEach(email=>{
    let btn = document.createElement("button");
    btn.textContent = email;
    btn.onclick = ()=>openChat(email);
    btn.style.marginRight = "5px";
    sellerChatList.appendChild(btn);
  });
}

function openChat(email) {
  currentChatClient = email;
  renderSellerChat();
}

function renderSellerChat() {
  sellerChatWindow.innerHTML = "";
  if(!currentChatClient) return;

  const myChats = chats.filter(c =>
    (c.user === currentChatClient && c.to === "sprzedawca") ||
    (c.user === "sprzedawca" && c.to === currentChatClient)
  );

  myChats.forEach(c=>{
    let div = document.createElement("div");
    div.className = "chat-message " + (c.user==="sprzedawca"?"user-msg":"admin-msg");
    let sender = c.user==="sprzedawca"?"Ty":"Klient";
    div.innerHTML = `<b>${sender}:</b> ${c.message}`;
    sellerChatWindow.appendChild(div);

    setTimeout(()=>{
      div.style.opacity=1;
      div.style.transform="translateY(0)";
    },50);
  });

  sellerChatWindow.scrollTop = sellerChatWindow.scrollHeight;
}

function sendSellerMessage() {
  const msgInput = document.getElementById("sellerChatMessage");
  const msg = msgInput.value.trim();
  if(!msg || !currentChatClient) return;
  chats.push({
    user:"sprzedawca",
    to: currentChatClient,
    message: msg,
    date: new Date().toLocaleString()
  });
  localStorage.setItem("chats", JSON.stringify(chats));
  msgInput.value = "";
  renderSellerChat();
}

// odświeżanie listy chatów co sekundę
setInterval(()=>{
  chats = JSON.parse(localStorage.getItem("chats")) || [];
  if(sellerLogged) {
    loadClients();
    renderSellerChat();
  }
},1000);
