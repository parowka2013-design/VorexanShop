let users = JSON.parse(localStorage.getItem("users")) || [];
let user = JSON.parse(localStorage.getItem("user"));
let cart = JSON.parse(localStorage.getItem("cart")) || [];
const cartEl = document.getElementById("cartItems");
const totalEl = document.getElementById("total");

// Logowanie
function login() {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPass").value.trim();
    const status = document.getElementById("authStatus");
    if (!email || !pass) { status.textContent="Uzupełnij dane!"; status.style.color="red"; return; }
    const foundUser = users.find(u => u.email===email && u.password===pass);
    if(foundUser){ user=foundUser; localStorage.setItem("user",JSON.stringify(user)); status.textContent="Zalogowano!"; status.style.color="lime"; setTimeout(()=>location.reload(),800);}
    else { status.textContent="Niepoprawny email lub hasło!"; status.style.color="red";}
}

// Rejestracja
function register() {
    const email = document.getElementById("authEmail").value.trim();
    const pass = document.getElementById("authPass").value.trim();
    const name = document.getElementById("authName").value.trim();
    const status = document.getElementById("authStatus");
    if(!email || !pass || !name){ status.textContent="Uzupełnij wszystkie pola!"; status.style.color="red"; return; }
    if(users.find(u=>u.email===email)){ status.textContent="Konto z tym emailem już istnieje!"; status.style.color="red"; return; }
    const newUser={ email, password:pass, displayName:name };
    users.push(newUser);
    localStorage.setItem("users",JSON.stringify(users));
    user=newUser;
    localStorage.setItem("user",JSON.stringify(user));
    status.textContent="Konto utworzone i zalogowano!"; status.style.color="lime"; setTimeout(()=>location.reload(),800);
}

// Wylogowanie
function logout(){ localStorage.removeItem("user"); user=null; location.reload(); }

// Ukrywanie logowania jeśli zalogowany
window.onload = () => { 
    const authSection=document.getElementById("auth"); 
    if(user) authSection.style.display="none"; else authSection.style.display="block"; 
}

// Koszyk
function toggleCart(){ document.getElementById("cart").classList.toggle("active"); renderCart(); }

function addToCart(name, price){
    if(!user) return alert("Musisz się zalogować, aby dodać do koszyka!");
    cart.push({name,price});
    localStorage.setItem("cart",JSON.stringify(cart));
    alert("Dodano do koszyka");
}

function renderCart(){
    cartEl.innerHTML="";
    let total=0;
    cart.forEach(item => { total+=item.price; cartEl.innerHTML+=`<div class="cart-item">${item.name} – ${item.price} zł</div>`; });
    totalEl.textContent=total;
}

function checkout(){
    if(!user) return alert("Musisz być zalogowany, aby zamówić!");
    const orders = JSON.parse(localStorage.getItem("orders"))||[];
    orders.push({ email:user.email, items:cart, date:new Date().toLocaleString() });
    localStorage.setItem("orders",JSON.stringify(orders));
    localStorage.removeItem("cart");
    cart=[];
    alert("Zamówienie wysłane!");
    toggleCart();
}
