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

let metodoEnvio = "entrega";
let cliente = {};
let pedido = { tamanho: "", maxSabores: 0, sabores: [], borda: null, bebidas: [], total: 0, valorPizza: 0, desconto: 0, cupomAplicado: "" };
let precosDB = { p: 0, m: 0, g: 0, taxa: 0, cupomNome: "", cupomValor: 0 };
let cardapioGeral = [];
let lojaAberta = false;

function init() {
    // Monitorar Status da Loja
    db.collection('config').doc('geral').onSnapshot(doc => {
        lojaAberta = doc.exists ? doc.data().aberto : false;
        const badge = document.getElementById('status-badge');
        const btn = document.getElementById('btn-save-client');
        if(lojaAberta) {
            badge.innerHTML = '<span class="text-green-500">🟢 ABERTO AGORA</span>';
            btn.disabled = false; btn.className = btn.className.replace("bg-zinc-700", "bg-yellow-500");
        } else {
            badge.innerHTML = '<span class="text-red-500">🔴 FECHADO NO MOMENTO</span>';
            btn.disabled = true; btn.className = btn.className.replace("bg-yellow-500", "bg-zinc-700");
        }
    });

    // Configurações e Cupom
    db.collection('config').doc('identidade').onSnapshot(doc => {
        if(doc.exists) {
            precosDB.taxa = doc.data().taxa || 0;
            precosDB.cupomNome = doc.data().cupomNome || "";
            precosDB.cupomValor = doc.data().cupomValor || 0;
            if(doc.data().logo) { const img = document.getElementById('logo-img'); img.src = doc.data().logo; img.classList.remove('hidden'); }
            atualizarTotal();
        }
    });

    // Preços das Pizzas
    db.collection('config').doc('precos').onSnapshot(doc => {
        if(doc.exists) { precosDB.p = doc.data().p; precosDB.m = doc.data().m; precosDB.g = doc.data().g; }
    });

    // Cardápio Real-time
    db.collection('cardapio').orderBy('data', 'asc').onSnapshot(snap => {
        cardapioGeral = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(pedido.tamanho) renderCardapio();
    });
}

function setMetodo(m) {
    metodoEnvio = m;
    document.getElementById('btn-entrega').classList.toggle('method-active', m === 'entrega');
    document.getElementById('btn-retirada').classList.toggle('method-active', m === 'retirada');
    document.getElementById('campos-endereco').classList.toggle('hidden', m === 'retirada');
    atualizarTotal();
}

function saveClientData() {
    const n = document.getElementById('cust-name').value;
    if(!n) return alert("Seu nome é obrigatório!");
    if(metodoEnvio === 'entrega') {
        const s = document.getElementById('cust-street').value;
        const b = document.getElementById('cust-bairro').value;
        if(!s || !b) return alert("Rua e Bairro são obrigatórios!");
        cliente = { nome: n, endereco: `${s}, ${b}`, ref: document.getElementById('cust-ref').value || "Não informado", tipo: "ENTREGA" };
    } else {
        cliente = { nome: n, endereco: "RETIRADA NA LOJA", ref: "N/A", tipo: "RETIRADA" };
    }
    document.getElementById('login-modal').classList.add('hidden');
    renderSizes();
}

function renderSizes() {
    const container = document.getElementById('sizes-container');
    const tams = [{id:'p', nome:'PEQUENA', p:precosDB.p, m:1}, {id:'m', nome:'MÉDIA', p:precosDB.m, m:2}, {id:'g', nome:'GRANDE', p:precosDB.g, m:3}];
    container.innerHTML = tams.map(t => `
        <div onclick="selectSize('${t.id}', ${t.p}, ${t.m})" class="bg-white text-black p-3 rounded-xl cursor-pointer text-center active:scale-95 transition-all">
            <h4 class="font-black text-xs">${t.nome}</h4>
            <p class="text-red-600 font-black text-sm">R$ ${t.p.toFixed(2)}</p>
        </div>`).join('');
}

function selectSize(id, preco, max) {
    pedido.tamanho = id; pedido.valorPizza = preco; pedido.maxSabores = max;
    pedido.sabores = []; pedido.borda = null; pedido.bebidas = [];
    ['flavors-section', 'bordas-section', 'bebidas-section', 'cart-bar'].forEach(s => document.getElementById(s).classList.remove('hidden'));
    renderCardapio(); atualizarTotal();
}

function renderCardapio() {
    const pizzas = cardapioGeral.filter(i => (i.tipo === 'pizza' || i.tipo === 'doce') && i.disponivel !== false);
    document.getElementById('flavors-container').innerHTML = pizzas.map(s => {
        const isSelected = pedido.sabores.find(p => p.nome === s.nome);
        return `
        <div onclick="toggleSabor('${s.nome}', '${s.chocolate}')" class="bg-zinc-900 border-2 ${isSelected ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center cursor-pointer mb-2">
            <div><p class="font-bold text-xs uppercase">${s.nome}</p><p class="text-[9px] text-zinc-500">${s.desc || ''}</p></div>
            <div class="font-black text-lg">${isSelected ? '●' : '○'}</div>
        </div>`;
    }).join('');

    const bordas = cardapioGeral.filter(i => i.tipo === 'borda' && i.disponivel !== false);
    document.getElementById('bordas-container').innerHTML = bordas.map(b => `
        <div onclick="toggleBorda('${b.nome}', ${b.preco})" class="bg-zinc-900 border-2 ${pedido.borda?.nome === b.nome ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center cursor-pointer mb-2">
            <span class="text-[10px] uppercase font-bold">${b.nome} (+ R$ ${b.preco.toFixed(2)})</span>
            <div class="font-black text-lg">${pedido.borda?.nome === b.nome ? '●' : '○'}</div>
        </div>`).join('');

    const bebidas = cardapioGeral.filter(i => i.tipo === 'bebida' && i.disponivel !== false);
    document.getElementById('bebidas-container').innerHTML = bebidas.map(b => `
        <div onclick="toggleBebida('${b.nome}', ${b.preco})" class="bg-zinc-900 border-2 ${pedido.bebidas.find(x => x.nome === b.nome) ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center cursor-pointer mb-2">
            <span class="text-[10px] uppercase font-bold">${b.nome} (+ R$ ${b.preco.toFixed(2)})</span>
            <div class="font-black text-lg">${pedido.bebidas.find(x => x.nome === b.nome) ? '●' : '○'}</div>
        </div>`).join('');
    
    document.getElementById('flavor-count').innerText = `${pedido.sabores.length}/${pedido.maxSabores}`;
}

function toggleSabor(nome, choco) {
    const idx = pedido.sabores.findIndex(p => p.nome === nome);
    if(idx > -1) pedido.sabores.splice(idx, 1);
    else if(pedido.sabores.length < pedido.maxSabores) pedido.sabores.push({ nome, chocolate: choco });
    else alert("Limite de sabores atingido!");
    renderCardapio();
}

function toggleBorda(nome, preco) {
    pedido.borda = (pedido.borda?.nome === nome) ? null : { nome, preco: Number(preco) };
    renderCardapio(); atualizarTotal();
}

function toggleBebida(nome, preco) {
    const idx = pedido.bebidas.findIndex(x => x.nome === nome);
    if(idx > -1) pedido.bebidas.splice(idx, 1);
    else if(pedido.bebidas.length < 2) pedido.bebidas.push({ nome, preco: Number(preco) });
    renderCardapio(); atualizarTotal();
}

function aplicarCupom() {
    const cod = document.getElementById('input-cupom').value.toUpperCase();
    if(cod === precosDB.cupomNome) { pedido.desconto = precosDB.cupomValor; pedido.cupomAplicado = cod; alert("Cupom Aplicado!"); atualizarTotal(); }
    else alert("Cupom Inválido!");
}

function toggleTroco() {
    document.getElementById('troco-para').classList.toggle('hidden', document.getElementById('pagamento').value !== 'Dinheiro');
}

function atualizarTotal() {
    const taxa = (metodoEnvio === 'entrega') ? precosDB.taxa : 0;
    const pBorda = pedido.borda ? pedido.borda.preco : 0;
    const pBebida = pedido.bebidas.reduce((s, i) => s + i.preco, 0);
    pedido.total = (pedido.valorPizza + pBorda + pBebida + taxa) - pedido.desconto;
    if(pedido.total < 0) pedido.total = 0;
    document.getElementById('total-price').innerText = `R$ ${pedido.total.toFixed(2)}`;
    document.getElementById('delivery-text').innerText = (metodoEnvio === 'entrega') ? `Entrega: R$ ${taxa.toFixed(2)}` : "Retirada: Grátis";
}

function sendOrder() {
    if(!lojaAberta) return alert("A loja está fechada agora!");
    if(pedido.sabores.length === 0) return alert("Escolha pelo menos 1 sabor!");

    const pag = document.getElementById('pagamento').value;
    const troco = document.getElementById('troco-para').value;
    let pagTexto = `💳 *Pagamento:* ${pag}`;
    if(pag === 'Dinheiro' && troco) pagTexto += `%0A💵 *Troco para:* R$ ${troco} (Troco: R$ ${Number(troco - pedido.total).toFixed(2)})`;

    const zap = "5545999683117";
    const saboresTexto = pedido.sabores.map(s => `${s.nome}${s.chocolate !== 'Nenhum' ? ' ('+s.chocolate+')' : ''}`).join(' / ');
    
    const msg = `👑 *PEDIDO - REIS*%0A%0A` +
                `👤 *Cliente:* ${cliente.nome}%0A` +
                `🛵 *Tipo:* ${cliente.tipo}%0A` +
                `📍 *Endereço:* ${cliente.endereco}%0A` +
                `📍 *Referência:* ${cliente.ref}%0A%0A` +
                `🍕 *Pizza:* ${pedido.tamanho.toUpperCase()}%0A` +
                `✅ *Sabores:* ${saboresTexto}%0A` +
                `🧀 *Borda:* ${pedido.borda ? pedido.borda.nome : 'Sem'}%0A` +
                `🥤 *Bebidas:* ${pedido.bebidas.map(b => b.nome).join(', ') || 'Nenhuma'}%0A%0A` +
                `${pagTexto}%0A` +
                `${pedido.cupomAplicado ? '🎟️ *Cupom:* '+pedido.cupomAplicado+'%0A' : ''}` +
                `💰 *TOTAL:* R$ ${pedido.total.toFixed(2)}`;

    window.open(`https://wa.me/${zap}?text=${msg}`);
}

init();