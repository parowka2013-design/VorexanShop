// ==================== KOSZYK ====================
let cart = JSON.parse(localStorage.getItem('vorexan_cart')) || [];

// Inicjalizacja
document.addEventListener('DOMContentLoaded', function() {
    updateCartUI();
    
    // Koszyk
    document.getElementById('cartIconBtn').addEventListener('click', openCart);
    document.getElementById('cartOverlay').addEventListener('click', closeCart);
    
    // Chat
    document.getElementById('chatToggle').addEventListener('click', toggleChat);
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
    
    // Dodaj obsługę kliknięcia w karty produktów
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('click', function(e) {
            if (!e.target.classList.contains('add-to-cart-btn')) {
                this.style.transform = 'scale(0.98)';
                setTimeout(() => {
                    this.style.transform = '';
                }, 150);
            }
        });
    });
});

// Koszyk funkcje
function openCart() {
    document.getElementById('cartSidebar').classList.add('open');
    document.getElementById('cartOverlay').classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeCart() {
    document.getElementById('cartSidebar').classList.remove('open');
    document.getElementById('cartOverlay').classList.remove('show');
    document.body.style.overflow = '';
}

function addToCart(button) {
    const card = button.closest('.card');
    const product = {
        id: card.dataset.product,
        name: card.dataset.name,
        price: parseFloat(card.dataset.price),
        desc: card.dataset.desc,
        img: card.querySelector('img').src,
        quantity: 1
    };
    
    const existingIndex = cart.findIndex(item => item.id === product.id);
    
    if (existingIndex > -1) {
        cart[existingIndex].quantity++;
    } else {
        cart.push(product);
    }
    
    saveCart();
    updateCartUI();
    showNotification(`Dodano: ${product.name} do koszyka!`);
    
    // Animacja przycisku
    button.innerHTML = '<i class="fas fa-check"></i> Dodano!';
    button.style.background = '#27ae60';
    setTimeout(() => {
        button.innerHTML = '<i class="fas fa-cart-plus"></i> Dodaj do koszyka';
        button.style.background = '';
    }, 1500);
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showNotification('Produkt usunięty z koszyka');
}

function updateQuantity(productId, change) {
    const itemIndex = cart.findIndex(item => item.id === productId);
    
    if (itemIndex > -1) {
        cart[itemIndex].quantity += change;
        
        if (cart[itemIndex].quantity <= 0) {
            cart.splice(itemIndex, 1);
        }
        
        saveCart();
        updateCartUI();
    }
}

function clearCart() {
    if (confirm('Czy na pewno chcesz wyczyścić koszyk?')) {
        cart = [];
        saveCart();
        updateCartUI();
        showNotification('Koszyk wyczyszczony!');
    }
}

function saveCart() {
    localStorage.setItem('vorexan_cart', JSON.stringify(cart));
}

function updateCartUI() {
    const cartCount = document.getElementById('cartCount');
    const cartItemsContainer = document.getElementById('cartItemsContainer');
    const cartTotal = document.getElementById('cartTotal');
    const emptyCartMessage = document.getElementById('emptyCartMessage');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
    
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    cartTotal.textContent = totalPrice.toFixed(2) + ' zł';
    
    cartItemsContainer.innerHTML = '';
    
    if (cart.length === 0) {
        emptyCartMessage.style.display = 'block';
        cartItemsContainer.appendChild(emptyCartMessage);
    } else {
        emptyCartMessage.style.display = 'none';
        
        cart.forEach(item => {
            const cartItem = document.createElement('div');
            cartItem.className = 'cart-item';
            cartItem.innerHTML = `
                <img src="${item.img}" alt="${item.name}" class="cart-item-img">
                <div class="cart-item-info">
                    <h4 class="cart-item-name">${item.name}</h4>
                    <p class="cart-item-desc">${item.desc}</p>
                    <div class="cart-item-price">${(item.price * item.quantity).toFixed(2)} zł</div>
                </div>
                <div class="cart-item-actions">
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', -1)">-</button>
                    <span class="cart-item-quantity">${item.quantity}</span>
                    <button class="quantity-btn" onclick="updateQuantity('${item.id}', 1)">+</button>
                    <button class="remove-item" onclick="removeFromCart('${item.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            cartItemsContainer.appendChild(cartItem);
        });
    }
}

// Przejdź do płatności (Cloudflare Pages)
function goToCheckout() {
    if (cart.length === 0) {
        showNotification('Koszyk jest pusty!');
        return;
    }
    
    // Przygotuj dane dla strony płatności
    const cartData = encodeURIComponent(JSON.stringify(cart));
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Przekieruj do strony płatności
    window.location.href = `/payment?cart=${cartData}&total=${total}`;
    
    // Zamknij koszyk
    closeCart();
}

// ==================== CHAT ====================
function toggleChat() {
    const chatBox = document.getElementById('chatBox');
    chatBox.classList.toggle('show');
}

function sendMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    
    if (message) {
        const chatMessages = document.getElementById('chatMessages');
        const msgDiv = document.createElement('div');
        msgDiv.textContent = 'Ty: ' + message;
        chatMessages.appendChild(msgDiv);
        input.value = '';
        
        // Automatyczna odpowiedź
        setTimeout(() => {
            const responses = [
                'Cześć! Jak mogę Ci pomóc z zakupem?',
                'Dziękuję za wiadomość! Odpowiem najszybciej jak to możliwe.',
                'Potrzebujesz pomocy z wyborem produktu?',
                'Wszystkie produkty są dostarczane natychmiast po płatności!'
            ];
            const botMsg = document.createElement('div');
            botMsg.innerHTML = `<strong>Vorexan:</strong> ${responses[Math.floor(Math.random() * responses.length)]}`;
            botMsg.style.color = '#3498db';
            chatMessages.appendChild(botMsg);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 1000);
        
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// ==================== NOTYFIKACJE ====================
function showNotification(message) {
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ==================== INNE FUNKCJE ====================
function goAccount() {
    showNotification('Panel użytkownika wkrótce dostępny!');
}

function showTerms() {
    alert(`REGULAMIN VOREXAN\n\n1. Produkty są cyfrowe i dostarczane natychmiast po płatności.\n2. Płatności obsługiwane przez Stripe.\n3. Brak możliwości zwrotu produktów cyfrowych.\n4. Wsparcie techniczne dostępne przez Discord.`);
}

function showPrivacy() {
    alert(`POLITYKA PRYWATNOŚCI\n\n1. Nie przechowujemy danych karty płatniczej.\n2. Email używany tylko do wysyłki produktu.\n3. Koszyk zapisany lokalnie w przeglądarce.\n4. Brak śledzenia reklamowego.`);
}
