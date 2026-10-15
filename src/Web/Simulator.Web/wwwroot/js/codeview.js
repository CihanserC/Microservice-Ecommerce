// Kaynak kod görüntüleyici: dosyayı /sim/source'tan alır, renklendirir, ilgili satırı işaretler.
import { background } from './api.js';

const cache = new Map();

const KEYWORDS = new Set(('abstract as async await base bool break case catch class const continue decimal default do double else enum ' +
  'false finally for foreach if in init int interface internal is lock long namespace new null object out override params ' +
  'partial private protected public readonly record required return sealed static string switch this throw true try typeof ' +
  'uint using var void volatile when where while with yield get set').split(' '));

const TOKEN = /(\/\/.*$)|(\$?@?"(?:[^"\\]|\\.)*")|('(?:[^'\\]|\\.)')|\b(\d+(?:\.\d+)?[mMuUlL]?)\b|\b([A-Za-z_][A-Za-z0-9_]*)\b/g;

async function load(path) {
  if (!cache.has(path)) {
    cache.set(path, background(`/sim/source?path=${encodeURIComponent(path)}`, { raw: true })
      .catch(err => { cache.delete(path); throw err; }));
  }
  return cache.get(path);
}

/**
 * refs: [{ label, path, line?, find? }] — birden fazlaysa sekme olarak gösterilir.
 */
export async function renderCode(container, refs) {
  container.innerHTML = '';
  if (!refs?.length) return;

  const tabs = document.createElement('div');
  tabs.className = 'code-tabs';
  tabs.setAttribute('role', 'tablist');
  const body = document.createElement('div');
  body.className = 'code-body';
  container.append(tabs, body);

  const show = async (ref, button) => {
    tabs.querySelectorAll('button').forEach(b => b.setAttribute('aria-selected', String(b === button)));
    body.innerHTML = '<div class="code-loading">Kod yükleniyor…</div>';
    try {
      const text = await load(ref.path);
      renderFile(body, ref, text);
    } catch {
      body.innerHTML = `<div class="code-loading">Kaynak okunamadı: <code>src/${escapeHtml(ref.path)}</code></div>`;
    }
  };

  refs.forEach((ref, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.textContent = ref.label;
    b.title = `src/${ref.path}`;
    b.addEventListener('click', () => show(ref, b));
    tabs.append(b);
    if (i === 0) show(ref, b);
  });
}

function renderFile(body, ref, text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let target = ref.line ?? null;
  if (!target && ref.find) {
    const idx = lines.findIndex(l => l.includes(ref.find));
    if (idx >= 0) target = idx + 1;
  }

  const header = document.createElement('div');
  header.className = 'code-path';
  header.innerHTML = `<span>src/${escapeHtml(ref.path)}</span>${target ? `<span class="code-line-no">satır ${target}</span>` : ''}`;

  const pre = document.createElement('pre');
  pre.className = 'code';
  const html = lines.map((line, i) => {
    const n = i + 1;
    const cls = n === target ? 'ln hit' : 'ln';
    return `<span class="${cls}" data-n="${n}">${highlight(line) || ' '}</span>`;
  }).join('');
  pre.innerHTML = html;

  body.innerHTML = '';
  body.append(header, pre);

  if (target) {
    const hit = pre.querySelector('.hit');
    // Hedef satır görünür alanın üst üçte birine gelsin.
    pre.scrollTop = Math.max(0, hit.offsetTop - pre.clientHeight / 3);
  }
}

function highlight(line) {
  let out = '';
  let last = 0;
  TOKEN.lastIndex = 0;
  for (let m; (m = TOKEN.exec(line));) {
    out += escapeHtml(line.slice(last, m.index));
    const [tok, comment, str, chr, num, word] = m;
    if (comment) out += `<i class="t-com">${escapeHtml(tok)}</i>`;
    else if (str || chr) out += `<i class="t-str">${escapeHtml(tok)}</i>`;
    else if (num) out += `<i class="t-num">${tok}</i>`;
    else if (KEYWORDS.has(word)) out += `<i class="t-kw">${tok}</i>`;
    else if (/^[A-Z]/.test(word)) out += `<i class="t-type">${tok}</i>`;
    else out += tok;
    last = m.index + tok.length;
    if (tok.length === 0) TOKEN.lastIndex++;
  }
  return out + escapeHtml(line.slice(last));
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
