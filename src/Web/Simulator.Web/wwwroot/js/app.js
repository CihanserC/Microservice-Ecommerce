import { api } from './api.js';
import { Diagram } from './diagram.js';
import { renderCode, escapeHtml } from './codeview.js';
import { SERVICES, MESSAGES, KINDS, SAGA_STATES, INFRA_REFS, httpRef, safeJson } from './knowledge.js';
import { ConceptBrowser } from './concept-view.js';
import { t, tBoth, tx, getLang, setLang, onLangChange, applyStatic, money, localizeReason } from './i18n.js';
import { DEMO, CODESPACES_URL, REPO_URL } from './runtime.js';

const $ = sel => document.querySelector(sel);
// 1× hızda paketin diyagramdaki hızı (viewBox birimi/ms). Gateway → servis hattı (~360 birim) ≈ 1,8 sn.
// Bütün hatlarda aynı hız kullanılır; hız seçimi bu değeri çarpar.
const PX_PER_MS = 0.2;
// Diyagramda yolu olmayan adımlarda (ör. servis içi iş adımı) 1× hızda bekleme süresi.
const IDLE_MS = 1100;
const MAX_TIMELINE = 600;
const SVC_LABEL = { browser: 'UI', gateway: 'GW', catalog: 'Catalog', basket: 'Basket', order: 'Order', payment: 'Payment' };

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
  detailView: null,       // { kind: 'event', ev } | { kind: 'node', id }
  conn: 'connecting',
  focusOrderId: null,
  sagaPath: new Map(),    // orderId -> Set("from>to")
  sagaCurrent: new Map(), // orderId -> durum
  refreshTimers: {},
};

const diagram = new Diagram($('#diagram'), { onNodeClick: showNode, eventTitle });
let concepts;

// İzler iki dilde gelir: title/detail Türkçe, titleEn/detailEn İngilizce.
function eventTitle(ev) {
  return getLang() === 'en' ? ev.titleEn ?? ev.title : ev.title;
}

function eventDetail(ev) {
  const text = getLang() === 'en' ? ev.detailEn ?? ev.detail : ev.detail;
  return localizeReason(text);
}

// ------------------------------------------------------------------ iz akışı

function connect() {
  api.subscribe(enqueue, setConn);
}

function setConn(s) {
  state.conn = s;
  renderConn();
}

function renderConn() {
  const conn = $('#conn');
  conn.dataset.state = state.conn;
  conn.querySelector('span').textContent = t(`conn.${state.conn}`);
}

function enqueue(ev) {
  if (state.seen.has(ev.id)) return;
  state.seen.add(ev.id);
  state.queue.push(ev);
  updateQueueUi();
  pump();
}

function enqueueLocal(title) {
  enqueue({ id: uid(), kind: 'action', service: 'browser', title: title.tr, titleEn: title.en, timestamp: new Date().toISOString() });
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

      // Hız yalnızca kullanıcının seçimine bağlıdır; kuyruk birikse bile hızlanılmaz ki
      // bütün hatlarda paket hızı her zaman aynı kalsın. Biriken izler sırayla oynatılır.
      const pxPerMs = PX_PER_MS * state.speed;
      const idleMs = state.speed > 0 ? IDLE_MS / state.speed : 0;

      addTimeline(ev);
      if (state.mode === 'step') showEvent(ev);
      await diagram.play(ev, { pxPerMs, idleMs });
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
  const ready = state.mode === 'step' && state.queue.length > 0;
  document.querySelectorAll('.queue-count').forEach(el => (el.textContent = String(state.queue.length)));
  document.querySelectorAll('.next-step').forEach(b => (b.disabled = !ready));
  document.body.classList.toggle('mode-step', state.mode === 'step');
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
    <span class="title"><span class="svc">${SVC_LABEL[ev.service] ?? escapeHtml(ev.service)}</span><span class="txt">${escapeHtml(eventTitle(ev))}</span></span>`;
  li.addEventListener('click', () => showEvent(ev, { expand: true }));
  li.addEventListener('keydown', e => { if (e.key === 'Enter') showEvent(ev, { expand: true }); });
  applyFilter(li);
  list.append(li);

  while (list.children.length > MAX_TIMELINE) {
    state.events.delete(list.firstElementChild.dataset.id);
    list.firstElementChild.remove();
  }
  $('#timeline-empty').hidden = true;
  if (nearBottom || !historic) list.scrollTop = list.scrollHeight;
}

function relabelTimeline() {
  document.querySelectorAll('#timeline li').forEach(li => {
    const ev = state.events.get(li.dataset.id);
    if (ev) li.querySelector('.txt').textContent = eventTitle(ev);
  });
}

function applyFilter(li) {
  const only = $('#filter-order').checked && state.focusOrderId;
  li.hidden = Boolean(only && li.dataset.order !== state.focusOrderId);
}

function refreshFilter() {
  document.querySelectorAll('#timeline li').forEach(applyFilter);
}

// ------------------------------------------------------------------ detay paneli

// Detay paneli her zaman görünür: sayfa asla kaydırılmaz, yalnızca panelin içi en üste döner.
// Mobilde panel alttan açılan bir sayfadır; kullanıcı bir şeye tıkladıysa (expand) açılır,
// adım adım oynatmada ise mevcut hali korunur ki animasyon görünmeye devam etsin.
function openDetail(title, { expand = false } = {}) {
  $('#detail-title').textContent = title;
  $('#detail-empty').hidden = true;
  $('#detail-close').hidden = false;
  $('#detail .detail-scroll').scrollTop = 0;
  if (expand) setSheet(true);
}

function clearDetail() {
  state.detailView = null;
  state.selectedId = null;
  $('#detail-title').textContent = t('det.none');
  $('#detail-empty').hidden = false;
  $('#detail-close').hidden = true;
  $('#detail-body').innerHTML = '';
  $('#detail-code').innerHTML = '';
  document.querySelectorAll('#timeline li.selected').forEach(li => li.classList.remove('selected'));
}

function setSheet(open) {
  $('#detail').classList.toggle('collapsed', !open);
  $('#sheet-toggle').setAttribute('aria-expanded', String(open));
}

function showEvent(ev, { expand = false } = {}) {
  state.selectedId = ev.id;
  state.detailView = { kind: 'event', ev };
  document.querySelectorAll('#timeline li.selected').forEach(li => li.classList.remove('selected'));
  document.querySelector(`#timeline li[data-id="${CSS.escape(ev.id)}"]`)?.classList.add('selected');

  const kind = KINDS[ev.kind] ?? KINDS.step;
  const msg = ev.messageType ? MESSAGES[ev.messageType] : null;
  const explanation = ev.kind === 'saga'
    ? `${tx(SAGA_STATES[ev.toState])} ${tx(kind.text)}`
    : tx(msg?.text ?? kind.text);

  const payload = ev.payload ? JSON.stringify(safeJson(ev.payload) ?? ev.payload, null, 2) : null;
  const detail = eventDetail(ev);
  const chips = [
    `<span class="chip k k-${ev.kind}">${kind.icon} ${escapeHtml(tx(kind.label))}${msg ? ` · ${escapeHtml(tx(msg.role))}` : ''}</span>`,
    `<span class="chip">${SVC_LABEL[ev.service] ?? escapeHtml(ev.service)}</span>`,
    `<span class="chip mono">${time(ev.timestamp)}</span>`,
    ev.orderId ? `<span class="chip mono" title="${ev.orderId}">${escapeHtml(t('det.order', { id: ev.orderId.slice(0, 8) }))}</span>` : '',
    ev.traceId ? `<span class="chip mono" title="${escapeHtml(t('det.traceTitle'))}">trace ${ev.traceId.slice(0, 8)}</span>` : '',
  ].join('');

  openDetail(eventTitle(ev), { expand });
  const body = $('#detail-body');
  body.innerHTML = `
    <div class="chips">${chips}</div>
    ${detail ? `<p>${escapeHtml(detail)}</p>` : ''}
    ${ev.kind === 'saga' ? `<p class="mono">${escapeHtml(ev.fromState)} → <b>${escapeHtml(ev.toState)}</b></p>` : ''}
    <h3>${escapeHtml(t('det.what'))}</h3>
    <div class="explain k-${ev.kind}">${escapeHtml(explanation)}</div>
    ${payload ? `<h3>${escapeHtml(t(ev.messageType ? 'det.message' : 'det.data'))}</h3><pre class="payload">${escapeHtml(payload)}</pre>` : ''}
    ${ev.orderId ? `<div class="row"><button type="button" class="btn small" id="follow-order">${escapeHtml(t('det.follow'))}</button></div>` : ''}
    <h3>${escapeHtml(t('det.code'))}</h3>`;
  $('#follow-order')?.addEventListener('click', () => focusOrder(ev.orderId));

  const refs = [];
  if (ev.codeFile) refs.push({ label: t('det.traceLine'), path: ev.codeFile, line: ev.codeLine, find: ev.codeFind });
  if (msg) refs.push(...msg.refs);
  if (ev.kind === 'http' || ev.kind === 'http-response') refs.push(...httpRef(ev), INFRA_REFS.http);
  if (ev.kind === 'publish' || ev.kind === 'consume') refs.push(INFRA_REFS[ev.kind]);
  if (!refs.length) body.lastElementChild.remove();
  renderCode($('#detail-code'), refs);
}

function showNode(id, { expand = true } = {}) {
  const info = SERVICES[id];
  state.detailView = { kind: 'node', id };
  openDetail(`${tx(info.name)} (${tx(info.sub)})`, { expand });
  $('#detail-body').innerHTML = `
    <div class="explain">${escapeHtml(tx(info.summary))}</div>
    ${info.files.length ? `<h3>${escapeHtml(t('det.relatedCode'))}</h3>` : ''}`;
  renderCode($('#detail-code'), info.files);
}

function rerenderDetail() {
  const view = state.detailView;
  if (!view) return clearDetail();
  if (view.kind === 'event') showEvent(view.ev);
  else showNode(view.id, { expand: false });
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
    let d, lx, ly, anchor = 'middle';
    if (y1 === y2) {
      const dir = x2 > x1 ? 1 : -1;
      const sx = x1 + dir * w1 / 2, ex = x2 - dir * w2 / 2;
      d = `M${sx},${y1} L${ex - dir * 2},${y2}`;
      lx = (sx + ex) / 2; ly = y1 - 7;
    } else {
      d = `M${x1},${y1 + H / 2} L${x2},${y2 - H / 2 - 2}`;
      lx = x1 + 8; ly = (y1 + y2) / 2 + 4; anchor = 'start';
    }
    html += `<g class="tr" data-edge="${from}>${to}"><path d="${d}"/><text x="${lx}" y="${ly}" style="text-anchor:${anchor}">${label}</text></g>`;
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
    ? `${t('saga.order', { id: id.slice(0, 8) })}${order ? ` (${order.userName}, ${money(order.totalPrice)})` : ''}`
    : t('saga.noOrder');
  const reason = order?.failureReason ? ` ${t('saga.reason', { reason: localizeReason(order.failureReason) })}` : '';
  $('#saga-desc').textContent = current ? `${current}: ${tx(SAGA_STATES[current])}${reason}` : t('saga.hint');
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
  renderProducts(previous);
}

function renderProducts(previous = new Map()) {
  const root = $('#products');
  if (!state.products.length) {
    root.innerHTML = `<p class="hint">${escapeHtml(t('cat.empty'))}</p>`;
    return;
  }
  root.innerHTML = '';
  for (const p of state.products) {
    const row = document.createElement('div');
    row.className = 'product' + (previous.has(p.id) && previous.get(p.id) !== p.stock ? ' changed' : '');
    row.innerHTML = `
      <span class="name" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
      <span class="meta">
        <span class="num">${money(p.price)}</span>
        <label class="stock${p.stock === 0 ? ' zero' : ''}">${escapeHtml(t('cat.stock'))} <input type="number" min="0" value="${p.stock}" aria-label="${escapeHtml(t('cat.stockAria', { name: p.name }))}"></label>
      </span>
      <span class="actions"><button type="button" class="btn small">${escapeHtml(t('cat.add'))}</button></span>`;
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
  if (!state.focusOrderId && state.orders[0]) state.focusOrderId = state.orders[0].id;
  renderOrders();
}

function renderOrders() {
  const body = $('#orders');
  if (!state.orders.length) {
    body.innerHTML = `<tr><td colspan="5" class="hint">${escapeHtml(t('ord.empty'))}</td></tr>`;
  } else {
    body.innerHTML = state.orders.map(o => `
      <tr data-id="${o.id}" tabindex="0" title="${escapeHtml(o.failureReason ? localizeReason(o.failureReason) : t('ord.follow'))}">
        <td class="mono">#${o.id.slice(0, 8)}</td>
        <td>${escapeHtml(o.userName)}</td>
        <td class="num">${money(o.totalPrice)}</td>
        <td><span class="status ${o.status}">${o.status}</span></td>
        <td class="mono">${o.sagaState ?? '-'}</td>
      </tr>`).join('');
    body.querySelectorAll('tr[data-id]').forEach(tr => {
      tr.addEventListener('click', () => focusOrder(tr.dataset.id));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter') focusOrder(tr.dataset.id); });
    });
  }
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
    toast(err.message || t('toast.requestFailed'), 'error');
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
    root.innerHTML = `<p class="hint">${escapeHtml(t('bsk.empty'))}</p>`;
  } else {
    const total = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
    root.innerHTML = items.map((i, idx) => `
      <div class="item">
        <span>${escapeHtml(i.productName)}</span>
        <span class="mono">${i.quantity} × ${money(i.unitPrice)}</span>
        <button type="button" class="link-btn" data-idx="${idx}" aria-label="${escapeHtml(t('bsk.remove', { name: i.productName }))}">✕</button>
      </div>`).join('') + `<div class="total"><span>${escapeHtml(t('bsk.total'))}</span><span class="num">${money(total)}</span></div>`;
    root.querySelectorAll('[data-idx]').forEach(b => b.addEventListener('click', () => removeFromBasket(Number(b.dataset.idx))));
  }
  $('#checkout').disabled = !items.length;
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  $('#basket-count').textContent = String(count);
  $('#basket-count').hidden = count === 0;
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
  return storeBasket(items, tBoth('act.add', { name: product.name })).catch(() => {});
}

function removeFromBasket(index) {
  const items = state.basket.items.filter((_, i) => i !== index);
  return storeBasket(items, tBoth('act.remove')).catch(() => {});
}

async function checkout() {
  const user = currentUser();
  try {
    await userAction(tBoth('act.checkout', { user }), () => api.checkout(user));
    toast(t('toast.checkout'));
    setDrawer(false);
    state.basket.items = [];
    renderBasket();
  } catch { /* toast gösterildi */ }
}

async function emptyBasket() {
  const user = currentUser();
  try {
    await userAction(tBoth('act.empty'), () => api.deleteBasket(user));
    state.basket.items = [];
    renderBasket();
  } catch { /* toast gösterildi */ }
}

async function updateStock(product, stock) {
  if (!Number.isInteger(stock) || stock < 0) return toast(t('toast.stockInvalid'), 'error');
  try {
    const full = await api.product(product.id);
    await userAction(tBoth('act.stock', { name: product.name, stock }), () => api.updateProduct(product.id, {
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
  const saved = silent ? await run() : await userAction(tBoth('act.payment', { mode: body.mode }), run);
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
    if (!products.length) throw new Error(t('toast.noProducts'));

    const limit = 20000;
    let mode = 'FailAboveLimit';
    let line;

    if (kind === 'happy') {
      const p = products.filter(p => p.stock > 0 && p.price <= limit).sort((a, b) => b.stock - a.stock)[0];
      if (!p) throw new Error(t('toast.noHappy'));
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
        if (!p) throw new Error(t('toast.noStock'));
        line = { p, qty: 1 };
        mode = 'AlwaysFail';
      }
    }

    const delayMs = Number($('#pay-delay').value) || 1500;
    await applyPaymentSettings({ mode, limit, delayMs }, { silent: true });

    await storeBasket([{
      productId: line.p.id, productName: line.p.name, quantity: line.qty, unitPrice: line.p.price,
    }], tBoth('act.scenario', { qty: line.qty, name: line.p.name }));
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
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = text;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), kind === 'error' ? 7000 : 4500);
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll('.seg button[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  if (mode === 'auto') nextStep();
  updateQueueUi();
  if (mode === 'step') toast(t('toast.stepMode'));
}

async function clearAll() {
  $('#timeline').innerHTML = '';
  $('#timeline-empty').hidden = false;
  state.events.clear();
  state.queue.length = 0;
  clearDetail();
  diagram.lastPublisher.clear();
  updateQueueUi();
  try { await api.clearHistory(); } catch { /* simülatör kapalıysa önemli değil */ }
}

/** Dil değişince yeniden istek atmadan bütün dinamik bölümleri yeniden çizer. */
function rerenderAll() {
  renderConn();
  relabelTimeline();
  rerenderDetail();
  renderProducts();
  renderBasket();
  renderOrders();
  diagram.relabel();
  renderFullscreenButton();
  concepts.render();
}

// ------------------------------------------------------------------ tam ekran diyagram

// Tarayıcının Fullscreen API'si varsa kart gerçekten tam ekran olur; yoksa (ör. iPhone Safari)
// kart CSS ile ekranı kaplar. İki durumda da aynı .is-fullscreen sınıfı ve buton kullanılır.
const diagramCard = () => $('.diagram-card');
const nativeFullscreen = () => Boolean(document.fullscreenEnabled && diagramCard().requestFullscreen);

function isDiagramFullscreen() {
  return diagramCard().classList.contains('is-fullscreen');
}

async function toggleDiagramFullscreen() {
  const card = diagramCard();
  if (isDiagramFullscreen()) {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else setDiagramFullscreen(false);
    return;
  }
  if (nativeFullscreen()) {
    try { await card.requestFullscreen(); return; } catch { /* CSS yedeğine düş */ }
  }
  setDiagramFullscreen(true);
}

function setDiagramFullscreen(on) {
  diagramCard().classList.toggle('is-fullscreen', on);
  document.body.classList.toggle('diagram-fullscreen', on);
  renderFullscreenButton();
}

function renderFullscreenButton() {
  const on = isDiagramFullscreen();
  const button = $('#diagram-fullscreen');
  button.setAttribute('aria-pressed', String(on));
  button.querySelector('.fs-label').textContent = t(on ? 'arch.exitFullscreen' : 'arch.fullscreen');
}

// ------------------------------------------------------------------ çekmece

function setDrawer(open) {
  const drawer = $('#drawer');
  drawer.classList.toggle('open', open);
  drawer.inert = !open;
  $('#drawer-backdrop').hidden = !open;
  $('#open-drawer').setAttribute('aria-expanded', String(open));
  if (open) $('#close-drawer').focus();
  else if (drawer.contains(document.activeElement)) $('#open-drawer').focus();
}

// ------------------------------------------------------------------ başlangıç

function bind() {
  document.querySelectorAll('.seg button[data-mode]').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  onLangChange(rerenderAll);

  document.querySelectorAll('.next-step').forEach(b => b.addEventListener('click', nextStep));
  $('#open-drawer').addEventListener('click', () => setDrawer(!$('#drawer').classList.contains('open')));
  $('#close-drawer').addEventListener('click', () => setDrawer(false));
  $('#drawer-backdrop').addEventListener('click', () => setDrawer(false));
  $('#diagram-fullscreen').addEventListener('click', toggleDiagramFullscreen);
  document.addEventListener('fullscreenchange', () => setDiagramFullscreen(document.fullscreenElement === diagramCard()));
  $('#sheet-toggle').addEventListener('click', () => setSheet($('#detail').classList.contains('collapsed')));
  $('#speed').addEventListener('change', e => (state.speed = Number(e.target.value)));
  $('#clear').addEventListener('click', clearAll);
  $('#filter-order').addEventListener('change', refreshFilter);
  $('#detail-close').addEventListener('click', clearDetail);

  const dialog = $('#concepts');
  $('#open-concepts').addEventListener('click', () => { dialog.showModal(); concepts.focusSearch(); });
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
    if (e.key === 'Escape' && $('#drawer').classList.contains('open')) return setDrawer(false);
    if (e.key === 'Escape' && isDiagramFullscreen() && !document.fullscreenElement) return setDiagramFullscreen(false);
    if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.altKey
      && !e.target.closest('input, select, textarea, dialog')) return toggleDiagramFullscreen();
    if (e.key !== 'ArrowRight' || state.mode !== 'step') return;
    if (e.target.closest('input, select, textarea, dialog')) return;
    e.preventDefault();
    nextStep();
  });
}

function setupDemoBanner() {
  if (!DEMO) return;
  document.body.classList.add('demo');
  $('#demo-banner').hidden = false;
  $('#demo-run').href = CODESPACES_URL;
  $('#demo-repo').href = REPO_URL;
}

async function init() {
  setupDemoBanner();
  applyStatic();
  concepts = new ConceptBrowser($('#concepts-body'));
  bind();
  buildSaga();
  clearDetail();
  renderConn();
  renderBasket();
  renderOrders();

  const results = await Promise.allSettled([loadHistory(), loadProducts(), loadBasket(), loadOrders(), loadPaymentSettings()]);
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) toast(t('toast.unreachable', { n: failed.length }), 'error');

  connect();
}

init();
