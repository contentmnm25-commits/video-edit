/* Rachit Gandhi — portfolio. Plain JS, no build step.
   To add or reorder work, edit WORK below. The first item is the large lead card. */

const ROLES = {
  'Mee Mee': 'Assistant Manager — AI Video',
  'Brainvire Infotech': 'Senior AI Video Editor & Motion Graphics Artist',
  'Yash Raj Films (YFX)': 'Compositing Artist',
  'Personal': 'Personal project',
  'Concept': 'Personal concept',
};

const WORK = [
  { slug: 'spiderman-ghar', title: 'Ghar Wapsi', client: 'Personal', year: '2026', category: 'AI Films', runtime: '0:13',
    blurb: 'A superhero landing in an ordinary Mumbai bedroom. Generative video, hand-graded and comped so the light actually belongs to the room.' },
  { slug: 'vfx-reel', title: 'Compositing Reel', client: 'Yash Raj Films (YFX)', year: '2022 — 2024', category: 'Film VFX', runtime: '0:20',
    blurb: 'Keying, CG integration and shot finaling in Nuke across Pathaan, Tiger 3, War 2 and Vijay 69.',
    credit: 'Footage © Yash Raj Films. Shown as a compositing credit.' },
  { slug: 'stroller-studio', title: 'Stroller — Studio Film', client: 'Mee Mee', year: '2026', category: 'Product Films', runtime: '0:04',
    blurb: 'Controlled studio lighting, AI-generated talent and product, matched to brand colour.' },
  { slug: 'walker-with-mum', title: 'Together', client: 'Mee Mee', year: '2026', category: 'Brand Campaigns', runtime: '0:05',
    blurb: 'Mother-and-child lifestyle cut for Instagram and e-commerce listings.' },
  { slug: 'ai-wardrobe', title: 'AI Wardrobe', client: 'Concept', year: '2026', category: 'AI Films', runtime: '0:14',
    blurb: 'Virtual try-on concept — garments assembled onto a subject, cut to a UI beat.' },
  { slug: 'events-reimagined', title: 'Events, Reimagined', client: 'Brainvire Infotech', year: '2025', category: 'Motion Graphics', runtime: '0:20',
    blurb: 'Kinetic type film. Every line lands on the beat and clears before the next.' },
  { slug: 'bath-time', title: 'Bath Time', client: 'Mee Mee', year: '2026', category: 'Brand Campaigns', runtime: '0:05',
    blurb: 'The product in use — soft daylight, calm pacing, safety cues visible.' },
  { slug: 'stroller-reveal', title: '360° Reveal', client: 'Mee Mee', year: '2026', category: 'Product Films', runtime: '0:08',
    blurb: 'Turntable product reveal with a built environment and reflection pass.' },
  { slug: 'first-sips', title: 'First Sips', client: 'Mee Mee', year: '2026', category: 'Brand Campaigns', runtime: '0:06',
    blurb: 'Warm-kitchen lifestyle spot generated end to end, cut for a three-second hook.' },
  { slug: 'sippy-macro', title: 'Sippy Cup — Macro', client: 'Mee Mee', year: '2026', category: 'Product Films', runtime: '0:05',
    blurb: 'Macro product study. Detail, weight and material sell in close-up.' },
  { slug: 'bathtub-fill', title: 'Bathtub — Fill', client: 'Mee Mee', year: '2026', category: 'Product Films', runtime: '0:08',
    blurb: 'Water simulation and product hero shot for a bath range launch.' },
  { slug: 'walker-livingroom', title: 'Walker — Living Room', client: 'Mee Mee', year: '2026', category: 'Brand Campaigns', runtime: '0:05',
    blurb: 'Product placed into a naturally lit home set with consistent brand identity.' },
  { slug: 'playtime', title: 'Playtime', client: 'Mee Mee', year: '2026', category: 'Brand Campaigns', runtime: '0:05',
    blurb: 'Short-form playtime spot, framed for both 16:9 and vertical crops.' },
  { slug: 'ai-wardrobe-look', title: 'Look Builder', client: 'Concept', year: '2026', category: 'AI Films', runtime: '0:15', tall: true,
    blurb: 'Square-format companion piece: the outfit builds around the model item by item.' },
  { slug: 'odoo-18', title: 'Future-Ready with Odoo 18', client: 'Brainvire Infotech', year: '2025', category: 'Corporate & Explainer', runtime: '0:20',
    blurb: 'Module-by-module product explainer. Icon system animated to a tight VO track.' },
  { slug: 'cheers-leaderboard', title: 'Cheers Leaderboard', client: 'Brainvire Infotech', year: '2025', category: 'Motion Graphics', runtime: '0:20',
    blurb: 'Monthly internal recognition reel. Character rig, gradient cards, data-driven layout.' },
  { slug: 'expo-recap', title: 'Expo Recap', client: 'Brainvire Infotech', year: '2025', category: 'Motion Graphics', runtime: '0:20',
    blurb: 'Trade-show recap cut from floor footage the same day it was shot.' },
  { slug: 'rta-ident', title: 'RTA Ident', client: 'RTA', year: '2025', category: 'Motion Graphics', runtime: '0:20',
    blurb: 'Logo animation built on a light sweep and a hard cut to lockup.' },
  { slug: 'commerce-teardown', title: 'Commerce Teardown', client: 'Brainvire Infotech', year: '2025', category: 'Corporate & Explainer', runtime: '0:20',
    blurb: 'Screen-capture walkthrough of a retail storefront, annotated in post.' },
  { slug: 'recycling-process', title: 'Recycling Process', client: 'Brainvire Infotech', year: '2025', category: 'Corporate & Explainer', runtime: '0:20',
    blurb: 'Infographic animation turning a supply chain into something you can follow once.' },
  { slug: 'masolo-ident', title: 'Masolo Ident', client: 'Masolo', year: '2025', category: 'Motion Graphics', runtime: '0:04', tall: true,
    blurb: 'Vertical logo sting for social bumpers.' },
];

const SHOWREEL = {
  slug: 'showreel', title: 'Showreel 2026', client: 'Rachit Gandhi', year: '2026', category: 'Showreel', runtime: '0:40',
  blurb: 'AI films, product work, motion design and feature-film compositing in one cut.',
  credit: 'Includes studio footage © its respective owners.',
};

const PROCESS = [
  ['Discover', 'What has to be true for this to work.'],
  ['Research', 'Category, audience, and what everyone else already did.'],
  ['Script', 'Written before a single frame is generated.'],
  ['Storyboard', 'Treated as a live-action board, not a prompt list.'],
  ['Design', 'Type, palette and grid locked to brand spec.'],
  ['Animate', 'Timing, easing, and the weight that sells it.'],
  ['AI enhance', 'Generative plates, upres, detail reconstruction.'],
  ['Sound', 'The half of the film you hear.'],
  ['Delivery', 'Every aspect ratio, every platform.'],
];

const CATEGORIES = ['AI Films', 'Product Films', 'Brand Campaigns', 'Motion Graphics', 'Corporate & Explainer', 'Film VFX'];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const poster = slug => `assets/posters/${slug}.webp`;
const video = slug => `assets/reels/${slug}.mp4`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const saveData = navigator.connection && navigator.connection.saveData;

/* ---------- Work grid ---------- */
const grid = $('[data-grid]');
const filtersEl = $('[data-filters]');
let filter = { type: 'all' };

function renderGrid() {
  grid.innerHTML = WORK.map((w, i) => `
    <button type="button" class="card${i === 0 ? ' card--lead' : ''}${w.tall ? ' card--tall' : ''}" data-slug="${w.slug}" data-reveal
      aria-label="Play ${esc(w.title)} — ${esc(w.client)}, ${esc(w.year)}">
      <span class="card-media">
        <img src="${poster(w.slug)}" alt="" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async" width="960" height="540">
        <span class="card-tag hud">${esc(w.category)}</span>
        <span class="card-play" aria-hidden="true">▶</span>
      </span>
      <span class="card-meta">
        <span>
          <span class="card-title" style="display:block">${esc(w.title)}</span>
          <span class="card-client hud faint" style="display:block">${esc(w.client)}</span>
        </span>
        <span class="hud faint">${esc(w.year)} · ${esc(w.runtime)}</span>
      </span>
    </button>`).join('');
  $('[data-work-count]').textContent = `${WORK.length} pieces · 2020 — 2026`;
}

function renderFilters() {
  const count = c => WORK.filter(w => w.category === c).length;
  let html = `<button type="button" class="filter" data-filter="all">All<sup>${WORK.length}</sup></button>`;
  html += CATEGORIES.map(c => `<button type="button" class="filter" data-filter="${esc(c)}">${esc(c)}<sup>${count(c)}</sup></button>`).join('');
  if (filter.type === 'client') {
    const n = WORK.filter(w => w.client === filter.value).length;
    html += `<button type="button" class="filter" data-filter="all" aria-pressed="true" aria-label="Showing ${esc(filter.value)} only. Clear filter">${esc(filter.value)}<sup>${n}</sup> ✕</button>`;
  }
  filtersEl.innerHTML = html;
  $$('.filter', filtersEl).forEach(b => {
    if (b.hasAttribute('aria-pressed')) return;
    const v = b.dataset.filter;
    const on = filter.type === 'all' ? v === 'all' : filter.type === 'cat' && v === filter.value;
    b.setAttribute('aria-pressed', String(on));
  });
}

function applyFilter() {
  $$('.card', grid).forEach(card => {
    const w = WORK.find(x => x.slug === card.dataset.slug);
    const show = filter.type === 'all' || (filter.type === 'cat' ? w.category === filter.value : w.client === filter.value);
    card.hidden = !show;
  });
  // The lead card only spans 2×2 in the unfiltered view.
  const lead = $('.card--lead', grid);
  if (lead) lead.style.gridColumn = lead.style.gridRow = filter.type === 'all' ? '' : 'auto';
  renderFilters();
}

filtersEl.addEventListener('click', e => {
  const b = e.target.closest('[data-filter]');
  if (!b) return;
  filter = b.dataset.filter === 'all' ? { type: 'all' } : { type: 'cat', value: b.dataset.filter };
  applyFilter();
});

$$('[data-client]').forEach(a => a.addEventListener('click', () => {
  filter = { type: 'client', value: a.dataset.client };
  applyFilter();
}));

/* Hover preview: the video element is only created on first hover, so nothing
   downloads until someone shows interest. */
function attachPreviews() {
  if (!canHover || reduceMotion || saveData) return;
  $$('.card', grid).forEach(card => {
    let v;
    card.addEventListener('pointerenter', () => {
      if (!v) {
        v = document.createElement('video');
        Object.assign(v, { muted: true, loop: true, playsInline: true, preload: 'auto', src: video(card.dataset.slug) });
        v.setAttribute('aria-hidden', 'true');
        $('.card-media', card).insertBefore(v, $('.card-tag', card));
      }
      const p = v.play();
      if (p) p.then(() => card.classList.add('is-previewing')).catch(() => {});
    });
    card.addEventListener('pointerleave', () => {
      if (!v) return;
      v.pause();
      card.classList.remove('is-previewing');
    });
  });
}

/* ---------- Player ---------- */
const dlg = $('[data-player]');
const pv = $('[data-player-video]');
let current = -1; // index into visible list; -1 = showreel
let list = WORK;

function visibleWork() {
  return $$('.card', grid).filter(c => !c.hidden).map(c => WORK.find(w => w.slug === c.dataset.slug));
}

function fill(w) {
  pv.pause();
  pv.poster = poster(w.slug);
  pv.src = video(w.slug);
  $('[data-player-stage]').classList.toggle('is-tall', !!w.tall);
  $('[data-player-cat]').textContent = w.category;
  $('[data-player-title]').textContent = w.title;
  $('[data-player-blurb]').textContent = w.blurb + (w.credit ? ' ' + w.credit : '');
  const facts = [['Client', w.client], ['Year', w.year], ['Runtime', w.runtime]];
  if (ROLES[w.client] && w.slug !== 'showreel') facts.push(['Role', ROLES[w.client]]);
  $('[data-player-facts]').innerHTML = facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  const isReel = w.slug === 'showreel';
  $('[data-player-prev]').hidden = $('[data-player-next]').hidden = isReel || list.length < 2;
  $('[data-player-counter]').textContent = isReel ? 'Showreel' : `${String(current + 1).padStart(2, '0')} / ${String(list.length).padStart(2, '0')}`;
  try { history.replaceState(null, '', `#play=${w.slug}`); } catch (_) {}
  const p = pv.play();
  if (p) p.catch(() => {});
}

function openPlayer(slug) {
  if (slug === 'showreel') { current = -1; fill(SHOWREEL); }
  else {
    list = visibleWork();
    if (!list.some(w => w.slug === slug)) list = WORK;
    current = list.findIndex(w => w.slug === slug);
    if (current < 0) return;
    fill(list[current]);
  }
  if (!dlg.open) dlg.showModal();
}

function step(d) {
  if (current < 0) return;
  current = (current + d + list.length) % list.length;
  fill(list[current]);
}

grid.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (card) openPlayer(card.dataset.slug);
});
$$('[data-play]').forEach(b => b.addEventListener('click', () => openPlayer(b.dataset.play)));
$('[data-player-prev]').addEventListener('click', () => step(-1));
$('[data-player-next]').addEventListener('click', () => step(1));
$('[data-player-close]').addEventListener('click', () => dlg.close());
dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener('keydown', e => {
  if (e.target === pv) return; // let the native player handle arrow keys
  if (e.key === 'ArrowRight') step(1);
  if (e.key === 'ArrowLeft') step(-1);
});
dlg.addEventListener('close', () => {
  pv.pause();
  pv.removeAttribute('src');
  pv.load();
  try { history.replaceState(null, '', location.pathname + location.search); } catch (_) {}
});

/* ---------- Process timeline ---------- */
const tc = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00`;
$('[data-ruler]').innerHTML = '<span></span>' + PROCESS.map((_, i) => `<span>${tc(i * 8)}</span>`).join('');
$('[data-track]').insertAdjacentHTML('beforeend', PROCESS.map(([label, line], i) => `
  <li class="tl-clip"><span class="faint">${String(i + 1).padStart(2, '0')}</span><b>${esc(label)}</b><p>${esc(line)}</p></li>`).join(''));

/* ---------- Header, clock, copy, reveal ---------- */
const header = $('#top-bar');
const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 24);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const navLinks = $$('.nav a[href^="#"]:not(.btn)');
const spy = new IntersectionObserver(entries => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    navLinks.forEach(a => a.setAttribute('aria-current', String(a.getAttribute('href') === '#' + en.target.id)));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
['work', 'experience', 'approach', 'contact'].forEach(id => spy.observe(document.getElementById(id)));

const clockFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
const tick = () => $$('[data-clock]').forEach(el => { el.textContent = clockFmt.format(new Date()); });
tick();
setInterval(tick, 30000);

$$('[data-copy]').forEach(b => b.addEventListener('click', async () => {
  const text = b.dataset.copy;
  const label = b.textContent;
  try {
    await navigator.clipboard.writeText(text);
    b.textContent = 'Copied ✓';
  } catch (_) {
    b.textContent = text;
  }
  setTimeout(() => { b.textContent = label; }, 2200);
}));

function observeReveals() {
  const els = $$('[data-reveal]:not(.is-in)');
  if (reduceMotion || !('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('is-in')); return; }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(el => io.observe(el));
}

/* ---------- Boot ---------- */
if (!canHover) $('[data-hint]').textContent = 'Tap any piece to watch with sound';
renderGrid();
applyFilter();
attachPreviews();
observeReveals();

const m = location.hash.match(/^#play=([\w-]+)/);
if (m) openPlayer(m[1]);
