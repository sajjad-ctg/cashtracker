/* ==========================================================================
   Cash Tracker — single-file offline app
   Vanilla JS. No build-time dependencies. Data in localStorage.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */

  const STORE_KEY = 'cashtracker.v1';
  const SCHEMA_VERSION = 1;

  const CURRENCIES = [
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
    { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
    { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
    { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' }
  ];

  const EMOJI_PALETTE = ['', '🍔', '🚗', '🏠', '🛒', '💊', '🎬', '✈️', '🎓', '🐾', '☕', '🎁', '💼', '📱', '⚡', '🧾'];

  const COLOR_PALETTE = ['#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#d97706', '#ca8a04', '#16a34a', '#0d9488', '#0891b2', '#4f46e5', '#be185d'];

  const NAV = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'transactions', label: 'Transactions' },
    { id: 'reports', label: 'Reports' },
    { id: 'settings', label: 'Settings' }
  ];

  /* ------------------------------------------------------------------ *
   * Small utilities
   * ------------------------------------------------------------------ */

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));
  const sum = (arr, f) => arr.reduce((t, x) => t + (f ? f(x) : x), 0);
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const byId = (list, id) => list.find((x) => x.id === id) || null;

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(self, args), ms);
    };
  }

  /* ---- dates (ISO 'YYYY-MM-DD' everywhere, local time) ---- */

  const pad2 = (n) => (n < 10 ? '0' + n : '' + n);
  const toISO = (d) => d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  const fromISO = (s) => { const p = String(s).split('-').map(Number); return new Date(p[0], (p[1] || 1) - 1, p[2] || 1); };
  const todayISO = () => toISO(new Date());
  const addDays = (iso, n) => { const d = fromISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const addMonths = (iso, n) => { const d = fromISO(iso); d.setMonth(d.getMonth() + n); return toISO(d); };

  function startOfWeek(iso, weekStart) {
    const d = fromISO(iso);
    const off = weekStart === 'sun' ? d.getDay() : weekStart === 'sat' ? (d.getDay() + 1) % 7 : (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - off);
    return toISO(d);
  }
  function endOfWeek(iso, weekStart) { return addDays(startOfWeek(iso, weekStart), 6); }

  function monthKey(iso) { return iso.slice(0, 7); }
  function monthStart(mk) { return mk + '-01'; }
  function monthEnd(mk) { const d = fromISO(mk + '-01'); d.setMonth(d.getMonth() + 1); d.setDate(0); return toISO(d); }
  function shiftMonth(mk, n) {
    const d = fromISO(mk + '-01'); d.setMonth(d.getMonth() + n);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  }

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function fmtDate(iso) {
    if (!iso) return '';
    const d = fromISO(iso);
    return pad2(d.getDate()) + ' ' + MONTHS[d.getMonth()].slice(0, 3) + ' ' + d.getFullYear();
  }
  function fmtDateShort(iso) {
    const d = fromISO(iso);
    return pad2(d.getDate()) + ' ' + MONTHS[d.getMonth()].slice(0, 3);
  }
  function fmtDayName(iso) { return DAYS[fromISO(iso).getDay()].slice(0, 3); }
  function fmtMonthLabel(mk) { const d = fromISO(mk + '-01'); return MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }

  /* ---- money ---- */

  let _fmtCache = {};
  function money(cents) {
    const code = state.settings.currency;
    const v = (cents || 0) / 100;
    if (!_fmtCache[code]) {
      try {
        _fmtCache[code] = new Intl.NumberFormat(undefined, { style: 'currency', currency: code, minimumFractionDigits: 2 });
      } catch (e) {
        _fmtCache[code] = { format: (n) => currencySymbol() + n.toFixed(2) };
      }
    }
    return _fmtCache[code].format(v);
  }
  function currencySymbol() {
    const c = CURRENCIES.find((x) => x.code === state.settings.currency);
    return c ? c.symbol : state.settings.currency;
  }
  function moneyPlain(cents) { return ((cents || 0) / 100).toFixed(2); }
  function toCents(value) {
    const n = parseFloat(String(value).replace(/[^0-9.\-]/g, ''));
    if (!isFinite(n)) return null;
    return Math.round(n * 100);
  }

  /* ------------------------------------------------------------------ *
   * Store
   * ------------------------------------------------------------------ */

  function defaultState() {
    const mkCat = (name, color, emoji) => ({ id: uid(), name, color, emoji: emoji || '' });
    return {
      version: SCHEMA_VERSION,
      settings: {
        theme: 'auto',
        currency: 'USD',
        weekStart: 'mon',
        title: 'Cash Tracker',
        owner: ''
      },
      categories: {
        expense: [
          mkCat('Food & Drinks', '#ea580c', '🍔'),
          mkCat('Transport', '#0891b2', '🚗'),
          mkCat('Bills & Utilities', '#7c3aed', '🏠'),
          mkCat('Shopping', '#db2777', '🛒'),
          mkCat('Health', '#dc2626', '💊'),
          mkCat('Entertainment', '#d97706', '🎬'),
          mkCat('Other', '#6b7480', '')
        ],
        income: [
          mkCat('Salary', '#16a34a', '💼'),
          mkCat('Freelance', '#2563eb', '💻'),
          mkCat('Gift', '#db2777', '🎁'),
          mkCat('Refund', '#0d9488', '↩️'),
          mkCat('Other', '#6b7480', '')
        ]
      },
      people: [],
      txns: []
    };
  }

  function migrate(data) {
    const base = defaultState();
    if (!data || typeof data !== 'object') return base;
    const s = {
      version: SCHEMA_VERSION,
      settings: Object.assign({}, base.settings, data.settings || {}),
      categories: {
        expense: Array.isArray((data.categories || {}).expense) ? data.categories.expense.slice() : base.categories.expense,
        income: Array.isArray((data.categories || {}).income) ? data.categories.income.slice() : base.categories.income
      },
      people: Array.isArray(data.people) ? data.people.slice() : [],
      txns: Array.isArray(data.txns) ? data.txns.slice() : []
    };
    // normalise transactions
    s.txns = s.txns.map((t) => ({
      id: t.id || uid(),
      type: t.type === 'income' ? 'income' : 'expense',
      amountCents: Math.round(Number(t.amountCents) || 0),
      date: /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : todayISO(),
      categoryId: t.categoryId || null,
      personId: t.personId || null,
      note: typeof t.note === 'string' ? t.note.slice(0, 500) : '',
      createdAt: t.createdAt || Date.now()
    })).filter((t) => t.amountCents > 0);
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) { const d = defaultState(); try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch (e) { } return d; }
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.error('Load failed', e);
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      return true;
    } catch (e) {
      toast('Could not save — storage is full or blocked.', 'err');
      return false;
    }
  }

  let state = load();

  /* ------------------------------------------------------------------ *
   * Lookup helpers
   * ------------------------------------------------------------------ */

  const allCategories = () => state.categories.expense.concat(state.categories.income);
  function categoryOf(txn) {
    const list = txn.type === 'income' ? state.categories.income : state.categories.expense;
    return list.find((c) => c.id === txn.categoryId) || null;
  }
  function categoryById(id) { return allCategories().find((c) => c.id === id) || null; }
  function personOf(txn) { return txn.personId ? byId(state.people, txn.personId) : null; }
  function categoryName(txn) { const c = categoryOf(txn); return c ? c.name : 'Uncategorised'; }
  function personName(txn) { const p = personOf(txn); return p ? p.name : ''; }

  /* ------------------------------------------------------------------ *
   * Filters
   * ------------------------------------------------------------------ */

  function emptyFilter() {
    return { type: 'all', from: '', to: '', cats: [], people: [], min: '', max: '', q: '' };
  }

  function applyFilter(list, f) {
    const q = (f.q || '').trim().toLowerCase();
    const min = f.min === '' || f.min == null ? null : Math.round(Number(f.min) * 100);
    const max = f.max === '' || f.max == null ? null : Math.round(Number(f.max) * 100);
    return list.filter((t) => {
      if (f.type !== 'all' && t.type !== f.type) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      if (f.cats && f.cats.length && f.cats.indexOf(t.categoryId) === -1) return false;
      if (f.people && f.people.length) {
        const key = t.personId || 'none';
        if (f.people.indexOf(key) === -1) return false;
      }
      if (min != null && t.amountCents < min) return false;
      if (max != null && t.amountCents > max) return false;
      if (q) {
        const hay = (t.note + ' ' + categoryName(t) + ' ' + personName(t) + ' ' + (t.type || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  /* ------------------------------------------------------------------ *
   * View state
   * ------------------------------------------------------------------ */

  const viewState = {
    route: 'dashboard',
    txnFilter: emptyFilter(),
    txnFiltersOpen: false,
    txnSort: { key: 'date', dir: 'desc' },
    report: {
      preset: 'month',       // today | day | week | month | custom
      anchor: todayISO(),     // anchor date for day/week
      month: monthKey(todayISO()),
      from: monthStart(monthKey(todayISO())),
      to: monthEnd(monthKey(todayISO())),
      type: 'expense',        // expense | income | both
      filter: emptyFilter()
    },
    reportFiltersOpen: false
  };

  function filterOpenKey() { return viewState.route === 'reports' ? 'reportFiltersOpen' : 'txnFiltersOpen'; }

  function currentRoute() {
    const h = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return NAV.some((n) => n.id === h) ? h : 'dashboard';
  }

  /* ------------------------------------------------------------------ *
   * Theme
   * ------------------------------------------------------------------ */

  const mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function effectiveTheme() {
    const t = state.settings.theme || 'auto';
    if (t === 'light' || t === 'dark') return t;
    return mql && mql.matches ? 'dark' : 'light';
  }

  function applyTheme() {
    const t = effectiveTheme();
    document.documentElement.setAttribute('data-theme', t);
    const btn = $('#theme-btn');
    if (btn) { btn.textContent = t === 'dark' ? '☀' : '☾'; btn.title = 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' theme'; }
  }

  if (mql && mql.addEventListener) mql.addEventListener('change', () => { if ((state.settings.theme || 'auto') === 'auto') applyTheme(); });

  /* ------------------------------------------------------------------ *
   * Toasts
   * ------------------------------------------------------------------ */

  function toast(msg, kind) {
    const root = $('#toasts');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 320); }, 2600);
  }

  /* ------------------------------------------------------------------ *
   * Generic UI fragments
   * ------------------------------------------------------------------ */

  function statCard(label, value, meta, cls) {
    return '<div class="card stat"><span class="label">' + esc(label) + '</span>' +
      '<span class="value ' + (cls || '') + '">' + value + '</span>' +
      (meta ? '<span class="meta">' + esc(meta) + '</span>' : '') + '</div>';
  }

  function emptyState(text, sub) {
    return '<div class="empty"><div class="big">🗒️</div><div>' + esc(text) + '</div>' +
      (sub ? '<div class="hint" style="margin-top:4px">' + esc(sub) + '</div>' : '') + '</div>';
  }

  /* ---- filter bar ---- */

  function dropdownFilter(label, name, options, selected) {
    const sel = selected || [];
    const count = sel.length ? '<span class="count">· ' + sel.length + '</span>' : '';
    const opts = options.map((o) =>
      '<label><input type="checkbox" data-filter="' + name + '" value="' + esc(o.value) + '"' + (sel.indexOf(o.value) !== -1 ? ' checked' : '') + '> ' +
      (o.color ? '<i class="dot" style="background:' + esc(o.color) + '"></i>' : '') + esc(o.label) + '</label>'
    ).join('');
    return '<details class="dd"><summary class="btn btn-sm">' + esc(label) + count + ' ▾</summary>' +
      '<div class="dd-panel">' + (opts || '<div class="hint" style="padding:6px 8px">None</div>') +
      '<button class="btn btn-sm done" data-action="close-dd">Done</button></div></details>';
  }

  function filterBarHTML(f, opts) {
    opts = opts || {};
    const catOpts = allCategories().map((c) => ({ value: c.id, label: c.name, color: c.color }));
    const peopleOpts = state.people.map((p) => ({ value: p.id, label: p.name }));
    peopleOpts.push({ value: 'none', label: 'Unassigned' });
    const more = [];

    if (opts.showType) {
      more.push('<div class="field"><label>Type</label><select data-filter="type">' +
        '<option value="all"' + (f.type === 'all' ? ' selected' : '') + '>All</option>' +
        '<option value="expense"' + (f.type === 'expense' ? ' selected' : '') + '>Expense</option>' +
        '<option value="income"' + (f.type === 'income' ? ' selected' : '') + '>Income</option>' +
        '</select></div>');
    }
    if (opts.showDates) {
      more.push('<div class="field"><label>From</label><input type="date" data-filter="from" value="' + esc(f.from) + '"></div>');
      more.push('<div class="field"><label>To</label><input type="date" data-filter="to" value="' + esc(f.to) + '"></div>');
    }
    more.push('<div class="field"><label>Min amount</label><input type="number" step="0.01" min="0" inputmode="decimal" placeholder="0.00" data-filter="min" value="' + esc(f.min) + '"></div>');
    more.push('<div class="field"><label>Max amount</label><input type="number" step="0.01" min="0" inputmode="decimal" placeholder="Any" data-filter="max" value="' + esc(f.max) + '"></div>');
    more.push('<button class="btn btn-sm" data-action="reset-filters">Reset filters</button>');

    const activeCount = (f.cats ? f.cats.length : 0) + (f.people ? f.people.length : 0) +
      (f.type && f.type !== 'all' ? 1 : 0) + (f.from ? 1 : 0) + (f.to ? 1 : 0) +
      (f.min !== '' && f.min != null ? 1 : 0) + (f.max !== '' && f.max != null ? 1 : 0) + (f.q ? 1 : 0);

    return '<div class="card filter-card' + (activeCount ? ' has-filters' : '') + (viewState[filterOpenKey()] ? ' open' : '') + '" id="filter-card">' +
      '<div class="filters">' +
      '<div class="filter-row">' +
      '<div class="field grow"><label>Search</label><input type="search" id="f-q" data-filter="q" placeholder="Search notes, categories…" value="' + esc(f.q) + '"></div>' +
      '<div class="row gap-sm wrap filter-dds">' +
      dropdownFilter('Categories', 'cat', catOpts, f.cats) +
      dropdownFilter('For whom', 'person', peopleOpts, f.people) +
      '</div>' +
      '<button class="btn btn-sm filter-toggle" data-action="toggle-filters">⚙ Filters' + (activeCount ? ' (' + activeCount + ')' : '') + '</button>' +
      '</div></div>' +
      '<div class="filter-more">' + more.join('') + '</div>' +
      '</div>';
  }

  /* ------------------------------------------------------------------ *
   * View: Dashboard
   * ------------------------------------------------------------------ */

  function renderDashboard() {
    const now = todayISO();
    const mk = monthKey(now);
    const from = monthStart(mk), to = monthEnd(mk);
    const inMonth = state.txns.filter((t) => t.date >= from && t.date <= to);
    const inc = sum(inMonth.filter((t) => t.type === 'income'), (t) => t.amountCents);
    const exp = sum(inMonth.filter((t) => t.type === 'expense'), (t) => t.amountCents);
    const net = inc - exp;
    const totalAll = state.txns.length;

    return '<div class="page-head"><div><h1>Dashboard</h1><div class="sub">' + esc(fmtMonthLabel(mk)) + ' · ' + totalAll + ' entries in total</div></div>' +
      '<button class="btn btn-primary" data-action="add-txn">+ Add entry</button></div>' +
      '<div class="grid grid-4">' +
      statCard('Income', money(inc), 'this month', 'value-pos') +
      statCard('Expenses', money(exp), 'this month', 'value-neg') +
      statCard('Net', money(net), net >= 0 ? 'surplus' : 'deficit', net >= 0 ? 'value-pos' : 'value-neg') +
      statCard('Entries', String(inMonth.length), 'this month') +
      '</div>';
  }

  function groupBy(list, keyFn) {
    const map = new Map();
    list.forEach((item) => {
      const k = keyFn(item);
      if (!map.has(k)) map.set(k, { key: k, items: [] });
      map.get(k).items.push(item);
    });
    return Array.from(map.values());
  }

  /* ------------------------------------------------------------------ *
   * View: Transactions
   * ------------------------------------------------------------------ */

  function txnItemHTML(t, opts) {
    opts = opts || {};
    const c = categoryOf(t);
    const color = c && c.color ? c.color : '#9aa3af';
    const icon = c && c.emoji ? esc(c.emoji) : esc((categoryName(t).charAt(0) || '?').toUpperCase());
    const thisYear = String(new Date().getFullYear());
    const sub = [];
    if (opts.showDate !== false) {
      sub.push(t.date.slice(0, 4) === thisYear ? fmtDateShort(t.date) : fmtDate(t.date));
    }
    if (t.personId) sub.push((t.type === 'income' ? 'Client ' : 'For ') + personName(t));
    if (t.note) sub.push(t.note);
    const sign = t.type === 'income' ? '+' : '−';
    return '<li class="txn-item ' + t.type + '" data-action="edit-txn" data-id="' + esc(t.id) + '" tabindex="0">' +
      '<span class="txn-ico" style="--c:' + esc(color) + '">' + icon + '</span>' +
      '<span class="txn-main">' +
      '<span class="txn-title">' + esc(categoryName(t)) + '</span>' +
      '<span class="txn-sub">' + esc(sub.join(' · ')) + '</span>' +
      '</span>' +
      '<span class="txn-amt">' + sign + money(t.amountCents) + '</span>' +
      '</li>';
  }

  function sortSelectHTML() {
    const s = viewState.txnSort;
    const cur = s.key + ':' + s.dir;
    const opts = [
      ['date:desc', 'Newest first'],
      ['date:asc', 'Oldest first'],
      ['amount:desc', 'Largest amount'],
      ['amount:asc', 'Smallest amount'],
      ['category:asc', 'Category A–Z'],
      ['person:asc', 'For whom A–Z']
    ];
    return '<select id="txn-sort" class="sort-select" aria-label="Sort entries">' +
      opts.map((o) => '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>').join('') +
      '</select>';
  }

  function renderTransactions() {
    const f = viewState.txnFilter;
    let rows = applyFilter(state.txns, f);

    const sort = viewState.txnSort;
    const dir = sort.dir === 'asc' ? 1 : -1;
    const comparators = {
      date: (a, b) => (a.date === b.date ? (a.createdAt - b.createdAt) * dir : (a.date < b.date ? -dir : dir)),
      type: (a, b) => a.type.localeCompare(b.type) * dir,
      category: (a, b) => categoryName(a).localeCompare(categoryName(b)) * dir,
      person: (a, b) => personName(a).localeCompare(personName(b)) * dir,
      note: (a, b) => String(a.note).localeCompare(String(b.note)) * dir,
      amount: (a, b) => (a.amountCents - b.amountCents) * dir
    };
    const cmp = comparators[sort.key] || comparators.date;
    rows = rows.slice().sort(cmp);

    return '<div class="page-head"><div><h1>Transactions</h1><div class="sub">' + rows.length + ' of ' + state.txns.length + ' entries</div></div>' +
      '<div class="row gap-sm">' + sortSelectHTML() +
      '<button class="btn" data-action="export-csv">⬇ CSV</button>' +
      '<button class="btn btn-primary" data-action="add-txn">+ Add</button></div></div>' +
      filterBarHTML(f, { showType: true, showDates: true }) +
      '<div class="card mt-3">' +
      (rows.length
        ? '<ul class="txn-list">' + rows.map(txnItemHTML).join('') + '</ul>'
        : emptyState('No entries match the current filters.', 'Try widening the date range or clearing filters.')) +
      '</div>';
  }

  /* ------------------------------------------------------------------ *
   * View: Reports
   * ------------------------------------------------------------------ */

  function periodRange() {
    const p = viewState.report;
    const ws = state.settings.weekStart;
    if (p.preset === 'today') { const d = todayISO(); return { from: d, to: d, label: 'Today · ' + fmtDate(d) }; }
    if (p.preset === 'day') { return { from: p.anchor, to: p.anchor, label: fmtDate(p.anchor) }; }
    if (p.preset === 'week') {
      const s = startOfWeek(p.anchor, ws), e = endOfWeek(p.anchor, ws);
      return { from: s, to: e, label: 'Week of ' + fmtDateShort(s) + ' – ' + fmtDateShort(e) + ' ' + new Date(fromISO(e)).getFullYear() };
    }
    if (p.preset === 'month') { return { from: monthStart(p.month), to: monthEnd(p.month), label: fmtMonthLabel(p.month) }; }
    const s = p.from || '', e = p.to || '';
    return { from: s, to: e, label: s && e ? (fmtDateShort(s) + ' – ' + fmtDateShort(e)) : 'Custom range' };
  }

  function periodNavHTML() {
    const p = viewState.report;
    const presets = [['today', 'Today'], ['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['custom', 'Custom']];
    let picker = '';
    if (p.preset === 'today') {
      picker = '<div class="hint">Entries recorded today.</div>';
    } else if (p.preset === 'day') {
      picker = '<input type="date" data-period="anchor" value="' + esc(p.anchor) + '">';
    } else if (p.preset === 'week') {
      picker = '<div class="row gap-sm"><button class="btn btn-sm" data-action="period-shift" data-dir="-1">‹</button>' +
        '<input type="date" data-period="anchor" value="' + esc(p.anchor) + '">' +
        '<button class="btn btn-sm" data-action="period-shift" data-dir="1">›</button></div>';
    } else if (p.preset === 'month') {
      picker = '<div class="row gap-sm"><button class="btn btn-sm" data-action="period-shift" data-dir="-1">‹</button>' +
        '<input type="month" data-period="month" value="' + esc(p.month) + '">' +
        '<button class="btn btn-sm" data-action="period-shift" data-dir="1">›</button></div>';
    } else {
      picker = '<div class="row gap-sm"><input type="date" data-period="from" value="' + esc(p.from) + '">' +
        '<span class="muted">→</span><input type="date" data-period="to" value="' + esc(p.to) + '"></div>';
    }
    return '<div class="card mb-3"><div class="card-body"><div class="row wrap" style="justify-content:space-between">' +
      '<div class="segmented scroll-x" id="preset-seg">' + presets.map((x) => '<button data-action="set-preset" data-preset="' + x[0] + '" class="' + (p.preset === x[0] ? 'active' : '') + '">' + x[1] + '</button>').join('') + '</div>' +
      '<div class="row wrap gap-sm">' + picker +
      '<div class="segmented" id="type-seg">' +
      '<button data-action="set-rtype" data-rtype="expense" class="' + (p.type === 'expense' ? 'active' : '') + '">Expenses</button>' +
      '<button data-action="set-rtype" data-rtype="income" class="' + (p.type === 'income' ? 'active' : '') + '">Income</button>' +
      '<button data-action="set-rtype" data-rtype="both" class="' + (p.type === 'both' ? 'active' : '') + '">Both</button>' +
      '</div></div></div></div>';
  }

  function breakdownCards(groups, total, title, barColor) {
    if (!groups.length) {
      return '<div class="sec-block"><h3 class="sec-title">' + esc(title) + '</h3>' +
        '<div class="card"><div class="card-body hint">No data for this period.</div></div></div>';
    }
    return '<div class="sec-block"><h3 class="sec-title">' + esc(title) + '</h3>' +
      groups.map((g) => {
        const pct = total ? (g.amount / total) * 100 : 0;
        const color = barColor || g.color;
        return '<div class="bd-card">' +
          '<div class="bd-top">' +
          '<span class="bd-name">' +
          (g.icon ? '<span class="txn-ico bd-ico" style="--c:' + esc(g.color) + '">' + esc(g.icon) + '</span>' : '') +
          '<span>' + esc(g.name) + '</span></span>' +
          '<span class="bd-amt">' + money(g.amount) + '</span>' +
          '</div>' +
          '<div class="bar"><span style="width:' + pct.toFixed(1) + '%;background:' + esc(color) + '"></span></div>' +
          '<div class="bd-pct">' + pct.toFixed(0) + '%</div>' +
          '</div>';
      }).join('') + '</div>';
  }

  function buildReport() {
    const p = viewState.report;
    const range = periodRange();
    const f = Object.assign({}, p.filter);
    f.from = range.from; f.to = range.to;
    const txns = applyFilter(state.txns, f);

    const income = txns.filter((t) => t.type === 'income');
    const expense = txns.filter((t) => t.type === 'expense');
    const totalIncome = sum(income, (t) => t.amountCents);
    const totalExpense = sum(expense, (t) => t.amountCents);

    const mkGroups = (list) => groupBy(list, (t) => t.categoryId || '__none').map((g) => {
      const c = g.key === '__none' ? null : categoryById(g.key);
      const name = c ? c.name : 'Uncategorised';
      return {
        id: g.key, name: name, color: c ? c.color : '#9aa3af',
        icon: c && c.emoji ? c.emoji : name.charAt(0).toUpperCase(),
        count: g.items.length, amount: sum(g.items, (t) => t.amountCents)
      };
    }).sort((a, b) => b.amount - a.amount);

    const mkPersonGroups = (list) => groupBy(list, (t) => t.personId || '__none').map((g) => {
      const p2 = g.key === '__none' ? null : byId(state.people, g.key);
      return {
        id: g.key, name: p2 ? p2.name : 'Unassigned', color: p2 ? 'var(--accent)' : '#9aa3af',
        icon: '', count: g.items.length, amount: sum(g.items, (t) => t.amountCents)
      };
    }).sort((a, b) => b.amount - a.amount);

    const days = Math.max(1, Math.round((fromISO(range.to) - fromISO(range.from)) / 86400000) + 1);
    const listTxns = p.type === 'expense' ? expense : p.type === 'income' ? income : txns;

    return {
      range: range,
      type: p.type,
      filter: p.filter,
      txns: txns.slice().sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : (a.date < b.date ? -1 : 1))),
      listTxns: listTxns.slice().sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : (a.date < b.date ? -1 : 1))),
      income: income, expense: expense,
      totalIncome: totalIncome, totalExpense: totalExpense,
      net: totalIncome - totalExpense,
      count: txns.length,
      days: days,
      avgPerDay: (totalExpense + totalIncome) / days,
      catExpense: mkGroups(expense), catIncome: mkGroups(income),
      perExpense: mkPersonGroups(expense), perIncome: mkPersonGroups(income)
    };
  }

  function renderReports() {
    const rep = buildReport();
    const f = viewState.report.filter;
    const showExp = rep.type === 'expense' || rep.type === 'both';
    const showInc = rep.type === 'income' || rep.type === 'both';

    let html = '<div class="page-head"><div><h1>Reports</h1><div class="sub">' + esc(rep.range.label) + '</div></div>' +
      '<div class="row gap-sm"><button class="btn print-btn" data-action="print-report">🖨 Print</button>' +
      '<button class="btn btn-primary pdf-btn" data-action="pdf-report">⬇ PDF</button></div></div>';

    html += periodNavHTML();
    html += filterBarHTML(f, { showDates: false });

    html += '<div class="report-summary mt-3 mb-3">' +
      (showInc ? statCard('Income', money(rep.totalIncome), rep.income.length + ' entries', 'value-pos') : '') +
      (showExp ? statCard('Expenses', money(rep.totalExpense), rep.expense.length + ' entries', 'value-neg') : '') +
      (rep.type === 'both' ? statCard('Net', money(rep.net), rep.net >= 0 ? 'surplus' : 'deficit', rep.net >= 0 ? 'value-pos' : 'value-neg') : '') +
      statCard('Period length', rep.days + (rep.days === 1 ? ' day' : ' days'), rep.range.label) +
      '</div>';

    if (showExp) {
      html += breakdownCards(rep.catExpense, rep.totalExpense, 'By category', null);
      html += breakdownCards(rep.perExpense, rep.totalExpense, 'For whom', 'var(--accent)');
    }
    if (showInc) {
      html += breakdownCards(rep.catIncome, rep.totalIncome, 'By category', null);
      html += breakdownCards(rep.perIncome, rep.totalIncome, 'For whom', 'var(--accent)');
    }

    const listLabel = rep.type === 'expense' ? 'Expenses' : rep.type === 'income' ? 'Income' : 'Entries';
    html += '<div class="sec-block"><h3 class="sec-title">' + listLabel + '</h3>' +
      '<h4 class="sec-title lg">' + esc(rep.range.label) + '</h4>' +
      '<div class="card mt-2">' +
      (rep.listTxns.length
        ? '<ul class="txn-list">' + rep.listTxns.map((t) => txnItemHTML(t, { showDate: rep.days > 1 })).join('') + '</ul>'
        : emptyState('No entries in this period.')) +
      '</div></div>';

    return html;
  }

  /* ------------------------------------------------------------------ *
   * View: Settings
   * ------------------------------------------------------------------ */

  function catListHTML(type) {
    const list = state.categories[type];
    if (!list.length) return '<div class="hint" style="padding:14px">No categories yet.</div>';
    return '<div class="list">' + list.map((c) => {
      const icon = c.emoji ? esc(c.emoji) : esc((c.name.charAt(0) || '?').toUpperCase());
      return '<div class="list-item">' +
        '<span class="txn-ico" style="--c:' + esc(c.color) + '">' + icon + '</span>' +
        '<div class="grow"><div class="name">' + esc(c.name) + '</div></div>' +
        '<div class="actions">' +
        '<button class="icon-btn" data-action="edit-cat" data-type="' + type + '" data-id="' + esc(c.id) + '" title="Edit" aria-label="Edit">✎</button>' +
        '<button class="icon-btn danger" data-action="del-cat" data-type="' + type + '" data-id="' + esc(c.id) + '" title="Delete" aria-label="Delete">✕</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  function peopleListHTML() {
    if (!state.people.length) return '<div class="hint" style="padding:14px">No people yet. Add names like family members, employees or vendors.</div>';
    return '<div class="list">' + state.people.map((p) => {
      return '<div class="list-item"><div class="grow"><div class="name">' + esc(p.name) + '</div></div>' +
        '<div class="actions">' +
        '<button class="icon-btn" data-action="edit-person" data-id="' + esc(p.id) + '" title="Edit" aria-label="Edit">✎</button>' +
        '<button class="icon-btn danger" data-action="del-person" data-id="' + esc(p.id) + '" title="Delete" aria-label="Delete">✕</button>' +
        '</div></div>';
    }).join('') + '</div>';
  }

  function renderSettings() {
    const s = state.settings;
    const bytes = new Blob([JSON.stringify(state)]).size;
    const cur = CURRENCIES.find((c) => c.code === s.currency);

    return '<div class="page-head"><div><h1>Settings</h1><div class="sub">Preferences, categories and data</div></div></div>' +

      '<div class="card mb-3"><div class="card-head"><h3>Appearance</h3></div><div class="card-body">' +
      '<div class="grid grid-2">' +
      '<div class="field"><label>Theme</label><div class="segmented" id="theme-seg">' +
      ['light', 'dark', 'auto'].map((t) => '<button data-action="set-theme" data-theme="' + t + '" class="' + (s.theme === t ? 'active' : '') + '">' + (t === 'auto' ? 'System' : t.charAt(0).toUpperCase() + t.slice(1)) + '</button>').join('') +
      '</div></div>' +
      '<div class="field"><label>Report title</label><input type="text" id="set-title" value="' + esc(s.title) + '" placeholder="Cash Tracker"></div>' +
      '<div class="field"><label>Currency</label><select id="set-currency">' +
      CURRENCIES.map((c) => '<option value="' + c.code + '"' + (c.code === s.currency ? ' selected' : '') + '>' + esc(c.code + ' — ' + c.name) + '</option>').join('') +
      (cur ? '' : '<option value="' + esc(s.currency) + '" selected>' + esc(s.currency) + '</option>') +
      '</select></div>' +
      '<div class="field"><label>Week starts on</label><select id="set-weekstart">' +
      '<option value="sat"' + (s.weekStart === 'sat' ? ' selected' : '') + '>Saturday</option>' +
      '<option value="sun"' + (s.weekStart === 'sun' ? ' selected' : '') + '>Sunday</option>' +
      '<option value="mon"' + (s.weekStart === 'mon' ? ' selected' : '') + '>Monday</option>' +
      '</select></div>' +
      '</div>' +
      '</div></div>' +

      '<div class="grid grid-2 mb-3">' +
      '<div class="card"><div class="card-head"><h3>Expense categories</h3><button class="btn btn-sm" data-action="add-cat" data-type="expense">+ Add</button></div>' + catListHTML('expense') + '</div>' +
      '<div class="card"><div class="card-head"><h3>Income categories</h3><button class="btn btn-sm" data-action="add-cat" data-type="income">+ Add</button></div>' + catListHTML('income') + '</div>' +
      '</div>' +

      '<div class="card mb-3"><div class="card-head"><h3>"For whom" list</h3><button class="btn btn-sm" data-action="add-person">+ Add</button></div>' + peopleListHTML() + '</div>' +

      '<div class="card mb-3"><div class="card-head"><h3>Data</h3><span class="hint">' + (bytes / 1024).toFixed(1) + ' KB in LocalStorage</span></div><div class="card-body">' +
      '<p class="hint mb-3">Everything is stored locally. Back up regularly.</p>' +
      (storageOK ? '' : '<p class="hint mb-3" style="color:var(--neg)">⚠ LocalStorage is blocked in this context, so changes cannot be saved.</p>') +
      '<div class="row wrap gap-sm data-actions">' +
      '<button class="btn" data-action="export-json">⬇ Export backup (.json)</button>' +
      '<button class="btn" data-action="import-json">⬆ Import backup</button>' +
      '<button class="btn" data-action="export-csv">⬇ Export CSV</button>' +
      '<button class="btn btn-danger" data-action="clear-data">🗑 Clear all data</button>' +
      '</div>' +
      '<input type="file" id="import-file" accept="application/json,.json" class="hidden">' +
      '<details class="paste-box"><summary class="btn btn-sm">⌨ Paste a backup instead</summary>' +
      '<div class="paste-inner">' +
      '<textarea id="paste-json" placeholder=\'Paste the backup JSON here, then press Restore.\'></textarea>' +
      '<button class="btn btn-sm btn-primary mt-2" data-action="import-paste">Restore from pasted JSON</button>' +
      '</div></details>' +
      '</div></div>' +

      '<div class="credit">Cash Tracker &mdash; Fully Offline &mdash; by MSKCTG' +
      '<br><a href="https://sajjad-ctg.github.io/cashtracker/privacy.html" target="_blank" rel="noopener">Privacy policy</a>' +
      ' &middot; <a href="https://github.com/sajjad-ctg/cashtracker" target="_blank" rel="noopener">Source code</a></div>';
  }

  /* ------------------------------------------------------------------ *
   * Container compatibility
   *
   * Inside an Android WebView (APK wrapper) the browser-only APIs that
   * this app used to rely on may be missing:
   *   · window.print()      – not implemented by Android WebView
   *   · <a download> blobs  – ignored unless the host has a DownloadListener
   *   · confirm() / prompt()– silent no-ops unless onJsConfirm is handled
   *   · <input type=file>   – needs onShowFileChooser in the host
   * Everything below degrades gracefully and can also talk to a native
   * bridge (see README) when the wrapper injects one.
   * ------------------------------------------------------------------ */

  const BRIDGE_NAMES = ['AndroidBridge', 'Android', 'AndroidFile', 'NativeApp', 'WebAppBridge', 'Ebridge', 'JsBridge'];
  const BRIDGE_FNS = ['saveFile', 'save', 'download', 'downloadFile', 'writeFile'];

  function isWebView() {
    const ua = navigator.userAgent || '';
    if (/\bwv\b/.test(ua)) return true;                                   // Android WebView
    if (window.AndroidBridge || window.Android) return true;              // injected bridge
    if (window.webkit && window.webkit.messageHandlers) return true;      // WKWebView
    return false;
  }

  function detectBridge() {
    for (const name of BRIDGE_NAMES) {
      const b = window[name];
      if (!b || typeof b !== 'object') continue;
      for (const fn of BRIDGE_FNS) {
        if (typeof b[fn] === 'function') return { name: name, fn: fn, obj: b };
      }
    }
    return null;
  }

  function b64encode(str) {
    try {
      const bytes = new TextEncoder().encode(str);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    } catch (e) { return btoa(str); }
  }

  function dataUriToBlob(uri) {
    const comma = uri.indexOf(',');
    const meta = uri.slice(0, comma);
    const data = uri.slice(comma + 1);
    const mime = (meta.match(/:(.*?);/) || [, 'application/octet-stream'])[1];
    const bin = atob(data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function legacyCopy(text) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, ta.length);
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch (e) { return false; }
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(() => true).catch(() => legacyCopy(text));
    }
    return Promise.resolve(legacyCopy(text));
  }

  /**
   * Save a file, using the best mechanism available:
   *   1. native bridge  (window.AndroidBridge.saveFile(name, mime, base64))
   *   2. blob + <a download>   (works in any real browser)
   *   3. clipboard copy        (text payloads only)
   */
  function saveFile(filename, mime, content) {
    if (content instanceof Blob) {
      // convert to a data URI first so the bridge can receive base64
      const reader = new FileReader();
      reader.onload = function () { saveFile(filename, mime, String(reader.result)); };
      reader.onerror = function () { toast('Could not read the file.', 'err'); };
      reader.readAsDataURL(content);
      return true;
    }
    const isDataUri = typeof content === 'string' && content.slice(0, 5) === 'data:';
    const base64 = isDataUri
      ? content.slice(content.indexOf(',') + 1)
      : (typeof content === 'string' ? b64encode(content) : null);

    const bridge = detectBridge();
    if (bridge && base64) {
      try {
        const res = bridge.obj[bridge.fn](filename, mime, base64);
        if (res && typeof res.then === 'function') {
          res.then(function (r) { toast('Saved to Downloads.'); })
            .catch(function (err) {
              const msg = (err && err.message) || String(err);
              toast('Save failed: ' + msg, 'err');
              if (isWebView() && !isDataUri) {
                copyText(content).then(function (ok) {
                  toast(ok ? 'Copied to clipboard instead.' : 'Could not copy either.', ok ? 'ok' : 'err');
                });
              } else {
                downloadViaBrowser(filename, mime, content, isDataUri);
              }
            });
          return true;
        }
        toast('Saved to Downloads.');
        return true;
      } catch (e) {
        toast('Save failed: ' + ((e && e.message) || e), 'err');
        downloadViaBrowser(filename, mime, content, isDataUri);
        return true;
      }
    }
    downloadViaBrowser(filename, mime, content, isDataUri);
    return true;
  }

  function downloadViaBrowser(filename, mime, content, isDataUri) {
    try {
      const blob = isDataUri ? dataUriToBlob(content)
        : new Blob([content], { type: mime || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 5000);
      toast('Download started.');
    } catch (e) {
      if (typeof content === 'string' && !isDataUri) {
        copyText(content).then((ok) => {
          toast(ok ? 'Copied to clipboard — paste it anywhere to save.' : 'This app build cannot save files.', ok ? 'ok' : 'err');
        });
      } else {
        toast('This app build cannot save files.', 'err');
      }
    }
  }

  /* ---- in-app confirmation (works without native dialogs) ---- */

  let dlgResolve = null;

  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise((resolve) => {
      dlgResolve = resolve;
      openModal(
        '<div class="modal-head"><h3>' + esc(opts.title || 'Are you sure?') + '</h3>' +
        '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>' +
        '<div class="modal-body"><p class="dlg-text">' + esc(opts.message || '') + '</p></div>' +
        '<div class="modal-foot">' +
        '<button type="button" class="btn" data-action="close-modal">Cancel</button>' +
        '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-action="dlg-ok">' + esc(opts.confirmLabel || 'Confirm') + '</button>' +
        '</div>');
    });
  }

  function resolveDialog(value) {
    if (!dlgResolve) return;
    const r = dlgResolve;
    dlgResolve = null;
    r(value);
  }

  /**
   * True when the file may not be savable directly and the user should be
   * offered the copy-to-clipboard fallback.  A native bridge can always save.
   */
  function needsExportSheet() {
    return isWebView() && !detectBridge();
  }

  /* ---- export sheet (used when the container may not support downloads) ---- */

  let sheetPayload = null;

  function exportSheet(title, filename, mime, content, hint) {
    sheetPayload = { filename: filename, mime: mime, content: content };
    const isDataUri = typeof content === 'string' && content.slice(0, 5) === 'data:';
    const canCopy = typeof content === 'string' && !isDataUri;
    openModal(
      '<div class="modal-head"><h3>' + esc(title) + '</h3>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>' +
      '<div class="modal-body">' +
      '<p class="dlg-file">' + esc(filename) + '</p>' +
      (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') +
      '</div>' +
      '<div class="modal-foot">' +
      '<button type="button" class="btn" data-action="close-modal">Cancel</button>' +
      (canCopy ? '<button type="button" class="btn" data-action="sheet-copy">📋 Copy</button>' : '') +
      '<button type="button" class="btn btn-primary" data-action="sheet-download">⬇ Download</button>' +
      '</div>');
  }

  /* ------------------------------------------------------------------ *
   * Modal
   * ------------------------------------------------------------------ */

  function closeModal() {
    if (dlgResolve) resolveDialog(false);
    sheetPayload = null;
    $('#modal-root').innerHTML = '';
    document.body.style.overflow = '';
  }

  function openModal(html) {
    const root = $('#modal-root');
    root.innerHTML = '<div class="overlay" data-action="close-overlay"><div class="modal">' + html + '</div></div>';
    document.body.style.overflow = 'hidden';
  }

  let txnDraft = null;

  function txnModal(id, keepDraft) {
    const editing = id ? byId(state.txns, id) : null;
    let t;
    if (editing) {
      t = { id: editing.id, type: editing.type, amountCents: editing.amountCents, date: editing.date, categoryId: editing.categoryId, personId: editing.personId, note: editing.note };
    } else if (keepDraft && txnDraft) {
      t = Object.assign({}, txnDraft);
    } else {
      t = { id: '', type: 'expense', amountCents: 0, date: todayISO(), categoryId: null, personId: null, note: '' };
    }
    txnDraft = t;
    const cats = state.categories[t.type];
    if (t.categoryId && !cats.find((c) => c.id === t.categoryId)) t.categoryId = null;

    const personNameVal = t.personName != null ? t.personName
      : (t.personId ? ((byId(state.people, t.personId) || {}).name || '') : '');

    const catChips = cats.map((c) =>
      '<button type="button" class="chip-cat' + (c.id === t.categoryId ? ' active' : '') + '" data-action="pick-cat" data-id="' + esc(c.id) + '">' +
      (c.emoji ? '<span class="chip-emoji">' + esc(c.emoji) + '</span>' : '<span class="txn-ico chip-ico" style="--c:' + esc(c.color) + '">' + esc((c.name.charAt(0) || '?').toUpperCase()) + '</span>') +
      '<span class="chip-name">' + esc(c.name) + '</span></button>'
    ).join('');

    const peopleList = state.people.map((p) => '<option value="' + esc(p.name) + '"></option>').join('');

    const html =
      '<form id="txn-form" data-id="' + esc(t.id || '') + '" data-type="' + esc(t.type) + '">' +
      '<div class="modal-head"><h3>' + (editing ? 'Edit ' + (t.type === 'income' ? 'income' : 'expense') : (t.type === 'income' ? 'Add Income' : 'Add Expense')) + '</h3>' +
      '<button type="button" class="icon-btn" data-action="close-modal" aria-label="Close">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="segmented" style="align-self:flex-start">' +
      '<button type="button" data-action="modal-type" data-type="expense" class="' + (t.type === 'expense' ? 'active' : '') + '">Expense</button>' +
      '<button type="button" data-action="modal-type" data-type="income" class="' + (t.type === 'income' ? 'active' : '') + '">Income</button>' +
      '</div>' +
      '<div class="field"><label>Amount *</label><div class="amount-input"><span class="sym">' + esc(currencySymbol()) + '</span>' +
      '<input type="number" step="0.01" min="0" inputmode="decimal" enterkeyhint="done" id="f-amount" placeholder="0.00" value="' + (t.amountCents ? (t.amountCents / 100).toFixed(2) : '') + '" required></div></div>' +
      '<div class="field"><label>Date *</label><input type="date" id="f-date" value="' + esc(t.date) + '" required></div>' +
      '<div class="field"><label>Category *</label>' +
      '<div class="chip-grid" id="f-cat-grid">' + (catChips || '<div class="hint">No categories yet — add some in Settings.</div>') + '</div>' +
      '<input type="hidden" id="f-cat" value="' + esc(t.categoryId || '') + '">' +
      '</div>' +
      '<div class="field"><label>' + (t.type === 'income' ? 'Client' : 'For whom') + ' <span class="help">(optional)</span></label>' +
      '<input type="text" id="f-person-text" list="people-list" autocomplete="off" placeholder="' + (t.type === 'income' ? 'e.g. Acme Ltd, John Doe' : 'e.g. Self, Family, Home') + '" value="' + esc(personNameVal) + '">' +
      '<datalist id="people-list">' + peopleList + '</datalist>' +
      '<div class="datalist-hint">Pick a saved name or type a new one.</div>' +
      '</div>' +
      '<div class="field"><label>Note <span class="help">(optional)</span></label>' +
      '<input type="text" id="f-note" maxlength="500" placeholder="Optional note" value="' + esc(t.note) + '"></div>' +
      '</div>' +
      '<div class="modal-foot">' +
      (editing ? '<button type="button" class="btn btn-danger" data-action="delete-txn" data-id="' + esc(editing.id) + '" style="margin-right:auto">Delete</button>' : '') +
      '<button type="button" class="btn" data-action="close-modal">Cancel</button>' +
      '<button type="submit" class="btn btn-primary">' + (editing ? 'Save changes' : (t.type === 'income' ? 'Save income' : 'Save expense')) + '</button>' +
      '</div></form>';

    openModal(html);
    const amt = $('#f-amount');
    if (amt && !editing) amt.focus();
  }
  function catModal(type, id) {
    const c = id ? byId(state.categories[type], id) : null;
    const cat = c || { name: '', color: COLOR_PALETTE[state.categories[type].length % COLOR_PALETTE.length], emoji: '' };
    const html =
      '<form id="cat-form" data-type="' + esc(type) + '" data-id="' + esc(c ? c.id : '') + '">' +
      '<div class="modal-head"><h3>' + (c ? 'Edit category' : 'New category') + '</h3>' +
      '<button type="button" class="icon-btn" data-action="close-modal">✕</button></div>' +
      '<div class="modal-body">' +
      '<div class="field"><label>Name *</label><input type="text" id="c-name" maxlength="40" value="' + esc(cat.name) + '" placeholder="e.g. Groceries" required></div>' +
      '<div class="row-2">' +
      '<div class="field"><label>Colour</label><input type="color" id="c-color" value="' + esc(cat.color) + '">' +
      '<div class="row wrap gap-sm mt-2">' + COLOR_PALETTE.map((col) => '<button type="button" class="icon-btn" data-action="pick-color" data-color="' + col + '" style="background:' + col + ';border-radius:6px;width:22px;height:22px"></button>').join('') + '</div></div>' +
      '<div class="field"><label>Icon</label><input type="text" id="c-emoji" maxlength="4" value="' + esc(cat.emoji) + '" placeholder="optional">' +
      '<div class="row wrap gap-sm mt-2">' + EMOJI_PALETTE.filter(Boolean).map((e) => '<button type="button" class="btn btn-sm" data-action="pick-emoji" data-emoji="' + e + '">' + e + '</button>').join('') + '</div></div>' +
      '</div></div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button>' +
      '<button type="submit" class="btn btn-primary">' + (c ? 'Save' : 'Add category') + '</button></div></form>';
    openModal(html);
    const n = $('#c-name');
    if (n) n.focus();
  }

  function personModal(id) {
    const p = id ? byId(state.people, id) : null;
    const html =
      '<form id="person-form" data-id="' + esc(p ? p.id : '') + '">' +
      '<div class="modal-head"><h3>' + (p ? 'Edit person' : 'New person') + '</h3>' +
      '<button type="button" class="icon-btn" data-action="close-modal">✕</button></div>' +
      '<div class="modal-body"><div class="field"><label>Name *</label>' +
      '<input type="text" id="p-name" maxlength="40" value="' + esc(p ? p.name : '') + '" placeholder="e.g. Ahmed" required></div></div>' +
      '<div class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancel</button>' +
      '<button type="submit" class="btn btn-primary">' + (p ? 'Save' : 'Add') + '</button></div></form>';
    openModal(html);
    const n = $('#p-name');
    if (n) n.focus();
  }

  /* ------------------------------------------------------------------ *
   * Actions
   * ------------------------------------------------------------------ */

  function addTxn(form) {
    const type = form.dataset.type || 'expense';
    const amount = toCents($('#f-amount').value);
    const date = $('#f-date').value;
    const catId = ($('#f-cat') ? $('#f-cat').value : '') || null;
    const note = ($('#f-note').value || '').trim();
    let personId = null;

    const ptext = (($('#f-person-text') || {}).value || '').trim();
    if (ptext) {
      const existing = state.people.find((p) => p.name.toLowerCase() === ptext.toLowerCase());
      if (existing) personId = existing.id;
      else { personId = uid(); state.people.push({ id: personId, name: ptext }); }
    }

    if (amount == null || amount <= 0) { toast('Enter an amount greater than zero.', 'err'); $('#f-amount').focus(); return; }
    if (!date) { toast('Pick a date.', 'err'); return; }
    if (!catId) { toast('Choose a category.', 'err'); return; }

    const id = form.dataset.id;
    if (id) {
      const t = byId(state.txns, id);
      if (t) {
        t.type = type; t.amountCents = amount; t.date = date; t.categoryId = catId; t.personId = personId; t.note = note;
      }
    } else {
      state.txns.push({ id: uid(), type: type, amountCents: amount, date: date, categoryId: catId, personId: personId, note: note, createdAt: Date.now() });
    }
    save();
    closeModal();
    render();
    toast(id ? 'Entry updated.' : 'Entry added.');
  }

  function deleteTxn(id) {
    const t = byId(state.txns, id);
    if (!t) return;
    const label = categoryName(t) + ' · ' + money(t.amountCents) + ' · ' + fmtDate(t.date);
    confirmDialog({
      title: 'Delete entry?',
      message: 'Delete this entry?\n\n' + label,
      confirmLabel: 'Delete',
      danger: true
    }).then((ok) => {
      if (!ok) return;
      state.txns = state.txns.filter((x) => x.id !== id);
      save();
      closeModal();
      render();
      toast('Entry deleted.');
    });
  }

  function saveCategory(form) {
    const type = form.dataset.type;
    const id = form.dataset.id;
    const name = ($('#c-name').value || '').trim();
    if (!name) { toast('Enter a name.', 'err'); return; }
    const color = $('#c-color').value;
    const emoji = ($('#c-emoji').value || '').trim().slice(0, 4);
    const dup = state.categories[type].some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id);
    if (dup) { toast('A category with that name already exists.', 'err'); return; }
    if (id) {
      const c = byId(state.categories[type], id);
      if (c) { c.name = name; c.color = color; c.emoji = emoji; }
    } else {
      state.categories[type].push({ id: uid(), name: name, color: color, emoji: emoji });
    }
    save(); closeModal(); render();
    toast(id ? 'Category updated.' : 'Category added.');
  }

  function deleteCategory(type, id) {
    const c = byId(state.categories[type], id);
    if (!c) return;
    const used = state.txns.filter((t) => t.type === type && t.categoryId === id).length;
    const msg = used
      ? 'Delete category "' + c.name + '"?\n\nIt is used by ' + used + ' entr' + (used === 1 ? 'y' : 'ies') + '. Those entries will be marked as "Uncategorised".'
      : 'Delete category "' + c.name + '"?';
    confirmDialog({ title: 'Delete category?', message: msg, confirmLabel: 'Delete', danger: true }).then((ok) => {
      if (!ok) return;
      state.categories[type] = state.categories[type].filter((x) => x.id !== id);
      state.txns.forEach((t) => { if (t.type === type && t.categoryId === id) t.categoryId = null; });
      save(); render();
      toast('Category deleted.');
    });
  }

  function savePerson(form) {
    const id = form.dataset.id;
    const name = ($('#p-name').value || '').trim();
    if (!name) { toast('Enter a name.', 'err'); return; }
    if (id) {
      const p = byId(state.people, id);
      if (p) p.name = name;
    } else {
      state.people.push({ id: uid(), name: name });
    }
    save(); closeModal(); render();
    toast(id ? 'Person updated.' : 'Person added.');
  }

  function deletePerson(id) {
    const p = byId(state.people, id);
    if (!p) return;
    const used = state.txns.filter((t) => t.personId === id).length;
    const msg = used ? 'Remove "' + p.name + '"?\n\n' + used + ' entr' + (used === 1 ? 'y' : 'ies') + ' will become unassigned.' : 'Remove "' + p.name + '"?';
    confirmDialog({ title: 'Remove person?', message: msg, confirmLabel: 'Remove', danger: true }).then((ok) => {
      if (!ok) return;
      state.people = state.people.filter((x) => x.id !== id);
      state.txns.forEach((t) => { if (t.personId === id) t.personId = null; });
      save(); render();
      toast('Person removed.');
    });
  }

  /* ---- data import / export ---- */

  function download(filename, content, mime) {
    // kept for backwards compatibility – routes through saveFile()
    saveFile(filename, mime || 'text/plain;charset=utf-8', content);
  }

  function exportJSON() {
    const payload = JSON.stringify(state, null, 2);
    const filename = 'cashtracker-backup-' + todayISO() + '.json';
    if (needsExportSheet()) {
      exportSheet('Export backup', filename, 'application/json', payload,
        'This app build may not support direct downloads. If nothing happens, use Copy and paste the text into any file app.');
    } else {
      saveFile(filename, 'application/json', payload);
    }
  }

  function exportCSV() {
    const rows = state.txns.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const head = ['Date', 'Type', 'Category', 'For whom', 'Note', 'Amount'];
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const body = rows.map((t) => [t.date, t.type, categoryName(t), personName(t), t.note, ((t.type === 'income' ? 1 : -1) * t.amountCents / 100).toFixed(2)]);
    const csv = head.map(q).join(',') + '\n' + body.map((r) => r.map(q).join(',')).join('\n');
    const filename = 'cashtracker-' + todayISO() + '.csv';
    if (needsExportSheet()) {
      exportSheet('Export CSV', filename, 'text/csv', csv,
        'If the download does not start, use Copy and paste the text into any file app.');
    } else {
      saveFile(filename, 'text/csv;charset=utf-8', csv);
    }
  }

  function applyImport(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.txns)) throw new Error('bad file');
    state = migrate(data);
    save(); render();
    toast('Backup imported.');
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        confirmDialog({
          title: 'Import backup?',
          message: 'Import this backup? Current data will be replaced.',
          confirmLabel: 'Import'
        }).then((ok) => {
          if (!ok) return;
          try { applyImport(data); } catch (e) { toast('Could not read that file.', 'err'); }
        });
      } catch (e) {
        toast('Could not read that file.', 'err');
      }
    };
    reader.onerror = () => toast('Could not read that file.', 'err');
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------------ *
   * Print report
   * ------------------------------------------------------------------ */

  function buildPrintHTML(rep) {
    const title = state.settings.title || 'Cash Tracker';
    const showExp = rep.type === 'expense' || rep.type === 'both';
    const showInc = rep.type === 'income' || rep.type === 'both';

    const cards = [];
    if (showInc) cards.push(['Income', money(rep.totalIncome)]);
    if (showExp) cards.push(['Expenses', money(rep.totalExpense)]);
    if (rep.type === 'both') cards.push(['Net', money(rep.net)]);
    cards.push(['Entries', String(rep.count)]);

    let h = '<div class="p-title">' + esc(title) + ' — ' + (rep.type === 'income' ? 'Income' : rep.type === 'expense' ? 'Expense' : 'Income & Expense') + ' Report</div>';
    h += '<div class="p-sub">Period: ' + esc(rep.range.label) + ' &nbsp;·&nbsp; Generated ' + esc(fmtDate(todayISO())) +
      (state.settings.owner ? ' &nbsp;·&nbsp; ' + esc(state.settings.owner) : '') +
      ' &nbsp;·&nbsp; Currency: ' + esc(state.settings.currency) + '</div>';

    const fs = reportFilterSummary(rep);
    if (fs) h += '<div class="p-sub">' + esc(fs) + '</div>';

    h += '<div class="p-cards">' + cards.map((c) => '<div class="p-card"><div class="k">' + esc(c[0]) + '</div><div class="v">' + c[1] + '</div></div>').join('') + '</div>';

    const table = (groups, total, name) => {
      if (!groups.length) return '';
      let t = '<div class="p-section"><h2>' + esc(name) + '</h2><table><thead><tr><th>Name</th><th style="width:60px">Entries</th><th class="num" style="width:90px">Amount</th><th style="width:120px">Share</th></tr></thead><tbody>' +
        groups.map((g) => {
          const pct = total ? (g.amount / total) * 100 : 0;
          return '<tr><td>' + esc(g.name) + '</td><td class="num">' + g.count + '</td><td class="num">' + money(g.amount) + '</td>' +
            '<td><div class="p-bar"><span style="width:' + pct.toFixed(1) + '%"></span></div></td></tr>';
        }).join('') +
        '</tbody><tfoot><tr><td>Total</td><td class="num">' + sum(groups, (g) => g.count) + '</td><td class="num">' + money(total) + '</td><td></td></tr></tfoot></table></div>';
      return t;
    };

    if (showExp) { h += table(rep.catExpense, rep.totalExpense, 'Expenses by category'); h += table(rep.perExpense, rep.totalExpense, 'Expenses by whom'); }
    if (showInc) { h += table(rep.catIncome, rep.totalIncome, 'Income by category'); h += table(rep.perIncome, rep.totalIncome, 'Income by whom'); }

    if (rep.listTxns.length) {
      h += '<div class="p-section"><h2>Entries</h2><table><thead><tr><th style="width:70px">Date</th><th style="width:55px">Type</th><th style="width:110px">Category</th><th style="width:90px">For whom</th><th>Note</th><th class="num" style="width:85px">Amount</th></tr></thead><tbody>' +
        rep.listTxns.map((t) => '<tr><td>' + esc(fmtDate(t.date)) + '</td><td>' + (t.type === 'income' ? 'Income' : 'Expense') + '</td><td>' + esc(categoryName(t)) +
          '</td><td>' + esc(personName(t) || '—') + '</td><td>' + esc(t.note || '') + '</td><td class="num">' + (t.type === 'income' ? '+' : '−') + money(t.amountCents) + '</td></tr>').join('') +
        '</tbody></table></div>';
    } else {
      h += '<div class="p-section"><h2>Entries</h2><div class="p-muted">No entries in this period.</div></div>';
    }

    h += '<div class="p-foot">Generated by ' + esc(title) + ' · ' + esc(fmtDate(todayISO())) + ' · Offline cash tracker</div>';
    return h;
  }

  function reportFilterSummary(rep) {
    const f = rep.filter || {};
    const bits = [];
    if (f.cats && f.cats.length) {
      bits.push('Categories: ' + f.cats.map((id) => { const c = categoryById(id); return c ? c.name : 'Uncategorised'; }).join(', '));
    }
    if (f.people && f.people.length) {
      bits.push('For whom: ' + f.people.map((id) => id === 'none' ? 'Unassigned' : ((byId(state.people, id) || {}).name || 'Unknown')).join(', '));
    }
    if (f.min !== '' && f.min != null) bits.push('Min ' + money(Math.round(Number(f.min) * 100)));
    if (f.max !== '' && f.max != null) bits.push('Max ' + money(Math.round(Number(f.max) * 100)));
    if (f.q) bits.push('Search: "' + f.q + '"');
    return bits.join('  ·  ');
  }

  function printReport() {
    const rep = buildReport();
    $('#print-area').innerHTML = buildPrintHTML(rep);

    if (needsExportSheet()) {
      // Android WebView has no print implementation – offer the PDF instead.
      exportSheet(
        'Print report',
        (state.settings.title || 'Cash Tracker') + ' - Report ' + todayISO() + '.pdf',
        'application/pdf',
        buildPdfDataUri(rep),
        'This app build cannot open the system print dialog. Download the PDF and print it from any file viewer.'
      );
      return;
    }

    const oldTitle = document.title;
    document.title = (state.settings.title || 'Cash Tracker') + ' - Report ' + todayISO();
    setTimeout(() => {
      try { window.print(); } finally { document.title = oldTitle; }
    }, 60);
  }

  /* ------------------------------------------------------------------ *
   * PDF export (jsPDF + autotable)
   * ------------------------------------------------------------------ */

  function hexToRgb(hex) {
    const h = String(hex || '#000000').replace('#', '');
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0];
  }

  function atTable(doc, opts) {
    let res = null;
    if (typeof doc.autoTable === 'function') {
      res = doc.autoTable(opts);
    } else {
      const at = window.autoTable && (window.autoTable.autoTable || window.autoTable.default);
      if (typeof at !== 'function') throw new Error('AutoTable plugin unavailable');
      res = at(doc, opts);
    }
    if (res && typeof res.finalY === 'number') return res;
    if (doc.lastAutoTable && typeof doc.lastAutoTable.finalY === 'number') return doc.lastAutoTable;
    return { finalY: opts.startY };
  }

  function buildPdf(rep) {
    if (!window.jspdf || !window.jspdf.jsPDF) { toast('PDF library not available.', 'err'); return null; }
    const title = state.settings.title || 'Cash Tracker';
    const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 12;
    const contentW = pageW - margin * 2;
    let y = margin;

    const GRAY = [110, 118, 129];
    const HEADBG = [243, 244, 246];
    const LINE = [222, 226, 231];
    const INK = [25, 30, 36];

    doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor.apply(doc, INK);
    doc.text(title + ' — ' + (rep.type === 'income' ? 'Income' : rep.type === 'expense' ? 'Expense' : 'Income & Expense') + ' Report', margin, y + 6);

    y += 11;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, GRAY);
    doc.text('Period: ' + rep.range.label + '    ·    Generated ' + fmtDate(todayISO()) + '    ·    Currency: ' + state.settings.currency, margin, y);
    y += 5;
    const fs = reportFilterSummary(rep);
    if (fs) { doc.text(fs, margin, y); y += 5; }

    // summary cards
    y += 3;
    const cards = [];
    if (rep.type === 'income' || rep.type === 'both') cards.push(['Income', money(rep.totalIncome)]);
    if (rep.type === 'expense' || rep.type === 'both') cards.push(['Expenses', money(rep.totalExpense)]);
    if (rep.type === 'both') cards.push(['Net', money(rep.net)]);
    cards.push(['Entries', String(rep.count)]);

    const cw = contentW / cards.length;
    const ch = 16;
    doc.setDrawColor.apply(doc, LINE);
    cards.forEach((c, i) => {
      const x = margin + i * cw;
      doc.setFillColor.apply(doc, HEADBG);
      doc.rect(x, y, cw - 2, ch, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRAY);
      doc.text(c[0], x + 3, y + 5.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor.apply(doc, INK);
      doc.text(c[1], x + 3, y + 12.5);
    });
    y += ch + 6;

    const styleBase = {
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 1.8, lineColor: LINE, lineWidth: 0.1, textColor: INK },
      headStyles: { fillColor: HEADBG, textColor: INK, fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [250, 250, 251] },
      margin: { left: margin, right: margin },
      didDrawPage: function () { }
    };

    function section(label, groups, total) {
      if (!groups.length) return;
      if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor.apply(doc, INK);
      doc.text(label, margin, y);
      y += 2;
      const res = atTable(doc, Object.assign({}, styleBase, {
        startY: y,
        head: [['Name', 'Entries', 'Amount', 'Share']],
        body: groups.map((g) => {
          const pct = total ? ((g.amount / total) * 100).toFixed(1) : '0.0';
          return [g.name, String(g.count), money(g.amount), pct + '%'];
        }),
        foot: [['Total', String(sum(groups, (g) => g.count)), money(total), '']],
        footStyles: { fillColor: HEADBG, textColor: INK, fontStyle: 'bold', fontSize: 8.5 },
        columnStyles: {
          1: { halign: 'right', cellWidth: 20 },
          2: { halign: 'right', cellWidth: 32 },
          3: { halign: 'right', cellWidth: 22 }
        }
      }));
      y = res.finalY + 7;
    }

    if (rep.type === 'expense' || rep.type === 'both') {
      section('Expenses by category', rep.catExpense, rep.totalExpense);
      section('Expenses by whom', rep.perExpense, rep.totalExpense);
    }
    if (rep.type === 'income' || rep.type === 'both') {
      section('Income by category', rep.catIncome, rep.totalIncome);
      section('Income by whom', rep.perIncome, rep.totalIncome);
    }

    // entries table
    if (rep.listTxns.length) {
      if (y > doc.internal.pageSize.getHeight() - 45) { doc.addPage(); y = margin; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor.apply(doc, INK);
      doc.text('Entries', margin, y);
      y += 2;
      const res = atTable(doc, Object.assign({}, styleBase, {
        startY: y,
        head: [['Date', 'Type', 'Category', 'For whom', 'Note', 'Amount']],
        body: rep.listTxns.map((t) => [
          fmtDate(t.date),
          t.type === 'income' ? 'Income' : 'Expense',
          categoryName(t),
          personName(t) || '—',
          t.note || '',
          (t.type === 'income' ? '+' : '-') + money(t.amountCents)
        ]),
        columnStyles: {
          0: { cellWidth: 20 }, 1: { cellWidth: 15 }, 2: { cellWidth: 32 },
          3: { cellWidth: 26 }, 4: { cellWidth: 'auto' }, 5: { cellWidth: 26, halign: 'right' }
        }
      }));
      y = res.finalY + 5;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor.apply(doc, GRAY);
      doc.text('No entries in this period.', margin, y + 2);
    }

    // footers
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      const h = doc.internal.pageSize.getHeight();
      doc.setDrawColor.apply(doc, LINE);
      doc.line(margin, h - 12, pageW - margin, h - 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor.apply(doc, GRAY);
      doc.text(title + ' · ' + rep.range.label, margin, h - 7);
      doc.text('Page ' + i + ' of ' + pages, pageW - margin, h - 7, { align: 'right' });
    }

    return doc;
  }

  function buildPdfDataUri(rep) {
    const doc = buildPdf(rep);
    if (!doc) return null;
    try { return doc.output('datauristring'); } catch (e) { return null; }
  }

  function exportPDF() {
    const rep = buildReport();
    const title = state.settings.title || 'Cash Tracker';
    const filename = title.replace(/[\\/:*?"<>|]/g, '-') + ' - Report ' + todayISO() + '.pdf';
    const uri = buildPdfDataUri(rep);
    if (!uri) { toast('PDF could not be created.', 'err'); return; }
    if (needsExportSheet()) {
      exportSheet('Download PDF', filename, 'application/pdf', uri,
        'If the download does not start, open the file from the app\'s own download folder or use a wrapper with download support.');
    } else {
      saveFile(filename, 'application/pdf', uri);
    }
  }

  /* ------------------------------------------------------------------ *
   * Rendering & routing
   * ------------------------------------------------------------------ */

  function navHTML() {
    const r = viewState.route;
    return NAV.map((n) => '<a href="#/' + n.id + '" class="' + (n.id === r ? 'active' : '') + '">' + esc(n.label) + '</a>').join('');
  }

  let renderQueued = false;
  function render() {
    if (renderQueued) return;
    renderQueued = true;
    try {
      doRender();
    } finally {
      renderQueued = false;
    }
  }

  function doRender() {
    const active = document.activeElement;
    const focusId = active && active.id ? active.id : null;
    const selStart = active && active.selectionStart != null ? active.selectionStart : null;

    viewState.route = currentRoute();
    $('#nav').innerHTML = navHTML();
    $$('#mobile-nav [data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === viewState.route));

    let html = '';
    if (viewState.route === 'dashboard') html = renderDashboard();
    else if (viewState.route === 'transactions') html = renderTransactions();
    else if (viewState.route === 'reports') html = renderReports();
    else if (viewState.route === 'settings') html = renderSettings();
    $('#view').innerHTML = html;

    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) {
        el.focus();
        if (selStart != null && el.setSelectionRange) { try { el.setSelectionRange(selStart, selStart); } catch (e) { } }
      }
    }
  }

  window.addEventListener('hashchange', render);
  window.addEventListener('resize', debounce(() => {
    if (viewState.route === 'dashboard') render();
  }, 220));
  window.addEventListener('orientationchange', () => setTimeout(render, 250));

  /* ------------------------------------------------------------------ *
   * Event wiring
   * ------------------------------------------------------------------ */

  function targetFilter(filter) {
    return viewState.route === 'reports' ? viewState.report.filter : viewState.txnFilter;
  }

  document.addEventListener('click', function (e) {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const a = el.dataset.action;

    switch (a) {
      case 'add-txn': e.preventDefault(); txnModal(null); break;

      case 'edit-txn': e.preventDefault(); txnModal(el.dataset.id); break;

      case 'delete-txn': e.preventDefault(); deleteTxn(el.dataset.id); break;

      case 'close-modal': e.preventDefault(); closeModal(); break;

      case 'dlg-ok': e.preventDefault(); resolveDialog(true); closeModal(); break;

      case 'dlg-cancel': e.preventDefault(); resolveDialog(false); closeModal(); break;

      case 'sheet-download': {
        e.preventDefault();
        const p = sheetPayload;
        sheetPayload = null;
        closeModal();
        if (p) saveFile(p.filename, p.mime, p.content);
        break;
      }

      case 'sheet-copy': {
        e.preventDefault();
        const p = sheetPayload;
        if (p && typeof p.content === 'string') {
          copyText(p.content).then((ok) => {
            toast(ok ? 'Copied to clipboard — paste it anywhere to save.' : 'Clipboard is not available.', ok ? 'ok' : 'err');
          });
        }
        break;
      }

      case 'close-overlay': if (e.target === el) closeModal(); break;

      case 'toggle-theme': {
        e.preventDefault();
        const cur = effectiveTheme();
        state.settings.theme = cur === 'dark' ? 'light' : 'dark';
        save(); applyTheme(); render();
        break;
      }

      case 'set-theme': state.settings.theme = el.dataset.theme; save(); applyTheme(); render(); break;

      case 'reset-filters': {
        const f = targetFilter();
        const keep = { type: f.type };
        Object.assign(f, emptyFilter(), keep);
        render();
        break;
      }

      /* sort */
      case 'sort': break;

      /* categories */
      case 'add-cat': catModal(el.dataset.type, null); break;
      case 'edit-cat': catModal(el.dataset.type, el.dataset.id); break;
      case 'del-cat': deleteCategory(el.dataset.type, el.dataset.id); break;
      case 'pick-color': { const c = $('#c-color'); if (c) c.value = el.dataset.color; break; }
      case 'pick-emoji': { const c = $('#c-emoji'); if (c) c.value = el.dataset.emoji; break; }

      /* people */
      case 'add-person': personModal(null); break;
      case 'edit-person': personModal(el.dataset.id); break;
      case 'del-person': deletePerson(el.dataset.id); break;

      /* modal type toggle */
      case 'modal-type': {
        const amount = $('#f-amount') ? $('#f-amount').value : '';
        const date = $('#f-date') ? $('#f-date').value : todayISO();
        const note = $('#f-note') ? $('#f-note').value : '';
        const person = $('#f-person-text') ? $('#f-person-text').value : '';
        txnDraft = {
          id: txnDraft ? txnDraft.id : '',
          type: el.dataset.type,
          amountCents: toCents(amount) || 0,
          date: date || todayISO(),
          categoryId: null,
          personId: null,
          personName: person,
          note: note
        };
        txnModal(txnDraft.id || null, true);
        break;
      }

      /* category chip */
      case 'pick-cat': {
        const hidden = $('#f-cat');
        if (hidden) hidden.value = el.dataset.id;
        $$('#f-cat-grid .chip-cat').forEach((c) => c.classList.toggle('active', c === el));
        break;
      }

      /* filter panel */
      case 'toggle-filters': {
        const key = filterOpenKey();
        viewState[key] = !viewState[key];
        const card = $('#filter-card');
        if (card) card.classList.toggle('open', viewState[key]);
        break;
      }

      /* close a dropdown panel */
      case 'close-dd': {
        const dd = el.closest('details');
        if (dd) dd.open = false;
        break;
      }

      /* report */
      case 'set-preset': {
        const p = viewState.report;
        p.preset = el.dataset.preset;
        if (p.preset === 'today') { /* nothing */ }
        if (p.preset === 'day' || p.preset === 'week') p.anchor = todayISO();
        if (p.preset === 'month') p.month = monthKey(todayISO());
        if (p.preset === 'custom') {
          const r = periodRange();
          if (!p.from || !p.to) { p.from = r.from || monthStart(monthKey(todayISO())); p.to = r.to || monthEnd(monthKey(todayISO())); }
        }
        render();
        break;
      }
      case 'set-rtype': viewState.report.type = el.dataset.rtype; render(); break;
      case 'period-shift': {
        const p = viewState.report;
        const dir = Number(el.dataset.dir);
        if (p.preset === 'month') p.month = shiftMonth(p.month, dir);
        else if (p.preset === 'week') p.anchor = addDays(p.anchor, 7 * dir);
        else if (p.preset === 'day') p.anchor = addDays(p.anchor, dir);
        render();
        break;
      }
      case 'print-report': printReport(); break;
      case 'pdf-report': try { exportPDF(); } catch (err) { console.error(err); toast('PDF export failed: ' + err.message, 'err'); } break;

      /* data */
      case 'export-json': exportJSON(); break;
      case 'export-csv': exportCSV(); break;
      case 'import-json': { const f = $('#import-file'); if (f) f.click(); break; }

      case 'import-paste': {
        e.preventDefault();
        const raw = ($('#paste-json') || {}).value || '';
        let data = null;
        try { data = JSON.parse(raw); } catch (err) { toast('That is not valid JSON.', 'err'); break; }
        confirmDialog({
          title: 'Import backup?',
          message: 'Import this backup? Current data will be replaced.',
          confirmLabel: 'Import'
        }).then((ok) => {
          if (!ok) return;
          try { applyImport(data); } catch (err) { toast('That backup is not valid.', 'err'); }
        });
        break;
      }

      case 'clear-data': {
        confirmDialog({
          title: 'Clear all data?',
          message: 'Delete ALL entries, categories and people?\n\nThis cannot be undone. Export a backup first if unsure.',
          confirmLabel: 'Delete everything',
          danger: true
        }).then((ok) => {
          if (!ok) return;
          state = defaultState();
          save(); render();
          toast('All data cleared.');
        });
        break;
      }
    }
  });

  /* filter changes */
  document.addEventListener('change', function (e) {
    const el = e.target;

    /* filter widgets */
    if (el.dataset.filter) {
      const f = targetFilter();
      const key = el.dataset.filter;
      if (key === 'cat' || key === 'person') {
        const fk = key === 'cat' ? 'cats' : 'people';
        const list = f[fk] || (f[fk] = []);
        const i = list.indexOf(el.value);
        if (el.checked && i === -1) list.push(el.value);
        if (!el.checked && i !== -1) list.splice(i, 1);
        f[fk] = list;
      } else if (key === 'min' || key === 'max') {
        f[key] = el.value === '' ? '' : el.value;
      } else {
        f[key] = el.value;
      }
      render();
      return;
    }

    /* period pickers */
    if (el.dataset.period) {
      const p = viewState.report;
      p[el.dataset.period] = el.value;
      if (el.dataset.period === 'month' && el.value) p.month = el.value;
      render();
      return;
    }

    /* settings */
    if (el.id === 'set-currency') { state.settings.currency = el.value; _fmtCache = {}; save(); render(); return; }
    if (el.id === 'set-weekstart') { state.settings.weekStart = el.value; save(); render(); return; }
    if (el.id === 'txn-sort') {
      const parts = String(el.value).split(':');
      viewState.txnSort = { key: parts[0], dir: parts[1] || 'asc' };
      render();
      return;
    }
    if (el.id === 'import-file') { if (el.files && el.files[0]) importJSON(el.files[0]); el.value = ''; return; }
  });

  /* search + settings title (debounced) */
  const onSearch = debounce(function () { render(); }, 220);
  document.addEventListener('input', function (e) {
    const el = e.target;
    if (el.id === 'f-q') { targetFilter().q = el.value; onSearch(); return; }
    if (el.id === 'set-title') { state.settings.title = el.value; save(); return; }
    if (el.id === 'f-note' || el.id === 'c-name' || el.id === 'p-name') return;
  });

  /* forms */
  document.addEventListener('submit', function (e) {
    const form = e.target;
    if (form.id === 'txn-form') { e.preventDefault(); addTxn(form); }
    else if (form.id === 'cat-form') { e.preventDefault(); saveCategory(form); }
    else if (form.id === 'person-form') { e.preventDefault(); savePerson(form); }
  });

  /* keyboard */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
    if (e.key === 'n' && !/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!document.querySelector('.modal')) { e.preventDefault(); txnModal(null); }
    }
  });

  /* ------------------------------------------------------------------ *
   * Storage availability
   * ------------------------------------------------------------------ */

  let storageOK = true;
  (function checkStorage() {
    try {
      localStorage.setItem('__ct_probe', '1');
      localStorage.removeItem('__ct_probe');
      storageOK = true;
    } catch (e) {
      storageOK = false;
    }
  })();

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  applyTheme();
  if (!location.hash) location.hash = '#/dashboard';
  render();
  if (!storageOK) {
    toast('LocalStorage is unavailable here — data will not persist. Open the file over http:// or allow site data.', 'err');
  }
  window.addEventListener('load', () => setTimeout(applyTheme, 0));
})();
