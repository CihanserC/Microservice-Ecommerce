// Simülatörün "öğretmen" katmanı: her servis, mesaj ve iz türü için açıklama ve kod adresleri.
// Kod yolları src/ altına göredir; "find" verilen satır kod görüntüleyicide işaretlenir.

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
    name: 'Tarayıcı',
    sub: 'bu sayfa',
    summary: 'Butonlara bastığında bu sayfa Gateway\'e HTTP isteği atar. Servislerin adreslerini bilmez, tek kapı Gateway\'dir.',
    files: [],
  },
  gateway: {
    name: 'Gateway.API',
    sub: 'YARP ters vekil',
    summary: 'Tek giriş noktası. İş kuralı yoktur; /catalog, /basket, /orders, /payments yollarını ilgili servise iletir ve yolu yeniden yazar (/catalog → /api/products).',
    files: [
      { label: 'Rota tablosu', path: P.gatewayConfig, find: '"catalog-route"' },
      { label: 'Program.cs', path: P.gateway, find: 'AddReverseProxy' },
    ],
  },
  catalog: {
    name: 'Catalog.API',
    sub: 'Clean Arch + CQRS',
    summary: 'Ürün ve stok sahibi. HTTP tarafı MediatR komut/sorgularıyla CRUD yapar. Saga\'nın stok katılımcısıdır: ReserveStock ile stok düşer, ReleaseStock (telafi) ile geri ekler.',
    files: [
      { label: 'Stok ayırma', path: P.reserveStock, find: 'IConsumer<ReserveStockCommand>' },
      { label: 'Stok bırakma (telafi)', path: P.releaseStock, find: 'IConsumer<ReleaseStockCommand>' },
      { label: 'Outbox kurulumu', path: P.catalogDi, find: 'AddEntityFrameworkOutbox' },
      { label: 'HTTP uçları', path: P.productEndpoints, find: 'MapGroup' },
      { label: 'DbContext', path: P.catalogDb, find: 'AddInboxStateEntity' },
    ],
  },
  basket: {
    name: 'Basket.API',
    sub: 'Minimal API + Redis',
    summary: 'Geçici sepet. Checkout\'ta Order\'ı çağırmaz: BasketCheckoutEvent yayınlar, sepeti siler, 202 Accepted döner. Asenkron iletişimin başladığı yer.',
    files: [
      { label: 'Checkout', path: P.basketEndpoints, find: 'MapPost("/checkout"' },
      { label: 'Redis erişimi', path: P.basketService, find: 'SetStringAsync' },
    ],
  },
  order: {
    name: 'Order.API',
    sub: 'DDD + Saga orkestratörü',
    summary: 'İki rolü var: (1) Sipariş kaydı — CustomerOrder aggregate\'i. (2) Saga orkestratörü — OrderStateMachine her siparişin sürecini yönetir, hangi servise hangi komutun gideceğine karar verir.',
    files: [
      { label: 'Saga (state machine)', path: P.stateMachine, find: 'Initially(' },
      { label: 'Checkout → sipariş', path: P.checkoutConsumer, find: 'new OrderCreatedEvent' },
      { label: 'Saga sonucu → sipariş', path: P.outcomeConsumer, find: 'order.Cancel' },
      { label: 'Aggregate kuralları', path: P.orderAggregate, find: 'public void Cancel' },
      { label: 'Saga + outbox kurulumu', path: P.orderDi, find: 'AddSagaStateMachine' },
    ],
  },
  payment: {
    name: 'Payment.API',
    sub: 'Stateless katılımcı',
    summary: 'Ödeme sağlayıcısını taklit eder. Saga\'dan habersizdir: ProcessPaymentCommand alır, PaymentCompleted ya da PaymentFailed yayınlar. Davranışı soldaki "Ödeme servisi" panelinden değiştirilir.',
    files: [
      { label: 'Ödeme consumer', path: P.paymentConsumer, find: 'IConsumer<ProcessPaymentCommand>' },
      { label: 'Karar kuralı', path: P.paymentSimulator, find: 'public string? Decide' },
    ],
  },
  rabbit: {
    name: 'RabbitMQ',
    sub: 'mesaj aracısı',
    summary: 'Servisler birbirini tanımaz; mesajı exchange\'e bırakır, ilgilenen servisin kuyruğu kopyasını alır. Hedef servis kapalıysa mesaj kuyrukta bekler. MassTransit kuyrukları consumer adından üretir.',
    files: [
      { label: 'MassTransit kurulumu', path: P.massTransit, find: 'UsingRabbitMq' },
      { label: 'Stok mesajları', path: P.stockMessages, find: 'ReserveStockCommand' },
      { label: 'Ödeme mesajları', path: P.paymentMessages, find: 'ProcessPaymentCommand' },
    ],
  },
  catalogdb: {
    name: 'catalogdb', sub: 'PostgreSQL',
    summary: 'Products, StockReservations ve MassTransit outbox/inbox tabloları. Stok düşüşü ile yayınlanan olay aynı transaction\'da yazılır.',
    files: [{ label: 'CatalogDbContext', path: P.catalogDb, find: 'StockReservation' }],
  },
  redis: {
    name: 'Redis', sub: 'cache',
    summary: 'Sepet JSON olarak basket:{kullanıcı} anahtarında durur. Şema yok, migration yok.',
    files: [{ label: 'BasketService', path: P.basketService, find: 'GetCacheKey' }],
  },
  orderdb: {
    name: 'orderdb', sub: 'PostgreSQL',
    summary: 'Orders, OrderItems, OrderSagaStates (saga hafızası) ve outbox/inbox tabloları.',
    files: [
      { label: 'OrderDbContext', path: P.orderDb, find: 'OrderStateMap' },
      { label: 'Saga satırı', path: P.sagaState, find: 'CurrentState' },
    ],
  },
};

export const MESSAGES = {
  BasketCheckoutEvent: {
    role: 'Olay',
    text: 'Sepet checkout edildi. Basket, Order servisini HTTP ile çağırmak yerine bu olayı bırakır; böylece Order o an kapalı olsa bile checkout başarılı olur.',
    refs: [
      { label: 'Yayınlayan', path: P.basketEndpoints, find: 'publishEndpoint.Publish(checkoutEvent' },
      { label: 'Tüketen', path: P.checkoutConsumer, find: 'IConsumer<BasketCheckoutEvent>' },
      { label: 'Sözleşme', path: P.checkoutEvent, find: 'record BasketCheckoutEvent' },
    ],
  },
  OrderCreatedEvent: {
    role: 'Olay',
    text: 'Sipariş Pending olarak kaydedildi. Saga bu olayla başlar (Initially → When(OrderCreated)). Olay outbox ile siparişle aynı transaction\'da yazıldığı için kaybolamaz.',
    refs: [
      { label: 'Yayınlayan', path: P.checkoutConsumer, find: 'new OrderCreatedEvent' },
      { label: 'Tüketen (saga)', path: P.stateMachine, find: 'When(OrderCreated)' },
      { label: 'Sözleşme', path: P.orderCreatedEvent, find: 'record OrderCreatedEvent' },
    ],
  },
  ReserveStockCommand: {
    role: 'Komut',
    text: 'Saga Catalog\'a "bu siparişin kalemlerini ayır" der. Komut tek bir alıcıya yöneliktir ve bir cevap (StockReserved / StockReservationFailed) beklenir.',
    refs: [
      { label: 'Gönderen (saga)', path: P.stateMachine, find: 'new ReserveStockCommand' },
      { label: 'İşleyen', path: P.reserveStock, find: 'IConsumer<ReserveStockCommand>' },
    ],
  },
  StockReservedEvent: {
    role: 'Olay',
    text: 'Stok düşüldü ve rezervasyon kaydedildi. Saga bir sonraki adıma, ödemeye geçer.',
    refs: [
      { label: 'Yayınlayan', path: P.reserveStock, find: 'new StockReservedEvent' },
      { label: 'Tüketen (saga)', path: P.stateMachine, find: 'When(StockReserved)' },
    ],
  },
  StockReservationFailedEvent: {
    role: 'Olay',
    text: 'Stok yetersiz. Catalog "ya hepsi ya hiçbiri" kuralıyla hiçbir kalemi ayırmadı; bu yüzden saga\'nın geri alacağı bir şey yok, sipariş doğrudan iptal olur.',
    refs: [
      { label: 'Yayınlayan', path: P.reserveStock, find: 'new StockReservationFailedEvent' },
      { label: 'Tüketen (saga)', path: P.stateMachine, find: 'When(StockReservationFailed)' },
    ],
  },
  ProcessPaymentCommand: {
    role: 'Komut',
    text: 'Saga Payment\'a tahsilat yaptırır. Payment saga\'yı tanımaz; yalnızca komutu işler ve sonucu olay olarak yayınlar.',
    refs: [
      { label: 'Gönderen (saga)', path: P.stateMachine, find: 'new ProcessPaymentCommand' },
      { label: 'İşleyen', path: P.paymentConsumer, find: 'IConsumer<ProcessPaymentCommand>' },
    ],
  },
  PaymentCompletedEvent: {
    role: 'Olay',
    text: 'Ödeme alındı. Saga mutlu sonla biter (Completed) ve OrderCompletedEvent yayınlar.',
    refs: [
      { label: 'Yayınlayan', path: P.paymentConsumer, find: 'new PaymentCompletedEvent' },
      { label: 'Tüketen (saga)', path: P.stateMachine, find: 'When(PaymentCompleted)' },
    ],
  },
  PaymentFailedEvent: {
    role: 'Olay',
    text: 'Ödeme reddedildi. Ama stok zaten düşülmüştü! Dağıtık sistemde veritabanı rollback\'i servisler arasında çalışmaz; saga daha önce başarılı olan adımı TELAFİ eder (ReleaseStockCommand).',
    refs: [
      { label: 'Yayınlayan', path: P.paymentConsumer, find: 'new PaymentFailedEvent' },
      { label: 'Tüketen (saga)', path: P.stateMachine, find: 'When(PaymentFailed)' },
    ],
  },
  ReleaseStockCommand: {
    role: 'Telafi komutu',
    text: 'Compensation: önceki işlemi silmez, onu tersine çeviren YENİ bir işlem yapar (stok geri eklenir). Mesaj yalnızca OrderId taşır; Catalog neyi ayırdığını StockReservations tablosundan bilir.',
    refs: [
      { label: 'Gönderen (saga)', path: P.stateMachine, find: 'new ReleaseStockCommand' },
      { label: 'İşleyen', path: P.releaseStock, find: 'IConsumer<ReleaseStockCommand>' },
    ],
  },
  StockReleasedEvent: {
    role: 'Olay',
    text: 'Telafi tamamlandı, stok eski haline döndü. Saga siparişi iptal eder.',
    refs: [
      { label: 'Yayınlayan', path: P.releaseStock, find: 'new StockReleasedEvent' },
      { label: 'Tüketen (saga)', path: P.stateMachine, find: 'When(StockReleased)' },
    ],
  },
  OrderCompletedEvent: {
    role: 'Olay',
    text: 'Saga\'nın sonucu. Order servisindeki OrderOutcomeConsumer siparişi Completed yapar. Başka servisler de (ör. e-posta, kargo) bu olayı dinleyebilir.',
    refs: [
      { label: 'Yayınlayan (saga)', path: P.stateMachine, find: 'new OrderCompletedEvent' },
      { label: 'Tüketen', path: P.outcomeConsumer, find: 'ConsumeContext<OrderCompletedEvent>' },
    ],
  },
  OrderCancelledEvent: {
    role: 'Olay',
    text: 'Saga\'nın başarısız sonu. Order servisi siparişi Cancelled yapar ve sebebi saklar.',
    refs: [
      { label: 'Yayınlayan (saga)', path: P.stateMachine, find: 'new OrderCancelledEvent' },
      { label: 'Tüketen', path: P.outcomeConsumer, find: 'ConsumeContext<OrderCancelledEvent>' },
    ],
  },
};

export const KINDS = {
  action: { icon: '👆', label: 'Kullanıcı', text: 'Sen bir butona bastın; tarayıcı Gateway\'e HTTP isteği gönderiyor.' },
  http: { icon: '⇢', label: 'HTTP istek', text: 'Senkron çağrı. Gateway isteği servise iletti; istemci cevabı bekliyor.' },
  'http-response': { icon: '⇠', label: 'HTTP cevap', text: 'Servis cevap döndü. 202 Accepted ise iş arka planda (kuyrukta) devam ediyor demektir.' },
  publish: { icon: '📤', label: 'Publish', text: 'Mesaj RabbitMQ\'ya bırakıldı. Yayınlayan servis kimin dinlediğini bilmez ve beklemez.' },
  consume: { icon: '📥', label: 'Consume', text: 'Servis kendi kuyruğundan mesajı aldı. Mesaj başarıyla işlenene kadar kuyruktan silinmez.' },
  db: { icon: '🗄', label: 'Veri', text: 'Servis yalnızca KENDİ veritabanına yazdı. Başka servisin tablosuna erişim yoktur.' },
  saga: { icon: '◆', label: 'Saga', text: 'Saga durum değiştirdi. Durum OrderSagaStates tablosunda saklanır; sonraki mesaj geldiğinde saga kaldığı yerden devam eder.' },
  step: { icon: '•', label: 'Adım', text: 'Servis içinde bir iş adımı.' },
  error: { icon: '✕', label: 'Hata', text: 'Bir şey ters gitti. Saga açısından bu bir "iş hatası" olabilir (ödeme reddi) ya da teknik hata (retry ile tekrar denenir).' },
};

export function httpRef(event) {
  const p = (event.payload && safeJson(event.payload)) || {};
  const method = p.method || '';
  const path = p.path || '';
  if (path.startsWith('/api/products')) {
    const find = method === 'GET' ? (/\/api\/products\/./.test(path) ? 'MapGet("/{id:guid}"' : 'group.MapGet("/"')
      : method === 'POST' ? 'MapPost("/"' : method === 'PUT' ? 'MapPut(' : 'MapDelete(';
    return [{ label: 'Endpoint', path: P.productEndpoints, find }];
  }
  if (path.startsWith('/api/basket')) {
    const find = path.endsWith('/checkout') ? 'MapPost("/checkout"'
      : method === 'POST' ? 'group.MapPost("/", async' : method === 'DELETE' ? 'MapDelete(' : 'MapGet(';
    return [{ label: 'Endpoint', path: P.basketEndpoints, find }];
  }
  if (path.startsWith('/api/orders')) return [{ label: 'Endpoint', path: P.orderEndpoints, find: 'MapGet("/"' }];
  if (path.startsWith('/api/payments')) return [{ label: 'Endpoint', path: P.paymentEndpoints, find: method === 'PUT' ? 'MapPut(' : 'MapGet(' }];
  return [];
}

export const INFRA_REFS = {
  publish: { label: 'İzi üreten observer', path: P.observers, find: 'PostPublish' },
  consume: { label: 'İzi üreten observer', path: P.observers, find: 'PreConsume' },
  http: { label: 'İzi üreten middleware', path: P.httpTrace, find: 'InvokeAsync' },
};

export const SAGA_STATES = {
  Initial: 'Saga henüz başlamadı.',
  AwaitingStock: 'Catalog\'dan stok cevabı bekleniyor.',
  AwaitingPayment: 'Stok ayrıldı; Payment\'tan ödeme sonucu bekleniyor.',
  Compensating: 'Ödeme başarısız oldu; ayrılan stok geri bırakılıyor (telafi).',
  Completed: 'Stok ayrıldı ve ödeme alındı. Sipariş tamam.',
  Cancelled: 'Sipariş iptal edildi; gerekli telafiler yapıldı.',
};

export const CONCEPTS = [
  {
    title: 'Senkron vs asenkron',
    text: 'Ürün listeleme, sepete ekleme HTTP ile senkrondur: istemci cevabı bekler. Checkout ise asenkrondur: Basket olayı bırakır, 202 döner; sipariş arka planda oluşur. Senkron çağrılar servisleri birbirinin ayakta olmasına bağlar, mesajlaşma bu bağı koparır.',
  },
  {
    title: 'Saga (orkestrasyon)',
    text: 'Birden çok servise yayılan bir iş (stok + ödeme) tek bir veritabanı transaction\'ına sığmaz. Saga, işi adımlara böler ve her adımın sonucuna göre bir sonrakine karar verir. Burada karar veren merkezi bir orkestratör var: OrderStateMachine. Alternatifi koreografidir: merkez yoktur, her servis bir önceki olayı dinleyip kendi adımını yapar.',
  },
  {
    title: 'Telafi (compensation)',
    text: 'Ödeme reddedildiğinde stok zaten başka bir serviste, başka bir veritabanında düşülmüştür; onu "rollback" edemezsin. Saga, başarılı olmuş adımı tersine çeviren yeni bir komut gönderir (ReleaseStockCommand). "Ödeme reddi" senaryosunu çalıştırıp 4K Monitör stoğunun önce düşüp sonra geri geldiğini izle.',
  },
  {
    title: 'Transactional outbox',
    text: 'Bir consumer hem veritabanına yazıp hem mesaj yayınlıyorsa, ikisinden biri başarısız olabilir: kayıt var ama olay yok (ya da tersi). Outbox, giden mesajı aynı veritabanı transaction\'ında bir tabloya (OutboxMessage) yazar; commit sonrası MassTransit onu RabbitMQ\'ya iletir. Catalog ve Order bunu kullanır.',
  },
  {
    title: 'Idempotency (tekrar güvenliği)',
    text: 'RabbitMQ "en az bir kez" teslim eder: aynı mesaj iki kez gelebilir. Her consumer bunu tolere eder: InboxState tablosu aynı mesajı ikinci kez işlemez, ReserveStock aynı sipariş için stoğu iki kez düşmez, Payment aynı siparişi iki kez tahsil etmez.',
  },
  {
    title: 'Korelasyon',
    text: 'Saga mesajlarının hepsi OrderId taşır; saga hangi satırı güncelleyeceğini buradan bilir (CorrelateById). Simülatör de izleri OrderId ve OpenTelemetry trace kimliğiyle gruplar.',
  },
  {
    title: 'Komut vs olay',
    text: 'Komut (ReserveStockCommand) bir şeyin yapılmasını ister ve tek bir sahibi vardır. Olay (StockReservedEvent) olmuş bir şeyi duyurur; kimin dinlediğini yayınlayan bilmez. İsimlendirme bu farkı taşır: emir kipi vs geçmiş zaman.',
  },
];

export function safeJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { return null; }
}
