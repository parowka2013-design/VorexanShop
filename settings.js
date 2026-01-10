let user = JSON.parse(localStorage.getItem("user"));
if(!user){ alert("Musisz być zalogowany aby otworzyć ustawienia!"); window.location.href="index.html"; }

document.getElementById("emailInput").value = user.email || "";
document.getElementById("displayNameInput").value = user.displayName || "";

let users = JSON.parse(localStorage.getItem("users")) || [];

function goBack(){ window.location.href="index.html"; }

function logout(){
    localStorage.removeItem("user");
    alert("Wylogowano!");
    window.location.href="index.html";
}

function saveSettings(){
    const email = document.getElementById("emailInput").value.trim();
    const displayName = document.getElementById("displayNameInput").value.trim();
    const password = document.getElementById("passwordInput").value;
    const passwordConfirm = document.getElementById("passwordConfirmInput").value;
    const statusMsg = document.getElementById("statusMsg");

    if(!email || !displayName){ statusMsg.textContent="Email i nazwa konta są wymagane!"; statusMsg.style.color="red"; return; }

    if(password || passwordConfirm){
        if(password!==passwordConfirm){ statusMsg.textContent="Hasła nie pasują!"; statusMsg.style.color="red"; return; }
        else user.password=password;
    }

    const otherUser = users.find(u=>u.email===email && u.email!==user.email);
    if(otherUser){ statusMsg.textContent="Email już zajęty!"; statusMsg.style.color="red"; return; }

    // Aktualizacja danych
    user.email=email;
    user.displayName=displayName;

    const idx = users.findIndex(u => u.email===user.email);
    if(idx!==-1) users[idx]=user; else users.push(user);

    localStorage.setItem("users",JSON.stringify(users));
    localStorage.setItem("user",JSON.stringify(user));

    statusMsg.textContent="Ustawienia zapisane!";
    statusMsg.style.color="lime";
}
