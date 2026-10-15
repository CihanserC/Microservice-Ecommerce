// "Kavramlar" penceresinin içeriği: mikroservis kavramları, Türkçe ve İngilizce.
// Gövde biçimi (concept-view.js render eder):
//   ## Başlık      -> alt başlık
//   - madde        -> liste
//   > not          -> "Bu projede" kutusu
//   **kalın**, ‹kod›

const L = (tr, en) => ({ tr, en });

export const CATEGORIES = {
  arch: L('Mimari ve tasarım', 'Architecture & design'),
  comm: L('İletişim', 'Communication'),
  data: L('Veri ve tutarlılık', 'Data & consistency'),
  resil: L('Dayanıklılık', 'Resilience'),
  obs: L('Gözlemlenebilirlik', 'Observability'),
  infra: L('Altyapı ve dağıtım', 'Infrastructure & deployment'),
};

export const CONCEPTS = [
  // ------------------------------------------------------------------ mimari
  {
    id: 'api-gateway',
    cat: 'arch',
    title: L('API Gateway', 'API Gateway'),
    aka: ['gateway', 'yarp', 'reverse proxy', 'ters vekil', 'edge'],
    related: ['bff', 'service-discovery', 'circuit-breaker', 'sidecar'],
    tr: `
API Gateway, istemcilerle arka plandaki servisler arasında duran **tek giriş noktasıdır**. İstemci onlarca servisin adresini bilmez; yalnızca gateway'i bilir. Gateway gelen isteği doğru servise yönlendirir, gerekirse yolu yeniden yazar ve cevabı istemciye geri taşır.

## Hangi problemi çözer?
Gateway olmadan her istemci (web, mobil, üçüncü parti) her servisin adresini, portunu ve sürümünü bilmek zorunda kalır. Bir servis bölündüğünde ya da taşındığında bütün istemciler güncellenmelidir. Ayrıca kimlik doğrulama, CORS, rate limiting gibi ortak işler her serviste tekrar yazılır.

## Tipik sorumluluklar
- **Yönlendirme ve yol yeniden yazma:** ‹/catalog› → ‹catalog-api:8080/api/products›.
- **Kesişen konular:** kimlik doğrulama (JWT doğrulama), yetkilendirme, rate limiting, CORS, TLS sonlandırma.
- **Toplama (aggregation):** birden çok servisin cevabını tek cevapta birleştirmek.
- **Dayanıklılık:** timeout, retry ve circuit breaker politikalarını tek yerde uygulamak.
- **Gözlemlenebilirlik:** her isteğe bir correlation ID eklemek, erişim loglarını toplamak.

## Dikkat edilmesi gerekenler
- Gateway **iş kuralı barındırmamalıdır**. İçine "sipariş toplamı 1000'i geçerse indirim yap" gibi mantık girerse yeni bir monolit doğar.
- Tek giriş noktası aynı zamanda **tek arıza noktasıdır**. Üretimde birden fazla örnek ve yük dengeleyici arkasında çalışır.
- Her istek bir ağ sıçraması daha ekler; gecikme bütçesine dahil edilmelidir.
- Bütün istemciler için tek bir gateway çok şişerse, istemci türüne göre ayrı gateway'ler (BFF) düşünülür.

> ‹Gateway.API› YARP ile yazılmış ince bir ters vekildir. ‹appsettings.json› içindeki rota tablosu ‹/catalog›, ‹/basket›, ‹/orders›, ‹/payments› ve ‹/sim› yollarını ilgili servise iletir. Docker'da hedefler servis adlarıdır (‹http://catalog.api:8080›), yerelde ise ‹localhost› portları. Simülatör arayüzü de gateway üzerinden açılır, böylece tarayıcı tek bir adres bilir.
`,
    en: `
An API Gateway is the **single entry point** that sits between clients and the backend services. The client does not know the addresses of dozens of services; it only knows the gateway. The gateway routes each request to the right service, rewrites the path if needed and carries the response back.

## What problem does it solve?
Without a gateway every client (web, mobile, third parties) has to know every service's address, port and version. When a service is split or moved, every client must be updated. Cross-cutting work such as authentication, CORS and rate limiting also gets rewritten in every service.

## Typical responsibilities
- **Routing and path rewriting:** ‹/catalog› → ‹catalog-api:8080/api/products›.
- **Cross-cutting concerns:** authentication (JWT validation), authorization, rate limiting, CORS, TLS termination.
- **Aggregation:** combining responses from several services into one.
- **Resilience:** applying timeout, retry and circuit-breaker policies in one place.
- **Observability:** stamping each request with a correlation ID and collecting access logs.

## Things to watch out for
- A gateway **must not hold business rules**. Once logic like "give a discount if the order total exceeds 1000" moves in, a new monolith is born.
- A single entry point is also a **single point of failure**. In production it runs as several instances behind a load balancer.
- Every request gets one more network hop; budget for the added latency.
- If one gateway for every client grows too large, consider separate gateways per client type (BFF).

> ‹Gateway.API› is a thin reverse proxy built with YARP. The route table in ‹appsettings.json› forwards ‹/catalog›, ‹/basket›, ‹/orders›, ‹/payments› and ‹/sim› to the matching service. In Docker the targets are service names (‹http://catalog.api:8080›); locally they are ‹localhost› ports. The simulator UI is also served through the gateway, so the browser knows a single address.
`,
  },
  {
    id: 'bff',
    cat: 'arch',
    title: L('Backend for Frontend (BFF)', 'Backend for Frontend (BFF)'),
    aka: ['bff', 'backend for frontend', 'mobil gateway', 'mobile gateway'],
    related: ['api-gateway', 'bounded-context'],
    tr: `
Backend for Frontend, **her istemci türü için ayrı bir arka uç katmanı** kurma desenidir: web için bir BFF, mobil uygulama için başka bir BFF, belki partner API'si için üçüncüsü. Her BFF, kendi istemcisinin ekranlarına tam uyan veriyi üretir.

## Neden tek gateway yetmez?
Mobil ekran küçük ve ağ yavaştır; az alan, az istek ister. Web paneli ise zengin tablolar ve filtreler ister. Tek bir genel amaçlı API ikisini de memnun etmeye çalıştığında ya mobil gereksiz veri indirir ya da web tek sayfa için on istek atar. Genel API'ye her istemcinin özel isteği eklendikçe API bir "her şeyin ortak paydası" haline gelir.

## Nasıl çalışır?
- Mobil BFF, "sipariş özeti" ekranı için Order, Catalog ve Payment servislerini **kendi içinde** çağırır, sonucu tek ve küçük bir JSON'da birleştirir.
- BFF genellikle o istemciyi yazan ekibe aittir. Ekip, arka uç ekibini beklemeden ekranına uygun ucu ekleyebilir.
- Kimlik doğrulama akışı istemciye göre değişebilir: web BFF'si cookie tabanlı oturum, mobil BFF'si token tabanlı akış kullanabilir.

## Dikkat edilmesi gerekenler
- BFF'ler **iş kuralını kopyalamamalıdır**. İndirim hesabı Order servisinde kalır; BFF yalnızca veriyi şekillendirir ve birleştirir.
- Her yeni istemci yeni bir dağıtım birimi demektir. Az sayıda istemci varken tek gateway yeterlidir.
- BFF'ler arasında tekrar eden kod ortak bir kütüphaneye değil, ilgili servise taşınmalıdır.

> Bu projede tek istemci (simülatör arayüzü) ve tek gateway vardır, bu yüzden BFF yoktur. Bir mobil uygulama eklenirse ‹Gateway.API›'nin yanına, mobil ekranlara özel uçlar sunan bir ‹Mobile.Bff› projesi eklemek doğal bir sonraki adım olur.
`,
    en: `
Backend for Frontend is the pattern of building **a separate backend layer for each kind of client**: one BFF for the web app, another for the mobile app, perhaps a third for a partner API. Each BFF produces exactly the data its client's screens need.

## Why isn't one gateway enough?
A mobile screen is small and its network is slow; it wants few fields and few requests. A web dashboard wants rich tables and filters. When one general-purpose API tries to please both, either the mobile app downloads data it doesn't need or the web page fires ten requests for a single screen. As every client's special needs get added to the general API, it becomes a lowest common denominator.

## How it works
- The mobile BFF calls Order, Catalog and Payment **internally** for an "order summary" screen and merges the result into one small JSON.
- A BFF is usually owned by the team that builds that client, so they can add the endpoint their screen needs without waiting for a backend team.
- The authentication flow can differ per client: the web BFF may use cookie-based sessions while the mobile BFF uses tokens.

## Things to watch out for
- BFFs **must not copy business rules**. Discount calculation stays in the Order service; the BFF only shapes and combines data.
- Every new client means a new deployable unit. With few clients, a single gateway is enough.
- Code repeated across BFFs belongs in the owning service, not in a shared library.

> This project has one client (the simulator UI) and one gateway, so there is no BFF. If a mobile app were added, a natural next step would be a ‹Mobile.Bff› project next to ‹Gateway.API› that serves endpoints tailored to the mobile screens.
`,
  },
  {
    id: 'bounded-context',
    cat: 'arch',
    title: L('Bounded Context (Sınırlı Bağlam)', 'Bounded Context'),
    aka: ['bounded context', 'sınırlı bağlam', 'ubiquitous language', 'ortak dil', 'context map'],
    related: ['ddd', 'database-per-service', 'shared-database'],
    tr: `
Bounded Context, Domain-Driven Design'ın **bir modelin geçerli olduğu sınır** için kullandığı terimdir. Aynı kelime farklı bağlamlarda farklı anlam taşır; her bağlam kendi modelini ve kendi dilini (ubiquitous language) korur.

## Örnek: "Ürün" kelimesi
- **Katalog** bağlamında ürün; ad, açıklama, görsel ve fiyattır. Sık değişir.
- **Sipariş** bağlamında ürün; sipariş anındaki ad ve birim fiyattır. Asla değişmez, çünkü o anki ticari anlaşmadır.
- **Depo** bağlamında ürün; raf konumu, ağırlık ve stok adedidir.

Tek bir dev ‹Product› sınıfıyla üçünü birden modellemeye çalışmak, her ekibin diğerinin alanlarına takıldığı ve kimsenin değiştirmeye cesaret edemediği bir model üretir.

## Mikroservislerle ilişkisi
Bounded context, **servis sınırı çizmek için en iyi başlangıç noktasıdır**. Bir servis genellikle bir bağlama karşılık gelir (bazen bir bağlam birkaç servise bölünür, ama tersi neredeyse hiç iyi değildir). Bağlamlar arası iletişim açık sözleşmelerle olur: API'ler ve olaylar.

## Bağlam haritası (context map)
Bağlamların birbirine nasıl bağlandığını gösterir. Bazı ilişki türleri:
- **Customer/Supplier:** bir bağlam diğerinin ihtiyacına göre API sunar.
- **Anti-Corruption Layer:** eski ya da dış bir modelin bizim modelimize sızmaması için çeviri katmanı.
- **Published Language:** herkesin anladığı ortak bir mesaj şeması.

> Catalog, Basket, Order ve Payment ayrı bağlamlardır. Sipariş, ürünün adını ve fiyatını ‹BasketCheckoutEvent› içinde **kopya olarak** taşır; Order, Catalog'un ‹Product› sınıfını hiç görmez. ‹Shared.Contracts› yalnızca mesaj kayıtlarını (published language) içerir, entity içermez.
`,
    en: `
Bounded Context is the Domain-Driven Design term for **the boundary within which a model is valid**. The same word means different things in different contexts; each context keeps its own model and its own language (the ubiquitous language).

## Example: the word "product"
- In the **Catalog** context a product is a name, description, image and price. It changes often.
- In the **Order** context a product is the name and unit price at the time of ordering. It never changes, because it records that moment's commercial agreement.
- In a **Warehouse** context a product is a shelf location, weight and quantity on hand.

Trying to model all three with one giant ‹Product› class produces a model where every team trips over the others' fields and nobody dares to change anything.

## Relationship to microservices
A bounded context is **the best starting point for drawing service boundaries**. A service usually maps to one context (sometimes one context is split into several services, but the reverse is rarely good). Contexts talk to each other through explicit contracts: APIs and events.

## Context map
A context map shows how contexts connect. Some relationship types:
- **Customer/Supplier:** one context offers an API shaped by the other's needs.
- **Anti-Corruption Layer:** a translation layer that keeps a legacy or external model from leaking into ours.
- **Published Language:** a shared message schema everyone understands.

> Catalog, Basket, Order and Payment are separate contexts. The order carries the product's name and price **as a copy** inside ‹BasketCheckoutEvent›; Order never sees Catalog's ‹Product› class. ‹Shared.Contracts› contains only message records (the published language), never entities.
`,
  },
  {
    id: 'ddd',
    cat: 'arch',
    title: L('Domain-Driven Design (DDD)', 'Domain-Driven Design (DDD)'),
    aka: ['ddd', 'aggregate', 'entity', 'value object', 'değer nesnesi', 'domain', 'alan'],
    related: ['bounded-context', 'cqrs', 'event-sourcing'],
    tr: `
Domain-Driven Design, yazılımı **iş alanının (domain) diline ve kurallarına göre** şekillendiren bir yaklaşımdır. Teknik katmanlardan önce şu soruyu sorar: bu işte gerçekten ne oluyor, kurallar neler, uzmanlar hangi kelimeleri kullanıyor?

## Stratejik DDD
Büyük resimle ilgilenir: alanı alt alanlara (core, supporting, generic) böler, **bounded context**'leri ve aralarındaki ilişkileri belirler. Mikroservis sınırlarını çizerken en çok burası işe yarar.

## Taktik DDD: yapı taşları
- **Entity:** kimliği olan ve zamanla değişen nesne (bir sipariş).
- **Value Object:** kimliği olmayan, değeriyle tanımlanan, değişmez nesne (‹Money›: 100 TL her yerde 100 TL'dir).
- **Aggregate:** birlikte tutarlı kalması gereken nesneler kümesi. Dışarıdan yalnızca **aggregate root** üzerinden değiştirilir. Bir transaction genellikle tek bir aggregate'i değiştirir.
- **Domain Event:** alanda olmuş önemli bir şey ("sipariş oluşturuldu").
- **Repository:** aggregate'i kaydetme ve yükleme soyutlaması.
- **Factory:** geçersiz nesne oluşturulmasını engelleyen kurucu metotlar.

## Ne zaman değer?
DDD kuralı bol, karmaşık alanlarda değerlidir. Basit bir CRUD ekranı için aggregate, value object ve repository katmanı kurmak gereksiz törendir. İyi bir proje her bağlamda aynı kalıbı değil, **o bağlamın karmaşıklığına uygun** kalıbı seçer.

> Order servisi taktik DDD kullanır: ‹CustomerOrder› aggregate root'tur, ‹OrderItem› ona aittir (EF Core ‹OwnsMany›), ‹Money› bir value object'tir. ‹CustomerOrder.Create› boş kalem listesini, ‹OrderItem.Create› sıfır veya negatif miktarı reddeder. ‹Complete()› ve ‹Cancel()› durum geçişlerini korur. Catalog ise bilerek sade bir CRUD modelidir, Basket'te domain katmanı hiç yoktur.
`,
    en: `
Domain-Driven Design shapes software **around the language and rules of the business domain**. Before any technical layer it asks: what really happens in this business, what are the rules, and which words do the experts use?

## Strategic DDD
Strategic DDD deals with the big picture: it splits the domain into subdomains (core, supporting, generic) and identifies **bounded contexts** and how they relate. This is the part that helps most when drawing microservice boundaries.

## Tactical DDD: building blocks
- **Entity:** an object with an identity that changes over time (an order).
- **Value Object:** an immutable object with no identity, defined by its value (‹Money›: 100 TRY is 100 TRY everywhere).
- **Aggregate:** a cluster of objects that must stay consistent together. It is changed from outside only through the **aggregate root**. A transaction usually changes a single aggregate.
- **Domain Event:** something significant that happened in the domain ("order created").
- **Repository:** the abstraction for saving and loading an aggregate.
- **Factory:** creation methods that prevent invalid objects from being built.

## When is it worth it?
DDD pays off in complex domains with many rules. Building aggregates, value objects and repositories for a simple CRUD screen is needless ceremony. A good project does not use the same pattern everywhere; it picks the pattern **that fits each context's complexity**.

> The Order service uses tactical DDD: ‹CustomerOrder› is the aggregate root, ‹OrderItem› belongs to it (EF Core ‹OwnsMany›) and ‹Money› is a value object. ‹CustomerOrder.Create› rejects an empty item list and ‹OrderItem.Create› rejects zero or negative quantities. ‹Complete()› and ‹Cancel()› guard the state transitions. Catalog is deliberately a plain CRUD model, and Basket has no domain layer at all.
`,
  },
  {
    id: 'cqrs',
    cat: 'arch',
    title: L('CQRS (Command Query Responsibility Segregation)', 'CQRS (Command Query Responsibility Segregation)'),
    aka: ['cqrs', 'command', 'query', 'komut', 'sorgu', 'mediatr', 'read model', 'okuma modeli'],
    related: ['event-sourcing', 'ddd', 'eventual-consistency', 'command-vs-event'],
    tr: `
CQRS, sistemdeki işlemleri iki gruba ayırır: **durumu değiştiren komutlar** (command) ve **durumu okuyan sorgular** (query). Her iki taraf farklı modellerle, hatta farklı veri depolarıyla çalışabilir.

## Fikrin kökü
Bertrand Meyer'in CQS ilkesi: bir metot ya bir şey yapar ya bir şey döndürür, ikisini birden değil. CQRS bunu mimari seviyeye taşır: yazma tarafı iş kurallarını korumaya, okuma tarafı ekranlara hızlı veri sunmaya odaklanır.

## Seviyeler
- **Hafif CQRS:** aynı veritabanı, ama komut ve sorgular ayrı sınıflarda/handler'larda. Kod düzeni ve test kolaylığı sağlar.
- **Ayrı okuma modeli:** yazma tarafı normalize tablolarda tutulur, okuma için ekrana göre şekillenmiş (denormalize) tablolar ya da bir arama indeksi (Elasticsearch) beslenir.
- **Event sourcing ile CQRS:** yazma tarafı olayları saklar, okuma modelleri bu olaylardan "projeksiyon" olarak üretilir.

## Faydaları ve bedeli
- Okuma ve yazma **bağımsız ölçeklenir**. E-ticarette okuma yazmadan kat kat fazladır.
- Yazma modeli ekran ihtiyaçlarıyla kirlenmez.
- Ayrı veri depoları kullanılırsa okuma modeli **nihai tutarlıdır**: yazma ile ekranda görünme arasında küçük bir gecikme olur. Arayüz bunu hesaba katmalıdır.
- Basit CRUD alanlarında fazladan karmaşıklıktır.

> Catalog servisi hafif CQRS uygular: ‹CreateProductCommand›, ‹UpdateProductCommand›, ‹GetProductsQuery› ve ‹GetProductByIdQuery› MediatR kayıtlarıdır, handler'ları ‹Catalog.Infrastructure› içindedir. Aynı PostgreSQL tablosu kullanılır, ayrı okuma modeli yoktur. Order servisinde ise bu katman yoktur; okuma iki basit sorgudan ibarettir.
`,
    en: `
CQRS splits a system's operations into two groups: **commands that change state** and **queries that read state**. The two sides can use different models and even different data stores.

## Where the idea comes from
It extends Bertrand Meyer's CQS principle: a method either does something or returns something, never both. CQRS lifts this to the architectural level: the write side focuses on protecting business rules, the read side on serving screens fast.

## Levels
- **Light CQRS:** the same database, but commands and queries live in separate classes/handlers. You get tidier code and easier tests.
- **Separate read model:** the write side stays in normalized tables, and screen-shaped (denormalized) tables or a search index (Elasticsearch) are fed for reading.
- **CQRS with event sourcing:** the write side stores events and read models are built from them as "projections".

## Benefits and cost
- Reads and writes **scale independently**. In e-commerce, reads outnumber writes many times over.
- The write model is not polluted by screen needs.
- With separate stores, the read model is **eventually consistent**: there is a short delay between a write and its appearance on screen, and the UI must account for it.
- In simple CRUD areas it is extra complexity.

> The Catalog service uses light CQRS: ‹CreateProductCommand›, ‹UpdateProductCommand›, ‹GetProductsQuery› and ‹GetProductByIdQuery› are MediatR records whose handlers live in ‹Catalog.Infrastructure›. They share one PostgreSQL table; there is no separate read model. The Order service has no such layer; its reads are just two simple queries.
`,
  },
  {
    id: 'strangler-fig',
    cat: 'arch',
    title: L('Strangler Fig (Boğan İncir)', 'Strangler Fig'),
    aka: ['strangler', 'strangler fig', 'boğan incir', 'migration', 'göç', 'monolit', 'monolith', 'legacy'],
    related: ['api-gateway', 'shared-database', 'bounded-context'],
    tr: `
Strangler Fig, eski bir monolitten mikroservislere **kademeli olarak** geçme desenidir. Adını, bir ağacın etrafını sararak büyüyen ve sonunda onun yerini alan incir türünden alır. Martin Fowler bu benzetmeyi 2004'te yaptı.

## Neden "büyük patlama" yeniden yazım değil?
Sistemi sıfırdan yeniden yazıp bir gecede geçiş yapmak cazip görünür ama çok risklidir: yeniden yazım aylar sürer, bu sürede eski sistem değişmeye devam eder, iş kuralları eksik taşınır ve geçiş günü her şey birden bozulabilir.

## Adımlar
1. **Önüne bir cephe koy:** bütün trafik bir proxy/gateway'den geçsin. İstemci arkada monolit mi servis mi olduğunu bilmesin.
2. **Bir dilim seç:** sınırı net, değeri yüksek ve riski düşük bir yetenek (ör. ürün kataloğu).
3. **Yeni servisi yaz** ve gateway'de o yolun trafiğini yeni servise yönlendir. Gerekirse önce trafiğin küçük bir yüzdesini gönder.
4. **Veriyi taşı:** başta iki taraf eşitlenebilir (çift yazma, change data capture), sonra sahiplik tamamen yeni servise geçer.
5. **Eski kodu sil.** Bu adım atlanırsa iki sistemin bakım yükü birden taşınır.
6. Tekrarla. Sonunda monolit küçülür ve kapatılır.

## Dikkat edilmesi gerekenler
- Ortak veritabanı en zor kısımdır; servis kendi verisinin sahibi olana kadar gerçek bağımsızlık yoktur.
- Monolit ile yeni servis arasında bir **anti-corruption layer** eski modelin yeni servise sızmasını engeller.
- Geçişin her adımı geri alınabilir olmalıdır (feature flag, yönlendirmeyi eski hale çevirme).

> Bu proje sıfırdan mikroservis olarak başladı, yani boğulacak bir monolit yoktur. Yine de ‹Gateway.API› deseni kurmak için gereken cepheyi zaten sağlar: YARP rota tablosunda tek bir satırı değiştirerek bir yolun trafiği eski bir sistemden yeni bir servise kaydırılabilir.
`,
    en: `
Strangler Fig is the pattern of moving from a legacy monolith to microservices **incrementally**. It is named after the fig species that grows around a host tree and eventually replaces it; Martin Fowler made the comparison in 2004.

## Why not a big-bang rewrite?
Rewriting the system from scratch and switching over in one night is tempting but very risky: the rewrite takes months, the old system keeps changing meanwhile, business rules get lost in translation and everything can break at once on switch-over day.

## Steps
1. **Put a facade in front:** route all traffic through a proxy/gateway so clients don't know whether a monolith or a service is behind it.
2. **Pick a slice:** a capability with a clear boundary, high value and low risk (e.g. the product catalog).
3. **Write the new service** and point that path's traffic at it in the gateway. Send only a small percentage of traffic at first if needed.
4. **Move the data:** keep both sides in sync for a while (dual writes, change data capture), then hand ownership entirely to the new service.
5. **Delete the old code.** Skip this and you carry the maintenance cost of two systems.
6. Repeat. Eventually the monolith shrinks and is switched off.

## Things to watch out for
- A shared database is the hardest part; there is no real independence until the service owns its data.
- An **anti-corruption layer** between the monolith and the new service keeps the old model from leaking in.
- Every step must be reversible (feature flags, switching routing back).

> This project started as microservices from day one, so there is no monolith to strangle. Still, ‹Gateway.API› already provides the facade the pattern needs: changing one line in the YARP route table would move a path's traffic from an old system to a new service.
`,
  },

  // ------------------------------------------------------------------ iletişim
  {
    id: 'sync-async',
    cat: 'comm',
    title: L('Senkron ve Asenkron İletişim', 'Synchronous vs Asynchronous Communication'),
    aka: ['sync', 'async', 'senkron', 'asenkron', 'http', 'rest', 'grpc', 'mesaj', 'message', 'queue', 'kuyruk', '202'],
    related: ['message-broker', 'command-vs-event', 'eventual-consistency', 'timeout', 'circuit-breaker'],
    tr: `
Servisler iki temel yolla konuşur. **Senkron** iletişimde çağıran taraf cevabı bekler (HTTP/REST, gRPC). **Asenkron** iletişimde çağıran mesajı bırakır ve işine devam eder; mesaj bir aracı (RabbitMQ, Kafka) üzerinden alıcıya ulaşır.

## Senkron: basit ama bağlayıcı
- Cevap hemen gelir; "ürünleri listele" gibi kullanıcının o anda görmek istediği işler için doğaldır.
- Hata akışı basittir: istek başarısız olursa çağıran hemen bilir.
- **Zamansal bağımlılık (temporal coupling):** çağrılan servis o an kapalıysa ya da yavaşsa çağıran da başarısız olur. A → B → C zincirinde erişilebilirlik çarpılır: üçü de %99 ayakta ise zincir yaklaşık %97 ayaktadır.
- Yavaş bir servis, onu çağıranların thread'lerini ve bağlantılarını tüketerek **zincirleme arızaya** yol açabilir.

## Asenkron: dayanıklı ama karmaşık
- Gönderen, alıcının ayakta olmasını beklemez. Alıcı kapalıysa mesaj kuyrukta bekler.
- Yük dalgalanmalarını kuyruk emer; alıcı kendi hızında tüketir.
- Bir olayı birden çok servis bağımsız olarak dinleyebilir.
- Bedeli: **nihai tutarlılık**, tekrar gelen mesajlar (idempotency gerekir), mesaj sırası, izlemesi daha zor akışlar ve "işlem şu an nerede?" sorusunun cevabını vermek için ek araçlar.

## Nasıl seçilir?
- Kullanıcı sonucu **o cevapta** görmek zorundaysa ve iş kısa ise: senkron.
- İş uzun sürüyorsa, birden çok servise yayılıyorsa ya da hedefin kapalı olması işi durdurmamalıysa: asenkron.
- Asenkron bir işi HTTP ile başlatmanın yaygın yolu: ‹202 Accepted› dönmek ve sonucu sonradan sorgulatmak (ya da bildirmek).

> Ürün listeleme, sepete ekleme ve sipariş listeleme senkron HTTP'dir. Checkout asenkrondur: Basket ‹BasketCheckoutEvent› yayınlar ve ‹202 Accepted› döner; sipariş arka planda oluşur. Saga'nın bütün adımları (stok, ödeme, telafi) RabbitMQ mesajlarıyla ilerler. Simülatörde mavi paketler HTTP, turuncu paketler mesajdır. "Kendin dene" alıştırması: ‹docker stop payment-api› ile Payment'ı durdurup checkout yap; saga bekler, servis geri gelince devam eder.
`,
    en: `
Services talk in two basic ways. In **synchronous** communication the caller waits for the answer (HTTP/REST, gRPC). In **asynchronous** communication the caller drops a message and carries on; the message reaches the receiver through a broker (RabbitMQ, Kafka).

## Synchronous: simple but binding
- The answer arrives immediately; it fits work the user wants to see right now, like "list products".
- Error handling is simple: if the request fails, the caller knows at once.
- **Temporal coupling:** if the called service is down or slow at that moment, the caller fails too. In an A → B → C chain availability multiplies: if each is up 99% of the time, the chain is up about 97%.
- A slow service can cause a **cascading failure** by exhausting its callers' threads and connections.

## Asynchronous: resilient but more complex
- The sender doesn't wait for the receiver to be up. If the receiver is down, the message waits in the queue.
- The queue absorbs load spikes; the receiver consumes at its own pace.
- Several services can listen to the same event independently.
- The cost: **eventual consistency**, duplicate messages (you need idempotency), message ordering, flows that are harder to trace, and extra tooling to answer "where is this operation right now?".

## How to choose
- If the user must see the result **in that response** and the work is short: synchronous.
- If the work takes long, spans several services, or must not stop because the target is down: asynchronous.
- A common way to start async work over HTTP: return ‹202 Accepted› and let the client poll for (or be notified of) the result.

> Listing products, adding to the basket and listing orders are synchronous HTTP. Checkout is asynchronous: Basket publishes ‹BasketCheckoutEvent› and returns ‹202 Accepted›; the order is created in the background. Every saga step (stock, payment, compensation) moves through RabbitMQ messages. In the simulator, blue packets are HTTP and orange packets are messages. Try it yourself: stop Payment with ‹docker stop payment-api› and check out; the saga waits and continues when the service comes back.
`,
  },
  {
    id: 'command-vs-event',
    cat: 'comm',
    title: L('Komut ve Olay', 'Command vs Event'),
    aka: ['command', 'event', 'komut', 'olay', 'publish', 'send', 'mesaj tipleri', 'message types'],
    related: ['sync-async', 'message-broker', 'saga', 'cqrs'],
    tr: `
Asenkron mesajlar niyetlerine göre ikiye ayrılır. **Komut** bir şeyin yapılmasını ister; **olay** bir şeyin olduğunu duyurur. Bu ayrım, kimin kime bağımlı olduğunu belirler.

## Komut (command)
- Emir kipinde adlandırılır: ‹ReserveStockCommand›, ‹ProcessPaymentCommand›.
- **Tek bir sahibi** (alıcısı) vardır. Gönderen, alıcının bunu yapabileceğini bilir.
- Reddedilebilir: "stok yetersiz" geçerli bir cevaptır.
- Genellikle bir sonuç (başka bir olay) beklenir.

## Olay (event)
- Geçmiş zamanda adlandırılır: ‹StockReservedEvent›, ‹OrderCreatedEvent›.
- Olmuş bir gerçeği bildirir; **reddedilemez**, çünkü zaten olmuştur.
- Yayınlayan **kimin dinlediğini bilmez**. Sıfır, bir ya da on servis dinleyebilir; yeni bir dinleyici eklemek yayınlayanı değiştirmez.

## Neden önemli?
- Olaylar bağımlılığı tersine çevirir: Order, "sipariş tamamlandı" olayını yayınlar; e-posta servisi bunu dinler. Order'ın e-posta servisinden haberi olmaz.
- Komutlar ise sorumluluğu açık yapar: stok ayırmanın sahibi Catalog'dur, başka kimse değil.
- İsimlendirme hatası tasarım hatasının işaretidir: "‹SendEmailEvent›" aslında bir komuttur.

## Olay türleri
- **Bildirim olayı (notification):** yalnızca kimlik taşır, dinleyen detay için sorar.
- **Durum taşıyan olay (event-carried state transfer):** dinleyenin ihtiyaç duyduğu veriyi içerir, geri sorgu gerekmez.

> Saga komut gönderir (‹ReserveStockCommand›, ‹ProcessPaymentCommand›, ‹ReleaseStockCommand›), katılımcılar olay yayınlar (‹StockReservedEvent›, ‹PaymentFailedEvent›…). ‹BasketCheckoutEvent› durum taşıyan bir olaydır: ürün adı ve fiyatı mesajın içindedir, Order Catalog'a geri sormaz. Not: bu projede komutlar da MassTransit ‹Publish› ile gönderilir; her komutun tek bir consumer'ı olduğu için sonuç aynıdır.
`,
    en: `
Asynchronous messages fall into two groups by intent. A **command** asks for something to be done; an **event** announces that something happened. The distinction decides who depends on whom.

## Command
- Named in the imperative: ‹ReserveStockCommand›, ‹ProcessPaymentCommand›.
- Has **exactly one owner** (receiver). The sender knows the receiver can do it.
- It can be refused: "insufficient stock" is a valid answer.
- A result (another event) is usually expected.

## Event
- Named in the past tense: ‹StockReservedEvent›, ‹OrderCreatedEvent›.
- States a fact that happened; it **cannot be refused**, because it already happened.
- The publisher **doesn't know who listens**. Zero, one or ten services may listen, and adding a listener doesn't change the publisher.

## Why it matters
- Events invert dependencies: Order publishes "order completed" and an email service listens. Order doesn't know the email service exists.
- Commands make responsibility explicit: Catalog owns stock reservation, nobody else.
- A naming mistake signals a design mistake: a "‹SendEmailEvent›" is really a command.

## Kinds of events
- **Notification event:** carries only an id; listeners ask for the details.
- **Event-carried state transfer:** includes the data listeners need, so no call back is required.

> The saga sends commands (‹ReserveStockCommand›, ‹ProcessPaymentCommand›, ‹ReleaseStockCommand›) and participants publish events (‹StockReservedEvent›, ‹PaymentFailedEvent›…). ‹BasketCheckoutEvent› carries state: the product name and price are inside the message, so Order never calls Catalog back. Note: in this project commands are also sent with MassTransit ‹Publish›; since each command has exactly one consumer, the effect is the same.
`,
  },
  {
    id: 'message-broker',
    cat: 'comm',
    title: L('Mesaj Aracısı (Message Broker)', 'Message Broker'),
    aka: ['rabbitmq', 'kafka', 'broker', 'aracı', 'queue', 'kuyruk', 'exchange', 'masstransit', 'pub/sub'],
    related: ['sync-async', 'at-least-once', 'command-vs-event', 'transactional-outbox'],
    tr: `
Mesaj aracısı, servisler arasındaki asenkron mesajları **alan, saklayan ve dağıtan** ara katmandır. Gönderen ve alıcı birbirini doğrudan tanımaz; ikisi de yalnızca aracıyı tanır.

## Temel kavramlar (RabbitMQ)
- **Exchange:** mesajın bırakıldığı yer. Mesajı kurallara göre kuyruklara kopyalar.
- **Queue (kuyruk):** mesajların alıcı tarafından tüketilene kadar beklediği yer. Kalıcı (durable) kuyruklar aracı yeniden başlasa bile mesajı korur.
- **Binding:** hangi exchange'in hangi kuyruğa mesaj gönderdiği.
- **Ack:** alıcı mesajı başarıyla işlediğini bildirince mesaj kuyruktan silinir. Ack gelmezse mesaj tekrar teslim edilir.

## Kuyruk mu, log mu?
- **RabbitMQ (kuyruk modeli):** mesaj tüketilince gider. İş dağıtımı, komutlar ve olaylar için uygundur.
- **Kafka (log modeli):** mesajlar bir süre saklanır, her tüketici kendi konumunu (offset) tutar. Olayları yeniden oynatmak, yüksek hacimli akışlar ve event sourcing için uygundur.

## Neler kazandırır?
- Gönderen ile alıcı arasında zamansal bağı koparır.
- Yük dengeleme: aynı kuyruğu dinleyen birden çok örnek mesajları paylaşır (competing consumers).
- Yayınla/abone ol: bir olay birden çok servise ulaşır.

## Neye dikkat?
- Aracının kendisi kritik altyapıdır: kümelenmeli, izlenmeli, yedeklenmelidir.
- Teslim garantisi genellikle **en az bir kez**dir; tekrar gelen mesajlara hazır olunmalıdır.
- Başarısız mesajlar için bir **dead-letter / error kuyruğu** ve onu izleyen biri gerekir.

> RabbitMQ, MassTransit üzerinden kullanılır (‹AddSharedMassTransit›). MassTransit her mesaj tipi için bir exchange, her consumer için bir kuyruk oluşturur. Yönetim paneli ‹http://localhost:15672› (guest/guest) adresindedir; ‹ReserveStock›, ‹ProcessPayment› gibi kuyrukları orada görebilirsin. İşlenemeyen mesajlar ‹<kuyruk>_error› kuyruğuna düşer.
`,
    en: `
A message broker is the middle layer that **receives, stores and distributes** asynchronous messages between services. The sender and receiver don't know each other directly; both know only the broker.

## Core concepts (RabbitMQ)
- **Exchange:** where a message is dropped. It copies the message to queues according to rules.
- **Queue:** where messages wait until a receiver consumes them. Durable queues keep messages even if the broker restarts.
- **Binding:** which exchange sends messages to which queue.
- **Ack:** once the receiver reports successful processing, the message is removed from the queue. Without an ack, it is redelivered.

## Queue or log?
- **RabbitMQ (queue model):** a message is gone once consumed. Good for distributing work, commands and events.
- **Kafka (log model):** messages are kept for a while and each consumer tracks its own position (offset). Good for replaying events, high-volume streams and event sourcing.

## What you gain
- It breaks the temporal coupling between sender and receiver.
- Load balancing: several instances on the same queue share the messages (competing consumers).
- Publish/subscribe: one event reaches several services.

## What to watch out for
- The broker itself is critical infrastructure: it must be clustered, monitored and backed up.
- The delivery guarantee is usually **at least once**; be ready for duplicate messages.
- Failed messages need a **dead-letter / error queue** and someone watching it.

> RabbitMQ is used through MassTransit (‹AddSharedMassTransit›). MassTransit creates one exchange per message type and one queue per consumer. The management UI is at ‹http://localhost:15672› (guest/guest), where you can see queues such as ‹ReserveStock› and ‹ProcessPayment›. Messages that cannot be processed end up in the ‹<queue>_error› queue.
`,
  },
  {
    id: 'service-discovery',
    cat: 'comm',
    title: L('Service Discovery ve Service Registry', 'Service Discovery & Service Registry'),
    aka: ['service discovery', 'service registry', 'servis keşfi', 'consul', 'eureka', 'dns', 'kubernetes service'],
    related: ['api-gateway', 'health-check', 'sidecar'],
    tr: `
Mikroservis ortamında servis örnekleri sürekli değişir: otomatik ölçekleme yenilerini ekler, çöken örnek yeniden başlar, her dağıtımda IP adresleri değişir. **Service discovery**, bir servisin diğerini **sabit bir adres bilmeden bulmasını** sağlar. **Service registry**, ayakta olan örneklerin ve adreslerinin tutulduğu kayıt defteridir.

## Nasıl işler?
1. **Kayıt:** servis örneği açılınca registry'ye "ben ‹order-api›, adresim 10.0.3.7:8080" der (self-registration) ya da platform onu kaydeder (third-party registration).
2. **Sağlık:** registry düzenli health check yapar; cevap vermeyen örnek listeden çıkar.
3. **Keşif:** çağıran taraf ‹order-api› adını çözer ve sağlıklı örneklerden birine gider.

## İki keşif modeli
- **İstemci taraflı (client-side):** çağıran registry'yi sorgular ve yük dengelemeyi kendisi yapar (Netflix Eureka + Ribbon, Consul + istemci kütüphanesi).
- **Sunucu taraflı (server-side):** çağıran sabit bir adrese (yük dengeleyici) gider, o da registry'ye bakar (AWS ELB, Kubernetes Service).

## Bugün yaygın olan
Kubernetes'te keşif platformun parçasıdır: her ‹Service› nesnesi kararlı bir DNS adı ve sanal IP alır, arkasındaki pod'lar etiketlerle seçilir ve readiness probe'larıyla filtrelenir. Çoğu ekip ayrı bir Consul/Eureka kurmadan bunu kullanır. Service mesh'ler (Istio, Linkerd) keşfi sidecar proxy'lere taşır.

> Bu projede keşif Docker Compose'un dahili DNS'iyle yapılır: gateway ‹http://catalog.api:8080› adresine gider, Docker bu adı konteynerin IP'sine çözer. Bu **statik** bir keşiftir: ölçeklenen örnekleri izleyen bir registry yoktur. Kubernetes'e taşındığında aynı adlar ‹Service› nesnelerine dönüşür ve kod değişmeden çalışır.
`,
    en: `
In a microservice environment service instances change all the time: autoscaling adds new ones, a crashed instance restarts, and IP addresses change on every deployment. **Service discovery** lets one service find another **without knowing a fixed address**. A **service registry** is the record of which instances are up and where they are.

## How it works
1. **Registration:** when an instance starts it tells the registry "I am ‹order-api› at 10.0.3.7:8080" (self-registration), or the platform registers it (third-party registration).
2. **Health:** the registry runs regular health checks and removes instances that stop responding.
3. **Discovery:** the caller resolves the name ‹order-api› and goes to one of the healthy instances.

## Two discovery models
- **Client-side:** the caller queries the registry and load-balances itself (Netflix Eureka + Ribbon, Consul + a client library).
- **Server-side:** the caller goes to a fixed address (a load balancer), which consults the registry (AWS ELB, Kubernetes Service).

## What is common today
In Kubernetes, discovery is part of the platform: every ‹Service› object gets a stable DNS name and virtual IP, the pods behind it are selected by labels and filtered by readiness probes. Most teams use this without running a separate Consul/Eureka. Service meshes (Istio, Linkerd) move discovery into sidecar proxies.

> In this project discovery is done by Docker Compose's internal DNS: the gateway calls ‹http://catalog.api:8080› and Docker resolves that name to the container's IP. This is **static** discovery: no registry tracks scaled instances. Moved to Kubernetes, the same names would become ‹Service› objects and the code would keep working unchanged.
`,
  },

  // ------------------------------------------------------------------ veri
  {
    id: 'database-per-service',
    cat: 'data',
    title: L('Database per Service (Servis Başına Veritabanı)', 'Database per Service'),
    aka: ['database per service', 'servis başına veritabanı', 'veri sahipliği', 'data ownership', 'polyglot persistence'],
    related: ['shared-database', 'saga', 'eventual-consistency', 'bounded-context'],
    tr: `
Her servis **kendi verisinin tek sahibidir**. Başka bir servis o veriye yalnızca sahibinin API'si ya da yayınladığı olaylar üzerinden erişir; tablolarına doğrudan bağlanamaz.

## Neden?
- **Bağımsız değişim:** Catalog bir kolonu yeniden adlandırınca başka hiçbir servis kırılmaz, çünkü kimse o tabloyu okumuyordur.
- **Bağımsız dağıtım ve ölçekleme:** bir servisin migration'ı diğerlerinin dağıtımını bekletmez.
- **Uygun teknoloji (polyglot persistence):** sepet için Redis, sipariş için PostgreSQL, arama için Elasticsearch seçilebilir.
- **Arıza izolasyonu:** bir servisin veritabanındaki yük ya da kilit diğerlerini etkilemez.

## "Ayrı veritabanı" ne kadar ayrı?
- Ayrı sunucu: en güçlü izolasyon, en yüksek maliyet.
- Aynı sunucuda ayrı veritabanı ya da şema: pratik bir orta yol.
- Aynı şemada ayrı tablolar ama erişim kuralıyla korunuyor: en zayıf; disiplin bozulunca ortak veritabanına döner.

## Bedeli
- **Servisler arası transaction yoktur.** Birden çok servise yayılan iş için saga gerekir.
- **Servisler arası JOIN yoktur.** Rapor ve ekranlar için ya API'ler birleştirilir (API composition) ya da olaylarla beslenen bir okuma modeli kurulur (CQRS).
- Veri bazen **kopyalanır** (ürün adı siparişe kopyalanır) ve kopyalar **nihai tutarlıdır**.

> ‹catalogdb› ve ‹orderdb› aynı PostgreSQL sunucusundaki iki ayrı veritabanıdır (‹scripts/init-databases.sql›); Basket ise Redis kullanır, Payment kayıtlarını bellekte tutar. Catalog yalnızca ‹catalogdb› bağlantı dizesini, Order yalnızca ‹orderdb›'yi bilir. Stok düşüşü ile ödemenin aynı transaction'a sığmaması, bu projede saga'nın var olma sebebidir.
`,
    en: `
Each service is **the sole owner of its data**. Another service reaches that data only through the owner's API or the events it publishes; it never connects to its tables directly.

## Why?
- **Independent change:** when Catalog renames a column, no other service breaks, because nobody else reads that table.
- **Independent deployment and scaling:** one service's migration doesn't hold up the others' deployments.
- **The right technology (polyglot persistence):** Redis for baskets, PostgreSQL for orders, Elasticsearch for search.
- **Failure isolation:** load or locks in one service's database don't affect the others.

## How separate is "separate"?
- A separate server: the strongest isolation and the highest cost.
- A separate database or schema on the same server: a practical middle ground.
- Separate tables in the same schema guarded by access rules: the weakest; once discipline slips it becomes a shared database.

## The cost
- **No transactions across services.** Work that spans services needs a saga.
- **No JOINs across services.** Reports and screens either combine APIs (API composition) or use a read model fed by events (CQRS).
- Data is sometimes **copied** (the product name is copied into the order) and copies are **eventually consistent**.

> ‹catalogdb› and ‹orderdb› are two separate databases on the same PostgreSQL server (‹scripts/init-databases.sql›); Basket uses Redis and Payment keeps its records in memory. Catalog only knows the ‹catalogdb› connection string and Order only knows ‹orderdb›. The fact that the stock deduction and the payment cannot share one transaction is why this project needs a saga.
`,
  },
  {
    id: 'shared-database',
    cat: 'data',
    title: L('Shared Database (Ortak Veritabanı)', 'Shared Database'),
    aka: ['shared database', 'ortak veritabanı', 'paylaşılan veritabanı', 'anti-pattern', 'integration database'],
    related: ['database-per-service', 'strangler-fig', 'bounded-context'],
    tr: `
Shared Database, birden çok servisin **aynı veritabanını ve aynı tabloları** doğrudan okuyup yazmasıdır. Mikroservis dünyasında çoğunlukla bir **anti-pattern** olarak anılır, ama bazı durumlarda bilinçli bir geçiş adımıdır.

## Neden cazip?
- Kurulumu kolaydır; tek veritabanı, tek yedekleme.
- Servisler arası JOIN ve tek ACID transaction mümkündür; saga gerekmez.
- Monolitten geçişte veriyi taşımadan servis ayırmaya izin verir.

## Neden sorunlu?
- **Gizli bağımlılık:** Order, Catalog'un ‹Products› tablosunu okuyorsa Catalog o tabloyu artık özgürce değiştiremez. Şema, herkesin ortak sözleşmesi olur ama kimse bunu açıkça yazmaz.
- **Kilitli dağıtım:** bir migration bütün servislerin aynı anda güncellenmesini gerektirebilir. Bağımsız dağıtım, mikroservisin ana vaadiydi.
- **Performans karışması:** bir servisin ağır raporu, diğerinin kritik sorgularını yavaşlatır.
- **Sahiplik belirsizliği:** bir satırı kim, hangi kurala göre değiştirdi? İş kuralları servislerde değil, veritabanında buluşur.
- Sonuç çoğu zaman **dağıtık monolit**tir: mikroservislerin bütün karmaşıklığı, monolitin bütün bağımlılıklarıyla.

## Kabul edilebilir olduğu durumlar
- Strangler Fig geçişinin geçici bir aşaması (çıkış planıyla).
- Aynı ekibin sahip olduğu, birlikte dağıtılan çok sıkı bağlı iki bileşen.
- Salt okunur bir raporlama kopyası (read replica / veri ambarı); iş servisleri buraya yazmaz.

> Bu proje bilerek tersini yapar: ‹catalogdb› ve ‹orderdb› aynı PostgreSQL **sunucusunu** paylaşır ama **veritabanları ayrıdır** ve hiçbir servis diğerinin bağlantı dizesini bilmez. Sunucuyu paylaşmak altyapı tasarrufudur; veriyi paylaşmak ise mimari bir bağımlılık olurdu.
`,
    en: `
Shared Database means several services read and write **the same database and the same tables** directly. In the microservice world it is mostly called an **anti-pattern**, though sometimes it is a deliberate transition step.

## Why it is tempting
- It is easy to set up: one database, one backup.
- Cross-service JOINs and a single ACID transaction are possible; no saga is needed.
- It lets you split services out of a monolith without moving data.

## Why it is a problem
- **Hidden coupling:** if Order reads Catalog's ‹Products› table, Catalog can no longer change that table freely. The schema becomes everyone's shared contract, but nobody writes that contract down.
- **Lock-step deployments:** a migration may require every service to update at the same time. Independent deployment was the main promise of microservices.
- **Performance interference:** one service's heavy report slows down another's critical queries.
- **Unclear ownership:** who changed this row, and under which rule? Business rules meet in the database instead of in the services.
- The result is often a **distributed monolith**: all the complexity of microservices with all the coupling of a monolith.

## When it is acceptable
- A temporary stage of a Strangler Fig migration (with an exit plan).
- Two tightly coupled components owned by the same team and deployed together.
- A read-only reporting copy (read replica / data warehouse) that business services never write to.

> This project deliberately does the opposite: ‹catalogdb› and ‹orderdb› share the same PostgreSQL **server** but are **separate databases**, and no service knows the other's connection string. Sharing a server is an infrastructure saving; sharing data would be an architectural dependency.
`,
  },
  {
    id: 'saga',
    cat: 'data',
    title: L('Saga (Orkestrasyon ve Koreografi)', 'Saga (Orchestration & Choreography)'),
    aka: ['saga', 'orkestrasyon', 'koreografi', 'orchestration', 'choreography', 'state machine', 'durum makinesi', 'distributed transaction', 'dağıtık transaction', '2pc'],
    related: ['compensation', 'transactional-outbox', 'idempotency', 'eventual-consistency', 'correlation-id', 'timeout'],
    tr: `
Saga, birden çok servise yayılan bir işi **her biri kendi servisinde yerel transaction olan adımlar dizisine** böler. Bir adım başarısız olursa, daha önce başarılı olmuş adımlar **telafi işlemleriyle** tersine çevrilir. Kavram 1987'de Garcia-Molina ve Salem'in uzun süren veritabanı transaction'ları üzerine makalesinden gelir.

## Problem
Monolitte "stok düş + ödeme al" tek bir ‹BEGIN … COMMIT›'tir. Mikroserviste stok Catalog'un, ödeme Payment'ın veritabanındadır. İki aşamalı commit (2PC) teoride mümkündür ama katılımcıları kilitli bekletir, koordinatör çökerse sistem takılır ve RabbitMQ/HTTP gibi araçlarla pratikte kullanılmaz. Saga, ACID yerine **nihai tutarlılığı** kabul eder.

## Orkestrasyon
Bir **merkezi koordinatör** (orkestratör) süreci yönetir: hangi adımın ne zaman çalışacağına karar verir, komut gönderir, cevapları bekler.
- Sürecin tamamı tek bir yerde okunur ve test edilir.
- Katılımcılar basit kalır: komut alır, sonuç yayınlar; saga'dan habersizdir.
- Orkestratör ek bir bileşendir ve fazla mantık toplarsa "tanrı servis"e dönüşebilir.

## Koreografi
Merkez yoktur. Her servis bir önceki olayı dinler ve kendi adımını yapar: Order ‹OrderCreated› yayınlar → Catalog dinler, stok ayırır, ‹StockReserved› yayınlar → Payment dinler, ödeme alır…
- Az bileşen, gevşek bağ; küçük akışlarda daha az kod.
- Süreç hiçbir dosyada yazılı değildir; "ödeme reddedilince ne olur?" sorusunun cevabı servislere dağılmıştır.
- Adım sayısı arttıkça olay döngüleri ve izlemesi zor akışlar ortaya çıkar.

## Saga tasarımında kurallar
- Her adım **idempotent** olmalı; mesajlar tekrar gelebilir.
- Her telafi edilebilir adımın bir **telafi işlemi** olmalı ve o da idempotent olmalı.
- Durum değişikliği ile mesaj yayını atomik olmalı (**transactional outbox**).
- Adımlar bir **korelasyon kimliği** (ör. ‹OrderId›) taşımalı.
- Bekleme adımlarına **zaman aşımı** eklenmeli.
- Saga izolasyon sağlamaz: ara durumlar (stok düşmüş, ödeme bekleniyor) başkalarına görünür. Gerekirse "beklemede" gibi semantik kilitler kullanılır.

> Bu proje **orkestrasyon** kullanır: ‹OrderStateMachine› (MassTransit) her sipariş için ‹OrderSagaStates› tablosunda bir satır tutar. Akış: ‹Initial› → ‹AwaitingStock› → ‹AwaitingPayment› → ‹Completed›; stok yetersizse ‹Cancelled›, ödeme reddedilirse ‹Compensating› → ‹Cancelled›. Ortadaki "Saga" kartı bu durum makinesini canlı gösterir. Koreografiyi denemek için iyi bir alıştırma: state machine'i kapatıp Catalog'a ‹OrderCreatedEvent›, Payment'a ‹StockReservedEvent› consumer'ı eklemek.
`,
    en: `
A saga splits work that spans several services into **a sequence of steps, each a local transaction in its own service**. If a step fails, the steps that already succeeded are reversed with **compensating actions**. The idea comes from Garcia-Molina and Salem's 1987 paper on long-lived database transactions.

## The problem
In a monolith, "deduct stock + take payment" is a single ‹BEGIN … COMMIT›. In microservices, stock lives in Catalog's database and payment in Payment's. Two-phase commit (2PC) is possible in theory, but it keeps participants locked while waiting, the system gets stuck if the coordinator crashes, and in practice it isn't used with tools like RabbitMQ or HTTP. A saga accepts **eventual consistency** instead of ACID.

## Orchestration
A **central coordinator** (the orchestrator) runs the process: it decides which step runs when, sends commands and waits for replies.
- The whole process can be read and tested in one place.
- Participants stay simple: they receive a command and publish a result, unaware of the saga.
- The orchestrator is one more component, and if it gathers too much logic it can turn into a "god service".

## Choreography
There is no center. Each service listens for the previous event and performs its own step: Order publishes ‹OrderCreated› → Catalog listens, reserves stock, publishes ‹StockReserved› → Payment listens, takes payment…
- Fewer components and loose coupling; less code for small flows.
- The process isn't written down anywhere; the answer to "what happens when payment is declined?" is scattered across services.
- As steps grow, event loops and hard-to-trace flows appear.

## Rules for designing sagas
- Every step must be **idempotent**; messages can arrive twice.
- Every compensatable step needs a **compensating action**, and that must be idempotent too.
- Changing state and publishing a message must be atomic (**transactional outbox**).
- Steps must carry a **correlation id** (e.g. ‹OrderId›).
- Waiting steps need **timeouts**.
- A saga provides no isolation: intermediate states (stock deducted, payment pending) are visible to others. Use semantic locks such as a "pending" status if needed.

> This project uses **orchestration**: ‹OrderStateMachine› (MassTransit) keeps one row per order in the ‹OrderSagaStates› table. The flow is ‹Initial› → ‹AwaitingStock› → ‹AwaitingPayment› → ‹Completed›; with insufficient stock it goes to ‹Cancelled›, and with a declined payment to ‹Compensating› → ‹Cancelled›. The "Saga" card in the middle shows this state machine live. A good exercise for trying choreography: turn off the state machine and add an ‹OrderCreatedEvent› consumer to Catalog and a ‹StockReservedEvent› consumer to Payment.
`,
  },
  {
    id: 'compensation',
    cat: 'data',
    title: L('Telafi İşlemi (Compensation)', 'Compensating Transaction (Compensation)'),
    aka: ['compensation', 'telafi', 'compensating transaction', 'rollback', 'geri alma', 'undo', 'refund', 'iade'],
    related: ['saga', 'idempotency', 'eventual-consistency'],
    tr: `
Telafi işlemi, daha önce **commit edilmiş** bir adımın etkisini tersine çeviren **yeni bir işlemdir**. Saga'larda veritabanı rollback'inin yerini alır.

## Rollback ile farkı
- Rollback, commit edilmemiş değişiklikleri **yok eder**; hiç olmamış gibi olur.
- Telafi, olmuş bir şeyi **iptal eden başka bir şey yapar**. İlk işlem ve telafisi kayıtlarda iz bırakır. Banka örneği: yanlış havale silinmez, ters yönde yeni bir havale yapılır.
- Arada geçen sürede başkaları ara durumu görmüş olabilir: stok düşükken başka bir müşteri "tükendi" görmüş olabilir. Telafi bunu geri alamaz, yalnızca durumu düzeltir.

## İyi bir telafi işleminin özellikleri
- **İdempotent:** iki kez gelirse stok iki kez artmamalı.
- **Yeniden denenebilir:** telafi başarısız olursa saga tekrar denemeli. Telafinin kalıcı olarak başarısız olması en kötü durumdur ve insan müdahalesi (alarm, manuel kuyruk) gerektirir.
- **Değişmeyen girdiyle çalışır:** "neyi geri alacağım?" bilgisi telafiyi yapan serviste saklanmalıdır.
- **Semantik olarak doğru:** her şey tam tersine çevrilemez. Gönderilmiş bir e-posta geri alınamaz; telafisi "özür e-postası" olabilir. Ödeme için telafi "iade"dir ve iadenin kendi kuralları (komisyon, süre) vardır.

## Adım sırası tasarımı
Telafisi zor ya da imkânsız adımları **sona** koymak yaygın bir tekniktir. Geri dönüşü olmayan adıma (pivot) gelmeden önceki her şey telafi edilebilir olmalı, ondan sonraki her şey ileriye doğru yeniden denenebilir olmalıdır.

> "Ödeme reddi + telafi" senaryosunda stok önce düşer (‹StockReservedEvent›), ödeme reddedilir (‹PaymentFailedEvent›), saga ‹Compensating› durumuna geçer ve ‹ReleaseStockCommand› gönderir. ‹ReleaseStockConsumer› neyi geri ekleyeceğini ‹StockReservations› tablosundan bilir; rezervasyon zaten silinmişse yalnızca olayı tekrar yayınlar (idempotent). Ödeme son adım olduğu için iade telafisi gerekmez; ödemeden sonra kargo gibi bir adım eklenseydi ‹RefundPaymentCommand› gerekirdi.
`,
    en: `
A compensating transaction is **a new operation** that reverses the effect of a step that was already **committed**. In sagas it takes the place of a database rollback.

## How it differs from rollback
- A rollback **discards** uncommitted changes; it is as if nothing happened.
- A compensation **does something else that cancels** what happened. Both the original operation and its compensation leave a trace in the records. Bank example: a wrong transfer is not deleted; a new transfer goes the other way.
- In the meantime others may have seen the intermediate state: while stock was low, another customer may have seen "sold out". Compensation cannot undo that; it only fixes the state.

## Properties of a good compensation
- **Idempotent:** if it arrives twice, stock must not go up twice.
- **Retryable:** if the compensation fails, the saga must retry it. A compensation that fails permanently is the worst case and needs human intervention (alerts, a manual queue).
- **Works from stable input:** the "what do I undo?" information must be stored in the service that performs the compensation.
- **Semantically correct:** not everything can be exactly reversed. A sent email can't be unsent; its compensation might be an apology email. For a payment the compensation is a refund, which has its own rules (fees, time limits).

## Ordering the steps
A common technique is to put steps that are hard or impossible to compensate **last**. Everything before the point of no return (the pivot) must be compensatable; everything after it must be retryable forward.

> In the "Payment declined + compensation" scenario, stock is deducted first (‹StockReservedEvent›), the payment is declined (‹PaymentFailedEvent›), the saga moves to ‹Compensating› and sends ‹ReleaseStockCommand›. ‹ReleaseStockConsumer› knows what to add back from the ‹StockReservations› table; if the reservation is already gone it just republishes the event (idempotent). Payment is the last step, so no refund compensation is needed; if a step such as shipping came after payment, a ‹RefundPaymentCommand› would be required.
`,
  },
  {
    id: 'transactional-outbox',
    cat: 'data',
    title: L('Transactional Outbox', 'Transactional Outbox'),
    aka: ['outbox', 'transactional outbox', 'dual write', 'çift yazma', 'inbox', 'cdc', 'change data capture', 'debezium'],
    related: ['idempotency', 'at-least-once', 'saga', 'message-broker'],
    tr: `
Transactional Outbox, "veritabanına yaz **ve** mesaj yayınla" işini atomik hale getiren desendir. Giden mesaj önce **aynı veritabanı transaction'ı içinde** bir ‹Outbox› tablosuna yazılır; ayrı bir süreç bu tabloyu okuyup mesajları aracıya iletir.

## Problem: çift yazma (dual write)
Bir consumer siparişi PostgreSQL'e kaydedip ‹OrderCreatedEvent›'i RabbitMQ'ya yayınlıyor. İki ayrı sistem, ortak transaction yok:
- Önce kaydet, sonra yayınla: kayıttan sonra süreç çökerse **sipariş var ama olay yok**; saga hiç başlamaz.
- Önce yayınla, sonra kaydet: kayıt başarısız olursa **olay var ama sipariş yok**; diğer servisler var olmayan bir sipariş için çalışır.
Retry bu sorunu çözmez; çökme iki yazma arasında her an olabilir.

## Çözüm
1. İş verisi ve giden mesaj **aynı transaction'da** yazılır: ‹Orders› satırı + ‹OutboxMessage› satırı. Ya ikisi birden olur ya hiçbiri.
2. Bir **relay/dispatcher** outbox'taki gönderilmemiş mesajları okur, aracıya yayınlar, gönderildi diye işaretler.
3. Relay yayından sonra, işaretlemeden önce çökerse mesaj **tekrar** gönderilir. Bu yüzden outbox **en az bir kez** teslim garantisi verir; alıcılar idempotent olmalıdır.

## Relay türleri
- **Polling publisher:** tabloyu düzenli aralıklarla sorgular. Basittir.
- **Transaction log tailing (CDC):** Debezium gibi bir araç veritabanının değişiklik günlüğünü okur. Daha düşük gecikme, daha fazla altyapı.

## Inbox: karşı taraf
Alıcı tarafta **inbox** tablosu, işlenen mesaj kimliklerini saklar ve aynı mesajın ikinci kez işlenmesini engeller. Outbox + inbox birlikte "neredeyse tam bir kez" etkisi verir.

> Catalog ve Order, MassTransit'in EF Core outbox ve inbox'ını kullanır (‹AddEntityFrameworkOutbox›, ‹UseEntityFrameworkOutbox›; ‹DependencyInjection.cs› dosyaları). ‹BasketCheckoutConsumer› siparişi kaydedip ‹OrderCreatedEvent›'i yayınladığında olay önce ‹OutboxMessage› tablosuna yazılır, commit sonrasında RabbitMQ'ya iletilir. Basket'te outbox yoktur: veritabanı Redis olduğu için yayın ile sepeti silme atomik değildir. Bu, dokümanlarda açıkça yazılmış bir sınırdır.
`,
    en: `
The Transactional Outbox pattern makes "write to the database **and** publish a message" atomic. The outgoing message is first written to an ‹Outbox› table **inside the same database transaction**; a separate process reads that table and forwards the messages to the broker.

## The problem: dual writes
A consumer saves an order to PostgreSQL and publishes ‹OrderCreatedEvent› to RabbitMQ. Two separate systems, no shared transaction:
- Save first, then publish: if the process crashes after saving, **the order exists but the event doesn't**; the saga never starts.
- Publish first, then save: if the save fails, **the event exists but the order doesn't**; other services work on an order that doesn't exist.
Retrying doesn't fix this; the crash can happen between the two writes at any moment.

## The solution
1. Business data and the outgoing message are written **in the same transaction**: an ‹Orders› row + an ‹OutboxMessage› row. Either both happen or neither does.
2. A **relay/dispatcher** reads unsent messages from the outbox, publishes them to the broker and marks them as sent.
3. If the relay crashes after publishing but before marking, the message is sent **again**. So the outbox guarantees **at-least-once** delivery, and receivers must be idempotent.

## Kinds of relay
- **Polling publisher:** queries the table at intervals. Simple.
- **Transaction log tailing (CDC):** a tool like Debezium reads the database's change log. Lower latency, more infrastructure.

## Inbox: the other side
On the receiving side an **inbox** table stores processed message ids and stops the same message from being processed twice. Outbox + inbox together give an "effectively once" result.

> Catalog and Order use MassTransit's EF Core outbox and inbox (‹AddEntityFrameworkOutbox›, ‹UseEntityFrameworkOutbox›; see the ‹DependencyInjection.cs› files). When ‹BasketCheckoutConsumer› saves an order and publishes ‹OrderCreatedEvent›, the event is first written to the ‹OutboxMessage› table and forwarded to RabbitMQ after the commit. Basket has no outbox: its database is Redis, so publishing and deleting the basket are not atomic. This limitation is spelled out in the docs.
`,
  },
  {
    id: 'idempotency',
    cat: 'data',
    title: L('Idempotency (Tekrar Güvenliği)', 'Idempotency'),
    aka: ['idempotency', 'idempotent', 'tekrar güvenliği', 'idempotency key', 'deduplication', 'tekilleştirme', 'inbox'],
    related: ['at-least-once', 'retry', 'transactional-outbox', 'compensation'],
    tr: `
Bir işlem **idempotent** ise onu bir kez ya da birden çok kez çalıştırmak **aynı sonucu** verir. Dağıtık sistemlerde tekrarlar kaçınılmaz olduğu için idempotency bir lüks değil, zorunluluktur.

## Tekrarlar nereden gelir?
- Aracı "en az bir kez" teslim eder: consumer işi bitirip ack göndermeden çökerse mesaj tekrar gelir.
- Outbox relay'i yayından sonra çökerse mesaj tekrar yayınlanır.
- İstemci timeout alıp isteği yeniden gönderir; oysa ilk istek sunucuda başarılı olmuştu.
- Retry politikaları kasıtlı olarak tekrarlar.

## Teknikler
- **Doğal idempotency:** "stok = 5 yap" idempotenttir, "stoğu 1 azalt" değildir. Mümkünse işlemi mutlak değerle ifade etmek.
- **Mesaj kimliği ile tekilleştirme (inbox):** işlenen mesaj kimlikleri saklanır; aynı kimlik tekrar gelirse atlanır.
- **İş anahtarı ile kontrol:** "bu sipariş için rezervasyon zaten var mı?" Farklı mesaj kimliğiyle gelen aynı anlamlı tekrarları yakalar.
- **Idempotency key (HTTP):** istemci her işlem için benzersiz bir anahtar gönderir (‹Idempotency-Key› başlığı); sunucu aynı anahtarla gelen ikinci isteğe ilk cevabı döner. Ödeme API'lerinde standarttır.
- **Durum makinesi kontrolü:** zaten ‹Completed› olan siparişe ikinci ‹Complete()› çağrısı sessizce yok sayılır.
- **Benzersiz kısıtlar:** veritabanı ‹UNIQUE› kısıtı yarışta ikinci kaydı reddeder.

## HTTP metotları
‹GET›, ‹PUT›, ‹DELETE› tanım gereği idempotent olmalıdır; ‹POST› değildir. Bu yüzden "sipariş oluştur" gibi ‹POST› işlemleri idempotency key ister.

> Her katılımcı tekrara karşı korunur: ‹InboxState› tablosu aynı mesaj kimliğini ikinci kez işlemez; ‹ReserveStockConsumer› bu sipariş için ‹StockReservations› satırı varsa stoğu tekrar düşmez, sonucu yeniden yayınlar; ‹ProcessPaymentConsumer› aynı sipariş için ilk ödeme kaydını döner; ‹OrderStateMachine› beklenmeyen olayları ‹OnUnhandledEvent(x => x.Ignore())› ile yok sayar; ‹CustomerOrder.Complete()›/‹Cancel()› aynı duruma ikinci geçişte sessiz kalır. Saga testleri (‹tests/Order.Tests›) tekrar teslimi de kapsar.
`,
    en: `
An operation is **idempotent** if running it once or many times produces **the same result**. In distributed systems duplicates are unavoidable, so idempotency is a requirement, not a luxury.

## Where do duplicates come from?
- Brokers deliver "at least once": if a consumer finishes the work but crashes before sending the ack, the message comes again.
- If the outbox relay crashes after publishing, the message is published again.
- A client times out and resends the request, even though the first one succeeded on the server.
- Retry policies repeat on purpose.

## Techniques
- **Natural idempotency:** "set stock to 5" is idempotent; "decrease stock by 1" is not. Express operations as absolute values where you can.
- **Deduplication by message id (inbox):** processed message ids are stored, and a repeated id is skipped.
- **Checks by business key:** "is there already a reservation for this order?" This catches repeats that mean the same thing but carry a different message id.
- **Idempotency key (HTTP):** the client sends a unique key per operation (the ‹Idempotency-Key› header) and the server returns the first response to a second request with the same key. It is standard in payment APIs.
- **State machine checks:** a second ‹Complete()› on an order that is already ‹Completed› is silently ignored.
- **Unique constraints:** a database ‹UNIQUE› constraint rejects the second insert in a race.

## HTTP methods
‹GET›, ‹PUT› and ‹DELETE› should be idempotent by definition; ‹POST› is not. That is why ‹POST› operations such as "create order" need an idempotency key.

> Every participant is protected against repeats: the ‹InboxState› table won't process the same message id twice; ‹ReserveStockConsumer› doesn't deduct stock again if a ‹StockReservations› row exists for the order and just republishes the result; ‹ProcessPaymentConsumer› returns the first payment record for the same order; ‹OrderStateMachine› ignores unexpected events with ‹OnUnhandledEvent(x => x.Ignore())›; and ‹CustomerOrder.Complete()›/‹Cancel()› stay quiet on a second transition to the same state. The saga tests (‹tests/Order.Tests›) cover duplicate delivery too.
`,
  },
  {
    id: 'at-least-once',
    cat: 'data',
    title: L('En Az Bir Kez Teslim', 'At-least-once Delivery'),
    aka: ['at least once', 'en az bir kez', 'exactly once', 'tam bir kez', 'at most once', 'en fazla bir kez', 'delivery guarantee', 'teslim garantisi', 'ack'],
    related: ['idempotency', 'transactional-outbox', 'message-broker', 'retry'],
    tr: `
Mesajlaşma sistemleri üç teslim garantisinden birini sunar. Hangisinin geçerli olduğunu bilmek, consumer'ları nasıl yazacağını belirler.

## Üç garanti
- **En fazla bir kez (at-most-once):** mesaj bir kez gönderilir, kaybolursa kaybolur. Hızlıdır ama veri kaybı kabul edilir (ör. metrik örnekleri).
- **En az bir kez (at-least-once):** mesaj, alıcı onaylayana kadar tekrar gönderilir. Kaybolmaz ama **tekrar gelebilir**. Pratikte en yaygın garanti budur.
- **Tam bir kez (exactly-once):** her mesaj tam olarak bir kez işlenir. Ağ ve çökmeler varken uçtan uca garanti etmek pratikte mümkün değildir; sistemler bunu "en az bir kez teslim + idempotent işleme" ile **etkili olarak** sağlar.

## Neden tekrar olur?
Consumer mesajı işler, veritabanına yazar, ama ack göndermeden çöker. Aracı ack almadığı için mesajın işlenmediğini varsayar ve tekrar teslim eder. Aracının "işledi mi, işlemedi mi" ayrımını yapmasının yolu yoktur.

## Sıra (ordering)
Tekrar teslim ve paralel consumer'lar mesaj sırasını da bozabilir: ‹PaymentCompleted›, ‹StockReserved›'dan önce gelebilir. Sağlam tasarımlar sıraya güvenmez ya da durum makinesiyle beklenmeyen sırayı ele alır.

> RabbitMQ ve MassTransit en az bir kez teslim eder; outbox da en az bir kez yayınlar. Bu yüzden projedeki her consumer idempotenttir (bkz. Idempotency) ve saga, beklemediği durumda gelen olayları ‹OnUnhandledEvent(x => x.Ignore())› ile güvenle yok sayar.
`,
    en: `
Messaging systems offer one of three delivery guarantees. Knowing which one applies determines how you write consumers.

## The three guarantees
- **At-most-once:** a message is sent once; if it gets lost, it's lost. Fast, but data loss is accepted (e.g. metric samples).
- **At-least-once:** a message is resent until the receiver acknowledges it. It is never lost but **can arrive more than once**. This is the most common guarantee in practice.
- **Exactly-once:** each message is processed exactly once. Guaranteeing this end to end in the presence of networks and crashes isn't practical; systems achieve it **effectively** with at-least-once delivery plus idempotent processing.

## Why do duplicates happen?
A consumer processes a message and writes to the database, but crashes before sending the ack. Having received no ack, the broker assumes the message wasn't processed and delivers it again. The broker has no way to tell "processed" from "not processed".

## Ordering
Redelivery and parallel consumers can also scramble message order: ‹PaymentCompleted› may arrive before ‹StockReserved›. Robust designs don't rely on order, or they handle unexpected order with a state machine.

> RabbitMQ and MassTransit deliver at least once, and the outbox publishes at least once too. That is why every consumer in the project is idempotent (see Idempotency) and the saga safely ignores events that arrive in an unexpected state with ‹OnUnhandledEvent(x => x.Ignore())›.
`,
  },
  {
    id: 'eventual-consistency',
    cat: 'data',
    title: L('Eventual Consistency (Nihai Tutarlılık)', 'Eventual Consistency'),
    aka: ['eventual consistency', 'nihai tutarlılık', 'consistency', 'tutarlılık', 'cap', 'base', 'acid'],
    related: ['saga', 'cqrs', 'database-per-service', 'sync-async'],
    tr: `
Nihai tutarlılık, sistemdeki kopyaların ve servislerin **bir süre birbirinden farklı görünebileceğini**, ama yeni değişiklik gelmezse **sonunda aynı duruma ulaşacağını** garanti eder. Dağıtık sistemlerde güçlü tutarlılığın (her okuma son yazmayı görür) bedeli yüksek olduğunda kabul edilen modeldir.

## Neden kaçınılmaz?
- **CAP teoremi:** ağ bölünmesi (partition) varken bir sistem ya tutarlılıktan ya erişilebilirlikten vazgeçmek zorundadır. Mikroservisler çoğunlukla erişilebilirliği seçer.
- Servis başına veritabanı kullanıldığında servisler arası tek transaction yoktur; değişiklik olaylarla yayılır ve olayların yayılması zaman alır.

## ACID ve BASE
- **ACID:** Atomicity, Consistency, Isolation, Durability; tek veritabanı içinde güçlü garanti.
- **BASE:** Basically Available, Soft state, Eventually consistent; dağıtık sistemlerde pratik model.

## Kullanıcıya nasıl yansır?
- Checkout'tan hemen sonra sipariş listesi boş görünebilir; mesaj henüz işlenmemiştir.
- Ara durumlar görünür: "sipariş alındı, onay bekleniyor".
- Arayüz bunu gizlemek yerine **dürüstçe göstermelidir**: ‹202 Accepted›, "işleniyor" etiketleri, otomatik yenileme ya da push bildirim.

## Ne zaman kabul edilemez?
Bazı kurallar anlık tutarlılık ister: aynı koltuğun iki kişiye satılmaması gibi. Bu durumda kural tek bir servisin, tek bir transaction'ın içine alınır (stok ayırma Catalog'un kendi transaction'ındadır) ya da iyimser kilit ve benzersiz kısıtlar kullanılır.

> Checkout ‹202 Accepted› döner; sipariş birkaç yüz milisaniye sonra ‹Pending›, saga bittiğinde ‹Completed› ya da ‹Cancelled› olur. Simülatörde siparişler tablosunun ve saga kartının adım adım değişmesi nihai tutarlılığın kendisidir. Stokta yarış ise Catalog içinde iyimser kilitle (‹Product.Version›, PostgreSQL ‹xmin›) anında çözülür.
`,
    en: `
Eventual consistency guarantees that copies and services **may look different from each other for a while**, but **will converge to the same state** if no new changes arrive. It is the model chosen in distributed systems when strong consistency (every read sees the latest write) is too expensive.

## Why is it unavoidable?
- **CAP theorem:** during a network partition a system must give up either consistency or availability. Microservices usually choose availability.
- With a database per service there is no single cross-service transaction; changes spread through events, and spreading takes time.

## ACID and BASE
- **ACID:** Atomicity, Consistency, Isolation, Durability; strong guarantees within a single database.
- **BASE:** Basically Available, Soft state, Eventually consistent; the practical model for distributed systems.

## How users experience it
- Right after checkout the order list may look empty, because the message hasn't been processed yet.
- Intermediate states are visible: "order received, awaiting confirmation".
- Instead of hiding this, the UI should **show it honestly**: ‹202 Accepted›, "processing" labels, auto-refresh or push notifications.

## When is it unacceptable?
Some rules need immediate consistency, such as never selling the same seat to two people. Then the rule is kept inside a single service and a single transaction (stock reservation happens in Catalog's own transaction), or optimistic locking and unique constraints are used.

> Checkout returns ‹202 Accepted›; a few hundred milliseconds later the order is ‹Pending›, and when the saga finishes it becomes ‹Completed› or ‹Cancelled›. Watching the orders table and the saga card change step by step in the simulator is eventual consistency itself. A stock race, on the other hand, is resolved immediately inside Catalog with optimistic locking (‹Product.Version›, PostgreSQL ‹xmin›).
`,
  },
  {
    id: 'event-sourcing',
    cat: 'data',
    title: L('Event Sourcing (Olay Kaynaklı Kayıt)', 'Event Sourcing'),
    aka: ['event sourcing', 'olay kaynaklı', 'event store', 'olay deposu', 'projection', 'projeksiyon', 'snapshot', 'audit'],
    related: ['cqrs', 'ddd', 'eventual-consistency'],
    tr: `
Event Sourcing'de bir varlığın **güncel durumu saklanmaz**; ona olan **her değişiklik bir olay olarak** sırayla saklanır. Güncel durum, olaylar baştan sona yeniden oynatılarak hesaplanır.

## Örnek
Klasik model: ‹Orders› tablosunda ‹Status = Cancelled›. Neden, ne zaman, hangi sırayla? Kayıp.
Event sourcing: ‹OrderPlaced› → ‹StockReserved› → ‹PaymentFailed› → ‹StockReleased› → ‹OrderCancelled›. Her şey kayıtlıdır; durum bu listeden türetilir.

## Faydaları
- **Tam denetim izi (audit log):** ne olduğu ve neden olduğu kayıttan çıkarılabilir. Finans, sağlık gibi alanlarda değerlidir.
- **Zamanda yolculuk:** "geçen salı bu siparişin durumu neydi?" sorusu olayları o tarihe kadar oynatarak cevaplanır.
- **Yeni okuma modelleri:** olaylar baştan oynatılarak bugün ihtiyaç duyulan yeni bir rapor geçmiş verilerle doldurulur.
- **Doğal olay yayını:** saklanan olaylar zaten diğer servislere yayınlanacak olaylardır; outbox ihtiyacı azalır.

## Bedeli
- **Sorgulamak zordur:** "bugün iptal olan siparişler" için olay deposu taranmaz; CQRS ile ayrı okuma modelleri (projeksiyonlar) gerekir.
- **Olay şeması evrimi:** yıllar önce yazılmış olayları bugünkü kod da okuyabilmelidir (upcasting, versiyonlama).
- **Performans:** binlerce olaylı bir varlık için periyodik **snapshot** gerekir.
- **Silme:** KVKK/GDPR "unutulma hakkı" değişmez olay listesinde ek teknik ister (kripto-silme gibi).
- Ekip için yeni bir düşünme biçimidir; basit alanlarda gereksiz karmaşıklıktır.

> Bu proje event sourcing kullanmaz: siparişin güncel durumu ‹Orders› tablosunda, saga'nın durumu ‹OrderSagaStates›'te saklanır. Yine de simülatörün "Akış" paneli, bir siparişe olan her şeyin sıralı bir listesidir, yani event sourcing'in ne kaydedeceğine iyi bir örnektir. Kullanmak istenirse Marten (PostgreSQL) ya da EventStoreDB yaygın seçeneklerdir.
`,
    en: `
With Event Sourcing an entity's **current state is not stored**; **every change to it is stored as an event**, in order. The current state is computed by replaying the events from start to finish.

## Example
Classic model: ‹Status = Cancelled› in the ‹Orders› table. Why, when, in what order? Lost.
Event sourcing: ‹OrderPlaced› → ‹StockReserved› → ‹PaymentFailed› → ‹StockReleased› → ‹OrderCancelled›. Everything is recorded and the state is derived from this list.

## Benefits
- **A complete audit log:** what happened and why can be read from the record. Valuable in areas like finance and healthcare.
- **Time travel:** "what was this order's state last Tuesday?" is answered by replaying events up to that date.
- **New read models:** a report you need today can be filled with historical data by replaying events from the beginning.
- **Natural event publishing:** stored events are exactly the events to publish to other services, which reduces the need for an outbox.

## The cost
- **Hard to query:** you don't scan the event store for "orders cancelled today"; you need separate read models (projections) via CQRS.
- **Event schema evolution:** today's code must still read events written years ago (upcasting, versioning).
- **Performance:** an entity with thousands of events needs periodic **snapshots**.
- **Deletion:** GDPR's "right to be forgotten" needs extra techniques in an immutable event list (such as crypto-shredding).
- It is a new way of thinking for the team and unnecessary complexity in simple areas.

> This project does not use event sourcing: an order's current state lives in the ‹Orders› table and the saga's state in ‹OrderSagaStates›. Still, the simulator's "Flow" panel is an ordered list of everything that happened to an order, which makes it a good example of what event sourcing would record. Marten (on PostgreSQL) and EventStoreDB are common choices if you want to adopt it.
`,
  },

  // ------------------------------------------------------------------ dayanıklılık
  {
    id: 'timeout',
    cat: 'resil',
    title: L('Timeout (Zaman Aşımı)', 'Timeout'),
    aka: ['timeout', 'zaman aşımı', 'deadline', 'cancellation', 'iptal', 'latency', 'gecikme'],
    related: ['retry', 'circuit-breaker', 'bulkhead', 'fallback', 'saga'],
    tr: `
Timeout, bir işlemin **en fazla ne kadar bekleneceğini** belirler. Süre dolunca beklemek bırakılır ve işlem başarısız sayılır. Dağıtık sistemlerdeki en temel, en çok unutulan dayanıklılık önlemidir.

## Neden bu kadar önemli?
Ağ üzerinden yapılan bir çağrının üç sonucu vardır: başarı, hata ve **cevapsızlık**. Cevapsızlığa sınır koymazsan çağıran sonsuza kadar bekler; thread'ler, bağlantılar ve bellek tükenir. Yavaş tek bir servis, onu çağıran bütün servisleri kilitleyebilir. Bir servis için yavaş olmak, çökmekten daha tehlikelidir.

## Doğru değeri seçmek
- Ölçülen gecikmeye göre: örneğin p99 gecikmenin biraz üstü. Çok kısa olursa sağlıklı istekler de kesilir, çok uzun olursa koruma işe yaramaz.
- **Deadline yayılımı:** kullanıcının toplam bekleme bütçesi 2 saniyeyse, zincirdeki her çağrı kalan süreyi bilmelidir. gRPC deadline'ları ve .NET ‹CancellationToken› bunu taşır.
- Dış çağrıların timeout'u, onları çağıranın timeout'undan **kısa** olmalıdır; aksi halde çağıran pes etmişken iç çağrı boşuna çalışmaya devam eder.

## Timeout bir belirsizliktir
Timeout "işlem olmadı" demek değildir; "**olup olmadığını bilmiyorum**" demektir. Ödeme isteği zaman aşımına uğradıysa ödeme bankada gerçekleşmiş olabilir. Bu yüzden timeout sonrası retry ancak işlem idempotent ise güvenlidir.

## Asenkron dünyada timeout
Mesajlaşmada çağrı beklenmez, ama **süreç** beklenir. "Ödeme sonucu 30 saniyede gelmezse ne olacak?" sorusu saga seviyesinde bir timeout gerektirir (zamanlanmış mesaj).

> İz yayıncısı (‹SimulationTracePublisher›) her izi 3 saniyelik bir timeout ile gönderir; RabbitMQ yavaşsa iz düşer ama iş akışı beklemez. Saga'da ise **bilerek** timeout yoktur: Payment hiç cevap vermezse sipariş ‹AwaitingPayment›'ta kalır. Dokümandaki alıştırma, MassTransit ‹Schedule› ile 30 saniyelik bir timeout ekleyip süre dolunca telafiyi başlatmaktır.
`,
    en: `
A timeout sets **the maximum time to wait** for an operation. When it runs out, waiting stops and the operation is treated as failed. It is the most basic, and most often forgotten, resilience measure in distributed systems.

## Why does it matter so much?
A call over the network has three outcomes: success, error and **no answer**. Without a limit on "no answer", the caller waits forever; threads, connections and memory run out. A single slow service can lock up every service that calls it. For a service, being slow is more dangerous than being down.

## Choosing the right value
- Base it on measured latency: for example, slightly above the p99 latency. Too short and healthy requests get cut off; too long and the protection is useless.
- **Deadline propagation:** if the user's total waiting budget is 2 seconds, every call in the chain should know how much time is left. gRPC deadlines and .NET ‹CancellationToken› carry this.
- An inner call's timeout must be **shorter** than its caller's; otherwise the inner call keeps working pointlessly after the caller has given up.

## A timeout is uncertainty
A timeout doesn't mean "it didn't happen"; it means "**I don't know whether it happened**". If a payment request timed out, the payment may still have gone through at the bank. That is why retrying after a timeout is only safe if the operation is idempotent.

## Timeouts in the asynchronous world
With messaging you don't wait for a call, but you do wait for a **process**. "What happens if the payment result doesn't arrive in 30 seconds?" calls for a timeout at the saga level (a scheduled message).

> The trace publisher (‹SimulationTracePublisher›) sends each trace with a 3-second timeout; if RabbitMQ is slow the trace is dropped, but the business flow never waits. The saga **deliberately** has no timeout: if Payment never answers, the order stays in ‹AwaitingPayment›. The exercise in the docs is to add a 30-second timeout with MassTransit ‹Schedule› and start compensation when it expires.
`,
  },
  {
    id: 'retry',
    cat: 'resil',
    title: L('Retry (Yeniden Deneme)', 'Retry'),
    aka: ['retry', 'yeniden deneme', 'backoff', 'exponential backoff', 'jitter', 'polly', 'transient', 'geçici hata', 'redelivery'],
    related: ['idempotency', 'circuit-breaker', 'timeout', 'at-least-once'],
    tr: `
Retry, **geçici** (transient) bir hatadan sonra işlemi belli bir politikaya göre tekrar denemektir. Kısa ağ kopmaları, anlık kilit çakışmaları ve yeniden başlayan servisler çoğu zaman ikinci denemede düzelir.

## Hangi hatalar denenmeli?
- **Evet:** bağlantı zaman aşımı, ‹503 Service Unavailable›, ‹429 Too Many Requests› (Retry-After başlığına uyarak), deadlock ve iyimser kilit çakışması.
- **Hayır:** ‹400 Bad Request›, doğrulama hataları, "stok yetersiz" gibi iş kuralı reddi. Bunlar her denemede aynı sonucu verir.

## İyi bir retry politikası
- **Sınırlı deneme sayısı:** sonsuz retry, arızayı gizler ve yükü büyütür.
- **Üstel geri çekilme (exponential backoff):** 100 ms, 200 ms, 400 ms, 800 ms… Hedef servise toparlanma zamanı tanır.
- **Jitter (rastgele sapma):** bekleme sürelerine rastgelelik eklenir. Yoksa bin istemci aynı anda yeniden dener ve servisi tekrar düşürür (thundering herd).
- **Toplam süre bütçesi:** retry'lar kullanıcının timeout'unu aşmamalıdır.

## Tehlikeler
- **Retry fırtınası:** A, B'yi 3 kez; B, C'yi 3 kez denerse C'ye 9 istek gider. Katmanlar arasında retry yalnızca bir seviyede yapılmalıdır.
- **İdempotent olmayan işlemler:** ödeme isteğini yeniden denemek çift tahsilata yol açabilir. Retry ancak idempotency ile güvenlidir.
- Retry, uzun süren bir arızada işe yaramaz; orada **circuit breaker** devreye girmelidir.

## Mesajlaşmada retry
Consumer hata fırlatınca mesaj yeniden işlenir. Kısa aralıklı **immediate/interval retry** geçici hataları, dakikalar/saatler süren **delayed redelivery** daha uzun kesintileri karşılar. Denemeler tükenince mesaj **error/dead-letter kuyruğuna** gider.

> ‹AddSharedMassTransit› her consumer'a ‹UseMessageRetry(r => r.Intervals(100, 500, 1000, 2000))› uygular. Örnek: iki sipariş son ürünü aynı anda ayırmaya çalışırsa ikincisi ‹DbUpdateConcurrencyException› alır; retry mesajı tekrar işler ve ikinci denemede stok artık yetersiz olduğu için temiz bir ‹StockReservationFailedEvent› üretilir. Denemeler tükenirse mesaj ‹<kuyruk>_error› kuyruğuna düşer ve simülatörde kırmızı bir hata izi görünür.
`,
    en: `
Retry means trying an operation again, according to a policy, after a **transient** failure. Brief network drops, momentary lock conflicts and restarting services often recover by the second attempt.

## Which errors should be retried?
- **Yes:** connection timeouts, ‹503 Service Unavailable›, ‹429 Too Many Requests› (respecting the Retry-After header), deadlocks and optimistic concurrency conflicts.
- **No:** ‹400 Bad Request›, validation errors, and business rejections like "insufficient stock". These give the same result on every attempt.

## A good retry policy
- **A limited number of attempts:** infinite retries hide failures and amplify load.
- **Exponential backoff:** 100 ms, 200 ms, 400 ms, 800 ms… This gives the target service time to recover.
- **Jitter:** add randomness to the waits. Otherwise a thousand clients retry at the same instant and knock the service over again (thundering herd).
- **A total time budget:** retries must not exceed the user's timeout.

## Dangers
- **Retry storms:** if A retries B 3 times and B retries C 3 times, C gets 9 requests. Retry at only one layer.
- **Non-idempotent operations:** retrying a payment request can charge twice. Retry is only safe with idempotency.
- Retry doesn't help during a long outage; that is where a **circuit breaker** should take over.

## Retry in messaging
When a consumer throws, the message is processed again. Short **immediate/interval retries** cover transient errors, and **delayed redelivery** over minutes or hours covers longer outages. Once attempts run out, the message goes to an **error/dead-letter queue**.

> ‹AddSharedMassTransit› applies ‹UseMessageRetry(r => r.Intervals(100, 500, 1000, 2000))› to every consumer. Example: if two orders try to reserve the last item at the same time, the second gets a ‹DbUpdateConcurrencyException›; the retry processes the message again, and since stock is now insufficient on the second attempt, a clean ‹StockReservationFailedEvent› is produced. If attempts run out, the message lands in the ‹<queue>_error› queue and a red error trace appears in the simulator.
`,
  },
  {
    id: 'circuit-breaker',
    cat: 'resil',
    title: L('Circuit Breaker (Devre Kesici)', 'Circuit Breaker'),
    aka: ['circuit breaker', 'devre kesici', 'sigorta', 'polly', 'resilience4j', 'hystrix', 'half-open', 'yarı açık'],
    related: ['retry', 'timeout', 'fallback', 'bulkhead'],
    tr: `
Circuit Breaker, arızalı bir bağımlılığa **sürekli istek göndermeyi durduran** bir korumadır. Evdeki elektrik sigortası gibi çalışır: hata belli bir eşiği aşınca devre "açılır" ve çağrılar hedefe hiç gitmeden hemen başarısız olur.

## Üç durum
- **Kapalı (closed):** normal çalışma. İstekler geçer, hatalar sayılır.
- **Açık (open):** hata oranı eşiği aştı (ör. son 20 çağrının %50'si başarısız). Bir süre boyunca istekler **hiç gönderilmeden** hemen reddedilir.
- **Yarı açık (half-open):** bekleme süresi dolunca birkaç deneme isteğine izin verilir. Başarılı olurlarsa devre kapanır, olmazsa tekrar açılır.

## Neden gerekli?
- Çöken bir servise istek göndermeye devam etmek, onun toparlanmasını zorlaştırır.
- Çağıran taraf her istekte timeout süresi kadar bekler; thread ve bağlantılar tükenir, arıza zincirleme yayılır.
- Hızlı başarısız olmak (fail fast), kullanıcıya hızlı bir cevap ya da fallback sunmayı mümkün kılar.

## Retry ile birlikte
Retry geçici hatalar içindir, circuit breaker uzun süren hatalar için. Doğru sıralama genellikle: **timeout → retry → circuit breaker**. Breaker açıksa retry'lar da hemen kesilir, böylece retry fırtınası önlenir.

## Ayar parametreleri
Hata oranı eşiği, minimum çağrı sayısı (az veriyle karar verilmesin), açık kalma süresi, yarı açık durumda izin verilen deneme sayısı. Breaker'lar genellikle **bağımlılık başına** tutulur: Payment'ın breaker'ı açılınca Catalog çağrıları etkilenmez.

> Bu projede circuit breaker yoktur: servisler arası iş akışı zaten asenkrondur ve kuyruk, kapalı bir servisin yükünü kendiliğinden emer. Gateway'den servislere giden HTTP çağrıları için eklenmek istenirse .NET'te ‹Microsoft.Extensions.Http.Resilience› (Polly v8) ‹AddStandardResilienceHandler› ile timeout, retry ve circuit breaker'ı birlikte sağlar. MassTransit tarafında ‹UseCircuitBreaker› ya da ‹UseKillSwitch› consumer'ları korur.
`,
    en: `
A Circuit Breaker is a guard that **stops sending requests to a failing dependency**. It works like the fuse box at home: once failures pass a threshold the circuit "opens", and calls fail immediately without ever reaching the target.

## Three states
- **Closed:** normal operation. Requests go through and failures are counted.
- **Open:** the failure rate crossed the threshold (e.g. 50% of the last 20 calls failed). For a period, requests are rejected immediately **without being sent**.
- **Half-open:** when the wait period ends, a few trial requests are let through. If they succeed the circuit closes; if not, it opens again.

## Why is it needed?
- Continuing to hammer a crashed service makes it harder for it to recover.
- The caller waits a full timeout on every request; threads and connections run out and the failure cascades.
- Failing fast makes it possible to give the user a quick answer or a fallback.

## Together with retry
Retry is for transient errors, the circuit breaker for longer failures. The usual order is **timeout → retry → circuit breaker**. When the breaker is open, retries are cut off immediately too, which prevents retry storms.

## Tuning parameters
The failure-rate threshold, a minimum number of calls (so it doesn't decide on too little data), how long it stays open, and how many trial calls are allowed in half-open. Breakers are usually kept **per dependency**: when Payment's breaker opens, calls to Catalog are unaffected.

> This project has no circuit breaker: the business flow between services is already asynchronous, and the queue naturally absorbs a down service's load. To add one for the HTTP calls from the gateway to the services, .NET's ‹Microsoft.Extensions.Http.Resilience› (Polly v8) ‹AddStandardResilienceHandler› provides timeout, retry and circuit breaker together. On the MassTransit side, ‹UseCircuitBreaker› or ‹UseKillSwitch› protect consumers.
`,
  },
  {
    id: 'fallback',
    cat: 'resil',
    title: L('Fallback (Yedek Davranış)', 'Fallback'),
    aka: ['fallback', 'yedek', 'graceful degradation', 'zarif bozulma', 'default', 'cache', 'önbellek'],
    related: ['circuit-breaker', 'timeout', 'bulkhead'],
    tr: `
Fallback, bir bağımlılık başarısız olduğunda (hata, timeout, açık devre) **hata göstermek yerine devreye giren alternatif davranıştır**. Amaç, sistemin tamamen çökmesi yerine **zarif bir şekilde bozulmasıdır** (graceful degradation).

## Yaygın fallback türleri
- **Önbellekten son bilinen değer:** öneri servisi cevap vermiyorsa dünkü öneriler gösterilir.
- **Varsayılan değer:** kişiselleştirme servisi yoksa herkese "en çok satanlar" listesi gösterilir.
- **Özelliği gizlemek:** yorumlar yüklenemiyorsa ürün sayfası yorumsuz açılır; sayfanın tamamı hata vermez.
- **Kuyruğa alıp sonra işlemek:** e-posta servisi kapalıysa mesaj kuyruğa bırakılır, sonra gönderilir.
- **Alternatif sağlayıcı:** birincil ödeme sağlayıcısı yanıt vermiyorsa ikinciye yönlendirmek.

## Tasarım soruları
- **İş kararıdır:** "fiyat servisine ulaşılamıyorsa eski fiyatla satış yapılsın mı?" sorusunu yazılımcı değil iş birimi cevaplamalıdır. Bazen en doğru fallback açık bir hata mesajıdır.
- **Görünür olmalı:** fallback devreye girdiğinde log, metrik ve alarm üretilmelidir; yoksa arıza haftalarca fark edilmeden kalır.
- **Fallback'in fallback'i olmamalı:** fallback basit ve kendisi arızalanamayacak kadar sağlam olmalıdır. Başka bir uzak servise bağlı bir fallback yeni bir risk demektir.
- **Kritik yol ayrımı:** ödeme gibi kritik işlemler için "sessizce başarılı say" asla fallback olamaz.

> Bu projede açık bir fallback katmanı yoktur. Asenkron tasarımın kendisi bir tür fallback sağlar: Order kapalıyken checkout yine ‹202› döner, iş kuyrukta bekler. Simülatör tarafında da küçük bir örnek vardır: iz yayını başarısız olursa iz sessizce düşer (‹SimulationTracePublisher›), çünkü izleme iş akışı için kritik değildir. Arayüz bazı servislere ulaşamazsa sayfa yine açılır ve bir uyarı gösterir.
`,
    en: `
A fallback is **the alternative behavior that kicks in instead of an error** when a dependency fails (error, timeout, open circuit). The goal is for the system to **degrade gracefully** rather than collapse.

## Common kinds of fallback
- **The last known value from a cache:** if the recommendation service doesn't respond, show yesterday's recommendations.
- **A default value:** without the personalization service, show everyone the "best sellers" list.
- **Hiding a feature:** if reviews can't load, the product page opens without them instead of failing entirely.
- **Queue now, process later:** if the email service is down, drop the message in a queue and send it later.
- **An alternative provider:** route to a secondary payment provider if the primary doesn't respond.

## Design questions
- **It is a business decision:** "if the price service is unreachable, should we sell at the old price?" is a question for the business, not the developer. Sometimes the right fallback is a clear error message.
- **It must be visible:** when a fallback kicks in it should produce logs, metrics and alerts; otherwise a failure can go unnoticed for weeks.
- **A fallback shouldn't need a fallback:** keep it simple and robust enough that it can't fail itself. A fallback that depends on another remote service is a new risk.
- **Mind the critical path:** for critical operations like payments, "silently treat it as successful" can never be a fallback.

> This project has no explicit fallback layer. The asynchronous design is itself a kind of fallback: with Order down, checkout still returns ‹202› and the work waits in the queue. There's a small example on the simulator side too: if publishing a trace fails, the trace is quietly dropped (‹SimulationTracePublisher›), because tracing is not critical to the business flow. If the UI can't reach some services, the page still opens and shows a warning.
`,
  },
  {
    id: 'bulkhead',
    cat: 'resil',
    title: L('Bulkhead (Bölme)', 'Bulkhead'),
    aka: ['bulkhead', 'bölme', 'isolation', 'izolasyon', 'connection pool', 'bağlantı havuzu', 'thread pool', 'concurrency limit'],
    related: ['circuit-breaker', 'timeout', 'fallback', 'database-per-service'],
    tr: `
Bulkhead, kaynakları **birbirinden yalıtılmış bölmelere** ayırarak bir arızanın bütün sistemi batırmasını önler. Adını gemilerin su geçirmez bölmelerinden alır: bir bölme su alsa da gemi batmaz.

## Problem
Bir servis üç bağımlılığı (Catalog, Payment, Öneri) aynı thread/bağlantı havuzuyla çağırıyor. Öneri servisi yavaşladı; her çağrı 30 saniye bekliyor. Kısa sürede havuzun tamamı öneri çağrılarıyla dolar ve **hiç ilgisi olmayan** ödeme istekleri de bekleyecek boş bağlantı bulamaz. Tek bir yavaş bağımlılık bütün servisi kilitler.

## Nasıl uygulanır?
- **Bağımlılık başına havuz:** her hedef servis için ayrı bağlantı havuzu ya da eşzamanlılık sınırı (ör. öneri servisine aynı anda en fazla 10 istek).
- **İş türü başına kaynak:** kritik ödeme trafiği ile toplu rapor işleri ayrı worker'larda/kuyruklarda çalışır.
- **Örnek seviyesinde:** önemli müşteriler için ayrılmış servis örnekleri.
- **Altyapı seviyesinde:** Kubernetes'te CPU/bellek limitleri, ayrı node havuzları; servis başına ayrı veritabanı.
- Sınır aşıldığında istek **hemen reddedilir** ya da kısa bir kuyrukta bekler; böylece fallback devreye girebilir.

## Bedeli
Kaynaklar bölündüğü için toplam kullanım verimliliği düşer: bir bölme boşken diğeri dolu olabilir. Sınırların ölçümle ayarlanması gerekir.

> Mikroservis ayrımının kendisi bir bulkhead'dir: her servis ayrı konteynerde, ayrı süreçte çalışır; Payment'ın yavaşlaması Catalog'un HTTP isteklerini etkilemez. Her consumer'ın **kendi kuyruğu** vardır, bu yüzden ‹ProcessPayment› kuyruğunda biriken mesajlar ‹ReserveStock›'u bekletmez. Servis başına ayrı veritabanı da veri seviyesinde bir bölmedir. Kod seviyesinde açık bir eşzamanlılık sınırı (ör. Polly ‹RateLimiter› / MassTransit ‹ConcurrentMessageLimit›) eklenmemiştir.
`,
    en: `
The Bulkhead pattern splits resources into **isolated compartments** so that one failure can't sink the whole system. It is named after the watertight compartments of a ship: one compartment can flood without the ship going down.

## The problem
A service calls three dependencies (Catalog, Payment, Recommendations) through the same thread/connection pool. The recommendation service slows down and every call waits 30 seconds. Soon the entire pool is full of recommendation calls, and **unrelated** payment requests can't find a free connection either. One slow dependency locks up the whole service.

## How to apply it
- **A pool per dependency:** a separate connection pool or concurrency limit for each target service (e.g. at most 10 concurrent requests to the recommendation service).
- **Resources per kind of work:** critical payment traffic and bulk report jobs run on separate workers/queues.
- **At the instance level:** dedicated service instances for important customers.
- **At the infrastructure level:** CPU/memory limits and separate node pools in Kubernetes; a separate database per service.
- When a limit is hit, the request is **rejected immediately** or waits in a short queue, so a fallback can take over.

## The cost
Splitting resources lowers overall utilization: one compartment may sit idle while another is full. Limits need to be tuned with measurements.

> Splitting into microservices is itself a bulkhead: each service runs in its own container and process, so Payment slowing down doesn't affect Catalog's HTTP requests. Each consumer has **its own queue**, so messages piling up in the ‹ProcessPayment› queue don't hold up ‹ReserveStock›. A database per service is a compartment at the data level. No explicit concurrency limit has been added at the code level (e.g. a Polly ‹RateLimiter› or MassTransit ‹ConcurrentMessageLimit›).
`,
  },

  // ------------------------------------------------------------------ gözlemlenebilirlik
  {
    id: 'correlation-id',
    cat: 'obs',
    title: L('Correlation ID (Korelasyon Kimliği)', 'Correlation ID'),
    aka: ['correlation id', 'korelasyon', 'correlation', 'request id', 'trace id', 'traceparent', 'orderid'],
    related: ['distributed-tracing', 'log-aggregation', 'saga'],
    tr: `
Correlation ID, **aynı iş akışına ait bütün istekleri, mesajları ve log satırlarını birbirine bağlayan** benzersiz bir kimliktir. Akışın başında üretilir ve her servis çağrısında, her mesajda aynen taşınır.

## Neden gerekli?
Bir checkout dört servise, onlarca log satırına ve bir düzine mesaja yayılır. Hepsi farklı süreçlerde, farklı makinelerde, farklı zamanlarda üretilir. Ortak bir kimlik olmadan "bu müşterinin siparişi neden iptal oldu?" sorusunun cevabını loglarda bulmak samanlıkta iğnedir.

## İki tür kimlik
- **Teknik korelasyon (trace id):** bir kullanıcı isteğinden doğan bütün teknik çağrıları bağlar. W3C Trace Context standardı bunu ‹traceparent› HTTP başlığıyla taşır; OpenTelemetry otomatik yayar.
- **İş korelasyonu:** iş anlamı olan bir kimlik; bir siparişin günler süren yaşamı boyunca bütün olayları bağlar (‹OrderId›). Saga'lar mesajın hangi saga örneğine ait olduğunu bu kimlikle bulur.

## Uygulama kuralları
- Kimlik **sınırda** üretilir (gateway ya da ilk servis); istemci gönderdiyse korunur.
- Her log satırına yapılandırılmış bir alan olarak eklenir (‹CorrelationId=…›), metne gömülmez.
- Asenkron sınırları da geçmelidir: mesaj başlıklarında ya da mesaj gövdesinde taşınır.
- Hata cevaplarında istemciye döndürülür; destek ekibi kullanıcının verdiği kimlikle akışı bulabilir.

> İki seviye de vardır. İş korelasyonu: bütün saga mesajları ‹OrderId› taşır ve ‹OrderStateMachine› ‹x.CorrelateById(m => m.Message.OrderId)› ile doğru saga satırını bulur. Teknik korelasyon: OpenTelemetry ‹traceparent›'ı HTTP ve MassTransit üzerinden yayar; her simülatör izi ‹TraceId› taşır. Detay panelindeki "sipariş #…" ve "trace …" etiketleri bu iki kimliktir; "Bu siparişi takip et" ile akışı tek siparişe göre süzebilirsin.
`,
    en: `
A correlation ID is a unique identifier that **ties together every request, message and log line belonging to the same flow**. It is generated at the start of the flow and carried unchanged through every service call and every message.

## Why is it needed?
One checkout spans four services, dozens of log lines and a dozen messages, all produced in different processes, on different machines, at different times. Without a shared id, finding out from the logs why a customer's order was cancelled is like looking for a needle in a haystack.

## Two kinds of id
- **Technical correlation (trace id):** links all technical calls that stem from one user request. The W3C Trace Context standard carries it in the ‹traceparent› HTTP header, and OpenTelemetry propagates it automatically.
- **Business correlation:** an id with business meaning that links every event across an order's life, which may span days (‹OrderId›). Sagas use it to find which saga instance a message belongs to.

## Rules for using it
- The id is generated **at the edge** (the gateway or the first service); if the client sent one, it is preserved.
- It is added to every log line as a structured field (‹CorrelationId=…›), not embedded in the text.
- It must cross asynchronous boundaries too, carried in message headers or the message body.
- It is returned to the client in error responses so support can find the flow from the id the user gives them.

> Both levels exist here. Business correlation: every saga message carries ‹OrderId›, and ‹OrderStateMachine› finds the right saga row with ‹x.CorrelateById(m => m.Message.OrderId)›. Technical correlation: OpenTelemetry propagates ‹traceparent› over HTTP and MassTransit, and each simulator trace carries a ‹TraceId›. The "order #…" and "trace …" chips in the detail panel are these two ids; "Follow this order" filters the flow down to a single order.
`,
  },
  {
    id: 'distributed-tracing',
    cat: 'obs',
    title: L('Distributed Tracing (Dağıtık İzleme)', 'Distributed Tracing'),
    aka: ['distributed tracing', 'dağıtık izleme', 'tracing', 'opentelemetry', 'otel', 'span', 'jaeger', 'zipkin', 'tempo'],
    related: ['correlation-id', 'log-aggregation', 'health-check'],
    tr: `
Distributed tracing, bir isteğin **servisler arasındaki yolculuğunu uçtan uca** kaydeder: hangi servise gitti, orada ne kadar kaldı, hangi veritabanı sorgusunu yaptı, hangi mesajı yayınladı. Sonuç, isteğin zaman çizelgesini gösteren bir şelale (waterfall) grafiğidir.

## Temel kavramlar
- **Trace:** bir isteğin tüm yolculuğu. Tek bir ‹trace id› ile tanımlanır.
- **Span:** yolculuktaki tek bir işlem (bir HTTP çağrısı, bir SQL sorgusu, bir mesaj tüketimi). Başlangıç-bitiş zamanı, etiketleri (attributes) ve üst span'i vardır.
- **Context propagation:** trace ve span kimliğinin servisten servise taşınması (HTTP'de ‹traceparent› başlığı, mesajlarda başlık alanı).
- **Sampling:** her isteği kaydetmek pahalıdır; örneğin isteklerin %10'u ya da yalnızca hatalı/yavaş olanlar kaydedilir (head/tail sampling).

## Neyi cevaplar?
- "Checkout neden 3 saniye sürdü?" → Şelalede 2,5 saniyenin Payment'ta geçtiği görülür.
- "Hata nerede başladı?" → Kırmızı ilk span.
- "Bu servis kimleri çağırıyor?" → Trace'lerden otomatik çıkarılan servis haritası.

## OpenTelemetry
Bugünün standardı OpenTelemetry'dir (OTel): trace, metrik ve log için satıcıdan bağımsız API, SDK ve bir aktarım protokolü (OTLP). Uygulama OTel ile enstrümante edilir; veri Jaeger, Zipkin, Grafana Tempo, Honeycomb ya da Datadog'a gönderilebilir. ASP.NET Core, HttpClient, EF Core ve MassTransit için hazır enstrümantasyon vardır.

## Üç sütun
Gözlemlenebilirlik genellikle üç sinyalle anlatılır: **log** (ne oldu), **metrik** (ne kadar/ne sıklıkla) ve **trace** (nerede ve ne kadar sürede). Güç, üçünü aynı trace id ile birbirine bağlamaktan gelir.

> Her servis ‹AddSharedOpenTelemetry› ile ASP.NET Core, HttpClient ve MassTransit kaynaklarından trace toplar ve konsola yazar. Simülatör ise bunun eğitim amaçlı, görsel bir versiyonudur: ‹ISimulationTracer› her adımı ‹TraceId›, servis adı ve **onu üreten kod satırıyla** birlikte yayınlar; "Akış" paneli bir şelale grafiğinin sadeleştirilmiş halidir. Gerçek bir arayüz için ‹docker-compose.yml›'ye Jaeger eklenip OTLP exporter açılabilir.
`,
    en: `
Distributed tracing records **a request's journey across services, end to end**: which service it reached, how long it stayed, which database query it ran, which message it published. The result is a waterfall chart showing the request's timeline.

## Core concepts
- **Trace:** the whole journey of one request, identified by a single ‹trace id›.
- **Span:** one operation in the journey (an HTTP call, a SQL query, consuming a message). It has start/end times, attributes and a parent span.
- **Context propagation:** carrying the trace and span ids from service to service (the ‹traceparent› header in HTTP, a header field in messages).
- **Sampling:** recording every request is expensive, so for example 10% of requests, or only failed/slow ones, are recorded (head/tail sampling).

## What it answers
- "Why did checkout take 3 seconds?" → The waterfall shows 2.5 seconds spent in Payment.
- "Where did the error start?" → The first red span.
- "Which services does this one call?" → A service map derived automatically from traces.

## OpenTelemetry
Today's standard is OpenTelemetry (OTel): a vendor-neutral API, SDK and wire protocol (OTLP) for traces, metrics and logs. You instrument the application with OTel and can send the data to Jaeger, Zipkin, Grafana Tempo, Honeycomb or Datadog. Ready-made instrumentation exists for ASP.NET Core, HttpClient, EF Core and MassTransit.

## The three pillars
Observability is often described with three signals: **logs** (what happened), **metrics** (how much/how often) and **traces** (where and how long). The power comes from linking all three with the same trace id.

> Every service collects traces from ASP.NET Core, HttpClient and MassTransit via ‹AddSharedOpenTelemetry› and writes them to the console. The simulator is an educational, visual version of the same idea: ‹ISimulationTracer› publishes each step with its ‹TraceId›, the service name and **the line of code that produced it**, and the "Flow" panel is a simplified waterfall. For a real UI you could add Jaeger to ‹docker-compose.yml› and turn on the OTLP exporter.
`,
  },
  {
    id: 'log-aggregation',
    cat: 'obs',
    title: L('Log Aggregation (Log Toplama)', 'Log Aggregation'),
    aka: ['log aggregation', 'log toplama', 'logging', 'serilog', 'elk', 'elasticsearch', 'kibana', 'loki', 'seq', 'structured logging', 'yapılandırılmış log'],
    related: ['correlation-id', 'distributed-tracing', 'health-check'],
    tr: `
Log aggregation, bütün servislerin ve örneklerin loglarını **tek bir merkezde toplayıp** aranabilir, süzülebilir ve ilişkilendirilebilir hale getirmektir.

## Neden gerekli?
Monolitte tek bir log dosyası vardır. Mikroserviste on servis, her birinin beş örneği ve her dağıtımda yeniden yaratılan konteynerler vardır. Konteyner silindiğinde içindeki log da gider. Bir hatayı araştırmak için elli konteynere tek tek bağlanmak mümkün değildir.

## Nasıl kurulur?
1. **Yapılandırılmış log:** servisler düz metin yerine alanları olan kayıtlar üretir: ‹{"level":"Error","service":"Order.API","orderId":"…","message":"…"}›. Böylece "OrderId'si X olan bütün loglar" gibi sorgular mümkün olur.
2. **Toplama:** loglar stdout'a yazılır; bir ajan (Fluent Bit, Vector, Promtail) bunları toplar ve merkeze gönderir. Ya da uygulama doğrudan OTLP ile gönderir.
3. **Depolama ve arama:** Elasticsearch + Kibana (ELK), Grafana Loki, Seq, Splunk, bulut sağlayıcının log servisi.
4. **İlişkilendirme:** her log satırında trace id ve correlation id bulunur; log ekranından trace'e, trace'den loglara geçilebilir.

## İyi pratikler
- Log seviyelerini bilinçli kullanmak (Debug, Information, Warning, Error); üretimde Debug kapalı.
- Kişisel veri, şifre, kart numarası **asla** loglanmaz.
- Her satırda servis adı, ortam, sürüm ve örnek kimliği bulunur.
- Hacim ve maliyet kontrolü: saklama süreleri, örnekleme, gürültülü logların azaltılması.
- Loglardan alarm üretmek (ör. dakikada 50'den fazla Error).

> Her servis ‹UseSharedSerilog("Catalog.API")› ile Serilog kullanır ve her satıra ‹ServiceName› ekler; ‹docker compose logs -f› ile dört servisin logları tek akışta okunabilir ve satırın hangi servisten geldiği görülür. Merkezi bir log deposu kurulmamıştır. Sonraki adım olarak Compose'a Seq ya da Grafana Loki eklemek ve Serilog'a ilgili sink'i bağlamak yeterlidir.
`,
    en: `
Log aggregation means **collecting the logs of every service and instance in one central place** and making them searchable, filterable and correlated.

## Why is it needed?
A monolith has one log file. Microservices have ten services, five instances each, and containers recreated on every deployment. When a container is deleted its logs go with it. Connecting to fifty containers one by one to investigate an error isn't feasible.

## How it is set up
1. **Structured logging:** services emit records with fields instead of plain text: ‹{"level":"Error","service":"Order.API","orderId":"…","message":"…"}›. This makes queries like "all logs for OrderId X" possible.
2. **Collection:** logs are written to stdout; an agent (Fluent Bit, Vector, Promtail) collects them and ships them to the center. Or the application sends them directly over OTLP.
3. **Storage and search:** Elasticsearch + Kibana (ELK), Grafana Loki, Seq, Splunk, or the cloud provider's log service.
4. **Correlation:** every log line carries the trace id and correlation id, so you can jump from logs to traces and back.

## Good practices
- Use log levels deliberately (Debug, Information, Warning, Error); keep Debug off in production.
- **Never** log personal data, passwords or card numbers.
- Every line includes the service name, environment, version and instance id.
- Control volume and cost: retention periods, sampling, trimming noisy logs.
- Raise alerts from logs (e.g. more than 50 Errors per minute).

> Every service uses Serilog via ‹UseSharedSerilog("Catalog.API")› and adds ‹ServiceName› to each line; with ‹docker compose logs -f› you can read all four services' logs in one stream and see which service each line came from. No central log store is set up. The next step would simply be adding Seq or Grafana Loki to Compose and wiring the matching Serilog sink.
`,
  },
  {
    id: 'health-check',
    cat: 'obs',
    title: L('Health Check API (Sağlık Kontrolü)', 'Health Check API'),
    aka: ['health check', 'sağlık kontrolü', '/health', 'liveness', 'readiness', 'startup probe', 'probe'],
    related: ['service-discovery', 'log-aggregation', 'circuit-breaker'],
    tr: `
Health Check API, bir servisin **"çalışıyor muyum ve iş alabilir miyim?"** sorusuna cevap verdiği bir uçtur (genellikle ‹/health›). Orkestratörler, yük dengeleyiciler ve izleme sistemleri bu uca düzenli olarak istek atar.

## Kim kullanır?
- **Orkestratör (Kubernetes, Docker):** sağlıksız konteyneri yeniden başlatır.
- **Yük dengeleyici / service registry:** sağlıksız örneğe trafik göndermez.
- **Dağıtım süreci:** yeni sürüm sağlıklı olmadan eskisini kapatmaz (rolling update).
- **İzleme/alarm:** sağlık durumu bozulunca nöbetçiyi uyarır.

## Liveness, readiness, startup
- **Liveness (canlılık):** süreç kilitlenmiş mi? Başarısızsa konteyner **yeniden başlatılır**. Yalnızca sürecin kendisini kontrol etmeli; veritabanı kapalı diye servisi yeniden başlatmak sorunu çözmez, döngüye sokar.
- **Readiness (hazırlık):** şu an trafik alabilir mi? Başarısızsa örnek **trafikten çıkarılır** ama öldürülmez. Bağımlılık kontrolleri (veritabanı, cache) buraya aittir.
- **Startup:** uzun açılışlı uygulamalar için; açılış bitene kadar diğer kontroller beklenir.

## Tasarım ipuçları
- Kontroller **hızlı ve ucuz** olmalı; her saniye ağır bir sorgu çalıştıran health check servisi kendisi yorar.
- Cevap, makinenin okuyabileceği bir durum kodu (‹200› / ‹503›) ve isteğe bağlı detay içerir.
- Zorunlu olmayan bir bağımlılık (ör. öneri servisi) bozuk diye servis "sağlıksız" ilan edilmemeli; "degraded" gibi ara durumlar kullanılabilir.
- Health check ucu dışarıya açılmamalı ya da hassas detay vermemelidir.

> Her serviste ‹/health› ucu vardır (ASP.NET Core Health Checks): Catalog ve Order PostgreSQL'e (‹AddNpgSql›), Basket Redis'e (‹AddRedis›) bakar; Payment yalnızca süreci kontrol eder. ‹docker-compose.yml› altyapı konteynerleri için health check tanımlar ve API'leri ancak ‹postgres›, ‹redis› ve ‹rabbitmq› sağlıklı olduktan sonra başlatır. Simülatörün HTTP izleri ‹/health› çağrılarını bilerek atlar.
`,
    en: `
A Health Check API is an endpoint (usually ‹/health›) where a service answers **"am I running, and can I take work?"**. Orchestrators, load balancers and monitoring systems call it regularly.

## Who uses it?
- **The orchestrator (Kubernetes, Docker):** restarts an unhealthy container.
- **Load balancers / service registries:** stop sending traffic to an unhealthy instance.
- **The deployment process:** doesn't shut down the old version until the new one is healthy (rolling update).
- **Monitoring/alerting:** pages the on-call engineer when health degrades.

## Liveness, readiness, startup
- **Liveness:** is the process stuck? If it fails, the container is **restarted**. It should check only the process itself; restarting a service because the database is down doesn't fix anything and just causes a restart loop.
- **Readiness:** can it take traffic right now? If it fails, the instance is **removed from traffic** but not killed. Dependency checks (database, cache) belong here.
- **Startup:** for slow-starting applications; other checks wait until startup finishes.

## Design tips
- Checks must be **fast and cheap**; a health check that runs a heavy query every second wears the service out itself.
- The response has a machine-readable status code (‹200› / ‹503›) and optional detail.
- A non-essential dependency being broken (e.g. a recommendation service) shouldn't make the service "unhealthy"; intermediate states like "degraded" can be used.
- The health endpoint shouldn't be publicly exposed or reveal sensitive detail.

> Every service has a ‹/health› endpoint (ASP.NET Core Health Checks): Catalog and Order check PostgreSQL (‹AddNpgSql›), Basket checks Redis (‹AddRedis›), and Payment checks only the process. ‹docker-compose.yml› defines health checks for the infrastructure containers and starts the APIs only after ‹postgres›, ‹redis› and ‹rabbitmq› are healthy. The simulator's HTTP traces deliberately skip ‹/health› calls.
`,
  },

  // ------------------------------------------------------------------ altyapı
  {
    id: 'sidecar',
    cat: 'infra',
    title: L('Sidecar (Yan Araç)', 'Sidecar'),
    aka: ['sidecar', 'yan araç', 'service mesh', 'istio', 'linkerd', 'envoy', 'dapr', 'ambassador'],
    related: ['service-discovery', 'api-gateway', 'circuit-breaker', 'distributed-tracing'],
    tr: `
Sidecar, ana uygulama konteynerinin **yanında, aynı yaşam döngüsüyle çalışan** yardımcı bir konteynerdir. Uygulamanın koduna dokunmadan ona ağ, güvenlik, gözlemlenebilirlik gibi yetenekler kazandırır. Adını motosiklet yan sepetinden alır.

## Hangi işler sidecar'a verilir?
- **Ağ proxy'si:** bütün giriş/çıkış trafiği sidecar'dan geçer; retry, timeout, circuit breaker, yük dengeleme orada yapılır.
- **Karşılıklı TLS (mTLS):** servisler arası trafik otomatik şifrelenir ve kimlik doğrulanır.
- **Gözlemlenebilirlik:** metrik ve trace'ler proxy seviyesinde otomatik üretilir.
- **Log gönderimi, yapılandırma yenileme, sertifika rotasyonu** gibi altyapı işleri.

## Service mesh
Her servisin yanına bir proxy sidecar'ı (genellikle Envoy) konup bunlar merkezi bir kontrol düzleminden yönetilince **service mesh** oluşur (Istio, Linkerd). Dayanıklılık ve güvenlik politikaları koddan çıkıp yapılandırmaya taşınır. Dapr ise benzer şekilde sidecar olarak durum yönetimi, pub/sub ve servis çağrısı gibi yapı taşları sunar.

## Faydaları
- **Dil bağımsızlığı:** .NET, Go ve Node servisleri aynı retry/mTLS davranışını aynı sidecar'dan alır; her dil için kütüphane yazılmaz.
- Altyapı ekibi, uygulama ekiplerine dokunmadan politikaları değiştirebilir.

## Bedeli
- Her istek iki proxy'den daha geçer; gecikme ve CPU/bellek maliyeti artar.
- Operasyonel karmaşıklık: kontrol düzlemi, sertifikalar, sürüm yükseltmeleri.
- Hata ayıklama zorlaşır: sorun uygulamada mı, proxy'de mi? Son yıllarda bu maliyet yüzünden sidecar'sız mesh modelleri de (Istio ambient, eBPF tabanlı çözümler) yaygınlaşmaktadır.

> Bu projede sidecar yoktur. Retry ve gözlemlenebilirlik gibi işler ortak bir kütüphanede (‹Shared.Infrastructure›) çözülmüştür. Bu, tek dilli (yalnızca .NET) küçük bir sistem için daha basit bir seçimdir. Farklı dillerde servisler eklenirse ya da mTLS gerekirse aynı işleri bir service mesh'e taşımak mantıklı hale gelir.
`,
    en: `
A sidecar is a helper container that runs **next to the main application container, with the same lifecycle**. It gives the application capabilities such as networking, security and observability without touching its code. It is named after a motorcycle's sidecar.

## What gets handed to a sidecar?
- **A network proxy:** all inbound/outbound traffic goes through the sidecar, which handles retries, timeouts, circuit breaking and load balancing.
- **Mutual TLS (mTLS):** service-to-service traffic is encrypted and authenticated automatically.
- **Observability:** metrics and traces are produced automatically at the proxy level.
- **Infrastructure chores** such as shipping logs, reloading configuration and rotating certificates.

## Service mesh
When every service gets a proxy sidecar (usually Envoy) and all of them are managed from a central control plane, you have a **service mesh** (Istio, Linkerd). Resilience and security policies move out of code and into configuration. Dapr likewise runs as a sidecar and offers building blocks such as state management, pub/sub and service invocation.

## Benefits
- **Language independence:** .NET, Go and Node services all get the same retry/mTLS behavior from the same sidecar; no library has to be written per language.
- The platform team can change policies without touching application teams' code.

## The cost
- Every request passes through two more proxies; latency and CPU/memory cost go up.
- Operational complexity: the control plane, certificates, upgrades.
- Debugging gets harder: is the problem in the app or the proxy? Because of this cost, sidecar-less mesh models (Istio ambient, eBPF-based solutions) have become popular in recent years.

> This project has no sidecar. Concerns such as retries and observability are handled in a shared library (‹Shared.Infrastructure›), which is the simpler choice for a small, single-language (.NET only) system. If services in other languages were added, or mTLS became necessary, moving the same concerns into a service mesh would start to make sense.
`,
  },
];
