// "Kavramlar" penceresi: solda arama + liste, sağda seçili kavramın sayfası.
import { CONCEPTS, CATEGORIES } from './concepts.js';
import { t, tx, getLang } from './i18n.js';
import { escapeHtml } from './codeview.js';

const BY_ID = new Map(CONCEPTS.map(c => [c.id, c]));

export class ConceptBrowser {
  constructor(root) {
    this.root = root;
    this.selectedId = CONCEPTS[0].id;
    this.query = '';
    root.innerHTML = `
      <aside class="cpt-side">
        <input type="search" class="cpt-search" autocomplete="off" spellcheck="false">
        <p class="cpt-count hint"></p>
        <nav class="cpt-list"></nav>
      </aside>
      <article class="cpt-article" tabindex="-1"></article>`;
    this.search = root.querySelector('.cpt-search');
    this.list = root.querySelector('.cpt-list');
    this.article = root.querySelector('.cpt-article');
    this.count = root.querySelector('.cpt-count');

    this.search.addEventListener('input', () => { this.query = this.search.value; this.renderList(); });
    this.search.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        const first = this.list.querySelector('button');
        if (e.key === 'Enter' && first) this.select(first.dataset.id);
        else first?.focus();
      }
    });
    this.list.addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const buttons = [...this.list.querySelectorAll('button')];
      const i = buttons.indexOf(document.activeElement);
      const next = buttons[i + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) next.focus(); else if (e.key === 'ArrowUp') this.search.focus();
    });
    this.render();
  }

  render() {
    this.search.placeholder = t('cpt.search');
    this.search.setAttribute('aria-label', t('cpt.searchAria'));
    this.renderList();
    this.renderArticle();
  }

  focusSearch() {
    this.search.focus();
    this.search.select();
  }

  select(id, { focusArticle = false } = {}) {
    if (!BY_ID.has(id)) return;
    this.selectedId = id;
    this.list.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(b.dataset.id === id)));
    this.renderArticle();
    this.article.scrollTop = 0;
    if (focusArticle) this.article.focus({ preventScroll: true });
  }

  renderList() {
    const terms = normalize(this.query).split(/\s+/).filter(Boolean);
    const matches = CONCEPTS
      .map(c => ({ c, score: score(c, terms) }))
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score || tx(a.c.title).localeCompare(tx(b.c.title), getLang()));

    this.count.textContent = matches.length ? t('cpt.count', { n: matches.length }) : t('cpt.none');

    let html = '';
    if (terms.length) {
      html = matches.map(({ c }) => this.itemHtml(c, true)).join('');
    } else {
      for (const [cat, label] of Object.entries(CATEGORIES)) {
        const items = matches.filter(m => m.c.cat === cat).map(m => m.c);
        if (!items.length) continue;
        html += `<h3>${escapeHtml(tx(label))}</h3>${items.map(c => this.itemHtml(c, false)).join('')}`;
      }
    }
    this.list.innerHTML = html;
    this.list.querySelectorAll('button').forEach(b => b.addEventListener('click', () => this.select(b.dataset.id, { focusArticle: true })));
  }

  itemHtml(c, showCategory) {
    const current = c.id === this.selectedId;
    return `<button type="button" data-id="${c.id}" aria-current="${current}">
      <span>${escapeHtml(tx(c.title))}</span>${showCategory ? `<small>${escapeHtml(tx(CATEGORIES[c.cat]))}</small>` : ''}
    </button>`;
  }

  renderArticle() {
    const c = BY_ID.get(this.selectedId);
    const related = (c.related ?? []).map(id => BY_ID.get(id)).filter(Boolean);
    this.article.innerHTML = `
      <span class="chip">${escapeHtml(tx(CATEGORIES[c.cat]))}</span>
      <h2>${escapeHtml(tx(c.title))}</h2>
      ${renderBody(c[getLang()] ?? c.en)}
      ${related.length ? `<h3>${escapeHtml(t('cpt.related'))}</h3>
        <div class="cpt-related">${related.map(r => `<button type="button" class="btn small" data-id="${r.id}">${escapeHtml(tx(r.title))}</button>`).join('')}</div>` : ''}`;
    this.article.querySelectorAll('.cpt-related button').forEach(b => b.addEventListener('click', () => this.select(b.dataset.id)));
  }
}

// ------------------------------------------------------------------ arama

function normalize(s) {
  return String(s ?? '')
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const haystacks = new Map();
function haystack(c) {
  if (!haystacks.has(c.id)) {
    haystacks.set(c.id, {
      title: normalize(`${c.title.tr} ${c.title.en} ${(c.aka ?? []).join(' ')}`),
      body: normalize(`${c.tr} ${c.en}`),
    });
  }
  return haystacks.get(c.id);
}

/** 0 = eşleşmedi. Başlık/takma ad eşleşmesi gövde eşleşmesinden önce gelir. */
function score(c, terms) {
  if (!terms.length) return 1;
  const h = haystack(c);
  let total = 0;
  for (const term of terms) {
    if (h.title.includes(term)) total += 10;
    else if (h.body.includes(term)) total += 1;
    else return 0;
  }
  return total;
}

// ------------------------------------------------------------------ gövde

function inline(text) {
  return escapeHtml(text)
    .replace(/‹([^›]+)›/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function renderBody(src) {
  const out = [];
  let list = null;
  let listTag = null;
  const closeList = () => { if (list) { out.push(`<${listTag}>${list.join('')}</${listTag}>`); list = null; } };

  for (const raw of src.trim().split('\n')) {
    const line = raw.trim();
    const bullet = line.match(/^- (.*)$/);
    const numbered = line.match(/^\d+\. (.*)$/);
    if (bullet || numbered) {
      const tag = bullet ? 'ul' : 'ol';
      if (list && listTag !== tag) closeList();
      if (!list) { list = []; listTag = tag; }
      list.push(`<li>${inline((bullet ?? numbered)[1])}</li>`);
      continue;
    }
    closeList();
    if (!line) continue;
    if (line.startsWith('## ')) out.push(`<h3>${inline(line.slice(3))}</h3>`);
    else if (line.startsWith('> ')) out.push(`<aside class="cpt-repo"><strong>${escapeHtml(t('cpt.inRepo'))}</strong><p>${inline(line.slice(2))}</p></aside>`);
    else out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('');
}
