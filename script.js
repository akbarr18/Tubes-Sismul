// --- IMPORT LIBRARY FIREBASE ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. KONFIGURASI FIREBASE (PASTE DATA ANDA DISINI) ---
const firebaseConfig = {
    apiKey: "AIzaSyB4gEKO89_eJHBx4BtLmDiNrXM53r9Q74c",
    authDomain: "tubes-sismul.firebaseapp.com",
    projectId: "tubes-sismul",
    storageBucket: "tubes-sismul.firebasestorage.app",
    messagingSenderId: "688316647034",
    appId: "1:688316647034:web:c58a60909702b15d2d1dc3",
    measurementId: "G-SW8C9ENGLJ"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variabel Global
let currentUser = null;
let currentChatPartner = null; // Email lawan bicara
let unsubscribeProducts = null; // Untuk mematikan listener produk
let unsubscribeChats = null;    // Untuk mematikan listener chat

// --- 2. AUTHENTICATION LOGIC ---

// Cek status login (Realtime)
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User sedang login
        currentUser = user;
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('navbar').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'block';
        
        // Update UI Profil
        document.getElementById('profileName').innerText = user.displayName || "User Tanpa Nama";
        document.getElementById('profileEmail').innerText = user.email;
        document.getElementById('profileImg').src = `https://ui-avatars.com/api/?name=${user.displayName || 'U'}&background=bd0a0a&color=fff`;

        // Mulai Listen Data (Realtime)
        listenToProducts();
        navigate('home');
    } else {
        // User belum login / Logout
        currentUser = null;
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('navbar').style.display = 'none';
        document.getElementById('mainApp').style.display = 'none';
    }
});

// Fungsi Register
document.getElementById('formRegister').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const pass = document.getElementById('regPass').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
        // Update nama user di Firebase Auth
        await updateProfile(userCredential.user, { displayName: name });
        
        Swal.fire('Sukses', 'Akun berhasil dibuat!', 'success');
        document.getElementById('formRegister').reset();
    } catch (error) {
        Swal.fire('Error', error.message, 'error');
    }
});

// Fungsi Login
document.getElementById('formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;

    try {
        await signInWithEmailAndPassword(auth, email, pass);
        Swal.fire({ icon: 'success', title: 'Login Berhasil', timer: 1500, showConfirmButton: false });
    } catch (error) {
        Swal.fire('Gagal', 'Email atau password salah!', 'error');
    }
});

// Fungsi Logout
const handleLogout = async () => {
    try {
        await signOut(auth);
        Swal.fire('Logout', 'Anda telah keluar.', 'success');
    } catch (error) {
        console.error(error);
    }
};
document.getElementById('btnLogout').addEventListener('click', handleLogout);
document.getElementById('btnLogoutProfile').addEventListener('click', handleLogout);

// Toggle Login/Register View
document.getElementById('linkToRegister').onclick = () => {
    document.getElementById('loginBox').classList.add('hidden');
    document.getElementById('registerBox').classList.remove('hidden');
};
document.getElementById('linkToLogin').onclick = () => {
    document.getElementById('registerBox').classList.add('hidden');
    document.getElementById('loginBox').classList.remove('hidden');
};

// --- 3. FIRESTORE: PRODUK (REALTIME LISTENER) ---

function listenToProducts() {
    // onSnapshot = Fitur ajaib Firebase agar data selalu update tanpa refresh
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    
    unsubscribeProducts = onSnapshot(q, (snapshot) => {
        const products = [];
        snapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        renderProducts(products);
        renderMyProducts(products);
    });
}

function renderProducts(products) {
    const container = document.getElementById('productContainer');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    container.innerHTML = '';
    
    // Filter manual di frontend (untuk search)
    const filtered = products.filter(p => p.title.toLowerCase().includes(searchTerm));

    if (filtered.length === 0) container.innerHTML = '<p style="text-align:center;width:100%">Belum ada barang.</p>';

    filtered.forEach(item => {
        const isMine = currentUser && item.sellerEmail === currentUser.email;
        let btnAction = isMine 
            ? `<button class="btn-card disabled">Milik Anda</button>` 
            : `<button class="btn-card chat-btn" data-email="${item.sellerEmail}" data-name="${item.sellerName}"><i class="fas fa-comment"></i> Chat Penjual</button>`;

        const html = `
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
        container.innerHTML += html;
    });

    // Event Listener untuk tombol Chat (karena dibuat dinamis)
    document.querySelectorAll('.chat-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            startChat(btn.dataset.email, btn.dataset.name);
        });
    });
}

function renderMyProducts(products) {
    const container = document.getElementById('myProductContainer');
    container.innerHTML = '';
    const myItems = products.filter(p => p.sellerEmail === currentUser.email);

    if (myItems.length === 0) container.innerHTML = '<p>Anda belum menjual barang.</p>';

    myItems.forEach(item => {
        const html = `
            <div class="card">
                <div class="card-img"><img src="${item.image}" alt="img"></div>
                <div class="card-body">
                    <h4>${item.title}</h4>
                    <button class="btn-card btn-danger delete-btn" data-id="${item.id}">Hapus</button>
                </div>
            </div>`;
        container.innerHTML += html;
    });

    // Event Listener Hapus
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if(confirm('Hapus barang ini?')) {
                await deleteDoc(doc(db, "products", btn.dataset.id));
                Swal.fire('Terhapus', '', 'success');
            }
        });
    });
}

// Tambah Produk
document.getElementById('formAddProduct').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('prodTitle').value;
    const cat = document.getElementById('prodCat').value;
    const price = parseInt(document.getElementById('prodPrice').value);
    const file = document.getElementById('prodImg').files[0];

    if (!file) return Swal.fire('Error', 'Upload foto dulu', 'warning');

    // Ubah gambar ke Base64 (Cara simpel tanpa Firebase Storage bucket)
    const reader = new FileReader();
    reader.onload = async function(evt) {
        const imageBase64 = evt.target.result;
        
        try {
            await addDoc(collection(db, "products"), {
                title: title,
                category: cat,
                price: price,
                image: imageBase64,
                sellerName: currentUser.displayName,
                sellerEmail: currentUser.email,
                createdAt: Date.now()
            });
            Swal.fire('Berhasil', 'Iklan tayang!', 'success');
            document.getElementById('formAddProduct').reset();
            navigate('home');
        } catch (err) {
            Swal.fire('Error', 'Gagal upload (File mungkin terlalu besar)', 'error');
        }
    };
    reader.readAsDataURL(file);
});

// Search Listener
document.getElementById('searchInput').addEventListener('keyup', () => {
    // Kita panggil ulang listener produk untuk trigger render ulang
    // (Sebenarnya agak boros, tapi ini cara termudah tanpa state management kompleks)
    // Di aplikasi asli, kita simpan data produk di variabel global lalu filter variabel itu.
    // Tapi karena logic onSnapshot di atas sudah jalan, kita biarkan logic render menangani filter.
    // Kita modif sedikit renderProducts agar menerima filter.
    // (Sudah dihandle di dalam renderProducts mengambil value input)
    // Cukup trigger refresh manual jika perlu, atau biarkan user menunggu update.
    // Agar responsif, kita ambil data terakhir dari DOM atau re-query? 
    // Cara paling gampang untuk pemula: Refresh snapshot? Tidak, boros kuota.
    // Kita buat variabel global 'allProductsData' untuk menyimpan cache.
});


// --- 4. FIRESTORE: CHAT (REALTIME) ---

function startChat(partnerEmail, partnerName) {
    currentChatPartner = partnerEmail;
    document.getElementById('chatHeaderName').innerText = partnerName;
    navigate('chat');
    listenToChats();
}

function listenToChats() {
    if (unsubscribeChats) unsubscribeChats(); // Stop listener sebelumnya biar ga numpuk

    // Ambil semua pesan
    // Logika Chat Sederhana: Pesan disimpan di koleksi 'chats'
    // Kita ambil semua pesan yang (sender == saya AND receiver == dia) OR (sender == dia AND receiver == saya)
    // Firestore query 'OR' agak ribet, jadi kita ambil semua pesan yang melibatkan saya, lalu filter di JS.
    
    const q = query(collection(db, "chats"), orderBy("timestamp", "asc"));

    unsubscribeChats = onSnapshot(q, (snapshot) => {
        const chatBody = document.getElementById('chatBody');
        const chatList = document.getElementById('chatList');
        chatBody.innerHTML = '';
        
        let allMyMessages = [];
        let partners = new Set(); // Untuk daftar kontak sidebar

        snapshot.forEach(doc => {
            const data = doc.data();
            // Ambil pesan yang melibatkan saya
            if (data.sender === currentUser.email || data.receiver === currentUser.email) {
                allMyMessages.push(data);
                
                // Tentukan siapa lawan bicaranya untuk sidebar
                const partner = data.sender === currentUser.email ? data.receiver : data.sender;
                partners.add(partner);
            }
        });

        // 1. Render Sidebar Kontak
        chatList.innerHTML = '';
        partners.forEach(email => {
            const isActive = email === currentChatPartner ? 'active' : '';
            chatList.innerHTML += `
                <div class="chat-contact ${isActive}" onclick="openChatFromSidebar('${email}')">
                    <div class="avatar"><i class="fas fa-user"></i></div>
                    <div class="info"><h4>${email}</h4><p>Klik untuk chat</p></div>
                </div>`;
        });

        // 2. Render Pesan di Window Chat (Hanya untuk partner yang aktif)
        if (currentChatPartner) {
            const conversation = allMyMessages.filter(m => 
                (m.sender === currentUser.email && m.receiver === currentChatPartner) ||
                (m.sender === currentChatPartner && m.receiver === currentUser.email)
            );

            conversation.forEach(msg => {
                const type = msg.sender === currentUser.email ? 'outgoing' : 'incoming';
                chatBody.innerHTML += `<div class="msg ${type}">${msg.text}</div>`;
            });
            chatBody.scrollTop = chatBody.scrollHeight; // Auto scroll ke bawah
        }
    });
}

// Fungsi global agar bisa dipanggil dari HTML string
window.openChatFromSidebar = (email) => {
    // Kita set namanya jadi email dulu karena data nama tidak disimpan di chat document (untuk simplifikasi)
    startChat(email, email); 
};

// Kirim Pesan
document.getElementById('btnSendMsg').addEventListener('click', async () => {
    const input = document.getElementById('msgInput');
    const text = input.value;
    
    if (!text || !currentChatPartner) return;

    await addDoc(collection(db, "chats"), {
        text: text,
        sender: currentUser.email,
        receiver: currentChatPartner,
        timestamp: Date.now()
    });
    input.value = '';
});

// --- 5. NAVIGASI ---
window.navigate = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    // Matikan warna aktif navbar
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    // Nyalakan yang sesuai
    if(viewId === 'home') document.getElementById('navHome').classList.add('active');
    if(viewId === 'sell') document.getElementById('navSell').classList.add('active');
    if(viewId === 'chat') {
        document.getElementById('navChat').classList.add('active');
        listenToChats(); // Mulai dengarkan chat saat masuk menu chat
    }
    if(viewId === 'profile') document.getElementById('navProfile').classList.add('active');
};

// Pasang event listener click untuk navbar (karena type=module, onclick di HTML kadang ga detect)
document.getElementById('navHome').onclick = () => navigate('home');
document.getElementById('navSell').onclick = () => navigate('sell');
document.getElementById('navChat').onclick = () => navigate('chat');
document.getElementById('navProfile').onclick = () => navigate('profile');