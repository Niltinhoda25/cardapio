// CONFIGURAÇÃO DO FIREBASE (Verifique se estas são suas chaves atuais)
const firebaseConfig = {
    apiKey: "AIzaSyDP-I5zYn9gVIMgNLFULIQTHypi0CqmlwA",
    authDomain: "pizzaria-reis-173ab.firebaseapp.com",
    projectId: "pizzaria-reis-173ab",
    storageBucket: "pizzaria-reis-173ab.firebasestorage.app",
    messagingSenderId: "1051814435008",
    appId: "1:1051814435008:web:a596d3d67d7360e8fab525"
};

// Inicializa o Firebase se ainda não foi inicializado
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// VARIÁVEIS GLOBAIS DO PEDIDO
let mEnvio = 'entrega';
let pedido = { 
    tamanho: '', 
    max: 0, 
    valorPizza: 0, 
    sabores: [], 
    borda: null, 
    bebidas: [], 
    total: 0, 
    desc: 0 
};
let precosDB = { p: 0, m: 0, g: 0, taxa: 0, cupomNome: '', cupomValor: 0 };
let cardapioGeral = [];
let lojaAberta = false;

// FUNÇÃO DE INICIALIZAÇÃO
function init() {
    // 1. Analytics - Contador de Visitas
    db.collection('analytics').doc('geral').set({ 
        visitas: firebase.firestore.FieldValue.increment(1) 
    }, { merge: true });

    // 2. Monitorar Cor Global do Site
    db.collection('config').doc('visual').onSnapshot(doc => {
        if(doc.exists && doc.data().corFundo) {
            document.documentElement.style.setProperty('--bg-site', doc.data().corFundo);
        }
    });

    // 3. Monitorar Banner de Promoção
    db.collection('config').doc('promocao').onSnapshot(doc => {
        const banner = document.getElementById('banner-promo');
        if(!banner) return;
        if(doc.exists && doc.data().ativo) {
            const p = doc.data();
            const agora = new Date();
            const horaAtual = agora.getHours().toString().padStart(2,'0') + ":" + agora.getMinutes().toString().padStart(2,'0');
            
            if(horaAtual >= p.inicio && horaAtual <= p.fim) {
                banner.innerText = p.texto; 
                banner.style.backgroundColor = p.cor; 
                banner.classList.remove('hidden');
            } else {
                banner.classList.add('hidden');
            }
        } else {
            banner.classList.add('hidden');
        }
    });

    // 4. Status da Loja (Aberto/Fechado)
    db.collection('config').doc('geral').onSnapshot(doc => {
        lojaAberta = doc.exists ? doc.data().aberto : false;
        const statusEl = document.getElementById('status-loja');
        if(statusEl) {
            statusEl.innerHTML = lojaAberta ? 
                '<span class="text-green-500 font-black">● Aberto Agora</span>' : 
                '<span class="text-red-500 font-black">● Fechado</span>';
        }
    });

    // 5. Carregar Preços das Pizzas
    db.collection('config').doc('precos').onSnapshot(doc => { 
        if(doc.exists) { 
            precosDB.p = doc.data().p || 0; 
            precosDB.m = doc.data().m || 0; 
            precosDB.g = doc.data().g || 0; 
        } 
    });

    // 6. Carregar Taxa e Cupom
    db.collection('config').doc('identidade').onSnapshot(doc => { 
        if(doc.exists) { 
            precosDB.taxa = doc.data().taxa || 0; 
            precosDB.cupomNome = (doc.data().cupomNome || '').toUpperCase(); 
            precosDB.cupomValor = doc.data().cupomValor || 0; 
        } 
    });

    // 7. Carregar Itens do Cardápio
    db.collection('cardapio').orderBy('data','asc').onSnapshot(snap => {
        cardapioGeral = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if(pedido.tamanho) renderItens(); // Re-renderiza se já tiver escolhido tamanho
    });
}

// MUDAR ENTRE ENTREGA E RETIRADA
function mudarMetodo(m) {
    mEnvio = m;
    const btnE = document.getElementById('btn-entrega');
    const btnR = document.getElementById('btn-retirada');
    const boxEnd = document.getElementById('box-endereco');

    if(m === 'entrega') {
        btnE.className = 'flex-1 py-4 rounded-2xl font-black text-xs metodo-on';
        btnR.className = 'flex-1 py-4 rounded-2xl font-black text-xs metodo-off';
        boxEnd.classList.remove('hidden');
    } else {
        btnE.className = 'flex-1 py-4 rounded-2xl font-black text-xs metodo-off';
        btnR.className = 'flex-1 py-4 rounded-2xl font-black text-xs metodo-on';
        boxEnd.classList.add('hidden');
    }
    atualizarTotal();
}

// BOTÃO INICIAL DO MODAL
function comecar() {
    const nome = document.getElementById('c-nome').value;
    if(!nome) { alert("Por favor, digite seu nome!"); return; }
    document.getElementById('modal-cliente').classList.add('hidden');
    renderTamanhos();
}

// RENDERIZAR OPÇÕES DE TAMANHO
function renderTamanhos() {
    const tams = [
        {id:'p', n:'PEQUENA', p:precosDB.p, m:1}, 
        {id:'m', n:'MÉDIA', p:precosDB.m, m:2}, 
        {id:'g', n:'GRANDE', p:precosDB.g, m:3}
    ];
    document.getElementById('lista-tamanhos').innerHTML = tams.map(t => `
        <div onclick="selecionarTamanho('${t.id}', ${t.p}, ${t.m})" class="bg-white text-black p-4 rounded-2xl text-center shadow-lg active:scale-95 transition-all cursor-pointer">
            <h4 class="text-[9px] font-black uppercase">${t.n}</h4>
            <p class="text-red-600 font-black text-xs">R$ ${t.p.toFixed(2)}</p>
        </div>
    `).join('');
}

// AO SELECIONAR UM TAMANHO
function selecionarTamanho(id, preco, max) {
    pedido.tamanho = id; 
    pedido.valorPizza = preco; 
    pedido.max = max; 
    pedido.sabores = []; // Limpa sabores ao trocar tamanho

    document.getElementById('secao-sabores').classList.remove('hidden');
    document.getElementById('secao-bordas').classList.remove('hidden');
    document.getElementById('secao-bebidas').classList.remove('hidden');
    document.getElementById('barra-pedido').classList.remove('hidden');
    
    renderItens(); 
    atualizarTotal();
    
    // Scroll suave para os sabores
    document.getElementById('secao-sabores').scrollIntoView({ behavior: 'smooth' });
}

// RENDERIZAR SABORES, BORDAS E BEBIDAS
function renderItens() {
    // Sabores (Pizzas e Doces)
    const sabores = cardapioGeral.filter(i => i.tipo === 'pizza' || i.tipo === 'doce');
    document.getElementById('lista-sabores').innerHTML = sabores.map(p => {
        const isSel = pedido.sabores.includes(p.nome);
        return `
            <div onclick="toggleSabor('${p.nome}')" class="item-card flex justify-between items-center ${isSel ? 'selected' : ''}">
                <div>
                    <p class="text-xs font-black uppercase">${p.nome}</p>
                    <p class="text-[9px] text-zinc-500">${p.desc || ''}</p>
                </div>
                <div class="text-red-600 font-black">${isSel ? '●' : '○'}</div>
            </div>`;
    }).join('');
    document.getElementById('contador-sabores').innerText = `${pedido.sabores.length}/${pedido.max}`;

    // Bordas
    const bordas = cardapioGeral.filter(i => i.tipo === 'borda');
    document.getElementById('lista-bordas').innerHTML = bordas.map(b => `
        <div onclick="setBorda('${b.nome}', ${b.preco})" class="item-card flex justify-between items-center ${pedido.borda?.nome === b.nome ? 'selected' : ''}">
            <p class="text-[10px] font-black uppercase">${b.nome} (+ R$ ${b.preco.toFixed(2)})</p>
            <div class="text-red-600 font-black">${pedido.borda?.nome === b.nome ? '●' : '○'}</div>
        </div>`);

    // Bebidas
    const drinks = cardapioGeral.filter(i => i.tipo === 'bebida');
    document.getElementById('lista-bebidas').innerHTML = drinks.map(b => {
        const isSel = pedido.bebidas.find(x => x.nome === b.nome);
        return `
            <div onclick="toggleBebida('${b.nome}', ${b.preco})" class="item-card flex justify-between items-center ${isSel ? 'selected' : ''}">
                <p class="text-[10px] font-black uppercase">${b.nome} (+ R$ ${b.preco.toFixed(2)})</p>
                <div class="text-red-600 font-black">${isSel ? '●' : '○'}</div>
            </div>`;
    }).join('');
}

// SELECIONAR SABORES
function toggleSabor(n) {
    const idx = pedido.sabores.indexOf(n);
    if(idx > -1) {
        pedido.sabores.splice(idx, 1);
    } else {
        if(pedido.sabores.length < pedido.max) {
            pedido.sabores.push(n);
        } else {
            alert(`Limite de ${pedido.max} sabor(es) atingido!`);
        }
    }
    renderItens();
}

// SELECIONAR BORDA
function setBorda(n, p) {
    if(pedido.borda?.nome === n) {
        pedido.borda = null;
    } else {
        pedido.borda = { nome: n, preco: p };
    }
    renderItens(); 
    atualizarTotal();
}

// SELECIONAR BEBIDA
function toggleBebida(n, p) {
    const idx = pedido.bebidas.findIndex(x => x.nome === n);
    if(idx > -1) {
        pedido.bebidas.splice(idx, 1);
    } else {
        pedido.bebidas.push({ nome: n, preco: p });
    }
    renderItens(); 
    atualizarTotal();
}

// MOSTRAR/OCULTAR TROCO
function verTroco() {
    const pag = document.getElementById('select-pag').value;
    const boxTroco = document.getElementById('box-troco');
    if(pag === 'Dinheiro') {
        boxTroco.classList.remove('hidden');
    } else {
        boxTroco.classList.add('hidden');
        document.getElementById('troco-input').value = '';
    }
}

// VALIDAR CUPOM
function validarCupom() {
    const cod = document.getElementById('cupom-input').value.toUpperCase().trim();
    if(cod !== "" && cod === precosDB.cupomNome) {
        pedido.desc = precosDB.cupomValor;
        alert("Cupom aplicado: R$ " + precosDB.cupomValor.toFixed(2) + " de desconto!");
    } else {
        pedido.desc = 0;
        alert("Cupom inválido.");
    }
    atualizarTotal();
}

// CALCULAR TOTAL
function atualizarTotal() {
    const taxa = mEnvio === 'entrega' ? precosDB.taxa : 0;
    const precoBorda = pedido.borda ? pedido.borda.preco : 0;
    const precoBebidas = pedido.bebidas.reduce((soma, item) => soma + item.preco, 0);
    
    pedido.total = (pedido.valorPizza + precoBorda + precoBebidas + taxa) - pedido.desc;
    
    if(pedido.total < 0) pedido.total = 0;

    document.getElementById('txt-total').innerText = "R$ " + pedido.total.toFixed(2);
    document.getElementById('txt-taxa').innerText = mEnvio === 'entrega' ? "Taxa: R$ " + taxa.toFixed(2) : "Retirada no Local";
}

// FINALIZAR E ENVIAR WHATSAPP
function cliqueFinalizar() {
    if(!lojaAberta) return alert("A loja está fechada agora!");
    if(pedido.sabores.length === 0) return alert("Escolha o sabor da pizza!");
    
    const nome = document.getElementById('c-nome').value;
    const rua = document.getElementById('c-rua').value;
    const bairro = document.getElementById('c-bairro').value;
    const pag = document.getElementById('select-pag').value;
    const troco = document.getElementById('troco-input').value;

    // Analytics Clique
    db.collection('analytics').doc('geral').update({ cliques: firebase.firestore.FieldValue.increment(1) });

    let msg = `*NOVO PEDIDO - REIS PIZZARIA*%0A`;
    msg += `------------------------------%0A`;
    msg += `*Cliente:* ${nome}%0A`;
    msg += `*Método:* ${mEnvio.toUpperCase()}%0A`;
    if(mEnvio === 'entrega') msg += `*Endereço:* ${rua}, ${bairro}%0A`;
    msg += `------------------------------%0A`;
    msg += `*Pizza:* ${pedido.tamanho.toUpperCase()}%0A`;
    msg += `*Sabores:* ${pedido.sabores.join(' / ')}%0A`;
    if(pedido.borda) msg += `*Borda:* ${pedido.borda.nome}%0A`;
    if(pedido.bebidas.length > 0) msg += `*Bebidas:* ${pedido.bebidas.map(b => b.nome).join(', ')}%0A`;
    msg += `------------------------------%0A`;
    msg += `*Pagamento:* ${pag}${troco ? ' (Troco para R$ ' + troco + ')' : ''}%0A`;
    if(pedido.desc > 0) msg += `*Desconto:* R$ ${pedido.desc.toFixed(2)}%0A`;
    msg += `*TOTAL:* R$ ${pedido.total.toFixed(2)}`;

    window.open(`https://wa.me/5545999683117?text=${msg}`);
}

// INICIA TUDO
window.onload = init;