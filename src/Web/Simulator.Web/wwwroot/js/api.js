// Gateway üzerinden servis çağrıları.
// "action" çağrıları kullanıcının bilinçli aksiyonudur ve servislerde iz üretir.
// "background" çağrıları listeleri tazelemek içindir; X-Simulator-Background başlığı sayesinde iz üretmez.

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

export const background = (url, opts = {}) => request(url, { ...opts, isBackground: true });
export const action = (url, opts = {}) => request(url, opts);

export const api = {
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
};
