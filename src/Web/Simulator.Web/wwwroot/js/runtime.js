// Sayfanın nerede çalıştığını belirler.
// - Gerçek sistem (docker compose / Codespaces): veriler gateway üzerinden servislerden gelir.
// - Demo (GitHub Pages, ?demo=1 ya da ?demo=static): servisler tarayıcıda simüle edilir
//   (demo-backend.js). GitHub Pages'te (ve ?demo=static ile yerelde) kod görüntüleyici
//   kaynak dosyaları sitenin yanındaki source/ klasöründen okur; yoksa simülatörün /sim/source ucundan.

const params = new URLSearchParams(location.search);
const STATIC_SITE = location.hostname.endsWith('github.io') || params.get('demo') === 'static';

export const DEMO = STATIC_SITE || params.has('demo');

/** Kod görüntüleyicinin bir kaynak dosyayı (src/ altına göre yol) okuyacağı adres. */
export function sourceUrl(path) {
  return STATIC_SITE ? `source/${path}` : `/sim/source?path=${encodeURIComponent(path)}`;
}

export const REPO_URL = 'https://github.com/CihanserC/Microservice-Ecommerce';
export const CODESPACES_URL = 'https://codespaces.new/CihanserC/Microservice-Ecommerce?quickstart=1';
