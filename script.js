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
let pedido = { tamanho: "", maxSabores: 0, sabores: [], borda: null, bebidas: [], total: 0, valorPizza: 0 };
let precosDB = { p: 0, m: 0, g: 0, taxa: 7.00 };
let cardapioGeral = [];

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
            precosDB.p = Number(doc.data().p); precosDB.m = Number(doc.data().m); precosDB.g = Number(doc.data().g); 
        }
    });
    db.collection('cardapio').orderBy('data', 'asc').onSnapshot(snap => {
        cardapioGeral = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(pedido.tamanho) renderCardapio();
    });
}
init();

function setMetodo(m) {
    metodoEnvio = m;
    document.getElementById('btn-entrega').classList.toggle('method-active', m === 'entrega');
    document.getElementById('btn-retirada').classList.toggle('method-active', m === 'retirada');
    document.getElementById('campos-endereco').classList.toggle('hidden', m === 'retirada');
}

function saveClientData() {
    const n = document.getElementById('cust-name').value;
    if(!n) return alert("Digite seu nome!");
    if(metodoEnvio === 'entrega') {
        const s = document.getElementById('cust-street').value;
        const b = document.getElementById('cust-bairro').value;
        const r = document.getElementById('cust-ref').value;
        if(!s || !b) return alert("Rua e Bairro são obrigatórios!");
        cliente = { nome: n, endereco: `${s}, ${b}`, ref: r || "Não informado", tipo: "ENTREGA" };
    } else {
        cliente = { nome: n, endereco: "RETIRADA NA LOJA", ref: "N/A", tipo: "RETIRADA" };
    }
    document.getElementById('login-modal').classList.add('hidden');
    renderSizes();
}

function renderSizes() {
    const container = document.getElementById('sizes-container');
    const tams = [{id:'p', nome:'PEQUENA', preco:precosDB.p, max:1}, {id:'m', nome:'MÉDIA', preco:precosDB.m, max:2}, {id:'g', nome:'GRANDE', preco:precosDB.g, max:3}];
    container.innerHTML = tams.map(t => `
        <div onclick="selectSize('${t.id}', ${t.preco}, ${t.max})" class="bg-white text-black p-4 rounded-2xl cursor-pointer border-4 border-transparent active:border-red-600 transition-all text-center">
            <h4 class="font-black italic">${t.nome}</h4>
            <p class="text-red-600 font-black text-xl">R$ ${t.preco.toFixed(2)}</p>
        </div>`).join('');
}

function selectSize(id, preco, max) {
    pedido.tamanho = id; pedido.valorPizza = Number(preco); pedido.maxSabores = max;
    pedido.sabores = []; pedido.borda = null; pedido.bebidas = [];
    ['flavors-section', 'bordas-section', 'bebidas-section', 'cart-bar'].forEach(s => document.getElementById(s).classList.remove('hidden'));
    renderCardapio(); atualizarTotal();
}

function renderCardapio() {
    // SABORES COM OPÇÃO DE CHOCOLATE
    document.getElementById('flavors-container').innerHTML = cardapioGeral.filter(i => i.tipo === 'pizza').map((s, idx) => {
        const isSelected = pedido.sabores.find(p => p.nome === s.nome);
        return `
        <div class="bg-zinc-900 border-2 ${isSelected ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl mb-2">
            <div onclick="toggleSabor('${s.nome}')" class="flex justify-between items-center cursor-pointer">
                <div>
                    <p class="font-bold text-sm uppercase">${s.nome}</p>
                    <p class="text-[10px] text-zinc-500 font-bold">${s.desc || ''}</p>
                </div>
                <div class="font-black text-xl">${isSelected ? '●' : '○'}</div>
            </div>
            ${isSelected ? `
                <div class="mt-3 flex gap-2 border-t border-zinc-800 pt-2">
                    <button onclick="setChocolate('${s.nome}', 'Preto')" class="flex-1 text-[10px] p-2 rounded-lg font-bold ${isSelected.chocolate === 'Preto' ? 'bg-zinc-700 text-white' : 'bg-black text-zinc-500'}">CHOCO PRETO</button>
                    <button onclick="setChocolate('${s.nome}', 'Branco')" class="flex-1 text-[10px] p-2 rounded-lg font-bold ${isSelected.chocolate === 'Branco' ? 'bg-zinc-100 text-black' : 'bg-black text-zinc-500'}">CHOCO BRANCO</button>
                </div>
            ` : ''}
        </div>`;
    }).join('');

    // BORDAS
    document.getElementById('bordas-container').innerHTML = cardapioGeral.filter(i => i.tipo === 'borda').map((b) => `
        <div onclick="toggleBorda('${b.nome}', ${b.preco})" class="bg-zinc-900 border-2 ${pedido.borda?.nome === b.nome ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center cursor-pointer mb-2">
            <span class="text-xs uppercase font-bold">${b.nome} (+ R$ ${Number(b.preco).toFixed(2)})</span>
            <div class="font-black text-xl">${pedido.borda?.nome === b.nome ? '●' : '○'}</div>
        </div>`).join('');

    // BEBIDAS
    document.getElementById('bebidas-container').innerHTML = cardapioGeral.filter(i => i.tipo === 'bebida').map((b) => `
        <div onclick="toggleBebida('${b.nome}', ${b.preco})" class="bg-zinc-900 border-2 ${pedido.bebidas.find(x => x.nome === b.nome) ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center cursor-pointer mb-2">
            <span class="text-xs uppercase font-bold">${b.nome} (+ R$ ${Number(b.preco).toFixed(2)})</span>
            <div class="font-black text-xl">${pedido.bebidas.find(x => x.nome === b.nome) ? '●' : '○'}</div>
        </div>`).join('');
    
    document.getElementById('flavor-count').innerText = `${pedido.sabores.length}/${pedido.maxSabores}`;
}

function toggleSabor(nome) {
    const idx = pedido.sabores.findIndex(p => p.nome === nome);
    if(idx > -1) {
        pedido.sabores.splice(idx, 1);
    } else {
        if(pedido.sabores.length < pedido.maxSabores) {
            pedido.sabores.push({ nome: nome, chocolate: "Nenhum" });
        } else {
            alert(`Máximo ${pedido.maxSabores} sabores!`);
        }
    }
    renderCardapio();
}

function setChocolate(nomeSabor, tipo) {
    const sabor = pedido.sabores.find(p => p.nome === nomeSabor);
    if(sabor) {
        sabor.chocolate = (sabor.chocolate === tipo) ? "Nenhum" : tipo;
        renderCardapio();
    }
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

function atualizarTotal() {
    const taxa = (metodoEnvio === 'entrega') ? precosDB.taxa : 0;
    const pBorda = pedido.borda ? pedido.borda.preco : 0;
    const pBebida = pedido.bebidas.reduce((s, i) => s + i.preco, 0);
    pedido.total = pedido.valorPizza + pBorda + pBebida + taxa;
    document.getElementById('total-price').innerText = `R$ ${pedido.total.toFixed(2)}`;
    document.getElementById('delivery-text').innerText = (metodoEnvio === 'entrega') ? `Entrega: R$ ${taxa.toFixed(2)}` : "Retirada: Grátis";
}

function sendOrder() {
    if(pedido.sabores.length === 0) return alert("Escolha o sabor!");
    const zap = "5545999683117";
    const saboresTexto = pedido.sabores.map(s => `${s.nome}${s.chocolate !== 'Nenhum' ? ' ('+s.chocolate+')' : ''}`).join(' / ');
    const msg = `👑 *PEDIDO - REIS*%0A%0A👤 *Cliente:* ${cliente.nome}%0A🛵 *Tipo:* ${cliente.tipo}%0A📍 *End:* ${cliente.endereco}%0A📍 *Ref:* ${cliente.ref}%0A%0A🍕 *Pizza:* ${pedido.tamanho.toUpperCase()}%0A✅ *Sabores:* ${saboresTexto}%0A🧀 *Borda:* ${pedido.borda ? pedido.borda.nome : 'Sem'}%0A🥤 *Bebidas:* ${pedido.bebidas.map(b => b.nome).join(', ') || 'Não'}%0A💰 *TOTAL:* R$ ${pedido.total.toFixed(2)}`;
    window.open(`https://wa.me/${zap}?text=${msg}`);
}