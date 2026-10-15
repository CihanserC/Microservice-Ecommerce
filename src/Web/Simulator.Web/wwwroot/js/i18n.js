// Arayüz dili (tr/en). Dil değişince sayfa yenilenmez: statik metinler data-i18n ile,
// dinamik bölümler onLangChange aboneleriyle yeniden çizilir.

const STORAGE_KEY = 'sim.lang';
const SUPPORTED = ['tr', 'en'];
const listeners = new Set();

let lang = readStoredLang();

function readStoredLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (SUPPORTED.includes(saved)) return saved;
  } catch { /* depolama kapalı olabilir */ }
  return navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

export const getLang = () => lang;

export function setLang(next) {
  if (!SUPPORTED.includes(next) || next === lang) return;
  lang = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* önemsiz */ }
  applyStatic();
  listeners.forEach(fn => fn(lang));
}

export function onLangChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** {tr, en} nesnesinden aktif dili seçer; düz metni olduğu gibi döner. */
export function tx(value) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value[lang] ?? value.en ?? value.tr ?? '';
}

function fill(text, vars) {
  return vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;
}

/** Sözlükten metin; {name} yer tutucuları vars ile doldurulur. */
export function t(key, vars) {
  const entry = STRINGS[key];
  return fill(entry ? tx(entry) : key, vars);
}

/** Aynı metnin iki dildeki hali; dil sonradan değişebilecek kayıtlar (ör. yerel izler) için. */
export function tBoth(key, vars) {
  const entry = STRINGS[key] ?? { tr: key, en: key };
  return { tr: fill(entry.tr, vars), en: fill(entry.en, vars) };
}

export function money(value) {
  return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: 'TRY' }).format(value);
}

/** data-i18n, data-i18n-title, data-i18n-aria ve data-i18n-placeholder taşıyan öğeleri günceller. */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  root.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria)));
  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  root.querySelectorAll('[data-lang]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.lang === lang)));
  document.title = t('app.title');
}

/**
 * Servislerin ürettiği iş hatası sebepleri (Payment, Catalog) Türkçe saklanır; sipariş kaydında
 * ve mesajlarda tek dil vardır. İngilizce arayüz bilinen kalıpları burada çevirir.
 */
const REASON_PATTERNS = [
  [/Kart limiti yetersiz: tutar ([\d.,]+) ₺, limit ([\d.,]+) ₺\./g, 'Card limit exceeded: amount $1 ₺, limit $2 ₺.'],
  [/Banka ödemeyi reddetti \(simülasyon: her zaman başarısız\)\./g, 'The bank declined the payment (simulation: always fail).'],
  [/Stok yetersiz(?: —|:) /g, 'Insufficient stock: '],
  [/: istenen (\d+), stokta (\d+)/g, ': requested $1, in stock $2'],
  [/: katalogda yok/g, ': not in catalog'],
  [/Ödeme başarısız\./g, 'Payment failed.'],
];

export function localizeReason(text) {
  if (!text || lang === 'tr') return text ?? '';
  return REASON_PATTERNS.reduce((s, [re, rep]) => s.replace(re, rep), text);
}

const L = (tr, en) => ({ tr, en });

const STRINGS = {
  'app.title': L('Mikroservis Laboratuvarı', 'Microservices Lab'),
  'app.tagline': L('Bir butona bas, isteğin servisler arasında nasıl aktığını ve hangi kodun çalıştığını izle.',
    'Press a button and watch how the request flows between services and which code runs.'),

  'ctl.toolbar': L('Oynatma kontrolleri', 'Playback controls'),
  'ctl.mode': L('Oynatma modu', 'Playback mode'),
  'ctl.auto': L('Otomatik', 'Auto'),
  'ctl.step': L('Adım adım', 'Step by step'),
  'ctl.next': L('Sonraki adım', 'Next step'),
  'ctl.nextTitle': L('Sıradaki izi oynat (→ tuşu)', 'Play the next trace (→ key)'),
  'ctl.speed': L('Hız', 'Speed'),
  'ctl.pause': L('Durdur (Boşluk tuşu)', 'Pause (Space key)'),
  'ctl.resume': L('Devam et (Boşluk tuşu)', 'Resume (Space key)'),
  'layout.resizeCols': L('Sürükleyerek sütun genişliğini ayarla (çift tık: varsayılan)', 'Drag to resize the columns (double-click: default)'),
  'layout.resizeRows': L('Sürükleyerek panel yüksekliğini ayarla (çift tık: varsayılan)', 'Drag to resize the panels (double-click: default)'),
  'ctl.instant': L('Anında', 'Instant'),
  'ctl.clear': L('Temizle', 'Clear'),
  'ctl.concepts': L('Kavramlar', 'Concepts'),
  'ctl.language': L('Dil', 'Language'),

  'conn.connecting': L('Bağlanıyor…', 'Connecting…'),
  'conn.open': L('Canlı', 'Live'),
  'conn.error': L('Bağlantı yok, yeniden deneniyor', 'Disconnected, retrying'),

  'scn.title': L('Senaryolar', 'Scenarios'),
  'scn.hint': L('Tek tıkla sepeti doldurur, ödeme ayarını seçer ve checkout yapar.',
    'One click fills the basket, picks the payment behavior and checks out.'),
  'scn.happy': L('Mutlu yol', 'Happy path'),
  'scn.happyDesc': L('Stok var, ödeme onaylanır → <b>Completed</b>', 'Stock available, payment approved → <b>Completed</b>'),
  'scn.stock': L('Stok yetersiz', 'Out of stock'),
  'scn.stockDesc': L('Catalog reddeder, geri alınacak bir şey yok → <b>Cancelled</b>',
    'Catalog rejects it, nothing to undo → <b>Cancelled</b>'),
  'scn.payment': L('Ödeme reddi + telafi', 'Payment declined + compensation'),
  'scn.paymentDesc': L('Stok düşer, ödeme reddedilir, stok geri gelir → <b>Cancelled</b>',
    'Stock is deducted, payment is declined, stock comes back → <b>Cancelled</b>'),

  'cat.title': L('Katalog', 'Catalog'),
  'cat.loading': L('Yükleniyor…', 'Loading…'),
  'cat.empty': L('Katalog boş.', 'The catalog is empty.'),
  'cat.stock': L('stok', 'stock'),
  'cat.stockAria': L('{name} stok', '{name} stock'),
  'cat.add': L('Sepete ekle', 'Add to basket'),

  'bsk.title': L('Sepet', 'Basket'),
  'bsk.user': L('Kullanıcı', 'User'),
  'bsk.empty': L('Sepet boş. Katalogdan ürün ekle.', 'The basket is empty. Add a product from the catalog.'),
  'bsk.total': L('Toplam', 'Total'),
  'bsk.remove': L('{name} kaldır', 'Remove {name}'),
  'bsk.checkout': L('Checkout', 'Checkout'),
  'bsk.clear': L('Boşalt', 'Empty'),

  'pay.title': L('Ödeme servisi', 'Payment service'),
  'pay.behavior': L('Davranış', 'Behavior'),
  'pay.FailAboveLimit': L('Limit üstünü reddet', 'Decline above limit'),
  'pay.AlwaysSucceed': L('Her zaman onayla', 'Always approve'),
  'pay.AlwaysFail': L('Her zaman reddet', 'Always decline'),
  'pay.limit': L('Kart limiti (₺)', 'Card limit (₺)'),
  'pay.delay': L('Banka gecikmesi', 'Bank delay'),
  'pay.apply': L('Uygula', 'Apply'),

  'demo.text': L('Demo modu: servisler tarayıcında simüle ediliyor; akış, saga ve gösterilen kod gerçek sistemle aynı.',
    'Demo mode: the services are simulated in your browser; the flow, the saga and the code shown match the real system.'),
  'demo.run': L('Gerçek sistemi çalıştır (Codespaces)', 'Run the real system (Codespaces)'),

  'arch.title': L('Mimari', 'Architecture'),
  'arch.fullscreen': L('Tam ekran', 'Full screen'),
  'arch.exitFullscreen': L('Küçült', 'Exit full screen'),
  'arch.fullscreenTitle': L('Mimari diyagramını tam ekran göster (F tuşu)', 'Show the architecture diagram full screen (F key)'),
  'arch.legend': L('Renk açıklaması', 'Color legend'),
  'arch.http': L('HTTP (senkron)', 'HTTP (synchronous)'),
  'arch.msg': L('Mesaj (asenkron)', 'Message (asynchronous)'),
  'arch.db': L('Veritabanı', 'Database'),
  'arch.saga': L('Saga', 'Saga'),
  'arch.err': L('Hata', 'Error'),
  'arch.aria': L('Servisler, veritabanları ve RabbitMQ diyagramı', 'Diagram of services, databases and RabbitMQ'),
  'arch.hint': L('Bir kutuya tıkla: o parçanın görevi ve ilgili kod dosyaları açılır.',
    'Click a box to see what that part does and its related code files.'),
  'arch.about': L('{name} hakkında', 'About {name}'),

  'saga.noOrder': L('(henüz sipariş yok)', '(no order yet)'),
  'saga.order': L('sipariş #{id}', 'order #{id}'),
  'saga.aria': L('Sipariş saga durum makinesi', 'Order saga state machine'),
  'saga.hint': L('Checkout yaptığında sipariş burada adım adım ilerler.', 'When you check out, the order moves through here step by step.'),
  'saga.reason': L('Sebep: {reason}', 'Reason: {reason}'),

  'ord.title': L('Siparişler', 'Orders'),
  'ord.refresh': L('Yenile', 'Refresh'),
  'ord.order': L('Sipariş', 'Order'),
  'ord.user': L('Kullanıcı', 'User'),
  'ord.amount': L('Tutar', 'Amount'),
  'ord.status': L('Durum', 'Status'),
  'ord.saga': L('Saga', 'Saga'),
  'ord.empty': L('Henüz sipariş yok.', 'No orders yet.'),
  'ord.follow': L('Takip etmek için tıkla', 'Click to follow'),

  'tl.title': L('Akış', 'Flow'),
  'tl.filter': L('Sadece takip edilen sipariş', 'Only the followed order'),
  'tl.empty': L('Henüz iz yok. Bir senaryo çalıştır.', 'No traces yet. Run a scenario.'),

  'det.title': L('Detay', 'Detail'),
  'det.none': L('Henüz bir adım seçilmedi', 'No step selected yet'),
  'det.clear': L('Temizle', 'Clear'),
  'det.toggle': L('Açıklamayı aç/kapat', 'Expand/collapse the explanation'),
  'det.emptyLead': L('Akıştan bir adıma ya da diyagramdan bir kutuya tıkla; açıklaması ve kodu burada açılır.',
    'Click a step in the flow or a box in the diagram; its explanation and code open here.'),
  'det.emptyStep': L('“Adım adım” modunda her adım sırayla burada anlatılır. “Sonraki adım” ya da → tuşu ile ilerle.',
    'In “Step by step” mode every step is explained here in order. Move on with “Next step” or the → key.'),

  'drw.open': L('Mağaza ve ayarlar', 'Store & settings'),
  'drw.openTitle': L('Katalog, sepet ve ödeme ayarlarını aç', 'Open catalog, basket and payment settings'),
  'drw.title': L('Mağaza ve ayarlar', 'Store & settings'),
  'drw.checkoutHint': L('Checkout sonrası çekmece kapanır, akışı izleyebilirsin.', 'After checkout the drawer closes so you can watch the flow.'),
  'det.close': L('Kapat', 'Close'),
  'det.closeAria': L('Açıklamayı temizle', 'Clear the explanation'),
  'det.order': L('sipariş #{id}', 'order #{id}'),
  'det.traceTitle': L('OpenTelemetry trace kimliği', 'OpenTelemetry trace id'),
  'det.what': L('Ne oluyor?', 'What is happening?'),
  'det.message': L('Mesaj gövdesi', 'Message body'),
  'det.data': L('Veri', 'Data'),
  'det.follow': L('Bu siparişi takip et', 'Follow this order'),
  'det.code': L('Kod', 'Code'),
  'det.relatedCode': L('İlgili kod', 'Related code'),
  'det.traceLine': L('İzi üreten satır', 'Line that emitted the trace'),

  'code.loading': L('Kod yükleniyor…', 'Loading code…'),
  'code.failed': L('Kaynak okunamadı:', 'Could not read source:'),
  'code.line': L('satır {n}', 'line {n}'),

  'cpt.title': L('Kavramlar', 'Concepts'),
  'cpt.search': L('Kavram ara…', 'Search concepts…'),
  'cpt.searchAria': L('Kavramlarda ara', 'Search concepts'),
  'cpt.none': L('Eşleşen kavram yok.', 'No matching concept.'),
  'cpt.count': L('{n} kavram', '{n} concepts'),
  'cpt.related': L('İlgili kavramlar', 'Related concepts'),
  'cpt.inRepo': L('Bu projede', 'In this project'),

  'act.add': L('Sepete ekle: {name}', 'Add to basket: {name}'),
  'act.remove': L('Sepetten ürün çıkar', 'Remove product from basket'),
  'act.checkout': L('Checkout ({user})', 'Checkout ({user})'),
  'act.empty': L('Sepeti boşalt', 'Empty the basket'),
  'act.stock': L('Stok güncelle: {name} → {stock}', 'Update stock: {name} → {stock}'),
  'act.payment': L('Ödeme ayarı: {mode}', 'Payment setting: {mode}'),
  'act.scenario': L('Senaryo: {qty} × {name} sepete', 'Scenario: {qty} × {name} into the basket'),

  'toast.requestFailed': L('İstek başarısız.', 'Request failed.'),
  'toast.checkout': L('202 Accepted: checkout başladı. Sipariş arka planda oluşuyor, saga\'yı izle.',
    '202 Accepted: checkout started. The order is being created in the background; watch the saga.'),
  'toast.stockInvalid': L('Stok 0 veya daha büyük bir tam sayı olmalı.', 'Stock must be a whole number of 0 or more.'),
  'toast.noProducts': L('Katalogda ürün yok.', 'There are no products in the catalog.'),
  'toast.noHappy': L('Stokta olan ve limit altında kalan bir ürün yok. Stok ekle.',
    'No product is in stock and under the limit. Add stock.'),
  'toast.noStock': L('Stokta ürün yok. Önce stok ekle.', 'Nothing is in stock. Add stock first.'),
  'toast.stepMode': L('Adım adım mod: her izi "Sonraki adım" (veya → tuşu) ile oynat. Detay paneli o adımın kodunu gösterir.',
    'Step mode: play each trace with "Next step" (or the → key). The detail panel shows that step\'s code.'),
  'toast.unreachable': L('Bazı servislere ulaşılamadı ({n}). Servisler ayağa kalkıyor olabilir; birkaç saniye sonra sayfayı yenile.',
    'Some services could not be reached ({n}). They may still be starting; reload the page in a few seconds.'),
};
