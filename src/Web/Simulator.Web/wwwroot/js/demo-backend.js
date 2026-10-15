// Demo modu (GitHub Pages): servisleri tarayıcıda taklit eden arka uç.
//
// Gerçek sistemin davranışını birebir izler: aynı HTTP uçları, aynı mesajlar ve kuyruklar,
// aynı saga geçişleri, aynı iş kuralları (stokta "ya hepsi ya hiçbiri", ödeme modu ve limiti,
// telafi, idempotency) ve aynı iz metinleri. Her iz, onu gerçek sistemde üreten kod satırını
// "codeFind" ile gösterir; kod görüntüleyici repodaki gerçek kaynak dosyayı açar.
//
// Mesajlar outbox üzerinden gönderildiğinde gerçek sistemde "yayınlandı" izi oluşmaz
// (yalnızca Basket ve Payment doğrudan yayınlar); demo da aynı izleri üretir.
// Durum bellekte tutulur: sayfa yenilenince katalog ve siparişler başa döner.

const FILES = {
  basketEndpoints: 'Services/Basket/Basket.API/Endpoints/BasketEndpoints.cs',
  checkoutConsumer: 'Services/Order/Order.Infrastructure/Consumers/BasketCheckoutConsumer.cs',
  outcomeConsumer: 'Services/Order/Order.Infrastructure/Consumers/OrderOutcomeConsumer.cs',
  stateMachine: 'Services/Order/Order.Infrastructure/Saga/OrderStateMachine.cs',
  reserveStock: 'Services/Catalog/Catalog.Infrastructure/Consumers/ReserveStockConsumer.cs',
  releaseStock: 'Services/Catalog/Catalog.Infrastructure/Consumers/ReleaseStockConsumer.cs',
  paymentConsumer: 'Services/Payment/Payment.API/Consumers/ProcessPaymentConsumer.cs',
};

// MassTransit'in consumer adından ürettiği kuyruk adları (gerçek sistemden kaydedildi).
const QUEUE = {
  BasketCheckoutEvent: 'BasketCheckout',
  OrderCreatedEvent: 'OrderState',
  StockReservedEvent: 'OrderState',
  StockReservationFailedEvent: 'OrderState',
  PaymentCompletedEvent: 'OrderState',
  PaymentFailedEvent: 'OrderState',
  StockReleasedEvent: 'OrderState',
  ReserveStockCommand: 'ReserveStock',
  ReleaseStockCommand: 'ReleaseStock',
  ProcessPaymentCommand: 'ProcessPayment',
  OrderCompletedEvent: 'OrderOutcome',
  OrderCancelledEvent: 'OrderOutcome',
};

const CONSUMER_SERVICE = {
  BasketCheckout: 'order', OrderState: 'order', OrderOutcome: 'order',
  ReserveStock: 'catalog', ReleaseStock: 'catalog', ProcessPayment: 'payment',
};

const SEED = [
  { id: '8a1c4f7e-0b1d-4c3a-9e57-1f0a2b3c4d01', name: 'Mekanik Klavye', description: 'Bol stoklu ürün, mutlu yol senaryosu için.', price: 1899.90, stock: 50 },
  { id: '8a1c4f7e-0b1d-4c3a-9e57-1f0a2b3c4d02', name: 'Kablosuz Mouse', description: 'Ucuz ürün, ödeme limiti altında kalır.', price: 649.50, stock: 25 },
  { id: '8a1c4f7e-0b1d-4c3a-9e57-1f0a2b3c4d03', name: '4K Monitör', description: 'Pahalı ve az stoklu, ödeme limitini aşmak için.', price: 14999.00, stock: 3 },
  { id: '8a1c4f7e-0b1d-4c3a-9e57-1f0a2b3c4d04', name: 'Sınırlı Sürüm Kulaklık', description: 'Stokta yok, stok yetersiz senaryosu için.', price: 4299.00, stock: 0 },
];

const MESSAGE_LATENCY_MS = 35;
const L = (tr, en) => ({ tr, en });
const N2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const uuid = () => globalThis.crypto?.randomUUID?.()
  ?? 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => ((Math.random() * 16) | (c === 'x' ? 0 : 8)).toString(16));
const traceId = () => uuid().replace(/-/g, '');
const round2 = n => Math.round(n * 100) / 100;

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function createDemoApi() {
  const products = new Map(SEED.map(p => [p.id, { ...p, imageUrl: null, createdAt: new Date().toISOString(), updatedAt: null }]));
  const reservations = new Map(); // orderId -> [{ productId, quantity }]
  const baskets = new Map();      // userName -> { userName, items, totalPrice }
  const orders = new Map();       // orderId -> sipariş
  const sagas = new Map();        // orderId -> saga satırı
  const payments = new Map();     // orderId -> ödeme kaydı
  let settings = { mode: 'FailAboveLimit', limit: 20000, delayMs: 1500 };

  const history = [];
  const subscribers = new Set();

  // ---------------------------------------------------------------- izler

  function trace(service, kind, title, { detail, payload, messageType, orderId, ctx, from, to, code } = {}) {
    const ev = {
      id: uuid(),
      timestamp: new Date().toISOString(),
      service, kind,
      title: title.tr, titleEn: title.en,
      detail: detail?.tr ?? detail ?? null, detailEn: detail?.en ?? detail ?? null,
      messageType: messageType ?? null,
      payload: payload === undefined ? null : JSON.stringify(payload, null, 2),
      traceId: ctx?.traceId ?? null,
      orderId: orderId ?? null,
      fromState: from ?? null, toState: to ?? null,
      codeFile: code?.[0] ?? null, codeLine: null, codeFind: code?.[1] ?? null,
    };
    history.push(ev);
    if (history.length > 1000) history.shift();
    subscribers.forEach(fn => fn(ev));
  }

  // ---------------------------------------------------------------- HTTP (iz üreten middleware'in karşılığı)

  async function http(service, method, path, handler) {
    const ctx = { traceId: traceId() };
    const started = performance.now();
    trace(service, 'http', L(`HTTP ${method} ${path}`, `HTTP ${method} ${path}`), {
      detail: L('Senkron çağrı: istemci bu isteğin cevabını bekliyor.', 'Synchronous call: the client is waiting for this response.'),
      payload: { method, path }, ctx,
    });
    await sleep(8 + Math.random() * 20);
    let status = 200, body, error;
    try {
      ({ status = 200, body } = (await handler(ctx)) ?? {});
    } catch (err) {
      status = err.status ?? 500;
      error = err;
    }
    const ms = Math.round(performance.now() - started);
    trace(service, 'http-response', L(`HTTP ${status} ← ${method} ${path}`, `HTTP ${status} ← ${method} ${path}`), {
      detail: L(`Cevap ${ms} ms sonra döndü.`, `Response returned after ${ms} ms.`),
      payload: { method, path, status, durationMs: ms }, ctx,
    });
    if (error) throw error;
    return body;
  }

  // ---------------------------------------------------------------- mesajlaşma (RabbitMQ + MassTransit'in karşılığı)

  /** Doğrudan yayın: gerçek sistemde publish observer iz üretir (Basket, Payment). */
  function publish(service, type, message, ctx) {
    trace(service, 'publish', L(`${type} yayınlandı`, `${type} published`), {
      detail: L('Mesaj RabbitMQ exchange\'ine bırakıldı. Yayınlayan, kimin dinlediğini bilmez.',
        'The message was handed to a RabbitMQ exchange. The publisher does not know who is listening.'),
      payload: message, messageType: type, orderId: message.orderId, ctx,
    });
    deliver(type, message, ctx);
  }

  /** Outbox üzerinden gönderim: gerçek sistemde "yayınlandı" izi oluşmaz, mesaj yine de iletilir. */
  function deliver(type, message, ctx) {
    setTimeout(() => consume(type, message, ctx).catch(err => console.error('[demo]', err)), MESSAGE_LATENCY_MS);
  }

  async function consume(type, message, ctx) {
    const queue = QUEUE[type];
    trace(CONSUMER_SERVICE[queue], 'consume', L(`${type} alındı`, `${type} received`), {
      detail: L(`Kuyruk: ${queue}`, `Queue: ${queue}`),
      payload: message, messageType: type, orderId: message.orderId, ctx,
    });
    await sleep(10);
    await HANDLERS[type](message, ctx);
  }

  // ---------------------------------------------------------------- saga (OrderStateMachine'in karşılığı)

  const TRANSITIONS = {
    'Initial>AwaitingStock': L('Saga başladı: Catalog\'a stok ayırma komutu gönderiliyor', 'Saga started: sending the reserve-stock command to Catalog'),
    'AwaitingStock>AwaitingPayment': L('Stok ayrıldı: Payment\'a ödeme komutu gönderiliyor', 'Stock reserved: sending the payment command to Payment'),
    'AwaitingStock>Cancelled': L('Stok ayrılamadı: geri alınacak adım yok, sipariş iptal', 'Stock could not be reserved: nothing to undo, order cancelled'),
    'AwaitingPayment>Completed': L('Ödeme alındı: sipariş tamamlandı', 'Payment received: order completed'),
    'AwaitingPayment>Compensating': L('Ödeme reddedildi: telafi başlıyor, Catalog\'a stoğu geri bırak komutu gönderiliyor', 'Payment declined: compensation starts, sending the release-stock command to Catalog'),
    'Compensating>Cancelled': L('Telafi tamamlandı: stok geri bırakıldı, sipariş iptal', 'Compensation done: stock released, order cancelled'),
  };

  function transition(saga, to, ctx) {
    const from = saga.currentState;
    // Beklenmeyen durumda gelen olaylar yok sayılır (OnUnhandledEvent → Ignore).
    const title = TRANSITIONS[`${from}>${to}`];
    if (!title) return false;
    saga.currentState = to;
    saga.updatedAt = new Date().toISOString();
    trace('order', 'saga', title, {
      detail: L(`Saga durumu: ${from} → ${to}. Durum OrderSagaStates tablosunda saklanır.`,
        `Saga state: ${from} → ${to}. The state is stored in the OrderSagaStates table.`),
      payload: saga, orderId: saga.correlationId, ctx, from, to,
      code: [FILES.stateMachine, title.tr],
    });
    return true;
  }

  // ---------------------------------------------------------------- consumer'lar

  const HANDLERS = {
    // Order: BasketCheckoutConsumer
    BasketCheckoutEvent(msg, ctx) {
      const id = uuid();
      const order = {
        id, userName: msg.userName, createdAt: new Date().toISOString(),
        totalPrice: round2(msg.items.reduce((t, i) => t + i.quantity * i.unitPrice, 0)),
        status: 'Pending', sagaState: null, failureReason: null, items: msg.items,
      };
      orders.set(id, order);
      trace('order', 'db', L('Sipariş Pending olarak kaydedildi', 'Order saved as Pending'), {
        detail: L('Orders + OrderItems satırları ve OrderCreatedEvent (OutboxMessage) tek transaction\'da yazıldı.',
          'The Orders + OrderItems rows and OrderCreatedEvent (OutboxMessage) were written in one transaction.'),
        payload: { id, userName: order.userName, status: 'Pending', total: order.totalPrice },
        orderId: id, ctx, code: [FILES.checkoutConsumer, '"Sipariş Pending olarak kaydedildi"'],
      });
      deliver('OrderCreatedEvent', {
        orderId: id, userName: order.userName, totalPrice: order.totalPrice, createdAt: order.createdAt,
        items: msg.items.map(i => ({ productId: i.productId, productName: i.productName, quantity: i.quantity })),
      }, ctx);
    },

    // Order: OrderStateMachine
    OrderCreatedEvent(msg, ctx) {
      if (sagas.has(msg.orderId)) return;
      const now = new Date().toISOString();
      const saga = {
        correlationId: msg.orderId, currentState: 'Initial', userName: msg.userName,
        totalPrice: msg.totalPrice, paymentId: null, failureReason: null, createdAt: now, updatedAt: now,
      };
      sagas.set(msg.orderId, saga);
      transition(saga, 'AwaitingStock', ctx);
      syncOrder(saga);
      deliver('ReserveStockCommand', { orderId: msg.orderId, items: msg.items }, ctx);
    },

    StockReservedEvent(msg, ctx) {
      const saga = sagas.get(msg.orderId);
      if (!saga || !transition(saga, 'AwaitingPayment', ctx)) return;
      syncOrder(saga);
      deliver('ProcessPaymentCommand', { orderId: msg.orderId, userName: saga.userName, amount: saga.totalPrice }, ctx);
    },

    StockReservationFailedEvent(msg, ctx) {
      const saga = sagas.get(msg.orderId);
      if (!saga || saga.currentState !== 'AwaitingStock') return;
      saga.failureReason = msg.reason;
      transition(saga, 'Cancelled', ctx);
      syncOrder(saga);
      deliver('OrderCancelledEvent', { orderId: msg.orderId, reason: msg.reason }, ctx);
    },

    PaymentCompletedEvent(msg, ctx) {
      const saga = sagas.get(msg.orderId);
      if (!saga || saga.currentState !== 'AwaitingPayment') return;
      saga.paymentId = msg.paymentId;
      transition(saga, 'Completed', ctx);
      syncOrder(saga);
      deliver('OrderCompletedEvent', { orderId: msg.orderId }, ctx);
    },

    PaymentFailedEvent(msg, ctx) {
      const saga = sagas.get(msg.orderId);
      if (!saga || saga.currentState !== 'AwaitingPayment') return;
      saga.failureReason = msg.reason;
      transition(saga, 'Compensating', ctx);
      syncOrder(saga);
      deliver('ReleaseStockCommand', { orderId: msg.orderId, reason: msg.reason }, ctx);
    },

    StockReleasedEvent(msg, ctx) {
      const saga = sagas.get(msg.orderId);
      if (!saga || !transition(saga, 'Cancelled', ctx)) return;
      syncOrder(saga);
      deliver('OrderCancelledEvent', { orderId: msg.orderId, reason: saga.failureReason ?? 'Ödeme başarısız.' }, ctx);
    },

    // Catalog: ReserveStockConsumer ("ya hepsi ya hiçbiri", idempotent)
    ReserveStockCommand(msg, ctx) {
      if (reservations.has(msg.orderId)) {
        trace('catalog', 'step', L('Bu sipariş için stok zaten ayrılmış, tekrar düşülmedi', 'Stock already reserved for this order, not deducted again'), {
          detail: L('Aynı komut ikinci kez geldi. Sonuç olayı yeniden yayınlanır, stok değişmez.',
            'The same command arrived twice. The result event is published again and stock stays unchanged.'),
          orderId: msg.orderId, ctx, code: [FILES.reserveStock, 'Bu sipariş için stok zaten ayrılmış'],
        });
        return deliver('StockReservedEvent', { orderId: msg.orderId }, ctx);
      }

      const shortages = msg.items
        .filter(i => !products.has(i.productId) || products.get(i.productId).stock < i.quantity)
        .map(i => products.has(i.productId)
          ? `${products.get(i.productId).name}: istenen ${i.quantity}, stokta ${products.get(i.productId).stock}`
          : `${i.productName}: katalogda yok`);

      if (shortages.length) {
        const reason = 'Stok yetersiz: ' + shortages.join('; ');
        trace('catalog', 'step', L('Stok yetersiz, hiçbir kalem ayrılmadı', 'Insufficient stock, no item was reserved'), {
          detail: reason, orderId: msg.orderId, ctx, code: [FILES.reserveStock, '"Stok yetersiz, hiçbir kalem ayrılmadı"'],
        });
        return deliver('StockReservationFailedEvent', { orderId: msg.orderId, reason }, ctx);
      }

      for (const i of msg.items) products.get(i.productId).stock -= i.quantity;
      reservations.set(msg.orderId, msg.items.map(i => ({ productId: i.productId, quantity: i.quantity })));
      trace('catalog', 'db', L('Stok düşüldü ve rezervasyon kaydedildi', 'Stock deducted and reservation saved'), {
        detail: L('Products.Stock azaltıldı, StockReservations\'a satır eklendi, StockReservedEvent outbox\'a yazıldı; hepsi tek transaction.',
          'Products.Stock was decreased, a StockReservations row was added and StockReservedEvent was written to the outbox, all in one transaction.'),
        payload: msg.items.map(i => ({ product: products.get(i.productId).name, reserved: i.quantity, remainingStock: products.get(i.productId).stock })),
        orderId: msg.orderId, ctx, code: [FILES.reserveStock, '"Stok düşüldü ve rezervasyon kaydedildi"'],
      });
      deliver('StockReservedEvent', { orderId: msg.orderId }, ctx);
    },

    // Catalog: ReleaseStockConsumer (telafi, idempotent)
    ReleaseStockCommand(msg, ctx) {
      const items = reservations.get(msg.orderId) ?? [];
      for (const r of items) if (products.has(r.productId)) products.get(r.productId).stock += r.quantity;
      reservations.delete(msg.orderId);
      const reason = String(msg.reason ?? '').replace(/\.+$/, '');
      trace('catalog', 'db', items.length
        ? L('Telafi: ayrılan stok geri eklendi', 'Compensation: reserved stock added back')
        : L('Telafi: geri bırakılacak rezervasyon yok', 'Compensation: no reservation to release'), {
        detail: L(`Sebep: ${reason}. Products.Stock artırıldı, StockReservations satırları silindi.`,
          `Reason: ${reason}. Products.Stock was increased and the StockReservations rows were deleted.`),
        payload: items.map(r => ({ productId: r.productId, released: r.quantity })),
        orderId: msg.orderId, ctx, code: [FILES.releaseStock, 'Telafi: ayrılan stok geri eklendi'],
      });
      deliver('StockReleasedEvent', { orderId: msg.orderId }, ctx);
    },

    // Payment: ProcessPaymentConsumer (idempotent)
    async ProcessPaymentCommand(msg, ctx) {
      const existing = payments.get(msg.orderId);
      if (existing) {
        trace('payment', 'step', L('Bu sipariş zaten işlenmiş, ikinci kez tahsil edilmedi', 'This order was already processed, not charged a second time'), {
          detail: L('Tekrar gelen komut için önceki sonuç yeniden yayınlanıyor.', 'The earlier result is published again for the repeated command.'),
          orderId: msg.orderId, ctx, code: [FILES.paymentConsumer, 'Bu sipariş zaten işlenmiş'],
        });
        return publishPaymentOutcome(existing, ctx);
      }

      const s = { ...settings };
      trace('payment', 'step', L(`Bankaya gidiliyor (${s.delayMs} ms)`, `Calling the bank (${s.delayMs} ms)`), {
        detail: L(`Mod: ${s.mode}, limit: ${N2.format(s.limit)} ₺. Bu sürede saga AwaitingPayment durumunda bekler.`,
          `Mode: ${s.mode}, limit: ${N2.format(s.limit)} ₺. Meanwhile the saga waits in AwaitingPayment.`),
        payload: s, orderId: msg.orderId, ctx, code: [FILES.paymentConsumer, 'Bankaya gidiliyor'],
      });
      await sleep(s.delayMs);

      const failureReason = s.mode === 'AlwaysFail'
        ? 'Banka ödemeyi reddetti (simülasyon: her zaman başarısız).'
        : s.mode === 'FailAboveLimit' && msg.amount > s.limit
          ? `Kart limiti yetersiz: tutar ${N2.format(msg.amount)} ₺, limit ${N2.format(s.limit)} ₺.`
          : null;
      const record = {
        paymentId: uuid(), orderId: msg.orderId, userName: msg.userName, amount: msg.amount,
        succeeded: !failureReason, failureReason, processedAt: new Date().toISOString(),
      };
      payments.set(msg.orderId, record);

      trace('payment', record.succeeded ? 'step' : 'error',
        record.succeeded ? L('Ödeme onaylandı', 'Payment approved') : L('Ödeme reddedildi', 'Payment declined'), {
          detail: failureReason ?? L(`${N2.format(record.amount)} ₺ tahsil edildi.`, `${N2.format(record.amount)} ₺ charged.`),
          payload: record, orderId: msg.orderId, ctx,
          code: [FILES.paymentConsumer, record.succeeded ? '"Ödeme onaylandı"' : '"Ödeme reddedildi"'],
        });
      publishPaymentOutcome(record, ctx);
    },

    // Order: OrderOutcomeConsumer
    OrderCompletedEvent(msg, ctx) {
      const order = orders.get(msg.orderId);
      if (!order || order.status === 'Completed') return;
      order.status = 'Completed';
      trace('order', 'db', L('Sipariş durumu Completed yapıldı', 'Order status set to Completed'), {
        detail: L('CustomerOrder.Complete() çağrıldı; Orders.Status güncellendi.', 'CustomerOrder.Complete() was called; Orders.Status was updated.'),
        orderId: order.id, ctx, code: [FILES.outcomeConsumer, '"Sipariş durumu Completed yapıldı"'],
      });
    },

    OrderCancelledEvent(msg, ctx) {
      const order = orders.get(msg.orderId);
      if (!order || order.status === 'Cancelled') return;
      order.status = 'Cancelled';
      order.failureReason = msg.reason;
      trace('order', 'db', L('Sipariş durumu Cancelled yapıldı', 'Order status set to Cancelled'), {
        detail: L(`CustomerOrder.Cancel() çağrıldı. Sebep: ${msg.reason}`, `CustomerOrder.Cancel() was called. Reason: ${msg.reason}`),
        orderId: order.id, ctx, code: [FILES.outcomeConsumer, '"Sipariş durumu Cancelled yapıldı"'],
      });
    },
  };

  function publishPaymentOutcome(record, ctx) {
    if (record.succeeded) publish('payment', 'PaymentCompletedEvent', { orderId: record.orderId, paymentId: record.paymentId }, ctx);
    else publish('payment', 'PaymentFailedEvent', { orderId: record.orderId, reason: record.failureReason }, ctx);
  }

  function syncOrder(saga) {
    const order = orders.get(saga.correlationId);
    if (order) order.sagaState = saga.currentState;
  }

  // ---------------------------------------------------------------- API (api.js ile aynı yüzey)

  const clone = v => JSON.parse(JSON.stringify(v));
  const listProducts = () => [...products.values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
    .map(({ id, name, price, imageUrl, stock }) => ({ id, name, price, imageUrl, stock }));

  function storedBasket(userName, items) {
    const lines = items.map(i => ({ ...i, lineTotal: round2(i.quantity * i.unitPrice) }));
    return { userName, items: lines, totalPrice: round2(lines.reduce((t, i) => t + i.lineTotal, 0)) };
  }

  return {
    products: async () => listProducts(),

    product: async id => {
      if (!products.has(id)) throw new HttpError(404, 'Product not found.');
      return clone(products.get(id));
    },

    updateProduct: (id, body) => http('catalog', 'PUT', `/api/products/${id}`, async () => {
      const p = products.get(id);
      if (!p) throw new HttpError(404, 'Product not found.');
      Object.assign(p, { name: body.name, description: body.description, price: body.price, imageUrl: body.imageUrl, stock: body.stock, updatedAt: new Date().toISOString() });
      return { status: 204 };
    }),

    basket: async user => (baskets.has(user) ? clone(baskets.get(user)) : null),

    storeBasket: body => http('basket', 'POST', '/api/basket', async ctx => {
      const stored = storedBasket(body.userName, body.items);
      baskets.set(body.userName, stored);
      trace('basket', 'db', L(`Sepet Redis'e yazıldı (basket:${stored.userName})`, `Basket written to Redis (basket:${stored.userName})`), {
        detail: L('Sepet geçici veridir: ilişkisel tablo yerine JSON olarak tek bir Redis anahtarında durur.',
          'A basket is temporary data: it lives as JSON under a single Redis key instead of relational tables.'),
        payload: stored, ctx, code: [FILES.basketEndpoints, 'Sepet Redis\'e yazıldı'],
      });
      return { body: clone(stored) };
    }),

    deleteBasket: user => http('basket', 'DELETE', `/api/basket/${user}`, async () => {
      baskets.delete(user);
      return { status: 204 };
    }),

    checkout: user => http('basket', 'POST', '/api/basket/checkout', async ctx => {
      const basket = baskets.get(user);
      if (!basket?.items.length) throw new HttpError(400, 'Basket is empty or does not exist.');
      publish('basket', 'BasketCheckoutEvent', {
        userName: basket.userName, totalPrice: basket.totalPrice,
        items: basket.items.map(({ productId, productName, quantity, unitPrice }) => ({ productId, productName, quantity, unitPrice })),
      }, ctx);
      baskets.delete(user);
      trace('basket', 'db', L('Sepet Redis\'ten silindi, istemciye 202 Accepted dönülüyor', 'Basket deleted from Redis, returning 202 Accepted to the client'), {
        detail: L('202 = "isteğini aldım, işleniyor". Siparişin oluşup oluşmadığını istemci daha sonra /orders ile öğrenir.',
          '202 = "I got your request and it is being processed". The client finds out later via /orders whether the order was created.'),
        ctx, code: [FILES.basketEndpoints, 'Sepet Redis\'ten silindi'],
      });
      return { status: 202, body: { message: 'Checkout initiated.', totalPrice: basket.totalPrice } };
    }),

    orders: async () => [...orders.values()]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ id, userName, createdAt, totalPrice, status, sagaState, failureReason }) => ({ id, userName, createdAt, totalPrice, status, sagaState, failureReason })),

    paymentSettings: async () => ({ ...settings }),

    updatePaymentSettings: body => http('payment', 'PUT', '/api/payments/settings', async () => {
      settings = {
        mode: body.mode,
        limit: Math.max(0, Number(body.limit) || 0),
        delayMs: Math.min(15000, Math.max(0, Number(body.delayMs) || 0)),
      };
      return { body: { ...settings } };
    }),

    history: async () => history.slice(-400),

    clearHistory: async () => { history.length = 0; },

    subscribe(onTrace, onState) {
      subscribers.add(onTrace);
      setTimeout(() => onState('open'), 50);
      return () => subscribers.delete(onTrace);
    },
  };
}
