// Mimari diyagramı (SVG) ve üzerinde akan "paket" animasyonları.
import { SERVICES } from './knowledge.js';

const NS = 'http://www.w3.org/2000/svg';

// viewBox 1000 x 560 içinde düğüm yerleşimi.
const NODES = {
  browser: { x: 140, y: 70, w: 180, h: 58, kind: 'client' },
  gateway: { x: 500, y: 70, w: 200, h: 58, kind: 'gateway' },
  catalog: { x: 165, y: 230, w: 186, h: 66, kind: 'service' },
  basket: { x: 390, y: 230, w: 186, h: 66, kind: 'service' },
  order: { x: 615, y: 230, w: 186, h: 66, kind: 'service' },
  payment: { x: 840, y: 230, w: 186, h: 66, kind: 'service' },
  catalogdb: { x: 200, y: 352, w: 104, h: 50, kind: 'db' },
  redis: { x: 425, y: 352, w: 104, h: 50, kind: 'db' },
  orderdb: { x: 650, y: 352, w: 104, h: 50, kind: 'db' },
  rabbit: { x: 500, y: 492, w: 900, h: 46, kind: 'bus' },
};

const DB_OF = { catalog: 'catalogdb', basket: 'redis', order: 'orderdb' };
const BUS_Y = NODES.rabbit.y;
const BUS_LANE_OFFSET = -62; // servis kutusunun sol tarafından otobüse inen hat

const COLORS = {
  action: 'var(--c-http)',
  http: 'var(--c-http)',
  'http-response': 'var(--c-http)',
  publish: 'var(--c-msg)',
  consume: 'var(--c-msg)',
  db: 'var(--c-db)',
  saga: 'var(--c-saga)',
  step: 'var(--c-muted)',
  error: 'var(--c-error)',
};

export class Diagram {
  constructor(svg, { onNodeClick }) {
    this.svg = svg;
    this.onNodeClick = onNodeClick;
    this.nodeEls = {};
    this.lastPublisher = new Map(); // messageType|orderId -> servis
    this.build();
  }

  build() {
    const svg = this.svg;
    svg.setAttribute('viewBox', '0 0 1000 560');
    svg.innerHTML = '';

    const defs = el('defs');
    defs.innerHTML = `
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>`;
    svg.append(defs);

    const links = el('g', { class: 'links' });
    const line = (a, b, cls = '') => links.append(el('path', { d: `M${a[0]},${a[1]} L${b[0]},${b[1]}`, class: `link ${cls}` }));

    line(right(NODES.browser), left(NODES.gateway), 'link-http');
    for (const s of ['catalog', 'basket', 'order', 'payment']) {
      line(bottom(NODES.gateway), top(NODES[s]), 'link-http');
      line(busPoint(s, 'service'), busPoint(s, 'bus'), 'link-msg');
      if (DB_OF[s]) line(dbAnchor(s), top(NODES[DB_OF[s]]), 'link-db');
    }
    svg.append(links);

    const nodes = el('g', { class: 'nodes' });
    for (const [id, n] of Object.entries(NODES)) nodes.append(this.buildNode(id, n));
    svg.append(nodes);

    this.packets = el('g', { class: 'packets' });
    svg.append(this.packets);
  }

  buildNode(id, n) {
    const info = SERVICES[id];
    const g = el('g', { class: `node node-${n.kind}`, 'data-id': id, tabindex: 0, role: 'button' });
    g.setAttribute('aria-label', `${info.name} hakkında`);
    const x = n.x - n.w / 2, y = n.y - n.h / 2;

    if (n.kind === 'db') {
      const ry = 8;
      g.append(el('path', {
        class: 'shape',
        d: `M${x},${y + ry} a${n.w / 2},${ry} 0 0,1 ${n.w},0 v${n.h - ry * 2} a${n.w / 2},${ry} 0 0,1 ${-n.w},0 Z`,
      }));
      g.append(el('path', { class: 'shape-line', d: `M${x},${y + ry} a${n.w / 2},${ry} 0 0,0 ${n.w},0` }));
    } else {
      g.append(el('rect', { class: 'shape', x, y, width: n.w, height: n.h, rx: n.kind === 'bus' ? 23 : 12 }));
    }

    const title = el('text', { class: 'node-title', x: n.x, y: n.y - (n.kind === 'db' ? 0 : 4) });
    title.textContent = info.name;
    g.append(title);
    const sub = el('text', { class: 'node-sub', x: n.x, y: n.y + (n.kind === 'db' ? 15 : 17) });
    sub.textContent = info.sub;
    g.append(sub);

    if (n.kind === 'service' || n.kind === 'gateway') {
      const badge = el('text', { class: 'node-badge', x: n.x, y: y - 8 });
      g.append(badge);
    }

    g.addEventListener('click', () => this.onNodeClick(id));
    g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onNodeClick(id); } });
    this.nodeEls[id] = g;
    return g;
  }

  /** Bir iz olayını yol parçalarına çevirir. */
  routeFor(event) {
    const s = event.service;
    switch (event.kind) {
      case 'action': return [[right(NODES.browser), left(NODES.gateway)]];
      case 'http': return NODES[s] ? [[bottom(NODES.gateway), top(NODES[s])]] : [];
      case 'http-response': return NODES[s] ? [[top(NODES[s]), bottom(NODES.gateway)], [left(NODES.gateway), right(NODES.browser)]] : [];
      case 'publish': {
        this.lastPublisher.set(key(event), s);
        return NODES[s] ? [[busPoint(s, 'service'), busPoint(s, 'bus')]] : [];
      }
      case 'consume': {
        const from = this.lastPublisher.get(key(event));
        const start = from ? busPoint(from, 'bus') : [NODES.rabbit.x, BUS_Y];
        return NODES[s] ? [[start, busPoint(s, 'bus')], [busPoint(s, 'bus'), busPoint(s, 'service')]] : [];
      }
      case 'db':
        return DB_OF[s] ? [[dbAnchor(s), top(NODES[DB_OF[s]])]] : [];
      case 'saga':
        return [[dbAnchor('order'), top(NODES.orderdb)]];
      default:
        return [];
    }
  }

  /** Olayı canlandırır; süre (ms) hız ayarına göre ölçeklenir. */
  async play(event, { duration }) {
    const segments = this.routeFor(event);
    const color = COLORS[event.kind] ?? 'var(--c-muted)';
    const label = event.messageType || (event.kind === 'saga' ? event.toState : '');

    this.flash(event.service === 'browser' ? 'browser' : event.service, event.kind);
    if (event.kind === 'db' || event.kind === 'saga') this.flash(DB_OF[event.service] ?? 'orderdb', event.kind);
    if (event.kind === 'publish' || event.kind === 'consume') this.flash('rabbit', event.kind);
    this.badge(event);

    if (!segments.length || duration <= 0) {
      if (duration > 0) await wait(duration * 0.6);
      return;
    }

    const packet = el('g', { class: `packet packet-${event.kind}` });
    packet.append(el('circle', { r: 8, fill: color, filter: 'url(#glow)' }));
    if (label) {
      const t = el('text', { class: 'packet-label', y: -14 });
      t.textContent = label;
      packet.append(t);
    }
    this.packets.append(packet);

    const per = duration / segments.length;
    for (const [a, b] of segments) await animate(packet, a, b, per);
    packet.classList.add('fade');
    setTimeout(() => packet.remove(), 260);
  }

  flash(id, kind) {
    const g = this.nodeEls[id];
    if (!g) return;
    g.classList.remove('flash', 'flash-error', 'flash-saga');
    void g.getBBox(); // animasyonu yeniden başlat
    g.classList.add(kind === 'error' ? 'flash-error' : kind === 'saga' ? 'flash-saga' : 'flash');
  }

  badge(event) {
    const g = this.nodeEls[event.service];
    const badge = g?.querySelector('.node-badge');
    if (!badge) return;
    const text = event.kind === 'saga' ? `◆ ${event.toState}` : event.kind === 'error' ? `✕ ${event.title}` : event.title;
    badge.textContent = text.length > 30 ? text.slice(0, 29) + '…' : text;
    badge.classList.remove('show');
    void badge.getBBox();
    badge.classList.add('show');
  }
}

function key(event) { return `${event.messageType}|${event.orderId ?? ''}`; }

function top(n) { return [n.x, n.y - n.h / 2]; }
function bottom(n) { return [n.x, n.y + n.h / 2]; }
function left(n) { return [n.x - n.w / 2, n.y]; }
function right(n) { return [n.x + n.w / 2, n.y]; }
function dbAnchor(s) { const n = NODES[s]; return [NODES[DB_OF[s]].x, n.y + n.h / 2]; }
function busPoint(s, end) {
  const n = NODES[s];
  const x = n.x + BUS_LANE_OFFSET;
  return end === 'service' ? [x, n.y + n.h / 2] : [x, BUS_Y - NODES.rabbit.h / 2];
}

function el(name, attrs = {}) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

function animate(node, [x1, y1], [x2, y2], ms) {
  return new Promise(resolve => {
    const start = performance.now();
    const step = now => {
      const t = Math.min(1, (now - start) / ms);
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      node.setAttribute('transform', `translate(${x1 + (x2 - x1) * e},${y1 + (y2 - y1) * e})`);
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

export function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
