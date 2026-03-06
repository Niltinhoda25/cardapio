const firebaseConfig = {
    apiKey: "AIzaSyDP-I5zYn9gVIMgNLFULIQTHypi0CqmlwA",
    authDomain: "pizzaria-reis-173ab.firebaseapp.com",
    projectId: "pizzaria-reis-173ab",
    storageBucket: "pizzaria-reis-173ab.firebasestorage.app",
    messagingSenderId: "1051814435008",
    appId: "1:1051814435008:web:a596d3d67d7360e8fab525"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const db = firebase.firestore();

let mEnvio = 'entrega';
let pedido = { tamanho:'', max:0, valorPizza:0, sabores:[], borda:null, bebidas:[], total:0, desc:0, cupomAtivo: null, extraPremium: 0 };
let precosDB = { p:0, m:0, g:0, taxa:0 };
let cardapioGeral = [];
let lojaAberta = false;

function init() {
    db.collection('analytics').doc('geral').onSnapshot(doc => {
        if(doc.exists) { /* Analytics aqui se necessário */ }
    });

    db.collection('config').doc('visual').onSnapshot(doc => {
        if(doc.exists && doc.data().corFundo) document.documentElement.style.setProperty('--bg-site', doc.data().corFundo);
    });

    db.collection('config').doc('promocao').onSnapshot(doc => {
        const banner = document.getElementById('banner-promo');
        if(!banner) return;
        if(doc.exists && doc.data().ativo) {
            const p = doc.data();
            const agora = new Date();
            const h = agora.getHours().toString().padStart(2,'0') + ":" + agora.getMinutes().toString().padStart(2,'0');
            if(h >= p.inicio && h <= p.fim) {
                banner.innerText = p.texto; banner.style.backgroundColor = p.cor; banner.classList.remove('hidden');
            } else banner.classList.add('hidden');
        } else banner.classList.add('hidden');
    });

    db.collection('config').doc('geral').onSnapshot(doc => {
        lojaAberta = doc.exists ? doc.data().aberto : false;
        const s = document.getElementById('status-loja');
        if(s) s.innerHTML = lojaAberta ? '<span class="text-green-500 font-black">● Aberto Agora</span>' : '<span class="text-red-500 font-black">● Fechado</span>';
    });

    db.collection('config').doc('precos').onSnapshot(doc => { if(doc.exists) { precosDB.p=doc.data().p; precosDB.m=doc.data().m; precosDB.g=doc.data().g; } });
    db.collection('config').doc('identidade').onSnapshot(doc => { if(doc.exists) { precosDB.taxa=doc.data().taxa; } });

    db.collection('cardapio').orderBy('data','asc').onSnapshot(snap => {
        cardapioGeral = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(pedido.tamanho) renderItens();
    });
}

function mudarMetodo(m) {
    mEnvio = m;
    const btnE = document.getElementById('btn-entrega');
    const btnR = document.getElementById('btn-retirada');
    const boxE = document.getElementById('box-endereco');
    if(m === 'entrega') {
        btnE.className = 'flex-1 py-4 rounded-2xl font-black text-xs metodo-on';
        btnR.className = 'flex-1 py-4 rounded-2xl font-black text-xs metodo-off';
        boxE.classList.remove('hidden');
    } else {
        btnE.className = 'flex-1 py-4 rounded-2xl font-black text-xs metodo-off';
        btnR.className = 'flex-1 py-4 rounded-2xl font-black text-xs metodo-on';
        boxE.classList.add('hidden');
    }
    atualizarTotal();
}

function comecar() {
    if(!document.getElementById('c-nome').value) return alert("Por favor, diga seu nome!");
    document.getElementById('modal-cliente').classList.add('hidden');
    renderTamanhos();
}

function renderTamanhos() {
    const tams = [{id:'p', n:'PEQUENA', p:precosDB.p, m:1}, {id:'m', n:'MÉDIA', p:precosDB.m, m:2}, {id:'g', n:'GRANDE', p:precosDB.g, m:3}];
    document.getElementById('lista-tamanhos').innerHTML = tams.map(t => `
        <div onclick="selecionarTamanho('${t.id}', ${t.p}, ${t.m})" class="bg-white text-black p-4 rounded-2xl text-center shadow-lg active:scale-95 transition-all cursor-pointer">
            <h4 class="text-[9px] font-black uppercase">${t.n}</h4>
            <p class="text-red-600 font-black text-xs">R$ ${t.p.toFixed(2)}</p>
        </div>`).join('');
}

function selecionarTamanho(id, preco, max) {
    pedido.tamanho = id; pedido.valorPizza = preco; pedido.max = max; pedido.sabores = []; pedido.extraPremium = 0;
    ['secao-sabores', 'secao-bordas', 'secao-bebidas', 'barra-pedido'].forEach(s => document.getElementById(s).classList.remove('hidden'));
    renderItens(); atualizarTotal();
    document.getElementById('secao-sabores').scrollIntoView({ behavior: 'smooth' });
}

function renderItens() {
    const ativos = cardapioGeral.filter(i => i.disponivel !== false);

    // RENDER SALGADAS E DOCES COMUNS
    const salgadas = ativos.filter(i => i.tipo === 'pizza');
    const doces = ativos.filter(i => i.tipo === 'doce');
    
    const renderSabor = (p) => {
        const isSel = pedido.sabores.find(s => s.nome === p.nome);
        return `<div onclick="toggleSabor('${p.nome}', ${p.preco || 0})" class="item-card flex justify-between items-center ${isSel ? 'selected' : ''}">
            <div><p class="text-xs font-black uppercase">${p.nome}</p><p class="text-[9px] text-zinc-500">${p.desc || ''}</p></div>
            <div class="text-red-600 font-black">${isSel ? '●' : '○'}</div>
        </div>`;
    };

    document.getElementById('lista-sabores-salgados').innerHTML = salgadas.map(renderSabor).join('');
    document.getElementById('lista-sabores-doces').innerHTML = doces.map(renderSabor).join('');

    // RENDER PREMIUM COM ADICIONAL NO TEXTO
    const premium = ativos.filter(i => i.tipo === 'premium');
    document.getElementById('lista-sabores-premium').innerHTML = premium.map(p => {
        const isSel = pedido.sabores.find(s => s.nome === p.nome);
        return `<div onclick="toggleSabor('${p.nome}', ${p.preco})" class="item-card flex justify-between items-center ${isSel ? 'selected' : ''}">
            <div>
                <p class="text-xs font-black uppercase">${p.nome}</p>
                <p class="text-[9px] text-purple-400 font-bold">+ R$ ${p.preco.toFixed(2)}</p>
            </div>
            <div class="text-red-600 font-black">${isSel ? '●' : '○'}</div>
        </div>`;
    }).join('');

    document.getElementById('contador-sabores').innerText = `${pedido.sabores.length}/${pedido.max}`;

    const bordas = ativos.filter(i => i.tipo === 'borda');
    document.getElementById('lista-bordas').innerHTML = bordas.map(b => `
        <div onclick="setBorda('${b.nome}', ${b.preco})" class="item-card flex justify-between items-center ${pedido.borda?.nome === b.nome ? 'selected' : ''}">
            <p class="text-[10px] font-black uppercase">${b.nome} (+ R$ ${b.preco.toFixed(2)})</p>
            <div class="text-red-600 font-black">${pedido.borda?.nome === b.nome ? '●' : '○'}</div>
        </div>`).join('');

    const drinks = ativos.filter(i => i.tipo === 'bebida');
    document.getElementById('lista-bebidas').innerHTML = drinks.map(b => {
        const isSel = pedido.bebidas.find(x => x.nome === b.nome);
        return `<div onclick="toggleBebida('${b.nome}', ${b.preco})" class="item-card flex justify-between items-center ${isSel ? 'selected' : ''}">
            <p class="text-[10px] font-black uppercase">${b.nome} (+ R$ ${b.preco.toFixed(2)})</p>
            <div class="text-red-600 font-black">${isSel ? '●' : '○'}</div>
        </div>`;
    }).join('');
}

function toggleSabor(nome, extra) {
    const idx = pedido.sabores.findIndex(s => s.nome === nome);
    if(idx > -1) {
        pedido.sabores.splice(idx, 1);
    } else if(pedido.sabores.length < pedido.max) {
        pedido.sabores.push({nome, extra});
    } else {
        alert(`Máximo de ${pedido.max} sabores!`);
    }
    
    // CALCULA O EXTRA TOTAL (Se for meio a meio, soma as metades dos extras)
    pedido.extraPremium = pedido.sabores.reduce((acc, obj) => acc + (obj.extra / pedido.max), 0);
    
    renderItens();
    atualizarTotal();
}

function setBorda(n, p) { pedido.borda = (pedido.borda?.nome === n) ? null : {nome: n, preco: p}; renderItens(); atualizarTotal(); }
function toggleBebida(n, p) {
    const idx = pedido.bebidas.findIndex(x => x.nome === n);
    if(idx > -1) pedido.bebidas.splice(idx, 1); else pedido.bebidas.push({nome: n, preco: p});
    renderItens(); atualizarTotal();
}

function verTroco() {
    const pag = document.getElementById('select-pag').value;
    document.getElementById('box-troco').classList.toggle('hidden', pag !== 'Dinheiro');
}

async function validarCupom() {
    const cod = document.getElementById('cupom-input').value.toUpperCase().trim();
    if(!cod) return;
    const doc = await db.collection('cupons').doc(cod).get();
    if(!doc.exists) return alert("Cupom inválido!");
    const c = doc.data();
    if(c.usos >= c.limite) return alert("Cupom esgotado!");
    if(c.regra === 'MG' && pedido.tamanho === 'p') return alert("Válido apenas para Média e Grande!");
    pedido.desc = c.valor;
    pedido.cupomAtivo = cod;
    alert("Desconto aplicado!");
    atualizarTotal();
}

function atualizarTotal() {
    const taxa = mEnvio === 'entrega' ? precosDB.taxa : 0;
    const bP = pedido.borda ? pedido.borda.preco : 0;
    const dP = pedido.bebidas.reduce((a, b) => a + b.preco, 0);
    // TOTAL = (Pizza Base + Extra Premium) + Borda + Bebidas + Taxa - Cupom
    pedido.total = (pedido.valorPizza + pedido.extraPremium + bP + dP + taxa) - pedido.desc;
    document.getElementById('txt-total').innerText = "R$ " + pedido.total.toFixed(2);
    document.getElementById('txt-taxa').innerText = mEnvio === 'entrega' ? "Taxa: R$ " + taxa.toFixed(2) : "Retirada no Local";
}

async function cliqueFinalizar() {
    if(!lojaAberta) return alert("Loja Fechada!");
    if(pedido.sabores.length === 0) return alert("Escolha o sabor!");
    if(pedido.cupomAtivo) await db.collection('cupons').doc(pedido.cupomAtivo).update({ usos: firebase.firestore.FieldValue.increment(1) });
    
    const troco = document.getElementById('troco-input').value;
    let msg = `*NOVO PEDIDO - REIS PIZZARIA*%0A*Cliente:* ${document.getElementById('c-nome').value}%0A*Método:* ${mEnvio.toUpperCase()}%0A*Pizza:* ${pedido.tamanho.toUpperCase()}%0A*Sabores:* ${pedido.sabores.map(s=>s.nome).join(' / ')}%0A`;
    if(pedido.extraPremium > 0) msg += `*Adicional Premium:* R$ ${pedido.extraPremium.toFixed(2)}%0A`;
    if(pedido.borda) msg += `*Borda:* ${pedido.borda.nome}%0A`;
    if(pedido.bebidas.length > 0) msg += `*Bebidas:* ${pedido.bebidas.map(b => b.nome).join(', ')}%0A`;
    msg += `*Pagamento:* ${document.getElementById('select-pag').value}${troco ? ' (Troco p/ R$ ' + troco + ')' : ''}%0A*TOTAL:* R$ ${pedido.total.toFixed(2)}`;
    window.open(`https://wa.me/5545999683117?text=${msg}`);
}

window.onload = init;