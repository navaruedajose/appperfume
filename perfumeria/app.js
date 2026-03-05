/* ============================================================
   PERFUMEFLOW APP — JAVASCRIPT v4
   Dashboard Premium, TPV, Calculadora y Reportes de Venta
   ============================================================ */

/* ============================================================
   ✏️  USUARIOS PERMITIDOS — Edita esta lista para agregar o
       quitar acceso. Los nombres NO son sensibles a mayúsculas.
   ============================================================ */
const USUARIOS_PERMITIDOS = [
  'admin',
  'usuario1',
  'usuario2',
  // Agrega más usuarios aquí, por ejemplo:
  'ricardo',
  // 'maria',
  // 'carlos',
];
/* ============================================================ */

// ── LOGIN / AUTENTICACIÓN ────────────────────────────────────
const LOGIN_KEY = 'pf_usuario_activo';

function checkLogin() {
  const stored = localStorage.getItem(LOGIN_KEY);
  if (stored) {
    // Ya tiene sesión guardada en este dispositivo
    document.getElementById('login-screen').style.display = 'none';
    return true;
  }
  // Muestra la pantalla de login
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('view-panel').style.visibility = 'hidden';
  setTimeout(() => document.getElementById('login-username').focus(), 100);
  return false;
}

function doLogin() {
  const input = document.getElementById('login-username');
  const errorEl = document.getElementById('login-error');
  const username = (input.value || '').trim().toLowerCase();

  if (!username) {
    shakeError(errorEl, 'Por favor escribe tu nombre de usuario.');
    return;
  }

  const allowed = USUARIOS_PERMITIDOS.map(u => u.toLowerCase());
  if (!allowed.includes(username)) {
    shakeError(errorEl, 'Usuario no reconocido. Contacta al administrador.');
    input.value = '';
    input.focus();
    return;
  }

  // ✅ Acceso concedido — guardar en este dispositivo
  localStorage.setItem(LOGIN_KEY, username);
  const screen = document.getElementById('login-screen');
  screen.classList.add('login-fade-out');
  setTimeout(() => {
    screen.style.display = 'none';
    document.getElementById('view-panel').style.visibility = '';
  }, 500);
}

function shakeError(el, msg) {
  el.textContent = msg;
  el.classList.remove('login-shake');
  void el.offsetWidth; // reflow para reiniciar animación
  el.classList.add('login-shake');
}

const DECANT_SIZES = [3, 5, 10];
const DECANT_MULTIPLIER = 1.75;
const PAGE_SIZE = 6;

// Inventario vacío — el usuario agrega sus propios perfumes
const SEED_PRODUCTS = [];

let products = JSON.parse(localStorage.getItem('pf_v3_products')) || SEED_PRODUCTS;
let nextId = JSON.parse(localStorage.getItem('pf_v3_nextId')) || (products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1);
let sales = JSON.parse(localStorage.getItem('pf_v4_sales')) || [];
let currentTab = 'inventory';
let filterCat = 'Todos';
let searchQ = '';
let currentPage = 1;

function save() {
  localStorage.setItem('pf_v3_products', JSON.stringify(products));
  localStorage.setItem('pf_v3_nextId', JSON.stringify(nextId));
  localStorage.setItem('pf_v4_sales', JSON.stringify(sales));
}

// ── EXPORTAR / IMPORTAR RESPALDO ──────────────────────────────
function exportData() {
  const backup = {
    version: 'pf_v4',
    exportedAt: new Date().toISOString(),
    products,
    nextId,
    sales
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const fecha = new Date().toLocaleDateString('es-MX').replace(/\//g, '-');
  a.href = url;
  a.download = `PerfumeFlow_Respaldo_${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ Respaldo exportado correctamente');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.products || !Array.isArray(data.products)) {
          showToast('❌ Archivo inválido: no es un respaldo de PerfumeFlow', 'error');
          return;
        }
        if (!confirm(`¿Restaurar respaldo del ${new Date(data.exportedAt).toLocaleString()}?\n\nEsto reemplazará TODO el inventario y ventas actuales.`)) return;
        products = data.products;
        nextId = data.nextId || (Math.max(0, ...products.map(p => p.id)) + 1);
        sales = data.sales || [];
        save();
        showToast('✅ Respaldo restaurado. Recargando...');
        setTimeout(() => location.reload(), 1500);
      } catch {
        showToast('❌ Error al leer el archivo. Asegúrate de que sea un respaldo válido.', 'error');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => { t.className = 'toast'; }, 3200);
}

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtMoney(n) {
  return '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPerfumeEmoji(family) {
  if (!family) return '🌸';
  const f = family.toLowerCase();
  if (f.includes('floral')) return '🌸';
  if (f.includes('cítrico') || f.includes('citrico')) return '🍋';
  if (f.includes('amaderado')) return '🌲';
  if (f.includes('oriental')) return '🪔';
  if (f.includes('acuático') || f.includes('acuatico')) return '🌊';
  if (f.includes('aromático') || f.includes('aromatico')) return '🌿';
  if (f.includes('gourmand')) return '🍦';
  return '✨';
}

function calcDecants(p) {
  if (!p.ml || !p.buyPrice) return null;
  const pricePerMl = p.buyPrice / p.ml;
  const decants = {};
  DECANT_SIZES.forEach(size => {
    const customKey = `price${size}`;
    if (p[customKey] && parseFloat(p[customKey]) > 0) {
      decants[size] = parseFloat(p[customKey]);
    } else {
      decants[size] = pricePerMl * size * DECANT_MULTIPLIER;
    }
  });

  const decantsPerBottle3ml = Math.floor(p.ml / 3);
  const totalDecantRevenue = decantsPerBottle3ml * decants[3];
  const bottleProfit = (p.sellPrice || 0) - p.buyPrice;
  return { pricePerMl, decants, totalDecantRevenue, bottleProfit };
}

// ── ROUTER ────────────────────────────────────────────────────
function switchTab(tab) {
  currentTab = tab;
  const tabs = ['dashboard', 'inventory', 'decants', 'analytics'];
  tabs.forEach(t => {
    const el = document.getElementById(`panel-${t}`);
    const link = document.getElementById(`tab-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
    if (link) link.classList.toggle('active', t === tab);
  });
  if (tab === 'inventory') renderTable();
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'decants') renderDecants();
  if (tab === 'analytics') renderAnalytics();

  window.scrollTo(0, 0);
  history.pushState({}, '', `#${tab}`);
}

// ── RENDER TABLA INVENTARIO ───────────────────────────────────
function getFilteredProducts() {
  let list = [...products];
  if (filterCat !== 'Todos') list = list.filter(p => (p.family || '').toLowerCase().includes(filterCat.toLowerCase()));
  if (searchQ) {
    const q = searchQ.toLowerCase();
    list = list.filter(p => (p.name || '').toLowerCase().includes(q) || (p.brand || '').toLowerCase().includes(q));
  }
  return list;
}
function filterCategory(cat, btn) { filterCat = cat; currentPage = 1; document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); btn.classList.add('active'); renderTable(); }
function searchProducts() { searchQ = document.getElementById('search-input').value; currentPage = 1; renderTable(); }
function changePage(dir) {
  const f = getFilteredProducts();
  const pages = Math.max(1, Math.ceil(f.length / PAGE_SIZE));
  currentPage = Math.max(1, Math.min(pages, currentPage + dir));
  renderTable();
}

function renderTable() {
  const filtered = getFilteredProducts();
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  if (currentPage > pages) currentPage = pages;
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const tbody = document.getElementById('products-tbody');

  const totalStock = products.reduce((s, p) => s + (p.stock || 0), 0);
  const totalValue = products.reduce((s, p) => s + ((p.stock || 0) * (p.buyPrice || 0)) + (((p.openedMl || 0) / p.ml) * (p.buyPrice || 0)), 0);
  const totalProfit = products.reduce((s, p) => s + ((p.sellPrice || 0) - (p.buyPrice || 0)) * (p.stock || 0), 0);

  document.getElementById('inv-metrics').innerHTML = `
    <div class="metric-card"><div class="metric-top"><span class="metric-label">Stock Cerrado</span><span class="material-symbols-outlined metric-icon">inventory_2</span></div><p class="metric-value">${totalStock.toLocaleString()}</p></div>
    <div class="metric-card"><div class="metric-top"><span class="metric-label">Inv. Invertido</span><span class="material-symbols-outlined metric-icon">payments</span></div><p class="metric-value">${fmtMoney(totalValue)}</p></div>
    <div class="metric-card"><div class="metric-top"><span class="metric-label">Ganancia Latente</span><span class="material-symbols-outlined metric-icon" style="color:#10b981">trending_up</span></div><p class="metric-value" style="color:#10b981">${fmtMoney(totalProfit)}</p></div>`;

  if (paginated.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div style="padding:40px;text-align:center;color:#64748b;">No hay resultados.</div></td></tr>`;
  } else {
    tbody.innerHTML = paginated.map(p => {
      const sColor = p.stock === 0 ? '#ef4444' : p.stock < 5 ? '#f59e0b' : '#10b981';
      const oMl = p.openedMl > 0 ? `<div class="ml-cell">${fmtMoney(p.openedMl).replace('$', '')} ml</div>` : '<span style="color:#475569">—</span>';
      return `
        <tr>
          <td><div class="product-cell"><div class="product-thumb">${getPerfumeEmoji(p.family)}</div><div><div class="product-name">${esc(p.name)}</div><div class="product-sku">${esc(p.ml)}ml · ${esc(p.sku)}</div></div></div></td>
          <td>${esc(p.brand)}</td>
          <td class="text-right product-price">${fmtMoney(p.buyPrice)}</td>
          <td class="text-right product-price">${p.sellPrice ? fmtMoney(p.sellPrice) : '—'}</td>
          <td class="text-center"><span style="color:${sColor};font-weight:bold;font-size:14px;">${p.stock || 0}</span></td>
          <td class="text-center">${oMl}</td>
          <td>
            <div class="action-btns">
              <button class="btn-sell" onclick="openSellModal(${p.id})"><span class="material-symbols-outlined" style="font-size:14px">point_of_sale</span> Vender</button>
              <button class="action-btn edit" onclick="openModal(${p.id})"><span class="material-symbols-outlined">edit</span></button>
              <button class="action-btn delete" onclick="openDeleteModal(${p.id})"><span class="material-symbols-outlined">delete</span></button>
            </div>
          </td>
        </tr>`;
    }).join('');
  }
  document.getElementById('table-count').textContent = `Mostrando ${paginated.length} de ${filtered.length} productos`;
  document.getElementById('page-indicator').textContent = `${currentPage} / ${pages}`;
}

// ── RENDER DASHBOARD ──────────────────────────────────────────
function renderDashboard() {
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  let gananciaReal = 0, totalVentas = 0, prevGanancia = 0;

  sales.forEach(s => {
    const d = new Date(s.date);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      gananciaReal += s.profit;
      totalVentas++;
    } else if (d.getMonth() === currentMonth - 1) { // Lógica simple para prev month (fallo marginal en Enero)
      prevGanancia += s.profit;
    }
  });

  // Ventas totales
  document.getElementById('dash-ventas-count').textContent = sales.length;

  // Ganancia Real y Badge
  document.getElementById('dash-ganancia-real').textContent = fmtMoney(gananciaReal);
  const badge = document.getElementById('dash-ganancia-badge');
  if (prevGanancia === 0) {
    badge.innerHTML = `+100% <span class="material-symbols-outlined">trending_up</span>`;
    badge.className = 'dc-badge green';
  } else {
    const diff = ((gananciaReal - prevGanancia) / prevGanancia) * 100;
    badge.innerHTML = `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}% <span class="material-symbols-outlined">${diff >= 0 ? 'trending_up' : 'trending_down'}</span>`;
    badge.className = `dc-badge ${diff >= 0 ? 'green' : 'red'}`;
  }

  // ML Disponibles
  const mlTotal = products.reduce((acc, p) => acc + (p.stock * p.ml) + p.openedMl, 0);
  document.getElementById('dash-ml-total').textContent = mlTotal.toLocaleString() + 'ml';

  // Fragancia Star
  const salesMap = {};
  sales.forEach(s => salesMap[s.perfumeName] = (salesMap[s.perfumeName] || 0) + 1);
  const tops = Object.keys(salesMap).sort((a, b) => salesMap[b] - salesMap[a]);
  document.getElementById('dash-star-frag').textContent = tops.length > 0 ? (tops[0].length > 15 ? tops[0].substring(0, 14) + '..' : tops[0]) : 'N/A';

  // Rendimiento
  const valorInv = products.reduce((s, p) => s + ((p.stock || 0) * (p.buyPrice || 0)), 0);
  const gananciaLatente = products.reduce((s, p) => s + ((p.sellPrice || 0) - (p.buyPrice || 0)) * (p.stock || 0), 0);

  document.getElementById('dash-valor-inv').textContent = fmtMoney(valorInv);
  document.getElementById('dash-meta-text').textContent = `${fmtMoney(gananciaReal)} / ${fmtMoney(gananciaLatente)}`;

  let percentage = gananciaLatente === 0 ? 0 : (gananciaReal / gananciaLatente) * 100;
  if (percentage > 100) percentage = 100;
  document.getElementById('dash-meta-bar').style.width = `${percentage}%`;
  document.getElementById('dash-porcentaje').textContent = `${percentage.toFixed(1)}%`;

  // Actividad
  const recentList = document.getElementById('dash-recent-list');
  const recentSales = [...sales].reverse().slice(0, 5);
  if (recentSales.length === 0) {
    recentList.innerHTML = `<div style="text-align:center;padding:20px;color:#94A3B8;font-size:12px;">Sin ventas recientes</div>`;
  } else {
    recentList.innerHTML = recentSales.map(s => {
      const isBotella = s.type === 'Botella';
      return `
        <div class="recent-item">
          <div class="ri-info">
            <div class="ri-icon"><span class="material-symbols-outlined">${isBotella ? 'liquor' : 'water_drop'}</span></div>
            <div class="ri-text">
              <strong>${esc(s.perfumeName)} - ${isBotella ? 'Botella Completa' : s.type + 'ml'}</strong>
              <span>${new Date(s.date).toLocaleString()}</span>
            </div>
          </div>
          <div class="ri-amount">${fmtMoney(s.price)}</div>
        </div>
      `;
    }).join('');
  }
}

// ── VENDER TPV ────────────────────────────────────────────────
let currentSellId = null;
function openSellModal(id) {
  currentSellId = id;
  const p = products.find(x => x.id === id);
  if (!p) return;
  const d = calcDecants(p);

  document.getElementById('sell-title').textContent = 'Vender: ' + p.name;
  let sub = `Stock cerrado: ${p.stock || 0} | ML sueltos: ${p.openedMl || 0} ml`;
  document.getElementById('sell-subtitle').textContent = sub;

  let opts = '';
  // Vender Botella
  opts += `<div class="btn-sell-opt ${p.stock > 0 ? '' : 'disabled'}" onclick="execSale('Botella', ${p.sellPrice}, ${p.sellPrice - p.buyPrice})">
    <div>🍶 Botella Completa (${p.ml}ml)</div>
    <span>${p.sellPrice ? fmtMoney(p.sellPrice) : '—'}</span>
  </div>`;
  // Vender Decants
  [3, 5, 10].forEach(size => {
    const canSell = (p.openedMl >= size) || (p.stock > 0);
    const salePrice = d.decants[size];
    const costOfMl = d.pricePerMl * size;
    const profit = salePrice - costOfMl;
    opts += `<div class="btn-sell-opt ${canSell ? '' : 'disabled'}" onclick="execSale(${size}, ${salePrice}, ${profit})">
      <div>💧 Decant ${size}ml</div>
      <span>${fmtMoney(salePrice)}</span>
    </div>`;
  });

  document.getElementById('sell-options').innerHTML = opts;
  document.getElementById('sell-modal').style.display = 'flex';
}

function execSale(type, pricePaid, profitMade) {
  const p = products.find(x => x.id === currentSellId);
  if (!p) return;

  if (type === 'Botella') {
    if (p.stock > 0) p.stock -= 1;
  } else {
    const mlSell = parseInt(type);
    if (!p.openedMl) p.openedMl = 0;
    if (p.openedMl >= mlSell) {
      p.openedMl -= mlSell;
    } else if (p.stock > 0) {
      p.stock -= 1;
      p.openedMl += p.ml;
      p.openedMl -= mlSell;
    }
    p.openedMl = parseFloat(p.openedMl.toFixed(2));
  }

  // Register Sale
  sales.push({
    id: Date.now(),
    date: new Date().toISOString(),
    perfumeId: p.id,
    perfumeName: p.name,
    type: type,
    price: pricePaid,
    profit: profitMade
  });

  save();
  closeModal('sell-modal');
  showToast(`✅ Venta registrada: ${fmtMoney(pricePaid)}`);

  if (currentTab === 'inventory') renderTable();
  if (currentTab === 'dashboard') renderDashboard();
  if (currentTab === 'analytics') renderAnalytics();
}

function renderAnalytics() {
  const tbody = document.getElementById('sales-tbody');
  const salesRev = [...sales].reverse();

  if (salesRev.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:30px">No hay ventas registradas aún.</td></tr>`;
  } else {
    tbody.innerHTML = salesRev.map(s => `
      <tr>
        <td>${new Date(s.date).toLocaleString()}</td>
        <td style="color:#f1f5f9;font-weight:bold">${esc(s.perfumeName)}</td>
        <td>${s.type === 'Botella' ? 'Botella Completa' : 'Decant ' + s.type + 'ml'}</td>
        <td class="text-right" style="color:var(--gold);font-weight:bold">${fmtMoney(s.price)}</td>
        <td class="text-right" style="color:#10b981;font-weight:bold">+${fmtMoney(s.profit)}</td>
      </tr>
    `).join('');
  }
}

function clearSalesHistory() {
  if (confirm("¿Estás seguro de que quieres borrar el historial de ventas? Esto reiniciará las estadísticas de venta.")) {
    sales = [];
    save();
    renderAnalytics();
    if (currentTab === 'dashboard') renderDashboard();
    showToast("Historial limpiado.");
  }
}

// ── CALCULADORA IOS CON HISTORIAL Y DESCUENTO ─────────────────
let calcExp = '0';
let calcWait = false;
let calcPrev = null;
let calcOp = null;
let calcHistory = [];

function toggleCalc() {
  const el = document.getElementById('ios-calc');
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function updateCalcUI() {
  document.getElementById('calc-display').textContent = calcExp;
  const hBox = document.getElementById('calc-history-box');
  hBox.innerHTML = calcHistory.map(line => `<div class="calc-history-line">${line}</div>`).join('');
  hBox.scrollTop = hBox.scrollHeight;
}

function calcAction(val) {
  const acBtn = document.getElementById('calc-ac');

  if (val === 'AC') {
    calcExp = '0'; calcWait = false; calcPrev = null; calcOp = null; calcHistory = [];
    acBtn.textContent = 'AC';
  } else if (val === 'C') {
    calcExp = '0'; acBtn.textContent = 'AC';
  } else if (['+', '-', '*', '/'].includes(val)) {
    if (calcOp && !calcWait && calcPrev) {
      let result = String(eval(`${calcPrev}${calcOp}${calcExp}`));
      calcHistory.push(`${calcPrev} ${calcOp} ${calcExp} = ${result}`);
      calcExp = result;
    }
    calcPrev = calcExp;
    calcOp = val;
    calcWait = true;
  } else if (val === '=') {
    if (calcOp && calcPrev !== null) {
      let result = String(eval(`${calcPrev}${calcOp}${calcExp}`));
      calcHistory.push(`${calcPrev} ${calcOp} ${calcExp} = ${result}`);
      calcExp = result;
      calcOp = null; calcPrev = null; calcWait = true;
    }
  } else if (val === '+/-') {
    calcExp = String(parseFloat(calcExp) * -1);
  } else if (val === '%') {
    // Si hay un operador previo (+ o -), calculamos el descuento
    if (calcOp && ['+', '-'].includes(calcOp) && calcPrev) {
      let percentVal = (parseFloat(calcPrev) * parseFloat(calcExp)) / 100;
      calcHistory.push(`${calcExp}% de ${calcPrev} -> ${percentVal}`);
      calcExp = String(percentVal);
      // Queda esperando que el usuario presione = para aplicar la suma o resta final
    } else {
      calcExp = String(parseFloat(calcExp) / 100);
    }
  } else if (val === '.') {
    if (!calcExp.includes('.')) calcExp += '.';
    acBtn.textContent = 'C';
  } else {
    // numbers
    if (calcExp === '0' || calcWait) calcExp = val;
    else calcExp += val;
    calcWait = false;
    acBtn.textContent = 'C';
  }

  // format float
  if (calcExp.includes('.') && calcExp.length > 10) calcExp = parseFloat(calcExp).toFixed(4).replace(/\.?0+$/, '');
  if (calcExp.length > 10) calcExp = calcExp.substring(0, 10);

  updateCalcUI();
}

// ── IMPRIMIR PDF INVENTARIO LIMPIO ────────────────────────────
function printStockPDF() {
  const title = `Inventario_PerfumeFlow_${new Date().toLocaleDateString().replace(/\//g, '-')}`;

  // Create an invisible iframe
  const iframe = document.createElement('iframe');
  iframe.style.position = 'absolute';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  iframe.style.border = 'none';
  document.body.appendChild(iframe);

  const targetDoc = iframe.contentWindow.document;

  let html = `
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Helvetica', sans-serif; padding: 20px; color: #111; }
          h2 { text-align: center; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ccc; padding: 10px; text-align: left; font-size: 14px; }
          th { background: #f4f4f4; }
          .right { text-align: right; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <h2>Inventario Actual — ${new Date().toLocaleDateString()}</h2>
        <table>
          <thead>
            <tr>
              <th>Perfume</th>
              <th>Marca</th>
              <th class="center">ML</th>
              <th class="center">Stock Completo</th>
              <th class="center">Stock Suelto</th>
            </tr>
          </thead>
          <tbody>
  `;

  products.forEach(p => {
    html += `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>${p.brand}</td>
        <td class="center">${p.ml}ml</td>
        <td class="center"><strong>${p.stock || 0}</strong> botellas</td>
        <td class="center">${p.openedMl || 0} ml</td>
      </tr>
    `;
  });

  html += `</tbody></table></body></html>`;

  targetDoc.open();
  targetDoc.write(html);
  targetDoc.close();

  setTimeout(() => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => { document.body.removeChild(iframe); }, 1000);
  }, 500);
}

// ── RESTO (Formularios y Utils) ───────────────────────────────
function openModal(id) {
  document.getElementById('product-form').reset();
  if (id) {
    const p = products.find(x => x.id === id);
    if (!p) return;
    document.getElementById('modal-title').textContent = 'Editar Perfume';
    document.getElementById('product-id').value = p.id;
    document.getElementById('f-name').value = p.name || '';
    document.getElementById('f-brand').value = p.brand || '';
    document.getElementById('f-family').value = p.family || '';
    document.getElementById('f-sku').value = p.sku || '';
    document.getElementById('f-ml').value = p.ml || 100;
    document.getElementById('f-stock').value = p.stock || 0;
    document.getElementById('f-opened-ml').value = p.openedMl || 0;
    document.getElementById('f-buy-price').value = p.buyPrice || '';
    document.getElementById('f-sell-price').value = p.sellPrice || '';
    document.getElementById('f-price-3').value = p.price3 || '';
    document.getElementById('f-price-5').value = p.price5 || '';
    document.getElementById('f-price-10').value = p.price10 || '';
  } else {
    document.getElementById('modal-title').textContent = 'Añadir Perfume';
    document.getElementById('product-id').value = '';
    document.getElementById('f-sku').value = `PER-${String(nextId).padStart(3, '0')}`;
  }
  recalcHints();
  document.getElementById('product-modal').style.display = 'flex';
}
function recalcHints() {
  const ml = parseFloat(document.getElementById('f-ml').value);
  const buy = parseFloat(document.getElementById('f-buy-price').value);
  const h3 = document.getElementById('hint-3'), h5 = document.getElementById('hint-5'), h10 = document.getElementById('hint-10');
  if (ml > 0 && buy > 0) {
    const pMl = buy / ml;
    h3.textContent = `Sug: ${fmtMoney(pMl * 3 * DECANT_MULTIPLIER)}`;
    h5.textContent = `Sug: ${fmtMoney(pMl * 5 * DECANT_MULTIPLIER)}`;
    h10.textContent = `Sug: ${fmtMoney(pMl * 10 * DECANT_MULTIPLIER)}`;
  } else {
    h3.textContent = 'Sug: $0.00'; h5.textContent = 'Sug: $0.00'; h10.textContent = 'Sug: $0.00';
  }
}
function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('product-id').value;
  const data = {
    name: document.getElementById('f-name').value, brand: document.getElementById('f-brand').value,
    family: document.getElementById('f-family').value, sku: document.getElementById('f-sku').value,
    ml: parseFloat(document.getElementById('f-ml').value) || 0, stock: parseInt(document.getElementById('f-stock').value) || 0,
    openedMl: parseFloat(document.getElementById('f-opened-ml').value) || 0,
    buyPrice: parseFloat(document.getElementById('f-buy-price').value) || 0, sellPrice: parseFloat(document.getElementById('f-sell-price').value) || 0,
    price3: parseFloat(document.getElementById('f-price-3').value) || null,
    price5: parseFloat(document.getElementById('f-price-5').value) || null,
    price10: parseFloat(document.getElementById('f-price-10').value) || null,
  };
  if (id) {
    const ix = products.findIndex(p => p.id === parseInt(id));
    if (ix !== -1) products[ix] = { ...products[ix], ...data };
    showToast(`Perfume actualizado`);
  } else {
    products.unshift({ id: nextId++, ...data });
    showToast(`Perfume añadido`);
  }
  save(); closeModal('product-modal');
  if (currentTab === 'inventory') renderTable(); if (currentTab === 'dashboard') renderDashboard();
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
function closeModalOnBG(e, id) { if (e.target.id === id) closeModal(id); }

let deleteTargetId = null;
function openDeleteModal(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  deleteTargetId = id;
  document.getElementById('delete-product-name').textContent = p.name;
  document.getElementById('delete-modal').style.display = 'flex';
}
function confirmDelete() {
  if (deleteTargetId !== null) {
    products = products.filter(p => p.id !== deleteTargetId);
    save();
    showToast('Perfume eliminado');
    closeModal('delete-modal');
    renderTable();
    if (currentTab === 'dashboard') renderDashboard();
  }
}

function renderDecants() {
  const cont = document.getElementById('decants-grid');
  cont.innerHTML = products.filter(p => p.ml && p.buyPrice).map(p => {
    const d = calcDecants(p);
    return `<div class="decant-card">
      <div class="dc-head"><div class="dc-name">${getPerfumeEmoji(p.family)} ${esc(p.name)}</div><div class="ml-cell">${p.ml}ml</div></div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:10px;">Costo/ml: ${fmtMoney(d.pricePerMl)} <br/>${p.price3 ? '<span style="color:var(--gold)">Precios personalizados</span>' : 'Fórmula: x1.75'}</div>
      <div class="dc-prices">
        <div class="dc-price-item"><div class="dc-ml">3 ML</div><div class="dc-val">${fmtMoney(d.decants[3])}</div></div>
        <div class="dc-price-item"><div class="dc-ml">5 ML</div><div class="dc-val">${fmtMoney(d.decants[5])}</div></div>
        <div class="dc-price-item"><div class="dc-ml">10 ML</div><div class="dc-val">${fmtMoney(d.decants[10])}</div></div>
      </div>
    </div>`;
  }).join('');
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal('product-modal'); closeModal('sell-modal'); closeModal('delete-modal'); } });
function init() {
  if (!checkLogin()) return; // No está autenticado → mostrar login
  const hash = location.hash.replace('#', '');
  const tabs = ['dashboard', 'inventory', 'decants', 'analytics'];
  switchTab(tabs.includes(hash) ? hash : 'inventory');
}
window.addEventListener('popstate', init);
init();
