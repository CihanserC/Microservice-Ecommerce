// Gateway üzerinden servis çağrıları.
// "action" çağrıları kullanıcının bilinçli aksiyonudur ve servislerde iz üretir.
// "background" çağrıları listeleri tazelemek içindir; X-Simulator-Background başlığı sayesinde iz üretmez.
// Demo modunda (GitHub Pages) aynı yüzey, tarayıcıda çalışan demo-backend.js tarafından sağlanır.
import { DEMO, sourceUrl } from './runtime.js';
import { createDemoApi } from './demo-backend.js';

const BACKGROUND_HEADER = 'X-Simulator-Background';

async function request(url, { method = 'GET', body, isBackground = false, raw = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (isBackground) headers[BACKGROUND_HEADER] = '1';

  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    const err = new Error(extractMessage(text) || `${res.status} ${res.statusText}`);
    err.status = res.status;
    throw err;
  }
  if (raw) return text;
  return text ? JSON.parse(text) : null;
}

function extractMessage(text) {
  try {
    const j = JSON.parse(text);
    return j.message || j.detail || j.title;
  } catch {
    return text?.slice(0, 200);
  }
}

const background = (url, opts = {}) => request(url, { ...opts, isBackground: true });
const action = (url, opts = {}) => request(url, opts);

const liveApi = {
  products: () => background('/catalog'),
  product: id => background(`/catalog/${id}`),
  updateProduct: (id, body) => action(`/catalog/${id}`, { method: 'PUT', body }),
  basket: user => background(`/basket/${encodeURIComponent(user)}`).catch(e => (e.status === 404 ? null : Promise.reject(e))),
  storeBasket: body => action('/basket', { method: 'POST', body }),
  deleteBasket: user => action(`/basket/${encodeURIComponent(user)}`, { method: 'DELETE' }),
  checkout: user => action('/basket/checkout', { method: 'POST', body: { userName: user } }),
  orders: () => background('/orders'),
  paymentSettings: () => background('/payments/settings'),
  updatePaymentSettings: body => action('/payments/settings', { method: 'PUT', body }),
  history: () => background('/sim/history?take=400'),
  clearHistory: () => background('/sim/history', { method: 'DELETE' }),

  /** Canlı iz akışı (Server-Sent Events). onState: 'open' | 'error'. */
  subscribe(onTrace, onState) {
    const source = new EventSource('/sim/events');
    source.addEventListener('open', () => onState('open'));
    source.addEventListener('error', () => onState('error'));
    source.addEventListener('trace', e => {
      try { onTrace(JSON.parse(e.data)); } catch { /* bozuk iz atlanır */ }
    });
    return () => source.close();
  },
};

export const api = DEMO ? createDemoApi() : liveApi;

/** Kod görüntüleyici için kaynak dosya (src/ altına göre yol). */
export function fetchSource(path) {
  return DEMO
    ? fetch(sourceUrl(path)).then(r => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
    : background(sourceUrl(path), { raw: true });
}
