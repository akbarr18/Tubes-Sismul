import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- PASTE CONFIG FIREBASE ANDA DI SINI ---
const firebaseConfig = {
    apiKey: "AIzaSyB4gEKO89_eJHBx4BtLmDiNrXM53r9Q74c",
    authDomain: "tubes-sismul.firebaseapp.com",
    projectId: "tubes-sismul",
    storageBucket: "tubes-sismul.firebasestorage.app",
    messagingSenderId: "688316647034",
    appId: "1:688316647034:web:c58a60909702b15d2d1dc3",
    measurementId: "G-SW8C9ENGLJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variabel Global
let currentUser = null;
let currentChatPartner = null;
let unsubscribeProducts = null;
let unsubscribeChats = null;
let allProductsData = []; // Menyimpan data produk lokal untuk filter

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('navbar').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'block';
        
        document.getElementById('profileName').innerText = user.displayName || "User";
        document.getElementById('profileEmail').innerText = user.email;
        document.getElementById('profileImg').src = `https://ui-avatars.com/api/?name=${user.displayName || 'U'}&background=bd0a0a&color=fff`;

        listenToProducts();
        navigate('home');
    } else {
        currentUser = null;
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('navbar').style.display = 'none';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// Register
document.getElementById('formRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const pass = document.getElementById('regPass').value;
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(userCredential.user, { displayName: name });
        Swal.fire('Sukses', 'Akun dibuat!', 'success');
        document.getElementById('formRegister').reset();
    } catch (err) { Swal.fire('Error', err.message, 'error'); }
});

// Login
document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
        await signInWithEmailAndPassword(auth, document.getElementById('loginEmail').value, document.getElementById('loginPass').value);
        Swal.fire({ icon: 'success', title: 'Login Berhasil', timer: 1500, showConfirmButton: false });
    } catch (err) { Swal.fire('Gagal', 'Email/Password salah', 'error'); }
});

// Logout
const handleLogout = () => {
    Swal.fire({ title: 'Logout?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya' }).then(async (res) => {
        if(res.isConfirmed) await signOut(auth);
    });
};
document.getElementById('btnLogout').addEventListener('click', handleLogout);
document.getElementById('btnLogoutProfile').addEventListener('click', handleLogout);

// Toggle UI Auth
document.getElementById('linkToRegister').onclick = () => { document.getElementById('loginBox').classList.add('hidden'); document.getElementById('registerBox').classList.remove('hidden'); };
document.getElementById('linkToLogin').onclick = () => { document.getElementById('registerBox').classList.add('hidden'); document.getElementById('loginBox').classList.remove('hidden'); };


// --- PRODUK & FILTER ---

function listenToProducts() {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    unsubscribeProducts = onSnapshot(q, (snapshot) => {
        allProductsData = [];
        snapshot.forEach((doc) => allProductsData.push({ id: doc.id, ...doc.data() }));
        
        renderProducts(); // Render saat data berubah
        renderMyProducts();
    });
}

function renderProducts() {
    const container = document.getElementById('productContainer');
    const searchVal = document.getElementById('searchInput').value.toLowerCase();
    const catVal = document.getElementById('categoryFilter').value;
    
    container.innerHTML = '';

    // LOGIKA FILTER UTAMA
    const filtered = allProductsData.filter(p => {
        const matchName = p.title.toLowerCase().includes(searchVal);
        const matchCat = catVal === 'all' || p.category === catVal;
        return matchName && matchCat;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<p style="text-align:center; width:100%">Tidak ditemukan.</p>';
        return;
    }

    filtered.forEach(item => {
        const isMine = currentUser && item.sellerEmail === currentUser.email;
        const btnAction = isMine 
            ? `<button class="btn-card disabled">Milik Anda</button>` 
            : `<button class="btn-card chat-btn" data-email="${item.sellerEmail}" data-name="${item.sellerName}"><i class="fas fa-comment"></i> Chat</button>`;

        container.innerHTML += `
            <div class="card">
                <div class="card-img"><img src="${item.image}" alt="img"></div>
                <div class="card-body">
                    <span class="category-badge">${item.category}</span>
                    <h4 class="card-title">${item.title}</h4>
                    <div class="card-price">Rp ${item.price.toLocaleString()}</div>
                    <div class="seller-info"><i class="fas fa-user"></i> ${item.sellerName}</div>
                    ${btnAction}
                </div>
            </div>`;
    });

    document.querySelectorAll('.chat-btn').forEach(btn => {
        btn.addEventListener('click', () => startChat(btn.dataset.email, btn.dataset.name));
    });
}

// Event Listener Search & Filter (PENTING)
document.getElementById('searchInput').addEventListener('keyup', renderProducts);
document.getElementById('categoryFilter').addEventListener('change', renderProducts);

function renderMyProducts() {
    const container = document.getElementById('myProductContainer');
    container.innerHTML = '';
    const myItems = allProductsData.filter(p => p.sellerEmail === currentUser.email);

    if (myItems.length === 0) { container.innerHTML = '<p>Belum ada iklan.</p>'; return; }

    myItems.forEach(item => {
        container.innerHTML += `
            <div class="card">
                <div class="card-img"><img src="${item.image}" alt="img"></div>
                <div class="card-body">
                    <h4>${item.title}</h4>
                    <div class="card-price">Rp ${item.price.toLocaleString()}</div>
                    <button class="btn-card btn-danger delete-btn" data-id="${item.id}">Hapus</button>
                </div>
            </div>`;
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            Swal.fire({ title: 'Hapus?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya' }).then(async (res) => {
                if(res.isConfirmed) {
                    await deleteDoc(doc(db, "products", btn.dataset.id));
                    Swal.fire('Terhapus', '', 'success');
                }
            });
        });
    });
}

// Add Product
document.getElementById('formAddProduct').addEventListener('submit', (e) => {
    e.preventDefault();
    const file = document.getElementById('prodImg').files[0];
    if(!file) return Swal.fire('Error', 'Foto wajib diisi', 'warning');

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            await addDoc(collection(db, "products"), {
                title: document.getElementById('prodTitle').value,
                category: document.getElementById('prodCat').value,
                price: parseInt(document.getElementById('prodPrice').value),
                image: evt.target.result,
                sellerName: currentUser.displayName,
                sellerEmail: currentUser.email,
                createdAt: Date.now()
            });
            Swal.fire('Berhasil', 'Iklan tayang!', 'success');
            document.getElementById('formAddProduct').reset();
            navigate('home');
        } catch(err) { Swal.fire('Error', 'Gagal upload', 'error'); }
    };
    reader.readAsDataURL(file);
});

// --- CHAT ---
function startChat(email, name) {
    currentChatPartner = email;
    document.getElementById('chatHeaderName').innerText = name;
    navigate('chat');
    listenToChats();
}

function listenToChats() {
    if (unsubscribeChats) unsubscribeChats();
    const q = query(collection(db, "chats"), orderBy("timestamp", "asc"));
    
    unsubscribeChats = onSnapshot(q, (snapshot) => {
        const body = document.getElementById('chatBody');
        const list = document.getElementById('chatList');
        body.innerHTML = '';
        list.innerHTML = '';
        
        let allMsgs = [], partners = new Set();
        snapshot.forEach(doc => {
            const d = doc.data();
            if (d.sender === currentUser.email || d.receiver === currentUser.email) {
                allMsgs.push(d);
                partners.add(d.sender === currentUser.email ? d.receiver : d.sender);
            }
        });

        partners.forEach(email => {
            const active = email === currentChatPartner ? 'active' : '';
            list.innerHTML += `<div class="chat-contact ${active}" onclick="openChatFromSidebar('${email}')"><div class="avatar"><i class="fas fa-user"></i></div><div class="info"><h4>${email}</h4></div></div>`;
        });

        if (currentChatPartner) {
            const msgs = allMsgs.filter(m => (m.sender === currentUser.email && m.receiver === currentChatPartner) || (m.sender === currentChatPartner && m.receiver === currentUser.email));
            msgs.forEach(m => {
                const type = m.sender === currentUser.email ? 'outgoing' : 'incoming';
                body.innerHTML += `<div class="msg ${type}">${m.text}</div>`;
            });
            body.scrollTop = body.scrollHeight;
        }
    });
}

window.openChatFromSidebar = (email) => startChat(email, email);

document.getElementById('btnSendMsg').addEventListener('click', async () => {
    const txt = document.getElementById('msgInput').value;
    if(txt && currentChatPartner) {
        await addDoc(collection(db, "chats"), { text: txt, sender: currentUser.email, receiver: currentChatPartner, timestamp: Date.now() });
        document.getElementById('msgInput').value = '';
    }
});

// --- NAVIGASI ---
window.navigate = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    
    if(viewId === 'home') document.getElementById('navHome').classList.add('active');
    if(viewId === 'sell') document.getElementById('navSell').classList.add('active');
    if(viewId === 'chat') { document.getElementById('navChat').classList.add('active'); listenToChats(); }
    if(viewId === 'profile') document.getElementById('navProfile').classList.add('active');
};

document.getElementById('navHome').onclick = () => navigate('home');
document.getElementById('navSell').onclick = () => navigate('sell');
document.getElementById('navChat').onclick = () => navigate('chat');
document.getElementById('navProfile').onclick = () => navigate('profile');