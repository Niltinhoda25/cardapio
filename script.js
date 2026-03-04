const firebaseConfig = {
    apiKey: "AIzaSyDP-I5zYn9gVIMgNLFULIQTHypi0CqmlwA",
    authDomain: "pizzaria-reis-173ab.firebaseapp.com",
    projectId: "pizzaria-reis-173ab",
    storageBucket: "pizzaria-reis-173ab.firebasestorage.app",
    messagingSenderId: "1051814435008",
    appId: "1:1051814435008:web:a596d3d67d7360e8fab525"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let cliente = { nome: "", rua: "" };
let pedido = { tamanho: "", maxSabores: 0, sabores: [], extras: [], total: 0, valorPizza: 0 };
let precosDB = { p: 0, m: 0, g: 0, taxa: 7.00 };
let cardapioGeral = [];

// Monitorar Dados
function init() {
    db.collection('config').doc('identidade').onSnapshot(doc => {
        if(doc.exists) {
            precosDB.taxa = Number(doc.data().taxa) || 0;
            if(doc.data().logo) {
                const img = document.getElementById('logo-img');
                img.src = doc.data().logo; img.style.display = 'block';
            }
            atualizarTotal();
        }
    });

    db.collection('config').doc('precos').onSnapshot(doc => {
        if(doc.exists) {
            precosDB.p = Number(doc.data().p) || 0;
            precosDB.m = Number(doc.data().m) || 0;
            precosDB.g = Number(doc.data().g) || 0;
        }
    });

    db.collection('cardapio').orderBy('data', 'asc').onSnapshot(snap => {
        cardapioGeral = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(pedido.tamanho) { renderFlavors(); renderExtras(); }
    });

    db.collection('config').doc('geral').onSnapshot(doc => {
        const aberto = doc.exists ? doc.data().aberto : true;
        document.getElementById('status-badge').innerHTML = aberto ? '<span class="text-green-500">🟢 ABERTO</span>' : '<span class="text-red-500">🔴 FECHADO</span>';
    });
}
init();

function saveClientData() {
    const n = document.getElementById('cust-name').value;
    const r = document.getElementById('cust-street').value;
    if(!n || !r) return alert("Preencha Nome e Endereço!");
    cliente = { nome: n, rua: r };
    document.getElementById('login-modal').classList.add('hidden');
    renderSizes();
}

function renderSizes() {
    const container = document.getElementById('sizes-container');
    const tams = [
        { id: 'p', nome: 'PEQUENA', preco: precosDB.p, max: 1 },
        { id: 'm', nome: 'MÉDIA', preco: precosDB.m, max: 2 },
        { id: 'g', nome: 'GRANDE', preco: precosDB.g, max: 3 }
    ];
    container.innerHTML = tams.map(t => `
        <div onclick="selectSize('${t.id}', ${t.preco}, ${t.max})" class="bg-white text-black p-4 rounded-2xl cursor-pointer border-4 border-transparent active:border-red-600 transition-all">
            <h4 class="font-black text-lg italic">${t.nome}</h4>
            <p class="text-red-600 font-black text-xl">R$ ${Number(t.preco).toFixed(2)}</p>
            <p class="text-[9px] font-bold opacity-40 uppercase">Até ${t.max} Sabor(es)</p>
        </div>
    `).join('');
}

function selectSize(id, preco, max) {
    pedido.tamanho = id; pedido.valorPizza = Number(preco); pedido.maxSabores = max;
    pedido.sabores = []; pedido.extras = [];
    document.getElementById('flavors-section').classList.remove('hidden');
    document.getElementById('extras-section').classList.remove('hidden');
    document.getElementById('cart-bar').classList.remove('hidden');
    renderFlavors(); renderExtras(); atualizarTotal();
}

function renderFlavors() {
    const container = document.getElementById('flavors-container');
    const pizzas = cardapioGeral.filter(i => i.tipo === 'pizza');
    container.innerHTML = pizzas.map((s, idx) => `
        <div onclick="toggleSabor('${s.nome}', ${idx})" id="f-${idx}" class="bg-zinc-900 border-2 border-zinc-800 p-4 rounded-xl flex justify-between items-center cursor-pointer">
            <div>
                <p class="font-bold uppercase text-sm">${s.nome}</p>
                <p class="text-[10px] text-zinc-500 font-bold">${s.desc || 'Tradicional'}</p>
            </div>
            <div id="check-${idx}" class="text-zinc-700 text-xl font-black">○</div>
        </div>
    `).join('');
}

function toggleSabor(nome, idx) {
    const i = pedido.sabores.indexOf(nome);
    if(i > -1) {
        pedido.sabores.splice(i, 1);
        document.getElementById(`f-${idx}`).classList.remove('border-red-600');
        document.getElementById(`check-${idx}`).innerText = "○";
    } else {
        if(pedido.sabores.length >= pedido.maxSabores) return alert("Limite atingido!");
        pedido.sabores.push(nome);
        document.getElementById(`f-${idx}`).classList.add('border-red-600');
        document.getElementById(`check-${idx}`).innerText = "●";
    }
    document.getElementById('flavor-count').innerText = `${pedido.sabores.length}/${pedido.maxSabores}`;
}

function renderExtras() {
    const container = document.getElementById('extras-container');
    const itens = cardapioGeral.filter(i => i.tipo !== 'pizza');
    container.innerHTML = itens.map(item => `
        <div class="bg-zinc-900 border border-zinc-800 p-3 rounded-xl flex justify-between items-center">
            <div><p class="font-bold text-xs uppercase">${item.nome}</p><p class="text-green-500 font-bold text-[10px]">+ R$ ${Number(item.preco).toFixed(2)}</p></div>
            <button onclick="addExtra('${item.nome}', ${item.preco})" class="bg-red-600 text-white px-3 py-1 rounded-lg font-bold">+</button>
        </div>
    `).join('');
}

function addExtra(n, p) {
    pedido.extras.push({ nome: n, preco: Number(p) });
    atualizarTotal();
}

function atualizarTotal() {
    const totalExtras = pedido.extras.reduce((s, i) => s + i.preco, 0);
    const taxa = Number(precosDB.taxa) || 0;
    pedido.total = Number(pedido.valorPizza) + totalExtras + taxa;
    document.getElementById('total-price').innerText = "R$ " + pedido.total.toFixed(2);
    document.getElementById('delivery-text').innerText = "Entrega: R$ " + taxa.toFixed(2);
}

function sendOrder() {
    if(pedido.sabores.length === 0) return alert("Escolha os sabores!");
    const zap = "5545999683117";
    const msg = `👑 *PIZZARIA REIS*%0A%0A👤 *Cliente:* ${cliente.nome}%0A📍 *End:* ${cliente.rua}%0A%0A🍕 *Pizza:* ${pedido.tamanho.toUpperCase()}%0A✅ *Sabores:* ${pedido.sabores.join(' / ')}%0A➕ *Extras:* ${pedido.extras.map(e => e.nome).join(', ') || 'Nenhum'}%0A🛵 *Entrega:* R$ ${precosDB.taxa.toFixed(2)}%0A💰 *TOTAL:* R$ ${pedido.total.toFixed(2)}`;
    window.open(`https://wa.me/${zap}?text=${msg}`);
}