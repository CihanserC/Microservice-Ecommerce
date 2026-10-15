import { api } from './api.js';
import { Diagram } from './diagram.js';
import { renderCode, escapeHtml } from './codeview.js';
import { SERVICES, MESSAGES, KINDS, SAGA_STATES, CONCEPTS, INFRA_REFS, httpRef, safeJson } from './knowledge.js';

const $ = sel => document.querySelector(sel);
const BASE_MS = 950;
const MAX_TIMELINE = 600;
const SVC_LABEL = { browser: 'UI', gateway: 'GW', catalog: 'Catalog', basket: 'Basket', order: 'Order', payment: 'Payment' };
const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });

const state = {
  products: [],
  basket: { userName: 'ayse', items: [] },
  orders: [],
  queue: [],
  playing: false,
  mode: 'auto',
  speed: 1,
  stepResolver: null,
  seen: new Set(),
  events: new Map(),
  selectedId: null,
  focusOrderId: null,
  sagaPath: new Map(),    // orderId -> Set("from>to")
  sagaCurrent: new Map(), // orderId -> durum
  refreshTimers: {},
};

const diagram = new Diagram($('#diagram'), { onNodeClick: showNode });

// ------------------------------------------------------------------ iz akışı

function connect() {
  const conn = $('#conn');
  const set = (s, text) => { conn.dataset.state = s; conn.querySelector('span').textContent = text; };
  const source = new EventSource('/sim/events');
  source.addEventListener('open', () => set('open', 'Canlı'));
  source.addEventListener('error', () => set('error', 'Bağlantı yok — yeniden deneniyor'));
  source.addEventListener('trace', e => {
    const ev = safeJson(e.data);
    if (ev) enqueue(ev);
  });
}

function enqueue(ev) {
  if (state.seen.has(ev.id)) return;
  state.seen.add(ev.id);
  state.queue.push(ev);
  updateQueueUi();
  pump();
}

function enqueueLocal(title) {
  enqueue({ id: uid(), kind: 'action', service: 'browser', title, timestamp: new Date().toISOString() });
}

async function pump() {
  if (state.playing) return;
  state.playing = true;
  try {
    while (state.queue.length) {
      if (state.mode === 'step') {
        await new Promise(resolve => { state.stepResolver = resolve; updateQueueUi(); });
        state.stepResolver = null;
        if (!state.queue.length) break;
      }
      const ev = state.queue.shift();
      updateQueueUi();

      // Otomatik modda kuyruk birikirse yetişmek için hızlan.
      const catchUp = state.mode === 'auto' && state.queue.length > 15 ? 0.3 : 1;
      const duration = state.speed === 0 ? 0 : (BASE_MS / state.speed) * catchUp;

      addTimeline(ev);
      if (state.mode === 'step') showEvent(ev);
      await diagram.play(ev, { duration });
      afterEvent(ev);
    }
  } finally {
    state.playing = false;
    updateQueueUi();
  }
}

function nextStep() {
  state.stepResolver?.();
}

function updateQueueUi() {
  $('#queue-count').textContent = String(state.queue.length);
  $('#next-step').disabled = !(state.mode === 'step' && state.queue.length > 0);
}

function afterEvent(ev, { historic = false } = {}) {
  if (ev.kind === 'saga' && ev.orderId) {
    if (!state.sagaPath.has(ev.orderId)) state.sagaPath.set(ev.orderId, new Set());
    state.sagaPath.get(ev.orderId).add(`${ev.fromState}>${ev.toState}`);
    state.sagaCurrent.set(ev.orderId, ev.toState);
    // Yeni başlayan saga otomatik takip edilir.
    if (ev.fromState === 'Initial' || !state.focusOrderId) state.focusOrderId = ev.orderId;
    renderSaga();
  }
  if (historic) return;

  if (ev.service === 'catalog' && ev.kind === 'db') scheduleRefresh('products', loadProducts);
  if (ev.service === 'order' && (ev.kind === 'db' || ev.kind === 'saga')) scheduleRefresh('orders', loadOrders);
  if (ev.service === 'basket' && ev.kind === 'http-response') scheduleRefresh('basket', loadBasket);
}

function scheduleRefresh(name, fn) {
  clearTimeout(state.refreshTimers[name]);
  state.refreshTimers[name] = setTimeout(() => fn().catch(() => {}), 250);
}

// ------------------------------------------------------------------ zaman çizelgesi

function addTimeline(ev, { historic = false } = {}) {
  state.events.set(ev.id, ev);
  const list = $('#timeline');
  const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;

  const li = document.createElement('li');
  li.className = `k-${ev.kind}${historic ? ' historic' : ' enter'}`;
  li.dataset.id = ev.id;
  li.dataset.order = ev.orderId ?? '';
  li.tabIndex = 0;
  li.innerHTML = `
    <span class="t">${time(ev.timestamp)}</span>
    <span class="k" aria-hidden="true">${KINDS[ev.kind]?.icon ?? '•'}</span>
    <span class="title"><span class="svc">${SVC_LABEL[ev.service] ?? escapeHtml(ev.service)}</span>${escapeHtml(ev.title)}</span>`;
  li.addEventListener('click', () => showEvent(ev));
  li.addEventListener('keydown', e => { if (e.key === 'Enter') showEvent(ev); });
  applyFilter(li);
  list.append(li);

  while (list.children.length > MAX_TIMELINE) {
    state.events.delete(list.firstElementChild.dataset.id);
    list.firstElementChild.remove();
  }
  $('#timeline-empty').hidden = true;
  if (nearBottom || !historic) list.scrollTop = list.scrollHeight;
}

function applyFilter(li) {
  const only = $('#filter-order').checked && state.focusOrderId;
  li.hidden = Boolean(only && li.dataset.order !== state.focusOrderId);
}

function refreshFilter() {
  document.querySelectorAll('#timeline li').forEach(applyFilter);
}

// ------------------------------------------------------------------ detay paneli

function openDetail(title) {
  $('#detail').hidden = false;
  $('#detail-title').textContent = title;
  if (window.matchMedia('(max-width: 1280px)').matches) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showEvent(ev) {
  state.selectedId = ev.id;
  document.querySelectorAll('#timeline li.selected').forEach(li => li.classList.remove('selected'));
  document.querySelector(`#timeline li[data-id="${CSS.escape(ev.id)}"]`)?.classList.add('selected');

  const kind = KINDS[ev.kind] ?? KINDS.step;
  const msg = ev.messageType ? MESSAGES[ev.messageType] : null;
  const explanation = ev.kind === 'saga'
    ? `${SAGA_STATES[ev.toState] ?? ''} ${kind.text}`
    : msg?.text ?? kind.text;

  const payload = ev.payload ? JSON.stringify(safeJson(ev.payload) ?? ev.payload, null, 2) : null;
  const chips = [
    `<span class="chip k k-${ev.kind}">${kind.icon} ${kind.label}${msg ? ` · ${msg.role}` : ''}</span>`,
    `<span class="chip">${SVC_LABEL[ev.service] ?? escapeHtml(ev.service)}</span>`,
    `<span class="chip mono">${time(ev.timestamp)}</span>`,
    ev.orderId ? `<span class="chip mono" title="${ev.orderId}">sipariş #${ev.orderId.slice(0, 8)}</span>` : '',
    ev.traceId ? `<span class="chip mono" title="OpenTelemetry trace kimliği">trace ${ev.traceId.slice(0, 8)}</span>` : '',
  ].join('');

  openDetail(ev.title);
  const body = $('#detail-body');
  body.innerHTML = `
    <div class="chips">${chips}</div>
    ${ev.detail ? `<p>${escapeHtml(ev.detail)}</p>` : ''}
    ${ev.kind === 'saga' ? `<p class="mono">${escapeHtml(ev.fromState)} → <b>${escapeHtml(ev.toState)}</b></p>` : ''}
    <h3>Ne oluyor?</h3>
    <div class="explain k-${ev.kind}">${escapeHtml(explanation)}</div>
    ${payload ? `<h3>${ev.messageType ? 'Mesaj gövdesi' : 'Veri'}</h3><pre class="payload">${escapeHtml(payload)}</pre>` : ''}
    ${ev.orderId ? '<div class="row"><button type="button" class="btn small" id="follow-order">Bu siparişi takip et</button></div>' : ''}
    <h3>Kod</h3>`;
  $('#follow-order')?.addEventListener('click', () => focusOrder(ev.orderId));

  const refs = [];
  if (ev.codeFile) refs.push({ label: 'İzi üreten satır', path: ev.codeFile, line: ev.codeLine });
  if (msg) refs.push(...msg.refs);
  if (ev.kind === 'http' || ev.kind === 'http-response') refs.push(...httpRef(ev), INFRA_REFS.http);
  if (ev.kind === 'publish' || ev.kind === 'consume') refs.push(INFRA_REFS[ev.kind]);
  if (!refs.length) body.lastElementChild.remove();
  renderCode($('#detail-code'), refs);
}

function showNode(id) {
  const info = SERVICES[id];
  openDetail(`${info.name} — ${info.sub}`);
  $('#detail-body').innerHTML = `
    <div class="explain">${escapeHtml(info.summary)}</div>
    ${info.files.length ? '<h3>İlgili kod</h3>' : ''}`;
  renderCode($('#detail-code'), info.files);
}

// ------------------------------------------------------------------ saga

const SAGA_LAYOUT = {
  Initial: [60, 45, 100], AwaitingStock: [270, 45, 150], AwaitingPayment: [530, 45, 150], Completed: [790, 45, 130],
  Cancelled: [270, 128, 150], Compensating: [530, 128, 150],
};
const SAGA_EDGES = [
  ['Initial', 'AwaitingStock', 'OrderCreated'],
  ['AwaitingStock', 'AwaitingPayment', 'StockReserved'],
  ['AwaitingPayment', 'Completed', 'PaymentCompleted'],
  ['AwaitingStock', 'Cancelled', 'StockReservationFailed'],
  ['AwaitingPayment', 'Compensating', 'PaymentFailed'],
  ['Compensating', 'Cancelled', 'StockReleased'],
];
const H = 34;

function buildSaga() {
  const svg = $('#saga');
  svg.setAttribute('viewBox', '0 0 900 170');
  let html = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker></defs>`;
  for (const [from, to, label] of SAGA_EDGES) {
    const [x1, y1, w1] = SAGA_LAYOUT[from];
    const [x2, y2, w2] = SAGA_LAYOUT[to];
    let d, tx, ty, anchor = 'middle';
    if (y1 === y2) {
      const dir = x2 > x1 ? 1 : -1;
      const sx = x1 + dir * w1 / 2, ex = x2 - dir * w2 / 2;
      d = `M${sx},${y1} L${ex - dir * 2},${y2}`;
      tx = (sx + ex) / 2; ty = y1 - 7;
    } else {
      d = `M${x1},${y1 + H / 2} L${x2},${y2 - H / 2 - 2}`;
      tx = x1 + 8; ty = (y1 + y2) / 2 + 4; anchor = 'start';
    }
    html += `<g class="tr" data-edge="${from}>${to}"><path d="${d}"/><text x="${tx}" y="${ty}" style="text-anchor:${anchor}">${label}</text></g>`;
  }
  for (const [name, [x, y, w]] of Object.entries(SAGA_LAYOUT)) {
    html += `<g class="st" data-state="${name}"><rect x="${x - w / 2}" y="${y - H / 2}" width="${w}" height="${H}" rx="9"/><text x="${x}" y="${y + 4.5}">${name}</text></g>`;
  }
  svg.innerHTML = html;
}

function renderSaga() {
  const id = state.focusOrderId;
  const path = (id && state.sagaPath.get(id)) || new Set();
  const order = state.orders.find(o => o.id === id);
  const current = (id && state.sagaCurrent.get(id)) || order?.sagaState || (id ? 'Initial' : null);

  const visited = new Set(id ? ['Initial'] : []);
  path.forEach(p => p.split('>').forEach(s => visited.add(s)));
  if (current) visited.add(current);

  document.querySelectorAll('#saga .st').forEach(g => {
    const s = g.dataset.state;
    g.classList.toggle('visited', visited.has(s));
    g.classList.toggle('current', s === current);
    g.classList.toggle('final-ok', s === 'Completed');
    g.classList.toggle('final-bad', s === 'Cancelled');
  });
  document.querySelectorAll('#saga .tr').forEach(g => g.classList.toggle('taken', path.has(g.dataset.edge)));

  $('#saga-title').textContent = id
    ? `— sipariş #${id.slice(0, 8)}${order ? ` (${order.userName}, ${money.format(order.totalPrice)})` : ''}`
    : '— henüz sipariş yok';
  const reason = order?.failureReason ? ` Sebep: ${order.failureReason}` : '';
  $('#saga-desc').textContent = current ? `${current}: ${SAGA_STATES[current] ?? ''}${reason}` : 'Checkout yaptığında sipariş burada adım adım ilerler.';
  document.querySelectorAll('#orders tr[data-id]').forEach(tr => tr.classList.toggle('focused', tr.dataset.id === id));
}

function focusOrder(id) {
  state.focusOrderId = id;
  renderSaga();
  refreshFilter();
}

// ------------------------------------------------------------------ veri yükleme

async function loadProducts() {
  const previous = new Map(state.products.map(p => [p.id, p.stock]));
  state.products = await api.products();
  const root = $('#products');
  if (!state.products.length) {
    root.innerHTML = '<p class="hint">Katalog boş.</p>';
    return;
  }
  root.innerHTML = '';
  for (const p of state.products) {
    const row = document.createElement('div');
    row.className = 'product' + (previous.has(p.id) && previous.get(p.id) !== p.stock ? ' changed' : '');
    row.innerHTML = `
      <span class="name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
      <span class="meta">
        <span class="num">${money.format(p.price)}</span>
        <label class="stock${p.stock === 0 ? ' zero' : ''}">stok <input type="number" min="0" value="${p.stock}" aria-label="${escapeHtml(p.name)} stok"></label>
      </span>
      <span class="actions"><button type="button" class="btn small">Sepete ekle</button></span>`;
    row.querySelector('button').addEventListener('click', () => addToBasket(p));
    row.querySelector('input').addEventListener('change', e => updateStock(p, Number(e.target.value)));
    root.append(row);
  }
}

async function loadBasket() {
  const user = currentUser();
  const basket = await api.basket(user);
  state.basket = { userName: user, items: basket?.items ?? [] };
  renderBasket();
}

async function loadOrders() {
  state.orders = await api.orders();
  // Canlı izler API'den önce gelir (saga izi, DB commit'inden hemen önce üretilir).
  // API yalnızca canlı izi kaçırılmış siparişleri (ör. sayfa sonradan açıldıysa) doldurur.
  for (const o of state.orders) {
    if (o.sagaState && !state.sagaCurrent.has(o.id)) state.sagaCurrent.set(o.id, o.sagaState);
  }

  const body = $('#orders');
  if (!state.orders.length) {
    body.innerHTML = '<tr><td colspan="5" class="hint">Henüz sipariş yok.</td></tr>';
  } else {
    body.innerHTML = state.orders.map(o => `
      <tr data-id="${o.id}" tabindex="0" title="${o.failureReason ? escapeHtml(o.failureReason) : 'Takip etmek için tıkla'}">
        <td class="mono">#${o.id.slice(0, 8)}</td>
        <td>${escapeHtml(o.userName)}</td>
        <td class="num">${money.format(o.totalPrice)}</td>
        <td><span class="status ${o.status}">${o.status}</span></td>
        <td class="mono">${o.sagaState ?? '—'}</td>
      </tr>`).join('');
    body.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => focusOrder(tr.dataset.id));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') focusOrder(tr.dataset.id); });
    });
  }
  if (!state.focusOrderId && state.orders[0]) state.focusOrderId = state.orders[0].id;
  renderSaga();
}

async function loadPaymentSettings() {
  const s = await api.paymentSettings();
  $('#pay-mode').value = s.mode;
  $('#pay-limit').value = s.limit;
  $('#pay-delay').value = s.delayMs;
  $('#pay-delay-out').textContent = `${s.delayMs} ms`;
}

async function loadHistory() {
  const history = await api.history();
  for (const ev of history) {
    if (state.seen.has(ev.id)) continue;
    state.seen.add(ev.id);
    addTimeline(ev, { historic: true });
    afterEvent(ev, { historic: true });
  }
}

// ------------------------------------------------------------------ kullanıcı aksiyonları

async function userAction(title, fn) {
  enqueueLocal(title);
  try {
    return await fn();
  } catch (err) {
    toast(err.message || 'İstek başarısız.', 'error');
    throw err;
  }
}

function currentUser() {
  return $('#user').value.trim() || 'ayse';
}

function renderBasket() {
  const root = $('#basket');
  const items = state.basket.items;
  if (!items.length) {
    root.innerHTML = '<p class="hint">Sepet boş. Katalogdan ürün ekle.</p>';
  } else {
    const total = items.reduce((t, i) => t + i.quantity * i.unitPrice, 0);
    root.innerHTML = items.map((i, idx) => `
      <div class="item">
        <span>${escapeHtml(i.productName)}</span>
        <span class="mono">${i.quantity} × ${money.format(i.unitPrice)}</span>
        <button type="button" class="link-btn" data-idx="${idx}" aria-label="${escapeHtml(i.productName)} kaldır">✕</button>
      </div>`).join('') + `<div class="total"><span>Toplam</span><span class="num">${money.format(total)}</span></div>`;
    root.querySelectorAll('[data-idx]').forEach(b => b.addEventListener('click', () => removeFromBasket(Number(b.dataset.idx))));
  }
  $('#checkout').disabled = !items.length;
}

async function storeBasket(items, title) {
  const user = currentUser();
  const body = {
    userName: user,
    items: items.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity, unitPrice: i.unitPrice })),
  };
  const stored = await userAction(title, () => api.storeBasket(body));
  state.basket = { userName: user, items: stored.items };
  renderBasket();
}

function addToBasket(product) {
  const items = state.basket.items.map(i => ({ ...i }));
  const existing = items.find(i => i.productId === product.id);
  if (existing) existing.quantity += 1;
  else items.push({ productId: product.id, productName: product.name, quantity: 1, unitPrice: product.price });
  return storeBasket(items, `Sepete ekle: ${product.name}`).catch(() => {});
}

function removeFromBasket(index) {
  const items = state.basket.items.filter((_, i) => i !== index);
  return storeBasket(items, 'Sepetten ürün çıkar').catch(() => {});
}

async function checkout() {
  const user = currentUser();
  try {
    await userAction(`Checkout (${user})`, () => api.checkout(user));
    toast('202 Accepted: checkout başladı. Sipariş arka planda oluşuyor, saga\'yı izle.');
    state.basket.items = [];
    renderBasket();
  } catch { /* toast gösterildi */ }
}

async function emptyBasket() {
  const user = currentUser();
  try {
    await userAction('Sepeti boşalt', () => api.deleteBasket(user));
    state.basket.items = [];
    renderBasket();
  } catch { /* toast gösterildi */ }
}

async function updateStock(product, stock) {
  if (!Number.isInteger(stock) || stock < 0) return toast('Stok 0 veya daha büyük bir tam sayı olmalı.', 'error');
  try {
    const full = await api.product(product.id);
    await userAction(`Stok güncelle: ${product.name} → ${stock}`, () => api.updateProduct(product.id, {
      name: full.name, description: full.description, price: full.price, imageUrl: full.imageUrl, stock,
    }));
    await loadProducts();
  } catch { /* toast gösterildi */ }
}

async function applyPaymentSettings(settings, { silent = false } = {}) {
  const body = settings ?? {
    mode: $('#pay-mode').value,
    limit: Number($('#pay-limit').value) || 0,
    delayMs: Number($('#pay-delay').value) || 0,
  };
  const run = () => api.updatePaymentSettings(body);
  const saved = silent ? await run() : await userAction(`Ödeme ayarı: ${body.mode}`, run);
  $('#pay-mode').value = saved.mode;
  $('#pay-limit').value = saved.limit;
  $('#pay-delay').value = saved.delayMs;
  $('#pay-delay-out').textContent = `${saved.delayMs} ms`;
  return saved;
}

// ------------------------------------------------------------------ senaryolar

async function runScenario(kind) {
  const buttons = document.querySelectorAll('.scenario');
  buttons.forEach(b => (b.disabled = true));
  try {
    await loadProducts();
    const products = state.products;
    if (!products.length) throw new Error('Katalogda ürün yok.');

    const limit = 20000;
    let mode = 'FailAboveLimit';
    let line;

    if (kind === 'happy') {
      const p = products.filter(p => p.stock > 0 && p.price <= limit).sort((a, b) => b.stock - a.stock)[0];
      if (!p) throw new Error('Stokta olan ve limit altında kalan bir ürün yok. Stok ekle.');
      line = { p, qty: 1 };
    } else if (kind === 'stock') {
      const p = products.find(p => p.stock === 0) ?? [...products].sort((a, b) => a.stock - b.stock)[0];
      line = { p, qty: p.stock + 1 };
    } else {
      const candidates = products
        .filter(p => p.stock > 0)
        .map(p => ({ p, qty: Math.floor(limit / p.price) + 1 }))
        .filter(c => c.qty <= c.p.stock)
        .sort((a, b) => a.qty - b.qty);
      line = candidates[0];
      if (!line) {
        // Limit aşılamıyorsa ödemeyi zorla reddettir.
        const p = products.find(p => p.stock > 0);
        if (!p) throw new Error('Stokta ürün yok. Önce stok ekle.');
        line = { p, qty: 1 };
        mode = 'AlwaysFail';
      }
    }

    const delayMs = Number($('#pay-delay').value) || 1500;
    await applyPaymentSettings({ mode, limit, delayMs }, { silent: true });

    await storeBasket([{
      productId: line.p.id, productName: line.p.name, quantity: line.qty, unitPrice: line.p.price,
    }], `Senaryo: ${line.qty} × ${line.p.name} sepete`);
    await checkout();
  } catch (err) {
    if (err?.message) toast(err.message, 'error');
  } finally {
    buttons.forEach(b => (b.disabled = false));
  }
}

// ------------------------------------------------------------------ yardımcılar

function time(ts) {
  const d = ts ? new Date(ts) : new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function uid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

function toast(text, kind = 'info') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = text;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), kind === 'error' ? 7000 : 4500);
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  if (mode === 'auto') nextStep();
  updateQueueUi();
  if (mode === 'step') toast('Adım adım mod: her izi "Sonraki adım" (veya → tuşu) ile oynat. Detay paneli o adımın kodunu gösterir.');
}

async function clearAll() {
  $('#timeline').innerHTML = '';
  $('#timeline-empty').hidden = false;
  state.events.clear();
  state.queue.length = 0;
  diagram.lastPublisher.clear();
  $('#detail').hidden = true;
  updateQueueUi();
  try { await api.clearHistory(); } catch { /* simülatör kapalıysa önemli değil */ }
}

function renderConcepts() {
  $('#concepts-body').innerHTML = CONCEPTS.map(c => `
    <div class="concept"><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.text)}</p></div>`).join('');
}

// ------------------------------------------------------------------ başlangıç

function bind() {
  document.querySelectorAll('.seg button').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('#next-step').addEventListener('click', nextStep);
  $('#speed').addEventListener('change', e => (state.speed = Number(e.target.value)));
  $('#clear').addEventListener('click', clearAll);
  $('#filter-order').addEventListener('change', refreshFilter);
  $('#detail-close').addEventListener('click', () => {
    $('#detail').hidden = true;
    document.querySelectorAll('#timeline li.selected').forEach(li => li.classList.remove('selected'));
  });

  const dialog = $('#concepts');
  $('#open-concepts').addEventListener('click', () => dialog.showModal());
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

  document.querySelectorAll('.scenario').forEach(b => b.addEventListener('click', () => runScenario(b.dataset.scenario)));
  $('#checkout').addEventListener('click', checkout);
  $('#empty-basket').addEventListener('click', emptyBasket);
  $('#user').addEventListener('change', () => loadBasket().catch(err => toast(err.message, 'error')));
  $('#refresh-orders').addEventListener('click', () => loadOrders().catch(err => toast(err.message, 'error')));

  $('#pay-delay').addEventListener('input', e => ($('#pay-delay-out').textContent = `${e.target.value} ms`));
  $('#pay-apply').addEventListener('click', () => applyPaymentSettings().catch(() => {}));

  document.addEventListener('keydown', e => {
    if (e.key !== 'ArrowRight' || state.mode !== 'step') return;
    if (e.target.closest('input, select, textarea')) return;
    e.preventDefault();
    nextStep();
  });
}

async function init() {
  bind();
  buildSaga();
  renderConcepts();
  renderBasket();

  const results = await Promise.allSettled([loadHistory(), loadProducts(), loadBasket(), loadOrders(), loadPaymentSettings()]);
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) toast(`Bazı servislere ulaşılamadı (${failed.length}). Servisler ayağa kalkıyor olabilir; birkaç saniye sonra sayfayı yenile.`, 'error');

  connect();
}

init();
