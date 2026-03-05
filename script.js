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
let pedido = { tamanho: "", maxSabores: 0, sabores: [], borda: null, bebidas: [], total: 0, valorPizza: 0, desconto: 0 };
let precosDB = { p: 0, m: 0, g: 0, taxa: 0, cupomNome: "", cupomValor: 0 };
let cardapioGeral = [];
let lojaAberta = false;

function init() {
    db.collection('config').doc('geral').onSnapshot(doc => {
        lojaAberta = doc.exists ? doc.data().aberto : false;
        document.getElementById('status-badge').innerHTML = lojaAberta ? '<span class="text-green-500">🟢 ABERTO</span>' : '<span class="text-red-500">🔴 FECHADO</span>';
    });
    db.collection('config').doc('identidade').onSnapshot(doc => {
        if(doc.exists) {
            precosDB.taxa = doc.data().taxa || 0;
            precosDB.cupomNome = doc.data().cupomNome || "";
            precosDB.cupomValor = doc.data().cupomValor || 0;
            atualizarTotal();
        }
    });
    db.collection('config').doc('precos').onSnapshot(doc => {
        if(doc.exists) { precosDB.p = doc.data().p; precosDB.m = doc.data().m; precosDB.g = doc.data().g; }
    });
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
    if(!n) return alert("Digite seu nome.");
    if(metodoEnvio === 'entrega') {
        const s = document.getElementById('cust-street').value;
        const b = document.getElementById('cust-bairro').value;
        if(!s || !b) return alert("Preencha o endereço.");
        cliente = { nome: n, endereco: `${s}, ${b}`, ref: document.getElementById('cust-ref').value || "N/A", tipo: "ENTREGA" };
    } else {
        cliente = { nome: n, endereco: "RETIRADA NA LOJA", ref: "N/A", tipo: "RETIRADA" };
    }
    document.getElementById('login-modal').classList.add('hidden');
    renderSizes();
}

function renderSizes() {
    const container = document.getElementById('sizes-container');
    const tams = [{id:'p', n:'PEQUENA', p:precosDB.p, m:1}, {id:'m', n:'MÉDIA', p:precosDB.m, m:2}, {id:'g', n:'GRANDE', p:precosDB.g, m:3}];
    container.innerHTML = tams.map(t => `<div onclick="selectSize('${t.id}', ${t.p}, ${t.m})" class="bg-white text-black p-3 rounded-xl text-center font-black">
        <h4 class="text-[9px] uppercase">${t.n}</h4>
        <p class="text-red-600 text-[11px] italic">R$ ${t.p.toFixed(2)}</p>
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
        
        // CORREÇÃO UNDEFINED: Se for doce mostra chocolate, se for salgada mostra descrição
        let info = s.tipo === 'doce' ? (s.chocolate && s.chocolate !== 'Nenhum' ? `Chocolate: ${s.chocolate}` : (s.desc || "")) : (s.desc || "");

        return `<div onclick="toggleSabor('${s.nome}', '${s.chocolate || 'Nenhum'}')" class="bg-zinc-900 border-2 ${isSelected ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center cursor-pointer">
            <div class="flex-1 pr-2">
                <p class="font-bold text-[11px] uppercase">${s.nome}</p>
                <p class="text-[9px] text-zinc-500">${info}</p>
            </div>
            <div class="text-red-600 font-black">${isSelected ? '●' : '○'}</div>
        </div>`;
    }).join('');

    const bordas = cardapioGeral.filter(i => i.tipo === 'borda' && i.disponivel !== false);
    document.getElementById('bordas-container').innerHTML = bordas.map(b => `<div onclick="toggleBorda('${b.nome}', ${b.preco})" class="bg-zinc-900 border-2 ${pedido.borda?.nome === b.nome ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center mb-2">
        <span class="text-[10px] uppercase font-bold">${b.nome} (+ R$ ${b.preco.toFixed(2)})</span>
        <div class="text-red-600 font-black">${pedido.borda?.nome === b.nome ? '●' : '○'}</div>
    </div>`).join('');

    const bebidas = cardapioGeral.filter(i => i.tipo === 'bebida' && i.disponivel !== false);
    document.getElementById('bebidas-container').innerHTML = bebidas.map(b => `<div onclick="toggleBebida('${b.nome}', ${b.preco})" class="bg-zinc-900 border-2 ${pedido.bebidas.find(x => x.nome === b.nome) ? 'border-red-600' : 'border-zinc-800'} p-3 rounded-xl flex justify-between items-center mb-2">
        <span class="text-[10px] uppercase font-bold">${b.nome} (+ R$ ${b.preco.toFixed(2)})</span>
        <div class="text-red-600 font-black">${pedido.bebidas.find(x => x.nome === b.nome) ? '●' : '○'}</div>
    </div>`).join('');
    document.getElementById('flavor-count').innerText = `${pedido.sabores.length}/${pedido.maxSabores}`;
}

function toggleSabor(nome, choco) {
    const idx = pedido.sabores.findIndex(p => p.nome === nome);
    if(idx > -1) pedido.sabores.splice(idx, 1);
    else if(pedido.sabores.length < pedido.maxSabores) pedido.sabores.push({ nome, chocolate: choco });
    else alert(`Máximo ${pedido.maxSabores} sabores.`);
    renderCardapio();
}

function toggleBorda(nome, preco) {
    pedido.borda = (pedido.borda?.nome === nome) ? null : { nome, preco: Number(preco) };
    renderCardapio(); atualizarTotal();
}

function toggleBebida(nome, preco) {
    const idx = pedido.bebidas.findIndex(x => x.nome === nome);
    if(idx > -1) pedido.bebidas.splice(idx, 1);
    else pedido.bebidas.push({ nome, preco: Number(preco) });
    renderCardapio(); atualizarTotal();
}

function aplicarCupom() {
    const cod = document.getElementById('input-cupom').value.toUpperCase().trim();
    if(cod === precosDB.cupomNome) { pedido.desconto = precosDB.cupomValor; alert("Cupom OK!"); atualizarTotal(); }
    else alert("Incorreto.");
}

function toggleTroco() {
    document.getElementById('div-troco').classList.toggle('hidden', document.getElementById('pagamento').value !== 'Dinheiro');
}

function atualizarTotal() {
    const taxa = (metodoEnvio === 'entrega') ? precosDB.taxa : 0;
    const pBorda = pedido.borda ? pedido.borda.preco : 0;
    const pBebida = pedido.bebidas.reduce((s, i) => s + i.preco, 0);
    pedido.total = (pedido.valorPizza + pBorda + pBebida + taxa) - pedido.desconto;
    document.getElementById('total-price').innerText = `R$ ${pedido.total.toFixed(2)}`;
    document.getElementById('delivery-text').innerText = (metodoEnvio === 'entrega') ? `Taxa: R$ ${taxa.toFixed(2)}` : "Retirada";
}

async function sendOrder() {
    if(!lojaAberta) return alert("Loja Fechada.");
    const pag = document.getElementById('pagamento').value;
    const troco = document.getElementById('troco-para').value;
    const saboresTexto = pedido.sabores.map(s => `${s.nome}${s.chocolate !== 'Nenhum' ? ' ('+s.chocolate+')' : ''}`).join(' / ');
    
    const dadosPedido = {
        cliente: cliente.nome, endereco: cliente.endereco, referencia: cliente.ref, tipo: cliente.tipo,
        tamanho: pedido.tamanho.toUpperCase(), sabores: saboresTexto, borda: pedido.borda?.nome || "Sem Borda",
        bebidas: pedido.bebidas.map(b => b.nome).join(', ') || "Nenhuma", pagamento: pag, trocoPara: troco || 0, total: pedido.total, data: new Date()
    };

    await db.collection('pedidos').add(dadosPedido);
    const msg = `*PEDIDO REIS*%0A*Cliente:* ${cliente.nome}%0A*End:* ${cliente.endereco}%0A*Pizza:* ${pedido.tamanho.toUpperCase()}%0A*Sabores:* ${saboresTexto}%0A*Total:* R$ ${pedido.total.toFixed(2)}`;
    window.open(`https://wa.me/5545999683117?text=${msg}`);
}
init();