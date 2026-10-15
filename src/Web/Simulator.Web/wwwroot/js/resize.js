// Masaüstünde panelleri sürükleyerek boyutlandırma.
// - Dikey tutamaç: sol sütunun ("Ne oluyor?" + Akış) genişliği (--left-w).
// - Yatay tutamaç: sol sütunda "Ne oluyor?" ile Akış arasındaki oran (--detail-frac).
// Mobilde (≤ 900px) tutamaçlar gizlidir ve değerler kullanılmaz. Seçim tarayıcıda hatırlanır;
// çift tık varsayılana döndürür. Klavyede ok tuşlarıyla da ayarlanabilir.

const STORAGE_KEY = 'sim.layout';
const DESKTOP = window.matchMedia('(min-width: 901px)');
const LEFT_MIN = 300;
const CENTER_MIN = 480;
const FRAC_MIN = 0.2;
const FRAC_MAX = 0.8;

const layout = () => document.querySelector('.layout');
const leftCol = () => document.querySelector('.col-left');

let saved = load();

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {}; } catch { return {}; }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch { /* önemsiz */ }
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const leftMax = () => Math.max(LEFT_MIN, layout().clientWidth - CENTER_MIN);

function applyLeftWidth(px) {
  if (px == null) {
    layout().style.removeProperty('--left-w');
    return;
  }
  layout().style.setProperty('--left-w', `${Math.round(clamp(px, LEFT_MIN, leftMax()))}px`);
}

function applyDetailFrac(frac) {
  if (frac == null) leftCol().style.removeProperty('--detail-frac');
  else leftCol().style.setProperty('--detail-frac', String(clamp(frac, FRAC_MIN, FRAC_MAX)));
}

function currentLeftWidth() {
  return leftCol().getBoundingClientRect().width;
}

function currentDetailFrac() {
  const detail = document.querySelector('#detail').getBoundingClientRect().height;
  const flow = document.querySelector('.timeline-card').getBoundingClientRect().height;
  return detail / (detail + flow);
}

/** Bir tutamacı sürükleme, klavye ve çift tıkla bağlar. */
function bindSplitter(el, { axis, onMove, onKey, onReset }) {
  el.addEventListener('pointerdown', e => {
    if (!DESKTOP.matches || e.button !== 0) return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    document.body.classList.add('resizing', `resizing-${axis}`);
    const start = { x: e.clientX, y: e.clientY };
    const ctx = onMove.begin();

    const move = ev => onMove.update(ctx, ev.clientX - start.x, ev.clientY - start.y);
    const end = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', end);
      el.removeEventListener('pointercancel', end);
      el.classList.remove('dragging');
      document.body.classList.remove('resizing', `resizing-${axis}`);
      save();
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  });

  el.addEventListener('keydown', e => {
    const step = e.shiftKey ? 4 : 1;
    const dir = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    onKey(dir * step);
    save();
  });

  el.addEventListener('dblclick', () => {
    onReset();
    save();
  });
}

export function setupResizers() {
  const vertical = document.querySelector('.splitter-v');
  const horizontal = document.querySelector('.splitter-h');

  bindSplitter(vertical, {
    axis: 'x',
    onMove: {
      begin: () => ({ width: currentLeftWidth() }),
      update: (ctx, dx) => {
        saved.leftWidth = Math.round(clamp(ctx.width + dx, LEFT_MIN, leftMax()));
        applyLeftWidth(saved.leftWidth);
      },
    },
    onKey: delta => {
      saved.leftWidth = Math.round(clamp(currentLeftWidth() + delta * 16, LEFT_MIN, leftMax()));
      applyLeftWidth(saved.leftWidth);
    },
    onReset: () => {
      delete saved.leftWidth;
      applyLeftWidth(null);
    },
  });

  bindSplitter(horizontal, {
    axis: 'y',
    onMove: {
      begin: () => {
        const col = leftCol().getBoundingClientRect().height - horizontal.getBoundingClientRect().height;
        return { frac: currentDetailFrac(), total: col };
      },
      update: (ctx, dx, dy) => {
        saved.detailFrac = Number(clamp(ctx.frac + dy / ctx.total, FRAC_MIN, FRAC_MAX).toFixed(3));
        applyDetailFrac(saved.detailFrac);
      },
    },
    onKey: delta => {
      saved.detailFrac = Number(clamp(currentDetailFrac() + delta * 0.03, FRAC_MIN, FRAC_MAX).toFixed(3));
      applyDetailFrac(saved.detailFrac);
    },
    onReset: () => {
      delete saved.detailFrac;
      applyDetailFrac(null);
    },
  });

  applyLeftWidth(saved.leftWidth);
  applyDetailFrac(saved.detailFrac);

  // Pencere daralınca sağ sütun asgari genişliğin altına düşmesin.
  window.addEventListener('resize', () => {
    if (DESKTOP.matches && saved.leftWidth != null) applyLeftWidth(saved.leftWidth);
  });
}
