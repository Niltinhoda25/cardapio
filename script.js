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

let cliente = {};
let pedido = { tamanho: "", maxSabores: 0, sabores: [], borda: null, bebidas: [], total: 0, valorPizza: 0 };
let precosDB = { p: 0, m: 0, g: 0, taxa: 7.00 };
let cardapioGeral = [];

function init() {
    db.collection('config').doc('identidade').onSnapshot(doc => {
        if(doc.exists) {
            precosDB.taxa = Number(doc.data().taxa) || 0;
            if(doc.data().logo) { document.getElementById('logo-img').src = doc.data().logo; document.getElementById('logo-img').style.display = 'block'; }
            atualizarTotal();
        }
    });
    db.collection('config').doc('precos').onSnapshot(doc => { if(doc.exists) { precosDB.p = Number(doc.data().p); precosDB.m = Number(doc.data().m); precosDB.g = Number(doc.data().g); }});
    db.collection('cardapio').orderBy('data', 'asc').onSnapshot(snap => {
        cardapioGeral = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(pedido.tamanho) renderCardapio();
    });
}
init();

function saveClientData() {
    const n = document.getElementById('cust-name').value;
    const s = document.getElementById('cust-street').value;
    const b = document.getElementById('cust-bairro').value;
    const r = document.getElementById('cust-ref').value;
    if(!n || !s || !b) return alert("Nome, Rua e Bairro são obrigatórios!");
    cliente = { nome: n, endereco: `${s}, ${b}`, ref: r || "Não informado" };
    document.getElementById('login-modal').classList.add('hidden');
    renderSizes();
}

function renderSizes() {
    const container = document.getElementById('sizes-container');
    const tams = [{id:'p', nome:'PEQUENA', preco:precosDB.p, max:1}, {id:'m', nome:'MÉDIA', preco:precosDB.m, max:2}, {id:'g', nome:'GRANDE', preco:precosDB.g, max:3}];
    container.innerHTML = tams.map(t => `<div onclick="selectSize('${t.id}', ${t.preco}, ${t.max})" class="bg-white text-black p-4 rounded-2xl cursor-pointer border-4 border-transparent active:border-red-600 transition-all text-center"><h4 class="font-black italic">${t.nome}</h4><p class="text-red-600 font-black text-xl">R$ ${t.preco.toFixed(2)}</p></div>`).join('');
}

function selectSize(id, preco, max) {
    pedido.tamanho = id; pedido.valorPizza = preco; pedido.maxSabores = max;
    pedido.sabores = []; pedido.borda = null; pedido.bebidas = [];
    ['flavors-section', 'bordas-section', 'bebidas-section', 'cart-bar'].forEach(s => document.getElementById(s).classList.remove('hidden'));
    renderCardapio(); atualizarTotal();
}

function renderCardapio() {
    // Sabores
    document.getElementById('flavors-container').innerHTML = cardapioGeral.filter(i => i.tipo === 'pizza').map((s, idx) => `
        <div onclick="toggleSabor('${s.nome}', ${idx})" id="f-${idx}" class="bg-zinc-900 border-2 border-zinc-800 p-3 rounded-xl flex justify-between items-center cursor-pointer">
            <div><p class="font-bold text-sm uppercase">${s.nome}</p><p class="text-[10px] text-zinc-500">${s.desc || ''}</p></div>
            <div id="check-${idx}" class="font-black">${pedido.sabores.includes(s.nome) ? '●' : '○'}</div>
        </div>`).join('');

    // Bordas (Max 1)
    document.getElementById('bordas-container').innerHTML = cardapioGeral.filter(i => i.tipo === 'borda').map((b, idx) => `
        <div onclick="toggleBorda('${b.nome}', ${b.preco}, ${idx})" class="bg-zinc-900 border-2 ${pedido.borda?.nome === b.nome ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center cursor-pointer">
            <span class="text-xs uppercase font-bold">${b.nome} (+ R$ ${b.preco.toFixed(2)})</span>
            <div class="font-black">${pedido.borda?.nome === b.nome ? '●' : '○'}</div>
        </div>`).join('');

    // Bebidas (Max 2)
    document.getElementById('bebidas-container').innerHTML = cardapioGeral.filter(i => i.tipo === 'bebida').map((b, idx) => `
        <div onclick="toggleBebida('${b.nome}', ${b.preco}, ${idx})" class="bg-zinc-900 border-2 ${pedido.bebidas.find(x => x.nome === b.nome) ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center cursor-pointer">
            <span class="text-xs uppercase font-bold">${b.nome} (+ R$ ${b.preco.toFixed(2)})</span>
            <div class="font-black">${pedido.bebidas.find(x => x.nome === b.nome) ? '●' : '○'}</div>
        </div>`).join('');
}

function toggleSabor(nome, idx) {
    const i = pedido.sabores.indexOf(nome);
    if(i > -1) pedido.sabores.splice(i, 1);
    else if(pedido.sabores.length < pedido.maxSabores) pedido.sabores.push(nome);
    renderCardapio();
    document.getElementById('flavor-count').innerText = `${pedido.sabores.length}/${pedido.maxSabores}`;
}

function toggleBorda(nome, preco) {
    if(pedido.borda?.nome === nome) pedido.borda = null;
    else pedido.borda = { nome, preco };
    renderCardapio(); atualizarTotal();
}

function toggleBebida(nome, preco) {
    const i = pedido.bebidas.findIndex(x => x.nome === nome);
    if(i > -1) pedido.bebidas.splice(i, 1);
    else if(pedido.bebidas.length < 2) pedido.bebidas.push({ nome, preco });
    else alert("Máximo de 2 bebidas por pedido!");
    renderCardapio(); atualizarTotal();
}

function atualizarTotal() {
    const precoBorda = pedido.borda ? pedido.borda.preco : 0;
    const precoBebidas = pedido.bebidas.reduce((s, i) => s + i.preco, 0);
    pedido.total = pedido.valorPizza + precoBorda + precoBebidas + precosDB.taxa;
    document.getElementById('total-price').innerText = `R$ ${pedido.total.toFixed(2)}`;
    document.getElementById('delivery-text').innerText = `Entrega: R$ ${precosDB.taxa.toFixed(2)}`;
}

function sendOrder() {
    if(pedido.sabores.length === 0) return alert("Escolha a pizza!");
    const zap = "5545999683117";
    const msg = `👑 *PIZZARIA REIS*%0A%0A👤 *Cliente:* ${cliente.nome}%0A📍 *End:* ${cliente.endereco}%0A📍 *Ref:* ${cliente.ref}%0A%0A🍕 *Pizza:* ${pedido.tamanho.toUpperCase()}%0A✅ *Sabores:* ${pedido.sabores.join(' / ')}%0A🧀 *Borda:* ${pedido.borda ? pedido.borda.nome : 'Sem borda'}%0A🥤 *Bebidas:* ${pedido.bebidas.map(b => b.nome).join(', ') || 'Nenhuma'}%0A🛵 *Entrega:* R$ ${precosDB.taxa.toFixed(2)}%0A💰 *TOTAL:* R$ ${pedido.total.toFixed(2)}`;
    window.open(`https://wa.me/${zap}?text=${msg}`);
}