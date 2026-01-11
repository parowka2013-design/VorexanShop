// ===== LOGOWANIE SPRZEDAWCY =====
const sellerPasswordKey = "sellerPass";
let sellerLogged = false;
let chats = JSON.parse(localStorage.getItem("chats")) || [];
let currentChatClient = null;

// Jeśli hasło jeszcze nie zapisane w localStorage, ustaw domyślne
if(!localStorage.getItem(sellerPasswordKey)) {
  localStorage.setItem(sellerPasswordKey, "admin123");
}

// ===== FUNKCJE MENU =====
function showSection(section) {
  const sections = document.querySelectorAll(".seller-section");
  sections.forEach(s => s.style.display = "none");

  if(section === "orders") document.getElementById("ordersSection").style.display = "block";
  if(section === "chat") {
    document.getElementById("chatSection").style.display = "block";
    loadClients();
    renderSellerChat();
  }
  if(section === "settings") document.getElementById("settingsSection").style.display = "block";
}

// ===== ZAMÓWIENIA =====
function loadOrders() {
  const orders = JSON.parse(localStorage.getItem("orders")) || [];
  const ordersList = document.getElementById("ordersList");
  ordersList.innerHTML = "";

  orders.forEach(order => {
    const div = document.createElement("div");
    div.className = "card";
    div.style.marginBottom = "10px";

    div.innerHTML = `<b>${order.email}</b> | ${order.date}<br>
                     Produkty: ${order.items.map(i=>i.name).join(", ")}
                     <button onclick="checkClient('${order.email}')">Szczegóły</button>`;
    ordersList.appendChild(div);
  });
}

// Weryfikacja klienta
function checkClient(email) {
  const users = JSON.parse(localStorage.getItem("users")) || [];
  const client = users.find(u => u.email === email);
  if(!client) return alert("Nie znaleziono takiego klienta");
  alert(`Gmail: ${client.email}\nHasło: ${client.pass}`);
}

// ===== CHAT =====
const sellerChatList = document.getElementById("sellerChatList");
const sellerChatWindow = document.getElementById("sellerChatWindow");

function loadClients() {
  const clients = [...new Set(chats.filter(c=>c.to==="sprzedawca").map(c=>c.user))];
  sellerChatList.innerHTML = "";
  clients.forEach(email => {
    let btn = document.createElement("button");
    btn.textContent = email;
    btn.onclick = () => { currentChatClient = email; renderSellerChat(); };
    btn.style.marginRight = "5px";
    sellerChatList.appendChild(btn);
  });
}

function renderSellerChat() {
  sellerChatWindow.innerHTML = "";
  if(!currentChatClient) return;

  const myChats = chats.filter(c =>
    (c.user === currentChatClient && c.to === "sprzedawca") ||
    (c.user === "sprzedawca" && c.to === currentChatClient)
  );

  myChats.forEach(c=>{
    const div = document.createElement("div");
    div.className = "chat-message " + (c.user==="sprzedawca"?"user-msg":"admin-msg");
    const sender = c.user==="sprzedawca"?"Ty":"Klient";
    div.innerHTML = `<b>${sender}:</b> ${c.message}`;
    div.style.opacity = 0;
    div.style.transform = "translateY(20px)";
    sellerChatWindow.appendChild(div);

    setTimeout(()=>{
      div.style.opacity = 1;
      div.style.transform = "translateY(0)";
      div.style.transition = "0.3s";
    }, 50);
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

// ===== USTAWIENIA SPRZEDAWCY =====
function changeSellerPassword() {
  const newPass = document.getElementById("newSellerPass").value.trim();
  if(!newPass) return alert("Wpisz nowe hasło");
  localStorage.setItem(sellerPasswordKey, newPass);
  alert("Hasło sprzedawcy zmienione!");
  document.getElementById("newSellerPass").value = "";
}

// ===== WYLOGOWANIE =====
function logoutSeller() {
  sellerLogged = false;
  location.reload();
}

// Odświeżanie chatów co sekundę
setInterval(()=>{
  chats = JSON.parse(localStorage.getItem("chats")) || [];
  if(document.getElementById("chatSection").style.display === "block") {
    loadClients();
    renderSellerChat();
  }
}, 1000);

// ===== INICJALIZACJA =====
loadOrders();
