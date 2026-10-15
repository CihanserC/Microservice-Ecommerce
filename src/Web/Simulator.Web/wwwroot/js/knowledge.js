// Simülatörün "öğretmen" katmanı: her servis, mesaj ve iz türü için açıklama ve kod adresleri.
// Kod yolları src/ altına göredir; "find" verilen satır kod görüntüleyicide işaretlenir.
// Metinler {tr, en} biçimindedir; tx() aktif dili seçer.

const L = (tr, en) => ({ tr, en });

const P = {
  gateway: 'ApiGateways/Gateway.API/Program.cs',
  gatewayConfig: 'ApiGateways/Gateway.API/appsettings.json',
  productEndpoints: 'Services/Catalog/Catalog.API/Endpoints/ProductEndpoints.cs',
  catalogProgram: 'Services/Catalog/Catalog.API/Program.cs',
  catalogDi: 'Services/Catalog/Catalog.Infrastructure/DependencyInjection.cs',
  catalogDb: 'Services/Catalog/Catalog.Infrastructure/Persistence/CatalogDbContext.cs',
  reserveStock: 'Services/Catalog/Catalog.Infrastructure/Consumers/ReserveStockConsumer.cs',
  releaseStock: 'Services/Catalog/Catalog.Infrastructure/Consumers/ReleaseStockConsumer.cs',
  basketEndpoints: 'Services/Basket/Basket.API/Endpoints/BasketEndpoints.cs',
  basketService: 'Services/Basket/Basket.API/Services/BasketService.cs',
  checkoutConsumer: 'Services/Order/Order.Infrastructure/Consumers/BasketCheckoutConsumer.cs',
  outcomeConsumer: 'Services/Order/Order.Infrastructure/Consumers/OrderOutcomeConsumer.cs',
  stateMachine: 'Services/Order/Order.Infrastructure/Saga/OrderStateMachine.cs',
  sagaState: 'Services/Order/Order.Infrastructure/Saga/OrderState.cs',
  orderDi: 'Services/Order/Order.Infrastructure/DependencyInjection.cs',
  orderDb: 'Services/Order/Order.Infrastructure/Persistence/OrderDbContext.cs',
  orderAggregate: 'Services/Order/Order.Domain/Entities/CustomerOrder.cs',
  orderEndpoints: 'Services/Order/Order.API/Endpoints/OrderEndpoints.cs',
  paymentConsumer: 'Services/Payment/Payment.API/Consumers/ProcessPaymentConsumer.cs',
  paymentSimulator: 'Services/Payment/Payment.API/Services/PaymentSimulator.cs',
  paymentEndpoints: 'Services/Payment/Payment.API/Endpoints/PaymentEndpoints.cs',
  massTransit: 'BuildingBlocks/Shared.Infrastructure/Extensions/MassTransitExtensions.cs',
  stockMessages: 'BuildingBlocks/Shared.Contracts/Saga/StockMessages.cs',
  paymentMessages: 'BuildingBlocks/Shared.Contracts/Saga/PaymentMessages.cs',
  outcomeMessages: 'BuildingBlocks/Shared.Contracts/Saga/OrderOutcomeMessages.cs',
  checkoutEvent: 'BuildingBlocks/Shared.Contracts/Events/BasketCheckoutEvent.cs',
  orderCreatedEvent: 'BuildingBlocks/Shared.Contracts/Events/OrderCreatedEvent.cs',
  tracer: 'BuildingBlocks/Shared.Infrastructure/Simulation/SimulationTracer.cs',
  observers: 'BuildingBlocks/Shared.Infrastructure/Simulation/SimulationMessageObservers.cs',
  httpTrace: 'BuildingBlocks/Shared.Infrastructure/Simulation/SimulationHttpTraceMiddleware.cs',
};

export const SERVICES = {
  browser: {
    name: L('Tarayıcı', 'Browser'),
    sub: L('bu sayfa', 'this page'),
    summary: L('Butonlara bastığında bu sayfa Gateway\'e HTTP isteği atar. Servislerin adreslerini bilmez, tek kapı Gateway\'dir.',
      'When you press a button, this page sends an HTTP request to the Gateway. It does not know the services\' addresses; the Gateway is the only door.'),
    files: [],
  },
  gateway: {
    name: 'Gateway.API',
    sub: L('YARP ters vekil', 'YARP reverse proxy'),
    summary: L('Tek giriş noktası. İş kuralı yoktur; /catalog, /basket, /orders, /payments yollarını ilgili servise iletir ve yolu yeniden yazar (/catalog → /api/products).',
      'The single entry point. It holds no business rules; it forwards /catalog, /basket, /orders and /payments to the right service and rewrites the path (/catalog → /api/products).'),
    files: [
      { label: L('Rota tablosu', 'Route table'), path: P.gatewayConfig, find: '"catalog-route"' },
      { label: 'Program.cs', path: P.gateway, find: 'AddReverseProxy' },
    ],
  },
  catalog: {
    name: 'Catalog.API',
    sub: 'Clean Arch + CQRS',
    summary: L('Ürün ve stok sahibi. HTTP tarafı MediatR komut/sorgularıyla CRUD yapar. Saga\'nın stok katılımcısıdır: ReserveStock ile stok düşer, ReleaseStock (telafi) ile geri ekler.',
      'Owns products and stock. The HTTP side does CRUD through MediatR commands/queries. It is the saga\'s stock participant: ReserveStock deducts stock, ReleaseStock (compensation) adds it back.'),
    files: [
      { label: L('Stok ayırma', 'Reserve stock'), path: P.reserveStock, find: 'IConsumer<ReserveStockCommand>' },
      { label: L('Stok bırakma (telafi)', 'Release stock (compensation)'), path: P.releaseStock, find: 'IConsumer<ReleaseStockCommand>' },
      { label: L('Outbox kurulumu', 'Outbox setup'), path: P.catalogDi, find: 'AddEntityFrameworkOutbox' },
      { label: L('HTTP uçları', 'HTTP endpoints'), path: P.productEndpoints, find: 'MapGroup' },
      { label: 'DbContext', path: P.catalogDb, find: 'AddInboxStateEntity' },
    ],
  },
  basket: {
    name: 'Basket.API',
    sub: 'Minimal API + Redis',
    summary: L('Geçici sepet. Checkout\'ta Order\'ı çağırmaz: BasketCheckoutEvent yayınlar, sepeti siler, 202 Accepted döner. Asenkron iletişimin başladığı yer.',
      'A temporary basket. On checkout it does not call Order: it publishes BasketCheckoutEvent, deletes the basket and returns 202 Accepted. This is where asynchronous communication begins.'),
    files: [
      { label: 'Checkout', path: P.basketEndpoints, find: 'MapPost("/checkout"' },
      { label: L('Redis erişimi', 'Redis access'), path: P.basketService, find: 'SetStringAsync' },
    ],
  },
  order: {
    name: 'Order.API',
    sub: L('DDD + Saga orkestratörü', 'DDD + saga orchestrator'),
    summary: L('İki rolü var: (1) Sipariş kaydı: CustomerOrder aggregate\'i. (2) Saga orkestratörü: OrderStateMachine her siparişin sürecini yönetir, hangi servise hangi komutun gideceğine karar verir.',
      'It has two roles: (1) the order record: the CustomerOrder aggregate; (2) the saga orchestrator: OrderStateMachine runs each order\'s process and decides which command goes to which service.'),
    files: [
      { label: L('Saga (state machine)', 'Saga (state machine)'), path: P.stateMachine, find: 'Initially(' },
      { label: L('Checkout → sipariş', 'Checkout → order'), path: P.checkoutConsumer, find: 'new OrderCreatedEvent' },
      { label: L('Saga sonucu → sipariş', 'Saga outcome → order'), path: P.outcomeConsumer, find: 'order.Cancel' },
      { label: L('Aggregate kuralları', 'Aggregate rules'), path: P.orderAggregate, find: 'public void Cancel' },
      { label: L('Saga + outbox kurulumu', 'Saga + outbox setup'), path: P.orderDi, find: 'AddSagaStateMachine' },
    ],
  },
  payment: {
    name: 'Payment.API',
    sub: L('Stateless katılımcı', 'Stateless participant'),
    summary: L('Ödeme sağlayıcısını taklit eder. Saga\'dan habersizdir: ProcessPaymentCommand alır, PaymentCompleted ya da PaymentFailed yayınlar. Davranışı soldaki "Ödeme servisi" panelinden değiştirilir.',
      'Imitates a payment provider. It knows nothing about the saga: it receives ProcessPaymentCommand and publishes PaymentCompleted or PaymentFailed. Change its behavior in the "Payment service" panel on the left.'),
    files: [
      { label: L('Ödeme consumer', 'Payment consumer'), path: P.paymentConsumer, find: 'IConsumer<ProcessPaymentCommand>' },
      { label: L('Karar kuralı', 'Decision rule'), path: P.paymentSimulator, find: 'public string? Decide' },
    ],
  },
  rabbit: {
    name: 'RabbitMQ',
    sub: L('mesaj aracısı', 'message broker'),
    summary: L('Servisler birbirini tanımaz; mesajı exchange\'e bırakır, ilgilenen servisin kuyruğu kopyasını alır. Hedef servis kapalıysa mesaj kuyrukta bekler. MassTransit kuyrukları consumer adından üretir.',
      'Services do not know each other; they drop a message on an exchange and each interested service\'s queue gets a copy. If the target service is down, the message waits in the queue. MassTransit names queues after the consumers.'),
    files: [
      { label: L('MassTransit kurulumu', 'MassTransit setup'), path: P.massTransit, find: 'UsingRabbitMq' },
      { label: L('Stok mesajları', 'Stock messages'), path: P.stockMessages, find: 'ReserveStockCommand' },
      { label: L('Ödeme mesajları', 'Payment messages'), path: P.paymentMessages, find: 'ProcessPaymentCommand' },
    ],
  },
  catalogdb: {
    name: 'catalogdb', sub: 'PostgreSQL',
    summary: L('Products, StockReservations ve MassTransit outbox/inbox tabloları. Stok düşüşü ile yayınlanan olay aynı transaction\'da yazılır.',
      'Products, StockReservations and the MassTransit outbox/inbox tables. The stock deduction and the published event are written in the same transaction.'),
    files: [{ label: 'CatalogDbContext', path: P.catalogDb, find: 'StockReservation' }],
  },
  redis: {
    name: 'Redis', sub: 'cache',
    summary: L('Sepet JSON olarak basket:{kullanıcı} anahtarında durur. Şema yok, migration yok.',
      'The basket is stored as JSON under the basket:{user} key. No schema, no migrations.'),
    files: [{ label: 'BasketService', path: P.basketService, find: 'GetCacheKey' }],
  },
  orderdb: {
    name: 'orderdb', sub: 'PostgreSQL',
    summary: L('Orders, OrderItems, OrderSagaStates (saga hafızası) ve outbox/inbox tabloları.',
      'Orders, OrderItems, OrderSagaStates (the saga\'s memory) and the outbox/inbox tables.'),
    files: [
      { label: 'OrderDbContext', path: P.orderDb, find: 'OrderStateMap' },
      { label: L('Saga satırı', 'Saga row'), path: P.sagaState, find: 'CurrentState' },
    ],
  },
};

const ROLE = {
  event: L('Olay', 'Event'),
  command: L('Komut', 'Command'),
  compensation: L('Telafi komutu', 'Compensating command'),
};
const REF = {
  publisher: L('Yayınlayan', 'Publisher'),
  publisherSaga: L('Yayınlayan (saga)', 'Publisher (saga)'),
  consumer: L('Tüketen', 'Consumer'),
  consumerSaga: L('Tüketen (saga)', 'Consumer (saga)'),
  sender: L('Gönderen (saga)', 'Sender (saga)'),
  handler: L('İşleyen', 'Handler'),
  contract: L('Sözleşme', 'Contract'),
};

export const MESSAGES = {
  BasketCheckoutEvent: {
    role: ROLE.event,
    text: L('Sepet checkout edildi. Basket, Order servisini HTTP ile çağırmak yerine bu olayı bırakır; böylece Order o an kapalı olsa bile checkout başarılı olur.',
      'The basket was checked out. Instead of calling the Order service over HTTP, Basket drops this event, so checkout succeeds even if Order is down at that moment.'),
    refs: [
      { label: REF.publisher, path: P.basketEndpoints, find: 'publishEndpoint.Publish(checkoutEvent' },
      { label: REF.consumer, path: P.checkoutConsumer, find: 'IConsumer<BasketCheckoutEvent>' },
      { label: REF.contract, path: P.checkoutEvent, find: 'record BasketCheckoutEvent' },
    ],
  },
  OrderCreatedEvent: {
    role: ROLE.event,
    text: L('Sipariş Pending olarak kaydedildi. Saga bu olayla başlar (Initially → When(OrderCreated)). Olay outbox ile siparişle aynı transaction\'da yazıldığı için kaybolamaz.',
      'The order was saved as Pending. The saga starts with this event (Initially → When(OrderCreated)). Because the outbox writes it in the same transaction as the order, it cannot get lost.'),
    refs: [
      { label: REF.publisher, path: P.checkoutConsumer, find: 'new OrderCreatedEvent' },
      { label: REF.consumerSaga, path: P.stateMachine, find: 'When(OrderCreated)' },
      { label: REF.contract, path: P.orderCreatedEvent, find: 'record OrderCreatedEvent' },
    ],
  },
  ReserveStockCommand: {
    role: ROLE.command,
    text: L('Saga Catalog\'a "bu siparişin kalemlerini ayır" der. Komut tek bir alıcıya yöneliktir ve bir cevap (StockReserved / StockReservationFailed) beklenir.',
      'The saga tells Catalog "reserve this order\'s items". A command targets a single receiver and a reply (StockReserved / StockReservationFailed) is expected.'),
    refs: [
      { label: REF.sender, path: P.stateMachine, find: 'new ReserveStockCommand' },
      { label: REF.handler, path: P.reserveStock, find: 'IConsumer<ReserveStockCommand>' },
    ],
  },
  StockReservedEvent: {
    role: ROLE.event,
    text: L('Stok düşüldü ve rezervasyon kaydedildi. Saga bir sonraki adıma, ödemeye geçer.',
      'Stock was deducted and the reservation saved. The saga moves on to the next step: payment.'),
    refs: [
      { label: REF.publisher, path: P.reserveStock, find: 'new StockReservedEvent' },
      { label: REF.consumerSaga, path: P.stateMachine, find: 'When(StockReserved)' },
    ],
  },
  StockReservationFailedEvent: {
    role: ROLE.event,
    text: L('Stok yetersiz. Catalog "ya hepsi ya hiçbiri" kuralıyla hiçbir kalemi ayırmadı; bu yüzden saga\'nın geri alacağı bir şey yok, sipariş doğrudan iptal olur.',
      'Not enough stock. Following its all-or-nothing rule, Catalog reserved no items, so the saga has nothing to undo and the order is cancelled directly.'),
    refs: [
      { label: REF.publisher, path: P.reserveStock, find: 'new StockReservationFailedEvent' },
      { label: REF.consumerSaga, path: P.stateMachine, find: 'When(StockReservationFailed)' },
    ],
  },
  ProcessPaymentCommand: {
    role: ROLE.command,
    text: L('Saga Payment\'a tahsilat yaptırır. Payment saga\'yı tanımaz; yalnızca komutu işler ve sonucu olay olarak yayınlar.',
      'The saga has Payment charge the customer. Payment does not know the saga; it just handles the command and publishes the result as an event.'),
    refs: [
      { label: REF.sender, path: P.stateMachine, find: 'new ProcessPaymentCommand' },
      { label: REF.handler, path: P.paymentConsumer, find: 'IConsumer<ProcessPaymentCommand>' },
    ],
  },
  PaymentCompletedEvent: {
    role: ROLE.event,
    text: L('Ödeme alındı. Saga mutlu sonla biter (Completed) ve OrderCompletedEvent yayınlar.',
      'Payment received. The saga ends happily (Completed) and publishes OrderCompletedEvent.'),
    refs: [
      { label: REF.publisher, path: P.paymentConsumer, find: 'new PaymentCompletedEvent' },
      { label: REF.consumerSaga, path: P.stateMachine, find: 'When(PaymentCompleted)' },
    ],
  },
  PaymentFailedEvent: {
    role: ROLE.event,
    text: L('Ödeme reddedildi. Ama stok zaten düşülmüştü! Dağıtık sistemde veritabanı rollback\'i servisler arasında çalışmaz; saga daha önce başarılı olan adımı TELAFİ eder (ReleaseStockCommand).',
      'Payment declined. But the stock was already deducted! In a distributed system a database rollback does not work across services; the saga COMPENSATES the step that already succeeded (ReleaseStockCommand).'),
    refs: [
      { label: REF.publisher, path: P.paymentConsumer, find: 'new PaymentFailedEvent' },
      { label: REF.consumerSaga, path: P.stateMachine, find: 'When(PaymentFailed)' },
    ],
  },
  ReleaseStockCommand: {
    role: ROLE.compensation,
    text: L('Compensation: önceki işlemi silmez, onu tersine çeviren YENİ bir işlem yapar (stok geri eklenir). Mesaj yalnızca OrderId taşır; Catalog neyi ayırdığını StockReservations tablosundan bilir.',
      'Compensation: it does not erase the earlier operation; it runs a NEW operation that reverses it (stock is added back). The message carries only OrderId; Catalog knows what it reserved from the StockReservations table.'),
    refs: [
      { label: REF.sender, path: P.stateMachine, find: 'new ReleaseStockCommand' },
      { label: REF.handler, path: P.releaseStock, find: 'IConsumer<ReleaseStockCommand>' },
    ],
  },
  StockReleasedEvent: {
    role: ROLE.event,
    text: L('Telafi tamamlandı, stok eski haline döndü. Saga siparişi iptal eder.',
      'Compensation finished and the stock is back to its previous level. The saga cancels the order.'),
    refs: [
      { label: REF.publisher, path: P.releaseStock, find: 'new StockReleasedEvent' },
      { label: REF.consumerSaga, path: P.stateMachine, find: 'When(StockReleased)' },
    ],
  },
  OrderCompletedEvent: {
    role: ROLE.event,
    text: L('Saga\'nın sonucu. Order servisindeki OrderOutcomeConsumer siparişi Completed yapar. Başka servisler de (ör. e-posta, kargo) bu olayı dinleyebilir.',
      'The saga\'s outcome. OrderOutcomeConsumer in the Order service marks the order Completed. Other services (e.g. email, shipping) could listen to this event too.'),
    refs: [
      { label: REF.publisherSaga, path: P.stateMachine, find: 'new OrderCompletedEvent' },
      { label: REF.consumer, path: P.outcomeConsumer, find: 'ConsumeContext<OrderCompletedEvent>' },
    ],
  },
  OrderCancelledEvent: {
    role: ROLE.event,
    text: L('Saga\'nın başarısız sonu. Order servisi siparişi Cancelled yapar ve sebebi saklar.',
      'The saga\'s unsuccessful end. The Order service marks the order Cancelled and stores the reason.'),
    refs: [
      { label: REF.publisherSaga, path: P.stateMachine, find: 'new OrderCancelledEvent' },
      { label: REF.consumer, path: P.outcomeConsumer, find: 'ConsumeContext<OrderCancelledEvent>' },
    ],
  },
};

export const KINDS = {
  action: { icon: '👆', label: L('Kullanıcı', 'User'), text: L('Sen bir butona bastın; tarayıcı Gateway\'e HTTP isteği gönderiyor.', 'You pressed a button; the browser is sending an HTTP request to the Gateway.') },
  http: { icon: '⇢', label: L('HTTP istek', 'HTTP request'), text: L('Senkron çağrı. Gateway isteği servise iletti; istemci cevabı bekliyor.', 'A synchronous call. The Gateway forwarded the request to the service; the client is waiting for the response.') },
  'http-response': { icon: '⇠', label: L('HTTP cevap', 'HTTP response'), text: L('Servis cevap döndü. 202 Accepted ise iş arka planda (kuyrukta) devam ediyor demektir.', 'The service responded. 202 Accepted means the work continues in the background (in a queue).') },
  publish: { icon: '📤', label: 'Publish', text: L('Mesaj RabbitMQ\'ya bırakıldı. Yayınlayan servis kimin dinlediğini bilmez ve beklemez.', 'The message was handed to RabbitMQ. The publishing service does not know who listens and does not wait.') },
  consume: { icon: '📥', label: 'Consume', text: L('Servis kendi kuyruğundan mesajı aldı. Mesaj başarıyla işlenene kadar kuyruktan silinmez.', 'The service took the message from its own queue. The message is not removed from the queue until it is processed successfully.') },
  db: { icon: '🗄', label: L('Veri', 'Data'), text: L('Servis yalnızca KENDİ veritabanına yazdı. Başka servisin tablosuna erişim yoktur.', 'The service wrote only to its OWN database. It has no access to another service\'s tables.') },
  saga: { icon: '◆', label: 'Saga', text: L('Saga durum değiştirdi. Durum OrderSagaStates tablosunda saklanır; sonraki mesaj geldiğinde saga kaldığı yerden devam eder.', 'The saga changed state. The state is stored in the OrderSagaStates table; when the next message arrives the saga continues where it left off.') },
  step: { icon: '•', label: L('Adım', 'Step'), text: L('Servis içinde bir iş adımı.', 'A work step inside a service.') },
  error: { icon: '✕', label: L('Hata', 'Error'), text: L('Bir şey ters gitti. Saga açısından bu bir "iş hatası" olabilir (ödeme reddi) ya da teknik hata (retry ile tekrar denenir).', 'Something went wrong. For the saga this may be a business failure (payment declined) or a technical error (retried by the retry policy).') },
};

export function httpRef(event) {
  const p = (event.payload && safeJson(event.payload)) || {};
  const method = p.method || '';
  const path = p.path || '';
  const label = 'Endpoint';
  if (path.startsWith('/api/products')) {
    const find = method === 'GET' ? (/\/api\/products\/./.test(path) ? 'MapGet("/{id:guid}"' : 'group.MapGet("/"')
      : method === 'POST' ? 'MapPost("/"' : method === 'PUT' ? 'MapPut(' : 'MapDelete(';
    return [{ label, path: P.productEndpoints, find }];
  }
  if (path.startsWith('/api/basket')) {
    const find = path.endsWith('/checkout') ? 'MapPost("/checkout"'
      : method === 'POST' ? 'group.MapPost("/", async' : method === 'DELETE' ? 'MapDelete(' : 'MapGet(';
    return [{ label, path: P.basketEndpoints, find }];
  }
  if (path.startsWith('/api/orders')) return [{ label, path: P.orderEndpoints, find: 'MapGet("/"' }];
  if (path.startsWith('/api/payments')) return [{ label, path: P.paymentEndpoints, find: method === 'PUT' ? 'MapPut(' : 'MapGet(' }];
  return [];
}

const OBSERVER = L('İzi üreten observer', 'Observer that emitted the trace');
export const INFRA_REFS = {
  publish: { label: OBSERVER, path: P.observers, find: 'PostPublish' },
  consume: { label: OBSERVER, path: P.observers, find: 'PreConsume' },
  http: { label: L('İzi üreten middleware', 'Middleware that emitted the trace'), path: P.httpTrace, find: 'InvokeAsync' },
};

export const SAGA_STATES = {
  Initial: L('Saga henüz başlamadı.', 'The saga has not started yet.'),
  AwaitingStock: L('Catalog\'dan stok cevabı bekleniyor.', 'Waiting for Catalog\'s stock reply.'),
  AwaitingPayment: L('Stok ayrıldı; Payment\'tan ödeme sonucu bekleniyor.', 'Stock reserved; waiting for the payment result from Payment.'),
  Compensating: L('Ödeme başarısız oldu; ayrılan stok geri bırakılıyor (telafi).', 'Payment failed; the reserved stock is being released (compensation).'),
  Completed: L('Stok ayrıldı ve ödeme alındı. Sipariş tamam.', 'Stock reserved and payment received. The order is complete.'),
  Cancelled: L('Sipariş iptal edildi; gerekli telafiler yapıldı.', 'The order was cancelled; any needed compensation was done.'),
};

export function safeJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}
