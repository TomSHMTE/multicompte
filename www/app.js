/* Multicompte — suivi quotidien des tâches sur plusieurs comptes d'un jeu.
   Tout est stocké sur le téléphone (localStorage). Le jeu se remet à zéro à minuit UTC
   (1h l'hiver, 2h l'été en France) : un "jour de jeu" = une date UTC. */
(function () {
  'use strict';

  var KEY = 'multicompte-data-v1';
  var SHARE_PREFIX = 'MULTICOMPTE:';
  var PALETTE = [['#A3E635', 'Vert'], ['#38BDF8', 'Bleu'], ['#F472B6', 'Rose'], ['#FBBF24', 'Jaune'],
    ['#A78BFA', 'Violet'], ['#FB923C', 'Orange'], ['#2DD4BF', 'Turquoise'], ['#F87171', 'Rouge']];
  var DAYS = [['L', 'lundi'], ['M', 'mardi'], ['M', 'mercredi'], ['J', 'jeudi'], ['V', 'vendredi'], ['S', 'samedi'], ['D', 'dimanche']];
  var REMIND_BASE_ID = 1000;
  var DEFAULT_RESOURCES = [{ id: 'pepites', name: 'Pépites', color: '#FBBF24' }, { id: 'gemmes', name: 'Gemmes', color: '#38BDF8' }];
  var RES_COLORS = ['#FBBF24', '#38BDF8', '#F472B6', '#A3E635', '#A78BFA', '#FB923C', '#2DD4BF', '#F87171'];

  var ICON = {
    plus: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
    back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
    trash: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16"/><path d="M10 7V4h4v3"/><path d="M6 7l1 13h10l1-13"/></svg>',
    edit: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></svg>',
    tasks: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6h11"/><path d="M9 12h11"/><path d="M9 18h11"/><path d="M4 6l1 1 2-2"/><path d="M4 12l1 1 2-2"/><path d="M4 18l1 1 2-2"/></svg>',
    gem: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 4h12l3 5-9 11L3 9z"/><path d="M3 9h18"/><path d="M9 4l3 16 3-16"/></svg>',
    cal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M12 13v3l2 1"/></svg>',
    spark: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z"/></svg>',
    chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    hist: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
    gear: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><circle cx="9" cy="6" r="2" fill="#15171D"/><circle cx="15" cy="12" r="2" fill="#15171D"/><circle cx="7" cy="18" r="2" fill="#15171D"/></svg>'
  };

  /* ---------- utilitaires ---------- */
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function initials(name) {
    var parts = String(name).trim().split(/\s+/);
    var out = parts.length > 1 ? parts[0].charAt(0) + parts[1].charAt(0) : String(name).trim().slice(0, 2);
    return out.toUpperCase();
  }
  function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }

  /* ---------- jours de jeu (UTC) ---------- */
  function gameDay() { return new Date().toISOString().slice(0, 10); }
  function dayNum(key) { return Math.floor(Date.parse(key + 'T00:00:00Z') / 86400000); }
  function keyFromNum(n) { return new Date(n * 86400000).toISOString().slice(0, 10); }
  function weekday(key) { return (new Date(key + 'T00:00:00Z').getUTCDay() + 6) % 7; } // 0 = lundi
  function fmtDay(key, opts) {
    return new Date(key + 'T12:00:00Z').toLocaleDateString('fr-FR', Object.assign({ timeZone: 'UTC' }, opts));
  }
  function nextReset() {
    var n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1));
  }
  function resetClock() { var r = nextReset(); return pad(r.getHours()) + ':' + pad(r.getMinutes()); }
  function resetIn() {
    var m = Math.max(0, Math.round((nextReset() - new Date()) / 60000));
    var h = Math.floor(m / 60);
    return h ? h + ' h ' + pad(m % 60) : m + ' min';
  }

  /* ---------- données ---------- */
  function defaultData() {
    return { version: 1, accounts: [], tasks: [], progress: {}, history: {},
      resources: DEFAULT_RESOURCES.map(function (r) { return Object.assign({}, r); }), resLog: {}, events: [], raid: {},
      settings: { remind: false, remindTime: '20:00' }, lastDay: null, welcomed: false };
  }
  function normalize(d) {
    var base = defaultData();
    var out = Object.assign(base, d || {});
    out.settings = Object.assign(defaultData().settings, (d && d.settings) || {});
    if (!Array.isArray(out.accounts)) out.accounts = [];
    if (!Array.isArray(out.tasks)) out.tasks = [];
    if (!out.progress || typeof out.progress !== 'object') out.progress = {};
    if (!out.history || typeof out.history !== 'object') out.history = {};
    if (!Array.isArray(out.resources)) out.resources = DEFAULT_RESOURCES.map(function (r) { return Object.assign({}, r); });
    if (!out.resLog || typeof out.resLog !== 'object') out.resLog = {};
    if (!Array.isArray(out.events)) out.events = [];
    out.events.forEach(function (ev) {
      if (!ev.kind) ev.kind = 'arena';
      if (ev.kind === 'arena') ev.autoOpt = true;
      if (ev.kind === 'spark' && !ev.spark) ev.spark = {};
    });
    if (!out.raid || typeof out.raid !== 'object') out.raid = {};
    delete out.autoRaid; // ancien format (raid auto permanent), remplacé par un raid auto par passage
    return out;
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return normalize(JSON.parse(raw));
    } catch (e) { /* données illisibles : on repart de zéro */ }
    return defaultData();
  }
  var data = load();
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { toast('Impossible d’enregistrer'); }
    queueReminders();
  }

  /* ---------- tâches et périodes ---------- */
  // Renvoie la clé de période de la tâche pour le jour donné, ou null si la tâche n'est pas active ce jour-là.
  function periodOf(t, key) {
    switch (t.type) {
      case 'daily': return 'd' + key;
      case 'days': return (t.days || []).indexOf(weekday(key)) >= 0 ? 'd' + key : null;
      case 'weekly':
        var back = (weekday(key) - (t.resetDay || 0) + 7) % 7;
        return 'w' + keyFromNum(dayNum(key) - back);
      case 'every':
        var diff = dayNum(key) - dayNum(t.start || key);
        if (diff < 0) return null;
        return 'e' + Math.floor(diff / Math.max(2, t.every || 2));
      case 'event':
        if (!t.from || !t.to || key < t.from || key > t.to) return null;
        return t.once ? 'p' + t.from : 'd' + key; // « une seule fois » : un seul compteur pour toute la période
    }
    return null;
  }
  function tabOf(t) { return t.type === 'weekly' ? 'hebdo' : t.type === 'event' ? 'event' : 'jour'; }
  function taskAccounts(t) {
    if (t.allAccounts) return data.accounts;
    return data.accounts.filter(function (a) { return (t.accounts || []).indexOf(a.id) >= 0; });
  }
  function pkey(per, t, a) { return per + '|' + t.id + '|' + a.id; }
  function getCount(per, t, a) { return data.progress[pkey(per, t, a)] || 0; }
  function reps(t) { return Math.max(1, t.reps || 1); }
  function freqLabel(t, key) {
    switch (t.type) {
      case 'daily': return '';
      case 'days': return (t.days || []).slice().sort().map(function (d) { return DAYS[d][1].slice(0, 3) + '.'; }).join(' ');
      case 'weekly': return 'Reset le ' + DAYS[t.resetDay || 0][1];
      case 'every':
        var n = Math.max(2, t.every || 2);
        var left = n - ((dayNum(key) - dayNum(t.start || key)) % n);
        return 'Tous les ' + n + ' j · reset ' + (left === 1 ? 'cette nuit' : 'dans ' + left + ' j');
      case 'event': return 'Jusqu’au ' + fmtDay(t.to, { day: 'numeric', month: 'short' }) + (t.once ? ' · sans remise à zéro' : '');
    }
    return '';
  }
  function statsFor(key, filterTab) {
    var done = 0, total = 0, acc = {};
    data.tasks.forEach(function (t) {
      var per = periodOf(t, key);
      if (!per) return;
      if (filterTab && tabOf(t) !== filterTab) return;
      taskAccounts(t).forEach(function (a) {
        var ok = getCount(per, t, a) >= reps(t);
        total++; if (ok) done++;
        acc[a.id] = acc[a.id] || [0, 0];
        acc[a.id][1]++; if (ok) acc[a.id][0]++;
      });
    });
    return { done: done, total: total, acc: acc };
  }

  /* ---------- changement de jour ---------- */
  function checkDay() {
    var today = gameDay();
    if (data.lastDay === today) return false;
    if (data.lastDay && data.lastDay < today) {
      var s = statsFor(data.lastDay);
      if (s.total > 0) data.history[data.lastDay] = s;
      var keys = Object.keys(data.history).sort();
      while (keys.length > 30) delete data.history[keys.shift()];
      prune(today);
    }
    data.lastDay = today;
    save();
    return true;
  }
  // Supprime les coches des périodes terminées depuis longtemps.
  function prune(today) {
    var limit = keyFromNum(dayNum(today) - 40);
    var current = {};
    data.tasks.forEach(function (t) { current[t.id] = periodOf(t, today); });
    Object.keys(data.progress).forEach(function (k) {
      var parts = k.split('|'), per = parts[0], tid = parts[1];
      if (per.charAt(0) === 'o') {
        if (!findEvent(tid) || per.slice(1, 11) < keyFromNum(dayNum(today) - 3)) delete data.progress[k];
        return;
      }
      if (!(tid in current)) { delete data.progress[k]; return; }
      if (per.charAt(0) === 'e' || per.charAt(0) === 'p') { if (per !== current[tid]) delete data.progress[k]; return; }
      if (per.slice(1) < limit) delete data.progress[k];
    });
    Object.keys(data.raid).forEach(function (k) {
      var per = k.split('|')[0];
      if (!findEvent(k.split('|')[1]) || per.slice(1, 11) < keyFromNum(dayNum(today) - 3)) delete data.raid[k];
    });
  }

  /* ---------- état de l'interface ---------- */
  var ui = { chart: { res: 'pepites', scope: 'total', days: 30 }, chartPick: null, tab: 'jour', collapsed: {}, evForm: null, confirmEv: false, form: null, editAcc: null, confirmAcc: null, confirmTask: false,
    draft: { name: '', color: PALETTE[0][0] }, importText: '', importPending: null, confirmWipe: false };
  var app = document.getElementById('app');

  function route() { return location.hash.replace(/^#/, ''); }
  function go(h) { if (route() === h) render(); else location.hash = h; }

  var lastRoute = null;
  function render() {
    checkDay();
    var r = route();
    var scroller = app.querySelector('.scroll');
    var keepScroll = r === lastRoute && scroller ? scroller.scrollTop : 0;
    if (r !== lastRoute) {
      if (r.indexOf('tache-') !== 0) { ui.form = null; ui.confirmTask = false; }
      if (r.indexOf('evenement-') !== 0) { ui.evForm = null; ui.confirmEv = false; }
      if (r !== 'reglages') { ui.editAcc = null; ui.confirmAcc = null; ui.confirmWipe = false; }
      if (r !== 'importer') { ui.importPending = null; }
      ui.counter = null;
      if (r !== 'reglages') { ui.confirmRes = null; }
      ui.chartPick = null;
    }
    var html;
    if (r === 'reglages') html = viewSettings();
    else if (r === 'historique') html = viewHistory();
    else if (r === 'ressources') html = viewResources();
    else if (r === 'evenements') html = viewEvents();
    else if (r.indexOf('evenement-') === 0) html = viewEventForm(r.slice(10));
    else if (r === 'importer') html = viewImport();
    else if (r.indexOf('tache-') === 0) html = viewForm(r.slice(6));
    else html = (data.accounts.length === 0 && !data.welcomed) ? viewWelcome() : viewTasks();
    app.innerHTML = html;
    var sc = app.querySelector('.scroll');
    if (sc && keepScroll) sc.scrollTop = keepScroll;
    lastRoute = r;
  }

  var toastTimer = null;
  function toast(msg) {
    var old = document.querySelector('.toast');
    if (old) old.remove();
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.remove(); }, 2600);
  }

  function nav(active) {
    function b(to, icon, label) {
      return '<button data-act="go" data-to="' + to + '" class="' + (active === to ? 'on' : '') + '">' + icon + label + '</button>';
    }
    return '<nav class="nav">' + b('', ICON.tasks, 'Tâches') + b('evenements', ICON.cal, 'Événements') + b('ressources', ICON.gem, 'Ressources') + b('historique', ICON.hist, 'Historique') + b('reglages', ICON.gear, 'Réglages') + '</nav>';
  }
  function headBack(kicker, title, to) {
    return '<div class="head row"><button class="icon-btn" data-act="go" data-to="' + (to || '') + '" aria-label="Retour">' + ICON.back + '</button>' +
      '<div style="display:flex;flex-direction:column">' + (kicker ? '<span class="kicker">' + kicker + '</span>' : '') +
      '<h1 class="small">' + title + '</h1></div></div>';
  }

  /* ---------- écran : bienvenue ---------- */
  function viewWelcome() {
    return '<div class="screen"><div class="welcome">' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<div style="display:flex;gap:6px" aria-hidden="true"><span class="av" style="background:#A3E635"></span><span class="av" style="background:#38BDF8"></span><span class="av" style="background:#F472B6"></span><span class="av" style="border:1.5px dashed #3A3F4B"></span></div>' +
      '<span class="kicker">Bienvenue</span>' +
      '<h1 style="font-size:34px">Tous tes comptes, une seule checklist.</h1>' +
      '<span class="sub" style="font-size:15px;line-height:1.5">Deux étapes pour démarrer. Tout reste sur ton téléphone.</span></div>' +
      '<div style="display:flex;flex-direction:column;gap:10px">' +
      '<div class="step"><span class="num">1</span><div style="display:flex;flex-direction:column;gap:2px"><b>Ajoute tes comptes</b><span class="hint">Un nom et une couleur par compte. Modifiable à tout moment dans Réglages.</span></div></div>' +
      '<div class="step"><span class="num off">2</span><div style="display:flex;flex-direction:column;gap:2px"><b>Crée tes tâches</b><span class="hint">Ou importe la liste qu’un ami t’a envoyée.</span></div></div>' +
      '</div>' +
      '<div style="margin-top:auto;display:flex;flex-direction:column;gap:10px">' +
      '<button class="btn primary" data-act="welcome" data-to="reglages">Ajouter mon premier compte</button>' +
      '<button class="btn outline" data-act="welcome" data-to="importer">Importer une liste de tâches</button>' +
      '</div></div></div>';
  }

  /* ---------- écran : tâches ---------- */
  function viewTasks() {
    var today = gameDay();
    var groups = [['jour', 'Quotidien'], ['hebdo', 'Hebdo'], ['event', 'Dates limitées']];
    var cur = statsFor(today);
    var pct = cur.total ? Math.round(cur.done / cur.total * 100) : 0;
    var h = '<div class="screen">';
    h += '<div class="head"><div style="display:flex;flex-direction:column;gap:2px;min-width:0">' +
      '<span class="kicker">Tâches · ' + esc(fmtDay(today, { weekday: 'short', day: 'numeric', month: 'short' })) + '</span>' +
      '<h1>Aujourd’hui</h1>' +
      '<span class="sub">' + (cur.total ? plural(cur.total - cur.done, 'case', 'cases') + ' à cocher · ' : '') + 'reset ' + resetClock() + '</span></div>' +
      '<div class="score"><b>' + cur.done + '<small>/' + cur.total + '</small></b><div class="bar"><i style="width:' + pct + '%"></i></div></div></div>';
    h += '<div class="scroll has-fab">';
    if (!data.accounts.length) {
      h += '<div class="empty">Aucun compte pour l’instant.<button class="btn primary sm" style="width:auto;padding:0 16px" data-act="go" data-to="reglages">Ajouter un compte</button></div>';
    } else if (!data.tasks.length) {
      h += '<div class="empty">Aucune tâche. Appuie sur + pour créer la première,<br>ou importe la liste d’un ami dans Réglages.</div>';
    }
    var shown = 0, finished = [];
    groups.forEach(function (g) {
      var list = data.tasks.filter(function (t) { return tabOf(t) === g[0] && periodOf(t, today); });
      if (!list.length) return;
      shown++;
      // Ce qui reste à faire en haut ; les tâches terminées par tous les comptes partent dans « Terminé », tout en bas.
      var open = list.filter(function (t) { if (taskDone(t, today)) { finished.push(t); return false; } return true; });
      if (!open.length) return;
      var st = statsFor(today, g[0]), left = st.total - st.done;
      var closed = !!ui.collapsed[g[0]];
      h += '<button class="sec-head' + (closed ? ' closed' : '') + '" data-act="sec" data-v="' + g[0] + '" aria-expanded="' + !closed + '">' + ICON.chev + g[1] +
        '<span class="sec-count">' + plural(left, 'case', 'cases') + ' à cocher</span></button>';
      if (closed) return;
      open.forEach(function (t) { h += taskCard(t, today); });
    });
    if (finished.length) {
      var allDone = finished.length === data.tasks.filter(function (t) { return periodOf(t, today); }).length;
      if (allDone) h += '<div class="empty ok-all">Tout est fait pour aujourd’hui sur tous les comptes.</div>';
      var cl = !!ui.collapsed.done;
      h += '<button class="sec-head' + (cl ? ' closed' : '') + '" data-act="sec" data-v="done" aria-expanded="' + !cl + '">' + ICON.chev + 'Terminé' +
        '<span class="sec-count ok">' + plural(finished.length, 'tâche', 'tâches') + '</span></button>';
      if (!cl) finished.forEach(function (t) { h += taskCard(t, today); });
    }
    if (data.accounts.length && data.tasks.length && !shown) h += '<div class="empty">Rien à faire aujourd’hui.</div>';
    h += '</div>';
    if (data.accounts.length) h += '<button class="fab" data-act="go" data-to="tache-new" aria-label="Nouvelle tâche">' + ICON.plus + '</button>';
    h += nav('') + '</div>';
    return h;
  }
  function taskDone(t, today) {
    var per = periodOf(t, today), accs = taskAccounts(t);
    return accs.length > 0 && accs.every(function (a) { return getCount(per, t, a) >= reps(t); });
  }
  function taskCard(t, today) {
    var per = periodOf(t, today);
    var accs = taskAccounts(t);
    var r = reps(t), n = 0;
    var dots = accs.map(function (a) {
      var c = Math.min(getCount(per, t, a), r);
      var full = c >= r;
      if (full) n++;
      var pct = Math.round(c / r * 100);
      var style = full ? 'background:' + a.color : (c > 0 ? 'border-color:' + a.color + ';color:' + a.color + (r > 1 ? ';background:linear-gradient(to top,' + a.color + '40 ' + pct + '%,transparent ' + pct + '%)' : '') : '');
      if (ui.counter && ui.counter.t === t.id && ui.counter.a === a.id) style += ';outline:2px solid var(--text);outline-offset:2px';
      return '<button class="dot' + (full ? ' full' : '') + '" style="' + style + '" data-act="dot" data-task="' + t.id + '" data-acc="' + a.id + '" aria-label="' +
        esc(t.name + ' — ' + a.name + (r > 1 ? ' : ' + c + ' sur ' + r : full ? ' : fait' : ' : à faire')) + '">' +
        esc(initials(a.name)) + (r > 1 ? '<small>' + (r > 999 ? fmtCompact(c) + '/' + fmtCompact(r) : c + '/' + r) + '</small>' : '') + '</button>';
    }).join('');
    var all = accs.length > 0 && n === accs.length;
    var sub = [t.note, t.time ? 'à ' + t.time + (t.remindBefore >= 0 ? ' · rappel ' + (t.remindBefore ? t.remindBefore + ' min avant' : 'à l’heure') : '') : '', freqLabel(t, today)].filter(Boolean).join(' · ');
    return '<div class="card' + (all ? ' done' : '') + '"><div class="task-top">' +
      '<div class="task-name"><b>' + esc(t.name) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' +
      (all ? '<span class="pill-done">TERMINÉ</span>' : '<span class="count">' + n + '<small>/' + accs.length + '</small></span>') +
      (accs.length ? '<button class="btn-small" data-act="all" data-task="' + t.id + '">' + (all ? 'Annuler' : 'Tout') + '</button>' : '') +
      '<button class="icon-btn ghost" data-act="go" data-to="tache-' + t.id + '" aria-label="Modifier ' + esc(t.name) + '">' + ICON.edit + '</button>' +
      '</div>' + (accs.length ? '<div class="dots">' + dots + '</div>' : '<span class="hint">Aucun compte sélectionné pour cette tâche.</span>') +
      counterPanel(t, per) + '</div>';
  }

  /* ---------- événements à heure fixe (arène…) ---------- */
  var DUR_CHOICES = [[0, 'Pas de durée'], [15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h']];
  var REMIND_CHOICES = [[-1, 'Pas de rappel'], [0, 'À l’heure'], [5, '5 min avant'], [15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant']];
  function findEvent(id) { for (var i = 0; i < data.events.length; i++) if (data.events[i].id === id) return data.events[i]; return null; }
  function localKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function evOnDay(ev, key) {
    if (ev.type === 'days') return (ev.days || []).indexOf(weekday(key)) >= 0;
    if (ev.type === 'every') {
      var n = Math.max(1, ev.every || 2), diff = dayNum(key) - dayNum(ev.anchor || key);
      return ((diff % n) + n) % n === 0;
    }
    return true;
  }
  function occAt(key, time) { var d = key.split('-'), t = time.split(':'); return new Date(+d[0], +d[1] - 1, +d[2], +t[0], +t[1], 0); }
  function evPer(key, time) { return 'o' + key + '@' + time; }
  function evAccounts(ev) { return taskAccounts(ev); }
  // Le raid auto ne vaut que pour un passage précis : il cesse de lui-même à la fin de ce passage.
  function isAuto(ev, a, per) { return !!ev.autoOpt && !!data.raid[pkey(per, ev, a)]; }
  function evTimes(ev) { return (ev.times || []).filter(function (x) { return /^\d\d:\d\d$/.test(x); }).sort(); }
  function nextOcc(ev, from) {
    var base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    for (var d = 0; d < 400; d++) {
      var key = localKey(new Date(base.getFullYear(), base.getMonth(), base.getDate() + d));
      if (!evOnDay(ev, key)) continue;
      var ts = evTimes(ev);
      for (var i = 0; i < ts.length; i++) {
        var at = occAt(key, ts[i]);
        if (at.getTime() + (ev.duration || 0) * 60000 > from.getTime()) return { key: key, time: ts[i], at: at };
      }
    }
    return null;
  }
  function inLabel(ms) {
    var m = Math.max(0, Math.round(ms / 60000)), h = Math.floor(m / 60);
    if (h >= 24) {
      // Au-delà d'un jour : différence de jours du calendrier (mercredi vu depuis lundi = 2 j).
      var n = new Date(), t = new Date(n.getTime() + ms);
      var days = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 86400000);
      return 'dans ' + days + ' j';
    }
    return 'dans ' + (h ? h + ' h ' + pad(m % 60) : m + ' min');
  }
  function evFreqLabel(ev) {
    if (ev.type === 'days') return (ev.days || []).slice().sort().map(function (d) { return DAYS[d][1].slice(0, 3) + '.'; }).join(' ');
    if (ev.type === 'every') return (ev.every || 2) > 1 ? 'Tous les ' + ev.every + ' jours' : 'Chaque jour';
    return 'Chaque jour';
  }
  /* Deux types d'événements :
     - arène : passages à heure fixe tous les X jours (2 par défaut), avec raid auto par passage ;
     - étincelle : revient 14 jours pile après avoir été faite, compte par compte. */
  var SPARK_DAYS = 14;
  function sparkState(ev, a) { return (ev.spark && ev.spark[a.id]) || {}; }
  function sameLocalDay(ms, ref) { var d = new Date(ms); return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate(); }
  function hm(ms) { var d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function availLabel(ms, now) {
    if (!ms) return 'disponible';
    if (ms > now) return 'dispo à ' + hm(ms);
    if (sameLocalDay(ms, new Date(now))) return 'dispo depuis ' + hm(ms);
    return 'dispo depuis ' + Math.max(1, Math.floor((now - ms) / 86400000)) + ' j';
  }
  function sparkDoneToday(st, now) { return !!st.doneAt && sameLocalDay(st.doneAt, new Date(now)) && (st.next || 0) > now; }
  // Comptes à afficher aujourd'hui pour une étincelle : disponibles (même depuis plusieurs jours), disponibles plus tard dans la journée, ou faites aujourd'hui.
  function sparkToday(ev, now, end) {
    var rows = [];
    evAccounts(ev).forEach(function (a) {
      var st = sparkState(ev, a), next = st.next || 0, done = sparkDoneToday(st, now);
      if (!done && next >= end) return;
      rows.push({ a: a, next: next, done: done, avail: !done && next <= now });
    });
    var todo = rows.filter(function (r) { return !r.done; });
    var first = todo.length ? Math.min.apply(null, todo.map(function (r) { return r.next; }))
      : Math.min.apply(null, rows.map(function (r) { return sparkState(ev, r.a).doneAt || 0; }));
    return { rows: rows, todo: todo, first: first };
  }
  function sparkCard(ev, info, now) {
    var all = !info.todo.length;
    var dots = info.rows.map(function (r) {
      var a = r.a;
      var style = r.done ? 'background:' + a.color : r.avail ? 'border-color:' + a.color + ';color:' + a.color : 'border-style:dashed';
      return '<button class="dot' + (r.done ? ' full' : '') + '" style="' + style + '" data-act="spark" data-ev="' + ev.id + '" data-acc="' + a.id + '" aria-label="' +
        esc(ev.name + ' — ' + a.name + (r.done ? ' : faite, toucher pour annuler' : r.avail ? ' : disponible, à faire' : ' : disponible à ' + hm(r.next))) + '">' +
        esc(initials(a.name)) + (!r.done && !r.avail ? '<small>' + hm(r.next) + '</small>' : '') + '</button>';
    }).join('');
    var sub = all ? 'Faite · revient dans ' + SPARK_DAYS + ' j' : plural(info.todo.length, 'compte', 'comptes') + ' · ' + availLabel(info.first, now);
    return '<div class="card' + (all ? ' done' : '') + '"><div class="task-top"><span class="ev-time ev-icon" aria-hidden="true">' + ICON.spark + '</span>' +
      '<div class="task-name"><b>' + esc(ev.name) + '</b><span>' + esc([ev.note, sub].filter(Boolean).join(' · ')) + '</span></div>' +
      (all ? '<span class="pill-done">FAIT</span>' : '<span class="count">' + (info.rows.length - info.todo.length) + '<small>/' + info.rows.length + '</small></span>') +
      (info.todo.some(function (r) { return r.avail; }) ? '<button class="btn-small" data-act="sparkAll" data-ev="' + ev.id + '">Tout</button>' : '') +
      '</div><div class="dots">' + dots + '</div></div>';
  }
  function markSpark(ev, a, now) {
    var st = sparkState(ev, a);
    ev.spark = ev.spark || {};
    ev.spark[a.id] = { next: now + SPARK_DAYS * 86400000, prev: st.next || 0, doneAt: now };
  }
  function toggleSpark(evId, aid) {
    var ev = findEvent(evId), a = findAcc(aid);
    if (!ev || !a) return;
    var now = Date.now(), st = sparkState(ev, a);
    if (sparkDoneToday(st, now)) {
      ev.spark[a.id] = { next: st.prev || 0, prev: null, doneAt: null };
      toast('Étincelle annulée pour ' + a.name);
    } else {
      markSpark(ev, a, now);
      toast('Prochaine étincelle de ' + a.name + ' : ' + fmtLocal(new Date(now + SPARK_DAYS * 86400000)) + ' à ' + hm(now));
    }
    save(); render();
  }
  function sparkAll(evId) {
    var ev = findEvent(evId);
    if (!ev) return;
    var now = Date.now(), n = 0;
    evAccounts(ev).forEach(function (a) {
      var st = sparkState(ev, a);
      if (!sparkDoneToday(st, now) && (st.next || 0) <= now) { markSpark(ev, a, now); n++; }
    });
    save(); render();
    if (n) toast('Prochaines étincelles dans ' + SPARK_DAYS + ' j, à ' + hm(now));
  }
  function arenaUpcoming(ev, nowD) {
    var list = [], start = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + 1);
    for (var d = 0; d < 90 && list.length < 4; d++) {
      var key = localKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + d));
      if (!evOnDay(ev, key)) continue;
      evTimes(ev).forEach(function (t) { if (list.length < 4) list.push(occAt(key, t)); });
    }
    var h = '<div class="card"><div class="task-top"><div class="task-name"><b>' + esc(ev.name) + '</b><span>' +
      esc([evTimes(ev).join(', '), evFreqLabel(ev), ev.remindBefore >= 0 ? 'rappel ' + (ev.remindBefore ? ev.remindBefore + ' min avant' : 'à l’heure') : 'sans rappel'].join(' · ')) + '</span></div>' +
      '<button class="icon-btn ghost" data-act="go" data-to="evenement-' + ev.id + '" aria-label="Modifier ' + esc(ev.name) + '">' + ICON.edit + '</button></div>';
    h += '<div class="up-list">' + (list.length ? list.map(function (at) {
      return '<div class="up-row"><span class="grow">' + esc(cap(fmtLocal(at))) + '</span><b>' + hm(at.getTime()) + '</b><span class="hint">' + inLabel(at - nowD) + '</span></div>';
    }).join('') : '<span class="hint">Aucun passage prévu.</span>') + '</div>';
    h += '<div class="row-between"><span class="hint">Décalage dans le jeu ?</span><div class="btn-row">' +
      '<button class="btn-small" data-act="evShift" data-v="' + ev.id + '" data-d="-1" aria-label="Avancer d’un jour">−1 j</button>' +
      '<button class="btn-small" data-act="evShift" data-v="' + ev.id + '" data-d="1" aria-label="Reculer d’un jour">+1 j</button></div></div>';
    return h + '</div>';
  }
  function sparkUpcoming(ev, now, end) {
    var rows = evAccounts(ev).map(function (a) { return { a: a, next: sparkState(ev, a).next || 0 }; })
      .filter(function (r) { return r.next >= end; }).sort(function (x, y) { return x.next - y.next; });
    var h = '<div class="card"><div class="task-top"><div class="task-name"><b>' + esc(ev.name) + '</b><span>' +
      esc('Revient ' + SPARK_DAYS + ' j après avoir été faite' + (ev.remind ? ' · rappel quand elle revient' : '')) + '</span></div>' +
      '<button class="icon-btn ghost" data-act="go" data-to="evenement-' + ev.id + '" aria-label="Modifier ' + esc(ev.name) + '">' + ICON.edit + '</button></div>';
    h += '<div class="up-list">' + (rows.length ? rows.map(function (r) {
      return '<div class="up-row"><span class="av" style="width:24px;height:24px;font-size:10px;border-radius:6px;background:' + r.a.color + '">' + esc(initials(r.a.name)) + '</span>' +
        '<span class="grow">' + esc(r.a.name) + '</span><span>' + esc(cap(fmtLocal(new Date(r.next)))) + ' · <b>' + hm(r.next) + '</b></span><span class="hint">' + inLabel(r.next - now) + '</span></div>';
    }).join('') : '<span class="hint">Tous les comptes l’ont disponible aujourd’hui : voir « À faire ».</span>') + '</div>';
    return h + '</div>';
  }
  function viewEvents() {
    var nowD = new Date(), now = nowD.getTime(), todayKey = localKey(nowD);
    var end = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + 1).getTime();
    var items = [];
    data.events.forEach(function (ev) {
      if (ev.kind === 'spark') {
        var info = sparkToday(ev, now, end);
        if (info.rows.length) items.push({ at: info.first, done: !info.todo.length, html: sparkCard(ev, info, now) });
        return;
      }
      if (!evOnDay(ev, todayKey)) return;
      evTimes(ev).forEach(function (t) {
        var accs = evAccounts(ev), per = evPer(todayKey, t);
        var done = accs.length > 0 && accs.every(function (a) { return data.progress[pkey(per, ev, a)]; });
        items.push({ at: occAt(todayKey, t).getTime(), done: done, html: occCard(ev, todayKey, t, nowD) });
      });
    });
    var byAt = function (x, y) { return x.at - y.at; };
    var open = items.filter(function (i) { return !i.done; }).sort(byAt);
    var fin = items.filter(function (i) { return i.done; }).sort(byAt);
    var sub = open.length ? plural(open.length, 'chose', 'choses') + ' à faire aujourd’hui' : items.length ? 'Tout est fait pour aujourd’hui' : 'Rien de prévu aujourd’hui';
    var h = '<div class="screen"><div class="head"><div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="kicker">Événements · ' +
      esc(nowD.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })) + '</span><h1>Événements</h1>' +
      '<span class="sub">' + esc(sub) + '</span></div></div><div class="scroll has-fab">';
    if (!data.events.length) {
      h += '<div class="empty">Aucun événement. Ajoute ton arène (tous les 2 jours, avec raid auto)<br>ou ton étincelle (revient 14 jours après).' +
        (data.accounts.length ? '<button class="btn primary sm" style="width:auto;padding:0 16px" data-act="go" data-to="evenement-new">Créer un événement</button>' : '') + '</div>';
    } else {
      h += '<div class="sec-head static">À faire aujourd’hui<span class="sec-count' + (open.length ? '' : ' ok') + '">' + (open.length ? plural(open.length, 'élément', 'éléments') : 'Tout est fait') + '</span></div>';
      if (!items.length) h += '<div class="empty" style="padding:16px">Rien de prévu aujourd’hui.</div>';
      open.concat(fin).forEach(function (i) { h += i.html; });
      var arenas = data.events.filter(function (ev) { return ev.kind !== 'spark'; });
      var sparks = data.events.filter(function (ev) { return ev.kind === 'spark'; });
      if (arenas.length) {
        h += '<div class="sec-head static" style="margin-top:8px">Arènes à venir</div>';
        arenas.forEach(function (ev) { h += arenaUpcoming(ev, nowD); });
      }
      if (sparks.length) {
        h += '<div class="sec-head static" style="margin-top:8px">Étincelles à venir</div>';
        sparks.forEach(function (ev) { h += sparkUpcoming(ev, now, end); });
      }
    }
    h += '</div>';
    if (data.accounts.length) h += '<button class="fab" data-act="go" data-to="evenement-new" aria-label="Nouvel événement">' + ICON.plus + '</button>';
    h += nav('evenements') + '</div>';
    return h;
  }
  function fmtLocal(d) {
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - today) / 86400000);
    if (diff === 0) return 'aujourd’hui';
    if (diff === 1) return 'demain';
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function occCard(ev, key, time, now) {
    var at = occAt(key, time), end = new Date(at.getTime() + (ev.duration || 0) * 60000);
    var per = evPer(key, time), accs = evAccounts(ev), n = 0;
    var status;
    if (now < at) status = inLabel(at - now);
    else if (ev.duration && now < end) status = 'en cours · encore ' + inLabel(end - now).replace('dans ', '');
    else status = ev.duration ? 'terminé' : 'c’est passé';
    var past = ev.duration ? now >= end : now >= at;
    var dots = accs.map(function (a) {
      var done = (data.progress[pkey(per, ev, a)] || 0) >= 1, auto = isAuto(ev, a, per);
      if (done) n++;
      var style = done ? 'background:' + a.color : (auto ? 'border-style:dashed;border-color:' + a.color + ';color:' + a.color : '');
      return '<button class="dot' + (done ? ' full' : '') + '" style="' + style + '" data-act="evDot" data-ev="' + ev.id + '" data-key="' + key + '" data-time="' + time + '" data-acc="' + a.id + '" aria-label="' +
        esc(ev.name + ' ' + time + ' — ' + a.name + (done ? ' : fait' : ' : à faire') + (auto ? ', raid auto' : '')) + '">' + esc(initials(a.name)) + (auto ? '<small>auto</small>' : '') + '</button>';
    }).join('');
    var all = accs.length > 0 && n === accs.length;
    var h = '<div class="card' + (all ? ' done' : '') + (past && !all ? ' past' : '') + '"><div class="task-top"><span class="ev-time">' + time + '</span>' +
      '<div class="task-name"><b>' + esc(ev.name) + '</b><span>' + esc([ev.note, status].filter(Boolean).join(' · ')) + '</span></div>' +
      (all ? '<span class="pill-done">FAIT</span>' : '<span class="count">' + n + '<small>/' + accs.length + '</small></span>') +
      (accs.length ? '<button class="btn-small" data-act="evAll" data-ev="' + ev.id + '" data-key="' + key + '" data-time="' + time + '">' + (all ? 'Annuler' : 'Tout') + '</button>' : '') +
      '</div>' + (accs.length ? '<div class="dots">' + dots + '</div>' : '<span class="hint">Aucun compte sélectionné.</span>');
    if (ev.autoOpt && accs.length && !past) {
      h += '<div class="raid-row"><span class="raid-label">Raid auto</span>' + accs.map(function (a) {
        var on = isAuto(ev, a, per);
        return '<button class="raid-chip' + (on ? ' on' : '') + '" style="' + (on ? 'background:' + a.color + ';border-color:' + a.color : '') + '" data-act="raid" data-ev="' + ev.id + '" data-key="' + key + '" data-time="' + time + '" data-acc="' + a.id + '" aria-pressed="' + on + '" aria-label="Raid auto ' + esc(a.name) + ' pour ' + time + '">' + esc(initials(a.name)) + '</button>';
      }).join('') + '<span class="raid-hint">pour ce passage</span></div>';
    }
    return h + '</div>';
  }
  function evToggle(evId, key, time, aid) {
    var ev = findEvent(evId), a = findAcc(aid);
    if (!ev || !a) return;
    var k = pkey(evPer(key, time), ev, a);
    if (data.progress[k]) delete data.progress[k]; else data.progress[k] = 1;
    save(); render();
  }
  function evAll(evId, key, time) {
    var ev = findEvent(evId);
    if (!ev) return;
    var per = evPer(key, time), accs = evAccounts(ev);
    var all = accs.every(function (a) { return data.progress[pkey(per, ev, a)]; });
    accs.forEach(function (a) { if (all) delete data.progress[pkey(per, ev, a)]; else data.progress[pkey(per, ev, a)] = 1; });
    save(); render();
  }
  function toggleRaid(evId, key, time, aid) {
    var ev = findEvent(evId), a = findAcc(aid);
    if (!ev || !a) return;
    var k = pkey(evPer(key, time), ev, a), was = !!data.raid[k];
    if (was) delete data.raid[k]; else data.raid[k] = 1;
    save(); render();
    toast(was ? 'Raid auto désactivé' : 'Raid auto activé jusqu’à la fin du passage de ' + time);
  }
  function shiftEvent(evId, d) {
    var ev = findEvent(evId);
    if (!ev) return;
    ev.anchor = keyFromNum(dayNum(ev.anchor || localKey(new Date())) + d);
    save(); render();
    var nx = nextOcc(ev, new Date());
    toast(nx ? 'Prochain passage : ' + fmtLocal(nx.at) + ' à ' + nx.time : 'Décalé');
  }
  function newEvForm(id) {
    var ev = id !== 'new' ? findEvent(id) : null;
    var all = data.accounts.map(function (a) { return a.id; });
    var f = { id: null, kind: null, name: '', note: '', type: 'every', days: [0, 1, 2, 3, 4, 5, 6], every: 2, anchor: localKey(new Date()),
      times: ['20:00'], duration: 30, remindBefore: 15, autoOpt: true, remind: true, spark: {}, allAccounts: true, accounts: all };
    if (ev) {
      f = Object.assign(f, JSON.parse(JSON.stringify(ev)));
      if (!f.kind) f.kind = 'arena';
      if (f.allAccounts) f.accounts = all;
      f.spark = f.spark || {};
    }
    return f;
  }
  function evIssues(f) {
    if (!f.name.trim()) return 'Donne un nom à l’événement';
    if (f.kind !== 'spark') {
      if (!evTimes(f).length) return 'Ajoute au moins une heure';
      if (!/^\d{4}-\d\d-\d\d$/.test(f.anchor || '')) return 'Indique la date d’un prochain passage';
    }
    if (!f.allAccounts && !f.accounts.length) return 'Sélectionne au moins un compte';
    return null;
  }
  function toLocalInput(ms) {
    var d = new Date(ms);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function accChips(f) {
    return '<div class="field" style="gap:10px"><div class="row-between"><span class="label">Comptes concernés</span>' +
      (data.accounts.length ? '<button class="link-btn" data-act="evAccAll">' + (f.allAccounts ? 'Choisir' : 'Tous') + '</button>' : '') + '</div>' +
      '<div class="chips">' + data.accounts.map(function (a) {
        var on = f.allAccounts || f.accounts.indexOf(a.id) >= 0;
        return '<button class="chip' + (on ? ' on' : '') + '" style="' + (on ? 'border-color:' + a.color : '') + '" data-act="evAcc" data-v="' + a.id + '" aria-pressed="' + on + '">' +
          '<span class="av" style="' + (on ? 'background:' + a.color : '') + '">' + esc(initials(a.name)) + '</span>' + esc(a.name) + '</button>';
      }).join('') + '</div></div>';
  }
  function viewEventForm(id) {
    if (!ui.evForm || (ui.evForm.id || 'new') !== id) {
      if (id !== 'new' && !findEvent(id)) { setTimeout(function () { go('evenements'); }, 0); return ''; }
      ui.evForm = newEvForm(id);
    }
    var f = ui.evForm, editing = !!f.id;
    // Étape 1 (création) : choisir le type.
    if (!f.kind) {
      return '<div class="screen">' + headBack('Événement', 'Nouvel événement', 'evenements') + '<div class="scroll">' +
        '<button class="kind-btn" data-act="evKind" data-v="arena"><span class="kind-ic">' + ICON.cal + '</span><span class="grow"><b>Arène</b>' +
        '<span class="hint">Passage à heure fixe tous les 2 jours. Rappel avant l’heure, raid auto possible sur chaque passage.</span></span></button>' +
        '<button class="kind-btn" data-act="evKind" data-v="spark"><span class="kind-ic">' + ICON.spark + '</span><span class="grow"><b>Étincelle</b>' +
        '<span class="hint">Revient 14 jours pile après avoir été faite, compte par compte. Reste affichée tant qu’elle n’est pas faite.</span></span></button>' +
        '</div></div>';
    }
    var isSpark = f.kind === 'spark';
    var h = '<div class="screen">' + headBack(isSpark ? 'Étincelle' : 'Arène', editing ? 'Modifier' : (isSpark ? 'Nouvelle étincelle' : 'Nouvelle arène'), 'evenements') + '<div class="scroll gap-lg">';
    h += '<div class="field"><label class="label" for="e-name">Nom</label><input id="e-name" class="input" data-field="evName" maxlength="60" value="' + esc(f.name) + '"></div>';
    h += '<div class="field"><label class="label" for="e-note">Précision (facultatif)</label><input id="e-note" class="input" data-field="evNote" maxlength="60" placeholder="' + (isSpark ? 'Ex. étincelle de guilde' : 'Ex. 5 combats') + '" value="' + esc(f.note) + '"></div>';
    if (isSpark) {
      h += '<div class="box"><b>Revient ' + SPARK_DAYS + ' jours pile après avoir été faite</b><span class="hint">Quand tu coches un compte, sa prochaine étincelle est programmée ' + SPARK_DAYS + ' jours plus tard à la même minute. Elle reste dans « À faire » tant que le compte ne l’a pas faite.</span></div>';
      h += '<div class="box row"><div class="grow"><b>Me prévenir quand elle revient</b><span class="hint">Une notification au moment où l’étincelle redevient disponible.</span></div>' +
        '<button class="switch' + (f.remind ? ' on' : '') + '" role="switch" aria-checked="' + !!f.remind + '" aria-label="Me prévenir quand elle revient" data-act="evSparkRemind"><i></i></button></div>';
      var accs = data.accounts.filter(function (a) { return f.allAccounts || f.accounts.indexOf(a.id) >= 0; });
      var now = Date.now();
      h += '<div class="field" style="gap:10px"><span class="label">Prochaine disponibilité</span>' +
        '<span class="hint">Vide = disponible maintenant. Si un compte l’a déjà faite, indique quand elle revient.</span>' +
        accs.map(function (a) {
          var next = (f.spark[a.id] || {}).next || 0;
          return '<div class="spark-row"><span class="av" style="background:' + a.color + '">' + esc(initials(a.name)) + '</span><span class="grow"><b>' + esc(a.name) + '</b></span>' +
            '<input type="datetime-local" class="input" aria-label="Prochaine étincelle de ' + esc(a.name) + '" data-field="sparkNext" data-a="' + a.id + '" value="' + (next > now ? toLocalInput(next) : '') + '">' +
            (next > now ? '<button class="link-btn" data-act="sparkClear" data-a="' + a.id + '">Dispo</button>' : '') + '</div>';
        }).join('') + '</div>';
    } else {
      h += '<div class="field" style="gap:10px"><span class="label">Heures</span>' + f.times.map(function (t, i) {
        return '<div class="row-between" style="gap:8px"><input type="time" class="input" style="flex:1" aria-label="Heure ' + (i + 1) + '" data-field="evTime" data-i="' + i + '" value="' + esc(t) + '">' +
          (f.times.length > 1 ? '<button class="icon-btn" data-act="evTimeDel" data-i="' + i + '" aria-label="Retirer cette heure" style="color:var(--danger)">' + ICON.trash + '</button>' : '') + '</div>';
      }).join('') + (f.times.length < 6 ? '<button class="btn outline sm" data-act="evTimeAdd">Ajouter une heure</button>' : '') + '</div>';
      h += '<div class="field" style="gap:10px"><span class="label">Rythme</span>' +
        '<div class="stepper"><span>Tous les <strong>' + f.every + '</strong> ' + (f.every > 1 ? 'jours' : 'jour') + '</span><button data-act="evEvery" data-v="-1" aria-label="Moins">−</button><button data-act="evEvery" data-v="1" aria-label="Plus">+</button></div>' +
        '<div class="field"><label class="hint" for="e-anchor">Date d’un prochain passage</label><input type="date" id="e-anchor" class="input" data-field="evAnchor" value="' + esc(f.anchor) + '"></div>' +
        '<span class="hint">En cas de décalage dans le jeu, les boutons −1 j / +1 j de l’onglet Événements recalent la suite.</span></div>';
      h += '<div class="field" style="gap:10px"><span class="label">Durée</span><div class="chips">' + DUR_CHOICES.map(function (o) {
        var on = (f.duration || 0) === o[0];
        return '<button class="choice' + (on ? ' on' : '') + '" style="padding:0 12px;height:44px" data-act="evDur" data-v="' + o[0] + '" aria-pressed="' + on + '">' + o[1] + '</button>';
      }).join('') + '</div><span class="hint">Le raid auto activé sur un passage se désactive à la fin de cette durée.</span></div>';
      h += '<div class="field" style="gap:10px"><span class="label">Rappel</span><div class="chips">' + REMIND_CHOICES.map(function (o) {
        var on = f.remindBefore === o[0];
        return '<button class="choice' + (on ? ' on' : '') + '" style="padding:0 12px;height:44px" data-act="evRemind" data-v="' + o[0] + '" aria-pressed="' + on + '">' + o[1] + '</button>';
      }).join('') + '</div><span class="hint">Pas de rappel pour les comptes en raid auto ou déjà faits.</span></div>';
    }
    h += accChips(f);
    if (editing) {
      h += ui.confirmEv
        ? '<div class="box"><b>Supprimer « ' + esc(f.name || 'cet événement') + ' » ?</b><div class="btn-row"><button class="btn outline sm" data-act="evDelCancel">Annuler</button><button class="btn danger sm" data-act="evDel">Supprimer</button></div></div>'
        : '<button class="btn outline sm" style="color:var(--danger)" data-act="evDelAsk">Supprimer l’événement</button>';
    }
    h += '</div>';
    var issue = evIssues(f);
    h += '<div class="footer"><button class="btn primary" id="e-save" data-act="evSave"' + (issue ? ' disabled' : '') + '>' + esc(issue || (editing ? 'Enregistrer' : 'Créer')) + '</button></div></div>';
    return h;
  }
  function refreshEvSave() {
    var b = document.getElementById('e-save');
    if (!b || !ui.evForm) return;
    var issue = evIssues(ui.evForm);
    b.disabled = !!issue;
    b.textContent = issue || (ui.evForm.id ? 'Enregistrer' : 'Créer');
  }
  function saveEvent() {
    var f = ui.evForm;
    if (!f || evIssues(f)) return;
    var ev = { id: f.id || uid(), kind: f.kind, name: f.name.trim(), note: f.note.trim(), allAccounts: f.allAccounts, accounts: f.allAccounts ? [] : f.accounts.slice() };
    if (f.kind === 'spark') {
      ev.remind = !!f.remind;
      ev.spark = f.spark || {};
    } else {
      Object.assign(ev, { type: 'every', days: f.days.slice(), every: Math.max(1, f.every || 2), anchor: f.anchor,
        times: evTimes(f).filter(function (t, i, arr) { return arr.indexOf(t) === i; }), duration: f.duration || 0, remindBefore: f.remindBefore, autoOpt: true });
    }
    var i = data.events.findIndex(function (x) { return x.id === ev.id; });
    if (i >= 0) data.events[i] = ev; else data.events.push(ev);
    save();
    if (ev.kind === 'spark' ? ev.remind : ev.remindBefore >= 0) ensureNotifPermission(true);
    toast(i >= 0 ? 'Événement modifié' : (ev.kind === 'spark' ? 'Étincelle créée' : 'Arène créée'));
    go('evenements');
  }
  function deleteEvent() {
    var f = ui.evForm;
    if (!f || !f.id) return;
    data.events = data.events.filter(function (e) { return e.id !== f.id; });
    Object.keys(data.raid).forEach(function (k) { if (k.split('|')[1] === f.id) delete data.raid[k]; });
    Object.keys(data.progress).forEach(function (k) { if (k.split('|')[1] === f.id) delete data.progress[k]; });
    save(); toast('Événement supprimé'); go('evenements');
  }

  // Panneau de compteur, ouvert sous la tâche quand l'objectif est grand (ex. 51/200).
  function counterPanel(t, per) {
    if (!ui.counter || ui.counter.t !== t.id) return '';
    var a = findAcc(ui.counter.a);
    if (!a) return '';
    var r = reps(t), c = Math.min(getCount(per, t, a), r);
    return '<div class="counter"><div class="row-between"><span class="counter-title"><span class="av" style="background:' + a.color + '">' + esc(initials(a.name)) + '</span>' + esc(a.name) + '</span>' +
      '<button class="link-btn" data-act="cntClose">Fermer</button></div>' +
      '<div class="counter-main"><button class="cnt-btn" data-act="cnt" data-v="-1" aria-label="Moins 1">−</button>' +
      '<input id="cnt-input" class="input" inputmode="numeric" enterkeyhint="done" autocomplete="off" aria-label="Avancement pour ' + esc(a.name) + '" data-field="cnt" value="' + c + '">' +
      '<span class="counter-max">/ ' + fmtNum(r) + '</span><button class="cnt-btn" data-act="cnt" data-v="1" aria-label="Plus 1">+</button></div>' +
      '<div class="counter-quick"><button class="btn outline sm" data-act="cnt" data-v="-10">−10</button><button class="btn outline sm" data-act="cnt" data-v="10">+10</button>' +
      '<button class="btn outline sm" data-act="cnt" data-v="50">+50</button><button class="btn primary sm" data-act="cntMax">Terminé</button></div></div>';
  }
  function fmtCompact(n) { return n >= 1000 ? (Math.round(n / 100) / 10).toString().replace('.', ',') + 'k' : String(n); }
  function setCounter(v) {
    var t = ui.counter && findTask(ui.counter.t), a = ui.counter && findAcc(ui.counter.a);
    if (!t || !a) return;
    var per = periodOf(t, gameDay());
    if (!per) return;
    var k = pkey(per, t, a), r = reps(t);
    v = Math.max(0, Math.min(r, Math.round(v)));
    if (v) data.progress[k] = v; else delete data.progress[k];
    save(); render();
  }
  function counterValue() {
    var t = findTask(ui.counter.t), a = findAcc(ui.counter.a);
    var per = t && periodOf(t, gameDay());
    return per && a ? getCount(per, t, a) : 0;
  }
  function cycleDot(tid, aid) {
    var t = findTask(tid), a = findAcc(aid);
    if (!t || !a) return;
    var per = periodOf(t, gameDay());
    if (!per) return;
    if (reps(t) > 5) {
      ui.counter = (ui.counter && ui.counter.t === tid && ui.counter.a === aid) ? null : { t: tid, a: aid };
      render(); return;
    }
    var k = pkey(per, t, a), r = reps(t);
    var c = (data.progress[k] || 0) + 1;
    if (c > r) delete data.progress[k]; else data.progress[k] = c;
    save(); render();
  }
  function toggleAll(tid) {
    var t = findTask(tid);
    if (!t) return;
    var per = periodOf(t, gameDay());
    if (!per) return;
    var accs = taskAccounts(t), r = reps(t);
    var all = accs.every(function (a) { return getCount(per, t, a) >= r; });
    accs.forEach(function (a) {
      if (all) delete data.progress[pkey(per, t, a)]; else data.progress[pkey(per, t, a)] = r;
    });
    save(); render();
  }
  function findTask(id) { for (var i = 0; i < data.tasks.length; i++) if (data.tasks[i].id === id) return data.tasks[i]; return null; }
  function findAcc(id) { for (var i = 0; i < data.accounts.length; i++) if (data.accounts[i].id === id) return data.accounts[i]; return null; }

  /* ---------- écran : création / modification de tâche ---------- */
  function newForm(id) {
    var today = gameDay();
    var t = id !== 'new' ? findTask(id) : null;
    var f = {
      id: t ? t.id : null, name: '', note: '', type: 'daily', days: [weekday(today)], resetDay: 0,
      every: 2, start: today, from: today, to: keyFromNum(dayNum(today) + 6), reps: 1, time: '', remindBefore: -1,
      allAccounts: true, accounts: data.accounts.map(function (a) { return a.id; })
    };
    if (t) {
      f = Object.assign(f, JSON.parse(JSON.stringify(t)));
      if (f.allAccounts) f.accounts = data.accounts.map(function (a) { return a.id; });
    }
    return f;
  }
  function formIssues(f) {
    if (!f.name.trim()) return 'Donne un nom à la tâche';
    if (f.type === 'days' && !f.days.length) return 'Choisis au moins un jour';
    if (f.type === 'event' && (!f.from || !f.to || f.from > f.to)) return 'Vérifie les dates';
    if (!f.allAccounts && !f.accounts.length) return 'Sélectionne au moins un compte';
    return null;
  }
  function viewForm(id) {
    if (!ui.form || (ui.form.id || 'new') !== id) {
      if (id !== 'new' && !findTask(id)) { setTimeout(function () { go(''); }, 0); return ''; }
      ui.form = newForm(id);
    }
    var f = ui.form;
    var editing = !!f.id;
    var h = '<div class="screen">' + headBack('Tâche commune', editing ? 'Modifier la tâche' : 'Nouvelle tâche', '');
    h += '<div class="scroll gap-lg">';
    h += '<div class="field"><label class="label" for="f-name">Nom</label><input id="f-name" class="input" data-field="name" maxlength="60" placeholder="Ex. Boss mondial" value="' + esc(f.name) + '"></div>';
    h += '<div class="field"><label class="label" for="f-note">Précision (facultatif)</label><input id="f-note" class="input" data-field="note" maxlength="60" placeholder="Ex. toutes les mines" value="' + esc(f.note) + '"></div>';

    var freqs = [['daily', 'Chaque jour'], ['weekly', 'Chaque semaine'], ['days', 'Certains jours'], ['every', 'Tous les X jours'], ['event', 'Dates limitées']];
    h += '<div class="field" style="gap:10px"><span class="label">Fréquence</span><div class="grid2">' + freqs.map(function (q, i) {
      return '<button class="choice' + (f.type === q[0] ? ' on' : '') + (i === 4 ? ' span2' : '') + '" data-act="freq" data-v="' + q[0] + '" aria-pressed="' + (f.type === q[0]) + '">' + q[1] + '</button>';
    }).join('') + '</div>';
    if (f.type === 'weekly' || f.type === 'days') {
      h += '<span class="hint">' + (f.type === 'weekly' ? 'Jour de remise à zéro :' : 'Jours où la tâche apparaît :') + '</span><div class="days">' + DAYS.map(function (d, i) {
        var on = f.type === 'weekly' ? f.resetDay === i : f.days.indexOf(i) >= 0;
        return '<button class="choice' + (on ? ' on' : '') + '" data-act="day" data-v="' + i + '" aria-label="' + d[1] + '" aria-pressed="' + on + '">' + d[0] + '</button>';
      }).join('') + '</div>';
    }
    if (f.type === 'every') {
      h += '<div class="stepper"><span>Tous les <strong>' + f.every + '</strong> jours</span>' +
        '<button data-act="every" data-v="-1" aria-label="Moins">−</button><button data-act="every" data-v="1" aria-label="Plus">+</button></div>';
    }
    if (f.type === 'event') {
      h += '<div class="grid2"><div class="field"><label class="hint" for="f-from">Du</label><input type="date" id="f-from" class="input" data-field="from" value="' + esc(f.from) + '"></div>' +
        '<div class="field"><label class="hint" for="f-to">Au</label><input type="date" id="f-to" class="input" data-field="to" value="' + esc(f.to) + '"></div></div>' +
        '<span class="hint">Remise à zéro :</span><div class="grid2">' +
        '<button class="choice' + (!f.once ? ' on' : '') + '" data-act="once" data-v="0" aria-pressed="' + !f.once + '">Chaque jour</button>' +
        '<button class="choice' + (f.once ? ' on' : '') + '" data-act="once" data-v="1" aria-pressed="' + !!f.once + '">Jamais (toute la période)</button></div>';
    }
    var summary = {
      daily: 'Remise à zéro chaque jour avec le jeu (' + resetClock() + ').',
      weekly: 'À faire une fois par semaine. Remise à zéro le ' + DAYS[f.resetDay][1] + '.',
      days: f.days.length ? 'Apparaît le ' + f.days.slice().sort().map(function (d) { return DAYS[d][1]; }).join(', ') + '.' : 'Choisis au moins un jour.',
      every: 'À faire une fois tous les ' + f.every + ' jours' + (editing ? '.' : ', à partir d’aujourd’hui.'),
      event: f.once ? 'Objectif à atteindre une seule fois entre ces deux dates : l’avancement se cumule jusqu’à la fin, sans remise à zéro.' : 'À faire chaque jour entre ces deux dates, puis la tâche disparaît.'
    }[f.type];
    h += '<span class="hint">' + summary + '</span></div>';

    h += '<div class="field" style="gap:10px"><label class="label" for="f-reps">Objectif par compte</label><div class="stepper">' +
      '<input id="f-reps" class="input reps-input" inputmode="numeric" autocomplete="off" data-field="reps" value="' + f.reps + '"><span>fois</span>' +
      '<button data-act="reps" data-v="-1" aria-label="Moins">−</button><button data-act="reps" data-v="1" aria-label="Plus">+</button></div>' +
      '<span class="hint">1 = simple case à cocher. Jusqu’à 5, chaque appui ajoute 1. Au-delà (ex. 200 phalènes), un appui sur la case ouvre un compteur.</span></div>';

    h += '<div class="field" style="gap:10px"><span class="label">Heure et rappel (facultatif)</span><div class="row-between" style="gap:10px">' +
      '<input type="time" id="f-time" class="input" style="width:140px" aria-label="Heure de la tâche" data-field="time" value="' + esc(f.time || '') + '">' +
      (f.time ? '<button class="link-btn" data-act="timeClear">Retirer l’heure</button>' : '<span class="hint" style="flex:1">Ex. l’heure de l’arène</span>') + '</div>';
    if (f.time) {
      h += '<div class="chips">' + [[-1, 'Pas de rappel'], [0, 'À l’heure'], [5, '5 min avant'], [15, '15 min avant'], [30, '30 min avant'], [60, '1 h avant']].map(function (o) {
        var on = f.remindBefore === o[0];
        return '<button class="choice' + (on ? ' on' : '') + '" style="padding:0 12px;height:44px" data-act="remindBefore" data-v="' + o[0] + '" aria-pressed="' + on + '">' + o[1] + '</button>';
      }).join('') + '</div><span class="hint">La notification ne part pas si tous les comptes ont déjà fait la tâche.</span>';
    }
    h += '</div>';

    h += '<div class="field" style="gap:10px"><div class="row-between"><span class="label">Comptes concernés</span>' +
      (data.accounts.length ? '<button class="link-btn" data-act="accAllForm">' + (f.allAccounts ? 'Choisir' : 'Tous') + '</button>' : '') + '</div>';
    if (!data.accounts.length) {
      h += '<span class="hint">Aucun compte. Ajoute-les dans Réglages, la tâche s’appliquera à tous.</span>';
    } else {
      h += '<div class="chips">' + data.accounts.map(function (a) {
        var on = f.allAccounts || f.accounts.indexOf(a.id) >= 0;
        return '<button class="chip' + (on ? ' on' : '') + '" style="' + (on ? 'border-color:' + a.color : '') + '" data-act="accForm" data-v="' + a.id + '" aria-pressed="' + on + '">' +
          '<span class="av" style="' + (on ? 'background:' + a.color : '') + '">' + esc(initials(a.name)) + '</span>' + esc(a.name) + '</button>';
      }).join('') + '</div>';
      h += '<span class="hint">' + (f.allAccounts ? 'Tous les comptes, y compris ceux que tu ajouteras plus tard.' : 'Seulement les comptes sélectionnés.') + '</span>';
    }
    h += '</div>';

    if (editing) {
      h += ui.confirmTask
        ? '<div class="box"><b>Supprimer « ' + esc(f.name || 'cette tâche') + ' » ?</b><span class="hint">Les coches associées seront effacées.</span><div class="btn-row"><button class="btn outline sm" data-act="taskDelCancel">Annuler</button><button class="btn danger sm" data-act="taskDel">Supprimer</button></div></div>'
        : '<button class="btn outline sm" style="color:var(--danger)" data-act="taskDelAsk">Supprimer la tâche</button>';
    }
    h += '</div>';
    var issue = formIssues(f);
    var n = f.allAccounts ? data.accounts.length : f.accounts.length;
    var label = issue || (editing ? 'Enregistrer' : (data.accounts.length ? 'Créer pour ' + plural(n, 'compte', 'comptes') : 'Créer la tâche'));
    h += '<div class="footer"><button class="btn primary" id="f-save" data-act="taskSave"' + (issue ? ' disabled' : '') + '>' + esc(label) + '</button></div></div>';
    return h;
  }
  function refreshSaveBtn() {
    var b = document.getElementById('f-save');
    if (!b || !ui.form) return;
    var f = ui.form, issue = formIssues(f);
    var n = f.allAccounts ? data.accounts.length : f.accounts.length;
    b.disabled = !!issue;
    b.textContent = issue || (f.id ? 'Enregistrer' : (data.accounts.length ? 'Créer pour ' + plural(n, 'compte', 'comptes') : 'Créer la tâche'));
  }
  function saveTask() {
    var f = ui.form;
    if (!f || formIssues(f)) return;
    var t = {
      id: f.id || uid(), name: f.name.trim(), note: f.note.trim(), type: f.type,
      days: f.days.slice(), resetDay: f.resetDay, every: f.every, start: f.start, from: f.from, to: f.to, once: f.type === 'event' && !!f.once,
      reps: Math.max(1, Math.min(100000, f.reps || 1)), allAccounts: f.allAccounts, accounts: f.allAccounts ? [] : f.accounts.slice(),
      time: f.time || '', remindBefore: f.time ? f.remindBefore : -1
    };
    if (t.time && t.remindBefore >= 0) ensureNotifPermission(true);
    var i = data.tasks.findIndex(function (x) { return x.id === t.id; });
    if (i >= 0 && ui.migrateOnce) {
      var today = gameDay(), oldPer = periodOf(data.tasks[i], today), newPer = periodOf(t, today);
      if (oldPer && newPer && oldPer !== newPer) {
        data.accounts.forEach(function (a) {
          var v = data.progress[pkey(oldPer, t, a)];
          if (v) data.progress[pkey(newPer, t, a)] = Math.max(v, data.progress[pkey(newPer, t, a)] || 0);
        });
      }
    }
    ui.migrateOnce = false;
    if (i >= 0) data.tasks[i] = t; else data.tasks.push(t);
    ui.tab = tabOf(t);
    save();
    toast(i >= 0 ? 'Tâche modifiée' : 'Tâche créée');
    go('');
  }
  function deleteTask() {
    var f = ui.form;
    if (!f || !f.id) return;
    data.tasks = data.tasks.filter(function (t) { return t.id !== f.id; });
    Object.keys(data.progress).forEach(function (k) { if (k.split('|')[1] === f.id) delete data.progress[k]; });
    save(); toast('Tâche supprimée'); go('');
  }

  /* ---------- écran : réglages ---------- */
  function viewSettings() {
    var h = '<div class="screen"><div class="head"><h1 class="small" style="font-size:26px">Réglages</h1></div><div class="scroll gap-lg">';

    h += '<div class="field" style="gap:8px"><div class="row-between"><span class="label">Mes comptes</span><span class="hint">' + plural(data.accounts.length, 'compte', 'comptes') + '</span></div>';
    if (!data.accounts.length) h += '<div class="empty" style="padding:16px">Aucun compte pour l’instant. Ajoute le premier ci-dessous.</div>';
    data.accounts.forEach(function (a, i) {
      h += '<div class="acc-row"><div class="acc-line"><span class="av lg" style="background:' + a.color + '">' + esc(initials(a.name)) + '</span><b>' + esc(a.name) + '</b>';
      if (ui.editAcc !== a.id) h += '<button class="icon-btn ghost" style="width:44px;height:44px" data-act="accEdit" data-v="' + a.id + '" aria-label="Modifier ' + esc(a.name) + '">' + ICON.edit + '</button>';
      h += '</div>';
      if (ui.editAcc === a.id) {
        if (ui.confirmAcc === a.id) {
          h += '<div class="acc-edit"><b>Supprimer ' + esc(a.name) + ' ?</b><span class="hint">Ses coches seront effacées.</span><div class="btn-row"><button class="btn outline sm" data-act="accDelCancel">Annuler</button><button class="btn danger sm" data-act="accDel" data-v="' + a.id + '">Supprimer</button></div></div>';
        } else {
          h += '<div class="acc-edit"><label class="hint" for="acc-name">Nom du compte</label><input id="acc-name" class="input" style="height:46px" maxlength="24" data-field="accName" data-v="' + a.id + '" value="' + esc(a.name) + '">' +
            '<div class="swatches">' + PALETTE.map(function (p) {
              return '<button class="swatch' + (a.color === p[0] ? ' on' : '') + '" style="background:' + p[0] + '" data-act="accColor" data-v="' + a.id + '" data-c="' + p[0] + '" aria-label="Couleur ' + p[1] + '"></button>';
            }).join('') + '</div>' +
            '<div class="btn-row"><button class="btn outline sm" data-act="accMove" data-v="' + a.id + '" data-d="-1"' + (i === 0 ? ' disabled' : '') + '>↑ Monter</button><button class="btn outline sm" data-act="accMove" data-v="' + a.id + '" data-d="1"' + (i === data.accounts.length - 1 ? ' disabled' : '') + '>↓ Descendre</button></div>' +
            '<div class="btn-row"><button class="btn outline sm" style="color:var(--danger)" data-act="accDelAsk" data-v="' + a.id + '">Supprimer</button><button class="btn primary sm" data-act="accDone">OK</button></div></div>';
        }
      }
      h += '</div>';
    });
    var canAdd = ui.draft.name.trim().length > 0;
    h += '<div class="add-box"><label for="acc-new" style="font-size:13px;font-weight:700">Ajouter un compte</label><div class="add-line">' +
      '<input id="acc-new" class="input" maxlength="24" data-field="draft" placeholder="Pseudo ou surnom du compte" value="' + esc(ui.draft.name) + '" enterkeyhint="done">' +
      '<button class="btn primary sm" id="acc-add" style="width:auto;padding:0 14px" data-act="accAdd"' + (canAdd ? '' : ' disabled') + '>Ajouter</button></div>' +
      '<div class="swatches">' + PALETTE.map(function (p) {
        return '<button class="swatch' + (ui.draft.color === p[0] ? ' on' : '') + '" style="background:' + p[0] + '" data-act="draftColor" data-c="' + p[0] + '" aria-label="Couleur ' + p[1] + '"></button>';
      }).join('') + '</div></div></div>';

    h += '<div class="field" style="gap:8px"><span class="label">Remise à zéro</span>' +
      '<div class="box"><div class="row-between"><b>Reset du jeu</b><b style="color:var(--accent)">' + resetClock() + '</b></div>' +
      '<span class="hint">Calé sur minuit UTC : 1h l’hiver, 2h l’été. Le changement d’heure est géré tout seul. Prochain reset dans ' + resetIn() + '.</span></div>' +
      '<div class="box row"><div class="grow"><b>Rappel du soir</b><span class="hint">Notification s’il reste des cases vides</span></div>' +
      '<button class="switch' + (data.settings.remind ? ' on' : '') + '" role="switch" aria-checked="' + data.settings.remind + '" aria-label="Rappel du soir" data-act="remind"><i></i></button></div>' +
      (data.settings.remind ? '<div class="box row"><label class="grow" for="remind-time"><b>Heure du rappel</b></label><input type="time" id="remind-time" class="input" style="width:120px;height:46px" data-field="remindTime" value="' + esc(data.settings.remindTime) + '"></div>' : '') +
      (ui.exact && ui.exact !== 'granted' && (data.settings.remind || data.tasks.some(function (t) { return t.time && t.remindBefore >= 0; }))
        ? '<div class="box row"><div class="grow"><b>Rappels à la minute près</b><span class="hint">Sans cette autorisation, Android peut décaler les rappels de quelques minutes.</span></div><button class="btn primary sm" style="width:auto;padding:0 14px" data-act="exactOpen">Autoriser</button></div>' : '') +
      '</div>';

    h += '<div class="field" style="gap:8px"><span class="label">Ressources suivies</span>';
    data.resources.forEach(function (r) {
      if (ui.confirmRes === r.id) {
        h += '<div class="box"><b>Ne plus suivre ' + esc(r.name) + ' ?</b><span class="hint">Les valeurs enregistrées pour cette ressource seront effacées.</span><div class="btn-row"><button class="btn outline sm" data-act="resDelCancel">Annuler</button><button class="btn danger sm" data-act="resDel" data-v="' + r.id + '">Supprimer</button></div></div>';
      } else {
        h += '<div class="box row" style="padding:8px 8px 8px 14px"><span class="res-dot" style="background:' + r.color + '"></span>' +
          '<input class="input" style="height:44px;font-weight:700;flex:1;min-width:0" maxlength="20" aria-label="Nom de la ressource" data-field="resName" data-v="' + r.id + '" value="' + esc(r.name) + '">' +
          '<button class="icon-btn ghost" style="width:44px;height:44px;color:var(--danger)" data-act="resDelAsk" data-v="' + r.id + '" aria-label="Ne plus suivre ' + esc(r.name) + '">' + ICON.trash + '</button></div>';
      }
    });
    h += '<div class="add-line"><input id="res-new" class="input" maxlength="20" data-field="resDraft" placeholder="Autre ressource (ex. Or)" value="' + esc(ui.resDraft || '') + '" enterkeyhint="done">' +
      '<button class="btn primary sm" id="res-add" style="width:auto;padding:0 14px" data-act="resAdd"' + ((ui.resDraft || '').trim() ? '' : ' disabled') + '>Ajouter</button></div></div>';

    h += '<div class="field" style="gap:8px"><span class="label">Partage et sauvegarde</span>' +
      '<button class="box" data-act="shareTasks"' + (data.tasks.length ? '' : ' disabled') + '><b>Partager ma liste de tâches</b><span class="hint">' + (data.tasks.length ? 'Envoie tes ' + plural(data.tasks.length, 'tâche', 'tâches') + ' à un ami, sans tes comptes' : 'Crée d’abord des tâches') + '</span></button>' +
      '<button class="box" data-act="go" data-to="importer"><b>Importer</b><span class="hint">Coller une liste reçue d’un ami ou une sauvegarde</span></button>' +
      '<button class="box" data-act="backup"><b>Faire une sauvegarde</b><span class="hint">Tout (comptes, tâches, coches, ressources), à garder en cas de changement de téléphone</span></button>' +
      '</div>';

    h += '<div class="field" style="gap:8px"><span class="label">Zone sensible</span>' +
      (ui.confirmWipe
        ? '<div class="box"><b>Tout effacer ?</b><span class="hint">Comptes, tâches, coches et historique. Impossible à annuler.</span><div class="btn-row"><button class="btn outline sm" data-act="wipeCancel">Annuler</button><button class="btn danger sm" data-act="wipe">Tout effacer</button></div></div>'
        : '<button class="btn outline sm" style="color:var(--danger)" data-act="wipeAsk">Tout effacer</button>') +
      '<span class="hint" style="text-align:center;margin-top:8px">Multicompte · v' + APP_VERSION + '</span></div>';

    h += '</div>' + nav('reglages') + '</div>';
    return h;
  }
  var APP_VERSION = '1.0';

  /* ---------- écran : ressources ---------- */
  function fmtNum(n) { return Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' '); }
  function resKey(aid, rid) { return aid + '|' + rid; }
  // Valeur actuelle et écart avec la dernière valeur notée un jour précédent.
  function resInfo(aid, rid) {
    var log = data.resLog[resKey(aid, rid)] || [];
    if (!log.length) return null;
    var today = gameDay(), cur = log[log.length - 1], prev = null;
    for (var i = log.length - 1; i >= 0; i--) { if (log[i][0] < today) { prev = log[i]; break; } }
    if (prev === cur) prev = null;
    return { value: cur[1], day: cur[0], prev: prev };
  }
  function setRes(aid, rid, value) {
    var k = resKey(aid, rid), today = gameDay();
    var log = data.resLog[k] || (data.resLog[k] = []);
    if (log.length && log[log.length - 1][0] === today) log[log.length - 1][1] = value; else log.push([today, value]);
    while (log.length > 120) log.shift();
    save();
  }
  function deltaHtml(d, sinceKey) {
    if (!d) return '<span class="delta">= ' + sinceLabel(sinceKey) + '</span>';
    return '<span class="delta ' + (d > 0 ? 'up' : 'down') + '">' + (d > 0 ? '+' : '−') + fmtNum(Math.abs(d)) + ' ' + sinceLabel(sinceKey) + '</span>';
  }
  function sinceLabel(key) {
    var diff = dayNum(gameDay()) - dayNum(key);
    return diff === 1 ? 'depuis hier' : 'depuis le ' + fmtDay(key, { day: 'numeric', month: 'short' });
  }
  /* ---------- graphique des ressources ---------- */
  // Série d'une ressource, jour par jour, pour un compte ou pour le total (dernière valeur connue reportée).
  function resSeries(rid, scope, days) {
    var today = dayNum(gameDay()), start = today - days + 1;
    var accs = scope === 'total' ? data.accounts : data.accounts.filter(function (a) { return a.id === scope; });
    var logs = accs.map(function (a) { return (data.resLog[resKey(a.id, rid)] || []).map(function (e) { return [dayNum(e[0]), e[1]]; }); });
    var pts = [];
    for (var d = start; d <= today; d++) {
      var sum = 0, any = false;
      logs.forEach(function (log) {
        var v = null;
        for (var i = 0; i < log.length && log[i][0] <= d; i++) v = log[i][1];
        if (v !== null) { sum += v; any = true; }
      });
      pts.push(any ? sum : null);
    }
    var first = pts.findIndex(function (v) { return v !== null; });
    return { start: start, pts: first < 0 ? [] : pts.slice(first), offset: first < 0 ? 0 : first };
  }
  function chartCard() {
    var ch = ui.chart;
    if (!data.resources.some(function (r) { return r.id === ch.res; })) ch.res = data.resources[0].id;
    if (ch.scope !== 'total' && !findAcc(ch.scope)) ch.scope = 'total';
    var res = data.resources.filter(function (r) { return r.id === ch.res; })[0];
    var color = ch.scope === 'total' ? res.color : findAcc(ch.scope).color;
    var ser = resSeries(ch.res, ch.scope, ch.days);
    var h = '<div class="card chart-card">';
    if (data.resources.length > 1) {
      h += '<div class="seg" role="group" aria-label="Ressource">' + data.resources.map(function (r) {
        var on = r.id === ch.res;
        return '<button class="seg-btn' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-act="chRes" data-v="' + r.id + '"><span class="res-dot" style="background:' + r.color + '"></span>' + esc(r.name) + '</button>';
      }).join('') + '</div>';
    }
    h += '<div class="chips scope-chips" role="group" aria-label="Comptes">' +
      '<button class="scope' + (ch.scope === 'total' ? ' on' : '') + '" aria-pressed="' + (ch.scope === 'total') + '" data-act="chScope" data-v="total">Total</button>' +
      data.accounts.map(function (a) {
        var on = ch.scope === a.id;
        return '<button class="scope' + (on ? ' on' : '') + '" style="' + (on ? 'border-color:' + a.color : '') + '" aria-pressed="' + on + '" data-act="chScope" data-v="' + a.id + '"><span class="av" style="width:22px;height:22px;font-size:9px;border-radius:5px;background:' + a.color + '">' + esc(initials(a.name)) + '</span>' + esc(a.name) + '</button>';
      }).join('') + '</div>';
    var known = ser.pts.filter(function (v) { return v !== null; });
    if (known.length < 2) {
      h += '<div class="chart-empty">' + (known.length ? 'Une seule valeur notée pour l’instant. La courbe apparaîtra dès le deuxième jour.' : 'Aucune valeur notée sur cette période. Remplis les champs ci-dessous, la courbe se construit jour après jour.') + '</div>';
    } else {
      var last = known[known.length - 1], firstV = known[0], d = last - firstV;
      var pick = ui.chartPick != null && ui.chartPick < ser.pts.length ? ui.chartPick : null;
      var pickV = pick != null ? ser.pts[pick] : null;
      var pickDay = keyFromNum(ser.start + ser.offset + (pick != null ? pick : ser.pts.length - 1));
      h += '<div class="chart-head"><div><b class="chart-val">' + fmtNum(pick != null ? pickV : last) + '</b>' +
        '<span class="hint"> ' + esc(res.name) + (pick != null ? ' le ' + esc(fmtDay(pickDay, { day: 'numeric', month: 'short' })) : ' aujourd’hui') + '</span></div>' +
        (pick != null ? '' : '<span class="delta ' + (d > 0 ? 'up' : d < 0 ? 'down' : '') + '">' + (d > 0 ? '+' : d < 0 ? '−' : '=') + (d ? fmtNum(Math.abs(d)) : '') + ' sur ' + ser.pts.length + ' j</span>') + '</div>';
      h += chartSvg(ser, color, pick);
    }
    h += '<div class="seg small" role="group" aria-label="Période">' + [7, 30, 90].map(function (n) {
      return '<button class="seg-btn' + (ch.days === n ? ' on' : '') + '" aria-pressed="' + (ch.days === n) + '" data-act="chDays" data-v="' + n + '">' + n + ' j</button>';
    }).join('') + '</div></div>';
    return h;
  }
  function chartSvg(ser, color, pick) {
    var W = 340, H = 150, L = 4, Rr = 4, T = 10, B = 22;
    var vals = ser.pts.filter(function (v) { return v !== null; });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (min === max) { min = Math.max(0, min - 1); max = max + 1; }
    var pad = (max - min) * 0.12; min = Math.max(0, min - pad); max = max + pad;
    var n = ser.pts.length;
    function x(i) { return L + (n === 1 ? (W - L - Rr) / 2 : i * (W - L - Rr) / (n - 1)); }
    function y(v) { return T + (1 - (v - min) / (max - min)) * (H - T - B); }
    var line = '', area = '', started = false, lastI = 0;
    ser.pts.forEach(function (v, i) {
      if (v === null) return;
      line += (started ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      if (!started) area = 'M' + x(i).toFixed(1) + ' ' + (H - B) + ' ';
      area += 'L' + x(i).toFixed(1) + ' ' + y(v).toFixed(1) + ' ';
      started = true; lastI = i;
    });
    area += 'L' + x(lastI).toFixed(1) + ' ' + (H - B) + ' Z';
    var gid = 'g' + color.slice(1);
    var grid = [0.25, 0.5, 0.75].map(function (f) { var yy = (T + f * (H - T - B)).toFixed(1); return '<line x1="0" x2="' + W + '" y1="' + yy + '" y2="' + yy + '" class="ch-grid"/>'; }).join('');
    var fd = function (k) { return esc(fmtDay(keyFromNum(ser.start + ser.offset + k), { day: 'numeric', month: 'short' })); };
    var mark = pick != null && ser.pts[pick] !== null ? pick : lastI;
    var mv = ser.pts[mark];
    return '<div class="chart" data-n="' + n + '"><svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Évolution sur la période, de ' + fmtNum(vals[0]) + ' à ' + fmtNum(vals[vals.length - 1]) + '">' +
      '<defs><linearGradient id="' + gid + '" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="' + color + '" stop-opacity=".35"/><stop offset="1" stop-color="' + color + '" stop-opacity="0"/></linearGradient></defs>' +
      grid + '<line x1="0" x2="' + W + '" y1="' + (H - B) + '" y2="' + (H - B) + '" class="ch-axis"/>' +
      '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
      '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      (pick != null ? '<line x1="' + x(mark).toFixed(1) + '" x2="' + x(mark).toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '" class="ch-cursor" vector-effect="non-scaling-stroke"/>' : '') +
      '</svg>' +
      '<span class="ch-dot" style="left:' + (x(mark) / W * 100).toFixed(2) + '%;top:' + (y(mv) / H * 100).toFixed(2) + '%;background:' + color + '"></span>' +
      '<span class="ch-y top">' + fmtCompact2(max) + '</span><span class="ch-y bot">' + fmtCompact2(min) + '</span>' +
      '<span class="ch-x left">' + fd(0) + '</span><span class="ch-x right">' + fd(n - 1) + '</span></div>';
  }
  function fmtCompact2(v) {
    v = Math.round(v);
    if (v >= 1e6) return (Math.round(v / 1e5) / 10).toString().replace('.', ',') + ' M';
    if (v >= 1e4) return Math.round(v / 1000) + ' k';
    return fmtNum(v);
  }
  function chartPickAt(el, clientX) {
    var r = el.getBoundingClientRect(), n = +el.dataset.n;
    var f = Math.max(0, Math.min(1, (clientX - r.left - r.width * 4 / 340) / (r.width * 332 / 340)));
    var i = Math.round(f * (n - 1));
    if (i !== ui.chartPick) { ui.chartPick = i; render(); }
  }

  function viewResources() {
    var today = gameDay();
    var h = '<div class="screen"><div class="head"><div style="display:flex;flex-direction:column;gap:2px"><span class="kicker">Ressources · ' +
      esc(fmtDay(today, { weekday: 'short', day: 'numeric', month: 'short' })) + '</span><h1>Ressources</h1>' +
      '<span class="sub">Tape +500 ou -200 pour ajouter ou retirer</span></div></div><div class="scroll">';
    if (!data.accounts.length || !data.resources.length) {
      h += '<div class="empty">' + (!data.accounts.length ? 'Ajoute d’abord tes comptes.' : 'Aucune ressource suivie.') +
        '<button class="btn primary sm" style="width:auto;padding:0 16px" data-act="go" data-to="reglages">Aller aux réglages</button></div>';
    } else {
      // Totaux
      h += '<div class="card totals"><span class="label">Total des ' + plural(data.accounts.length, 'compte', 'comptes') + '</span><div class="res-grid">';
      data.resources.forEach(function (r) {
        var tot = 0, delta = 0, any = false, anyPrev = false, since = null;
        data.accounts.forEach(function (a) {
          var info = resInfo(a.id, r.id);
          if (!info) return;
          any = true; tot += info.value;
          if (info.prev) { anyPrev = true; delta += info.value - info.prev[1]; if (!since || info.prev[0] < since) since = info.prev[0]; }
        });
        h += '<div class="res-total"><span class="res-name"><span class="res-dot" style="background:' + r.color + '"></span>' + esc(r.name) + '</span>' +
          '<b>' + (any ? fmtNum(tot) : '—') + '</b>' + (anyPrev ? deltaHtml(delta, since) : '') + '</div>';
      });
      h += '</div></div>';
      h += chartCard();
      // Par compte
      data.accounts.forEach(function (a) {
        h += '<div class="card"><div class="task-top"><span class="av lg" style="background:' + a.color + '">' + esc(initials(a.name)) + '</span>' +
          '<div class="task-name"><b>' + esc(a.name) + '</b></div></div><div class="res-grid">';
        data.resources.forEach(function (r) {
          var info = resInfo(a.id, r.id);
          var id = 'res-' + a.id + '-' + r.id;
          h += '<div class="res-cell"><label class="res-name" for="' + id + '"><span class="res-dot" style="background:' + r.color + '"></span>' + esc(r.name) + '</label>' +
            '<input id="' + id + '" class="input res-input" inputmode="numeric" enterkeyhint="done" autocomplete="off" placeholder="0" data-field="res" data-a="' + a.id + '" data-r="' + r.id + '" value="' + (info ? fmtNum(info.value) : '') + '">' +
            (info && info.prev ? deltaHtml(info.value - info.prev[1], info.prev[0]) : '<span class="delta">' + (info ? 'Noté ' + (info.day === today ? 'aujourd’hui' : 'le ' + esc(fmtDay(info.day, { day: 'numeric', month: 'short' }))) : 'Pas encore noté') + '</span>') +
            '</div>';
        });
        h += '</div></div>';
      });
    }
    h += '</div>' + nav('ressources') + '</div>';
    return h;
  }
  function applyResInput(el) {
    var raw = el.value.replace(/[\s\u00a0\u202f.]/g, '').replace(',', '.');
    if (raw === '') return;
    var m = raw.match(/^([+-]?)(\d+(?:\.\d+)?)$/);
    if (!m) { toast('Nombre non reconnu'); render(); return; }
    var n = parseFloat(m[2]);
    var info = resInfo(el.dataset.a, el.dataset.r);
    var cur = info ? info.value : 0;
    var v = m[1] === '+' ? cur + n : m[1] === '-' ? Math.max(0, cur - n) : n;
    setRes(el.dataset.a, el.dataset.r, Math.round(v));
    // On redessine après le changement de champ pour garder le clavier sur le champ suivant.
    setTimeout(function () {
      var next = document.activeElement && document.activeElement.id;
      render();
      var e2 = next && document.getElementById(next);
      if (e2 && e2.tagName === 'INPUT') e2.focus();
    }, 0);
  }
  function addResource() {
    var name = (ui.resDraft || '').trim();
    if (!name) return;
    var used = data.resources.map(function (r) { return r.color; });
    var color = RES_COLORS.filter(function (c) { return used.indexOf(c) < 0; })[0] || RES_COLORS[0];
    data.resources.push({ id: uid(), name: name.slice(0, 20), color: color });
    ui.resDraft = '';
    save(); render();
  }
  function deleteResource(id) {
    data.resources = data.resources.filter(function (r) { return r.id !== id; });
    Object.keys(data.resLog).forEach(function (k) { if (k.split('|')[1] === id) delete data.resLog[k]; });
    ui.confirmRes = null;
    save(); toast('Ressource retirée'); render();
  }

  function addAccount() {
    var name = ui.draft.name.trim();
    if (!name) return;
    data.accounts.push({ id: uid(), name: name.slice(0, 24), color: ui.draft.color });
    data.welcomed = true;
    var used = data.accounts.map(function (a) { return a.color; });
    var next = PALETTE.filter(function (p) { return used.indexOf(p[0]) < 0; })[0];
    ui.draft = { name: '', color: next ? next[0] : ui.draft.color };
    save(); render();
    var inp = document.getElementById('acc-new');
    if (inp) inp.focus();
  }
  function deleteAccount(id) {
    data.accounts = data.accounts.filter(function (a) { return a.id !== id; });
    data.tasks.concat(data.events).forEach(function (t) { if (t.accounts) t.accounts = t.accounts.filter(function (x) { return x !== id; }); });
    Object.keys(data.raid).forEach(function (k) { if (k.split('|')[2] === id) delete data.raid[k]; });
    Object.keys(data.progress).forEach(function (k) { if (k.split('|')[2] === id) delete data.progress[k]; });
    Object.keys(data.resLog).forEach(function (k) { if (k.split('|')[0] === id) delete data.resLog[k]; });
    ui.editAcc = null; ui.confirmAcc = null;
    save(); toast('Compte supprimé'); render();
  }
  function moveAccount(id, d) {
    var i = data.accounts.findIndex(function (a) { return a.id === id; });
    var j = i + d;
    if (i < 0 || j < 0 || j >= data.accounts.length) return;
    var tmp = data.accounts[i]; data.accounts[i] = data.accounts[j]; data.accounts[j] = tmp;
    save(); render();
  }

  /* ---------- écran : historique ---------- */
  function histBlock(label, s) {
    var pct = s.total ? Math.round(s.done / s.total * 100) : 0;
    var accs = data.accounts.filter(function (a) { return s.acc[a.id]; }).map(function (a) {
      var v = s.acc[a.id];
      return '<span class="hist-acc"><span class="av" style="background:' + a.color + '">' + esc(initials(a.name)) + '</span>' + v[0] + '/' + v[1] + '</span>';
    }).join('');
    return '<div class="card"><div class="row-between"><b style="font-size:16px">' + esc(label) + '</b><span class="count">' + s.done + '<small>/' + s.total + '</small></span></div>' +
      '<div class="bar wide"><i style="width:' + pct + '%"></i></div>' + (accs ? '<div class="hist-accs">' + accs + '</div>' : '') + '</div>';
  }
  function viewHistory() {
    var today = gameDay();
    var h = '<div class="screen"><div class="head"><div style="display:flex;flex-direction:column;gap:2px"><span class="kicker">30 derniers jours</span><h1 class="small" style="font-size:26px">Historique</h1></div></div><div class="scroll">';
    var s = statsFor(today);
    h += histBlock('Aujourd’hui (en cours)', s);
    var keys = Object.keys(data.history).sort().reverse();
    if (!keys.length) h += '<div class="empty">L’historique se remplit chaque jour au moment du reset.</div>';
    keys.forEach(function (k) {
      h += histBlock(fmtDay(k, { weekday: 'long', day: 'numeric', month: 'long' }), data.history[k]);
    });
    h += '</div>' + nav('historique') + '</div>';
    return h;
  }

  /* ---------- partage / import / sauvegarde ---------- */
  function encode(obj) { return SHARE_PREFIX + btoa(unescape(encodeURIComponent(JSON.stringify(obj)))); }
  function decode(text) {
    var i = text.indexOf(SHARE_PREFIX);
    if (i < 0) return null;
    var code = text.slice(i + SHARE_PREFIX.length).replace(/\s+/g, '');
    var m = code.match(/^[A-Za-z0-9+/=]+/);
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(escape(atob(m[0])))); } catch (e) { return null; }
  }
  function plugin(name) { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]; }
  function shareText(title, text) {
    var Share = plugin('Share');
    if (Share) {
      Share.share({ title: title, text: text, dialogTitle: title }).catch(function () {});
      return;
    }
    if (navigator.share) { navigator.share({ title: title, text: text }).catch(function () {}); return; }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('Copié : colle-le où tu veux'); }, function () { toast('Copie impossible'); });
    }
  }
  function shareTasks() {
    var tasks = data.tasks.map(function (t) {
      return { name: t.name, note: t.note, type: t.type, days: t.days, resetDay: t.resetDay, every: t.every, from: t.from, to: t.to, once: !!t.once, reps: t.reps, time: t.time || '', remindBefore: t.time ? t.remindBefore : -1 };
    });
    shareText('Ma liste de tâches Multicompte',
      'Ma liste de tâches Multicompte. Dans l’appli : Réglages > Importer, puis colle tout ce message.\n\n' + encode({ kind: 'tasks', v: 2, tasks: tasks,
        events: data.events.map(function (e) { return { kind: e.kind, name: e.name, note: e.note, remind: e.remind, type: e.type, days: e.days, every: e.every, anchor: e.anchor, times: e.times, duration: e.duration, remindBefore: e.remindBefore, autoOpt: e.autoOpt }; }) }));
  }
  function backup() {
    shareText('Sauvegarde Multicompte',
      'Sauvegarde Multicompte du ' + new Date().toLocaleDateString('fr-FR') + '. Pour restaurer : Réglages > Importer, puis colle tout ce message.\n\n' + encode({ kind: 'backup', v: 1, data: data }));
  }
  function viewImport() {
    var h = '<div class="screen">' + headBack('Réglages', 'Importer', 'reglages') + '<div class="scroll gap-lg">';
    if (ui.importPending) {
      var p = ui.importPending;
      if (p.kind === 'tasks') {
        var names = p.tasks.concat(p.events).map(function (t) { return t.name; });
        h += '<div class="box"><b>' + plural(p.tasks.length, 'tâche', 'tâches') + (p.events.length ? ' et ' + plural(p.events.length, 'événement', 'événements') : '') + ' trouvés</b><span class="hint">' +
          esc(names.slice(0, 8).join(', ')) + (names.length > 8 ? '…' : '') +
          '</span><span class="hint">Elles s’ajoutent à tes tâches actuelles et s’appliquent à tous tes comptes.</span>' +
          '<div class="btn-row"><button class="btn outline sm" data-act="importCancel">Annuler</button><button class="btn primary sm" data-act="importConfirm">Ajouter</button></div></div>';
      } else {
        var d = p.data;
        h += '<div class="box"><b>Restaurer cette sauvegarde ?</b><span class="hint">' + plural(d.accounts.length, 'compte', 'comptes') + ', ' + plural(d.tasks.length, 'tâche', 'tâches') +
          '. Tes données actuelles seront remplacées.</span>' +
          '<div class="btn-row"><button class="btn outline sm" data-act="importCancel">Annuler</button><button class="btn danger sm" data-act="importConfirm">Remplacer</button></div></div>';
      }
    } else {
      h += '<div class="field"><label class="label" for="imp">Message reçu</label>' +
        '<textarea id="imp" class="input" data-field="importText" placeholder="Colle ici le message qui contient MULTICOMPTE:…">' + esc(ui.importText) + '</textarea>' +
        '<span class="hint">Fonctionne avec une liste de tâches partagée par un ami ou avec une de tes sauvegardes.</span></div>' +
        '<div class="btn-row"><button class="btn outline sm" data-act="paste">Coller</button><button class="btn primary sm" data-act="importRead">Lire le message</button></div>';
    }
    h += '</div></div>';
    return h;
  }
  function readImport() {
    var obj = decode(ui.importText || '');
    if (!obj || (obj.kind !== 'tasks' && obj.kind !== 'backup')) { toast('Message non reconnu'); return; }
    if (obj.kind === 'tasks') { if (!Array.isArray(obj.tasks)) obj.tasks = []; if (!Array.isArray(obj.events)) obj.events = []; }
    if (obj.kind === 'tasks' && !obj.tasks.length && !obj.events.length) { toast('Aucune tâche dans ce message'); return; }
    if (obj.kind === 'backup') obj.data = normalize(obj.data);
    ui.importPending = obj; render();
  }
  function confirmImport() {
    var p = ui.importPending;
    if (!p) return;
    var today = gameDay();
    if (p.kind === 'tasks') {
      p.tasks.forEach(function (t) {
        data.tasks.push({
          id: uid(), name: String(t.name || 'Tâche').slice(0, 60), note: String(t.note || '').slice(0, 60),
          type: ['daily', 'weekly', 'days', 'every', 'event'].indexOf(t.type) >= 0 ? t.type : 'daily',
          days: Array.isArray(t.days) ? t.days : [0], resetDay: t.resetDay || 0, every: Math.max(2, t.every || 2), start: today,
          from: t.from || today, to: t.to || today, once: t.type === 'event' && !!t.once, reps: Math.max(1, Math.min(100000, t.reps || 1)), allAccounts: true, accounts: [],
          time: /^\d\d:\d\d$/.test(t.time || '') ? t.time : '', remindBefore: /^\d\d:\d\d$/.test(t.time || '') && t.remindBefore >= 0 ? +t.remindBefore : -1
        });
      });
      p.events.forEach(function (e) {
        if (e.kind === 'spark') {
          data.events.push({ id: uid(), kind: 'spark', name: String(e.name || 'Étincelle').slice(0, 60), note: String(e.note || '').slice(0, 60), remind: e.remind !== false, spark: {}, allAccounts: true, accounts: [] });
          return;
        }
        var times = (Array.isArray(e.times) ? e.times : []).filter(function (x) { return /^\d\d:\d\d$/.test(x); });
        if (!times.length) return;
        data.events.push({ id: uid(), kind: 'arena', name: String(e.name || 'Arène').slice(0, 60), note: String(e.note || '').slice(0, 60),
          type: ['daily', 'days', 'every'].indexOf(e.type) >= 0 ? e.type : 'daily', days: Array.isArray(e.days) ? e.days : [0, 1, 2, 3, 4, 5, 6],
          every: Math.max(2, e.every || 2), anchor: /^\d{4}-\d\d-\d\d$/.test(e.anchor || '') ? e.anchor : localKey(new Date()), times: times.slice(0, 6),
          duration: +e.duration || 0, remindBefore: e.remindBefore >= 0 ? +e.remindBefore : -1, autoOpt: true, allAccounts: true, accounts: [] });
      });
      toast(plural(p.tasks.length + p.events.length, 'élément importé', 'éléments importés'));
    } else {
      data = p.data;
      data.lastDay = null;
      toast('Sauvegarde restaurée');
    }
    data.welcomed = true;
    ui.importPending = null; ui.importText = '';
    save();
    go(data.accounts.length ? '' : 'reglages');
  }

  /* ---------- rappels (appli Android uniquement) ---------- */
  var remindTimer = null;
  function queueReminders() { clearTimeout(remindTimer); remindTimer = setTimeout(scheduleReminders, 600); }
  function scheduleReminders() {
    var LN = plugin('LocalNotifications');
    if (!LN) return;
    var exactOk = true;
    var checkExact = LN.checkExactNotificationSetting ? LN.checkExactNotificationSetting().then(function (r) { exactOk = r.exact_alarm === 'granted'; ui.exact = r.exact_alarm; }, function () {}) : Promise.resolve();
    LN.getPending().then(function (r) {
      var ids = (r.notifications || []).map(function (n) { return { id: n.id }; });
      return ids.length ? LN.cancel({ notifications: ids }) : null;
    }).catch(function () {}).then(function () {
      return Promise.all([LN.checkPermissions(), checkExact]);
    }).then(function (res) {
      if (!res || res[0].display !== 'granted') return;
      var list = buildNotifications(exactOk);
      if (list.length) return LN.schedule({ notifications: list });
    }).catch(function () {});
  }
  function buildNotifications(exact) {
    var now = new Date(), list = [], nextId = REMIND_BASE_ID;
    function push(at, title, body) {
      list.push({ id: nextId++, title: title, body: body, schedule: { at: at, allowWhileIdle: true }, isExactNotification: exact });
    }
    // Rappel du soir
    if (data.settings.remind) {
      var hm = (data.settings.remindTime || '20:00').split(':');
      var s = statsFor(gameDay()), left = s.total - s.done;
      for (var d = 0; d < 8; d++) {
        var at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, +hm[0], +hm[1], 0);
        if (at <= now || (d === 0 && left === 0)) continue;
        push(at, 'Multicompte', d === 0 ? 'Il te reste ' + plural(left, 'case', 'cases') + ' à cocher aujourd’hui.' : 'Pense à faire tes tâches du jour sur tous tes comptes.');
      }
    }
    // Rappels des tâches à heure fixe
    data.tasks.forEach(function (t) {
      if (!t.time || !(t.remindBefore >= 0)) return;
      var tm = t.time.split(':');
      for (var d = 0; d < 8; d++) {
        var occ = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, +tm[0], +tm[1], 0);
        var at = new Date(occ.getTime() - t.remindBefore * 60000);
        if (at <= now) continue;
        var key = occ.toISOString().slice(0, 10);
        var per = periodOf(t, key);
        if (!per) continue;
        var accs = taskAccounts(t);
        var todo = accs.filter(function (a) { return getCount(per, t, a) < reps(t); }).length;
        if (!accs.length || !todo) continue;
        push(at, t.remindBefore ? t.name + ' dans ' + t.remindBefore + ' min' : t.name + ' : c’est l’heure',
          'À ' + t.time + ' · ' + (todo === accs.length ? 'à faire sur ' + plural(todo, 'compte', 'comptes') : 'encore ' + plural(todo, 'compte', 'comptes') + ' à faire'));
      }
    });
    // Événements à heure fixe (arène…) : pas de rappel pour les comptes faits ou en raid auto.
    data.events.forEach(function (ev) {
      if (ev.kind === 'spark' || !(ev.remindBefore >= 0)) return;
      for (var d = 0; d < 8; d++) {
        var key = localKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + d));
        if (!evOnDay(ev, key)) continue;
        evTimes(ev).forEach(function (time) {
          var occ = occAt(key, time), at = new Date(occ.getTime() - ev.remindBefore * 60000);
          if (at <= now) return;
          var accs = evAccounts(ev), per = evPer(key, time);
          var todo = accs.filter(function (a) { return !data.progress[pkey(per, ev, a)] && !isAuto(ev, a, per); }).length;
          if (!accs.length || !todo) return;
          push(at, ev.remindBefore ? ev.name + ' dans ' + ev.remindBefore + ' min' : ev.name + ' : c’est maintenant',
            'À ' + time + ' · ' + plural(todo, 'compte', 'comptes') + ' à faire');
        });
      }
    });
    // Étincelles : une notification quand elle redevient disponible (comptes regroupés à la minute).
    data.events.forEach(function (ev) {
      if (ev.kind !== 'spark' || !ev.remind) return;
      var groups = {};
      evAccounts(ev).forEach(function (a) {
        var n = sparkState(ev, a).next || 0;
        if (n > now.getTime()) { var k = Math.floor(n / 60000); (groups[k] = groups[k] || []).push(a.name); }
      });
      Object.keys(groups).forEach(function (k) {
        push(new Date((+k + 1) * 60000), ev.name + ' disponible', groups[k].join(', ') + ' : à faire');
      });
    });
    list.sort(function (a, b) { return a.schedule.at - b.schedule.at; });
    return list.slice(0, 100);
  }
  function ensureNotifPermission(quiet) {
    var LN = plugin('LocalNotifications');
    if (!LN) return;
    LN.checkPermissions().then(function (p) {
      if (p.display === 'granted') return p;
      return LN.requestPermissions();
    }).then(function (p) {
      if (p.display !== 'granted') { toast('Notifications refusées dans les réglages Android'); return; }
      queueReminders();
      if (LN.checkExactNotificationSetting) {
        LN.checkExactNotificationSetting().then(function (r) {
          ui.exact = r.exact_alarm;
          if (r.exact_alarm !== 'granted' && !quiet) toast('Autorise « Alarmes et rappels » dans Réglages pour des rappels pile à l’heure');
          if (r.exact_alarm !== 'granted' && quiet) setTimeout(function () { toast('Astuce : Réglages > Rappels à la minute près'); }, 2800);
        }, function () {});
      }
    }).catch(function () {});
  }
  function toggleRemind() {
    var LN = plugin('LocalNotifications');
    if (data.settings.remind) { data.settings.remind = false; save(); render(); return; }
    if (!LN) { data.settings.remind = true; save(); render(); toast('Les rappels marchent dans l’appli Android'); return; }
    LN.requestPermissions().then(function (p) {
      if (p.display === 'granted') { data.settings.remind = true; save(); toast('Rappel activé'); ensureNotifPermission(true); }
      else toast('Notifications refusées dans les réglages Android');
      render();
    }).catch(function () { toast('Notifications indisponibles'); });
  }

  /* ---------- événements ---------- */
  var actions = {
    go: function (el) { go(el.dataset.to); },
    welcome: function (el) { data.welcomed = true; save(); go(el.dataset.to); },
    tab: function (el) { ui.tab = el.dataset.tab; ui.counter = null; render(); },
    chRes: function (el) { ui.chart.res = el.dataset.v; ui.chartPick = null; render(); },
    chScope: function (el) { ui.chart.scope = el.dataset.v; ui.chartPick = null; render(); },
    chDays: function (el) { ui.chart.days = +el.dataset.v; ui.chartPick = null; render(); },
    sec: function (el) { ui.collapsed[el.dataset.v] = !ui.collapsed[el.dataset.v]; render(); },
    evDot: function (el) { evToggle(el.dataset.ev, el.dataset.key, el.dataset.time, el.dataset.acc); },
    evAll: function (el) { evAll(el.dataset.ev, el.dataset.key, el.dataset.time); },
    raid: function (el) { toggleRaid(el.dataset.ev, el.dataset.key, el.dataset.time, el.dataset.acc); },
    evShift: function (el) { shiftEvent(el.dataset.v, +el.dataset.d); },
    evEvery: function (el) { ui.evForm.every = Math.min(30, Math.max(1, ui.evForm.every + (+el.dataset.v))); render(); },
    evKind: function (el) { ui.evForm.kind = el.dataset.v; if (!ui.evForm.name) ui.evForm.name = el.dataset.v === 'spark' ? 'Étincelle' : 'Arène'; render(); },
    evSparkRemind: function () { ui.evForm.remind = !ui.evForm.remind; render(); },
    sparkClear: function (el) { ui.evForm.spark[el.dataset.a] = { next: 0, prev: null, doneAt: null }; render(); },
    spark: function (el) { toggleSpark(el.dataset.ev, el.dataset.acc); },
    sparkAll: function (el) { sparkAll(el.dataset.ev); },
    evDur: function (el) { ui.evForm.duration = +el.dataset.v; render(); },
    evRemind: function (el) { ui.evForm.remindBefore = +el.dataset.v; render(); },
    evTimeAdd: function () { ui.evForm.times.push('20:00'); render(); },
    evTimeDel: function (el) { ui.evForm.times.splice(+el.dataset.i, 1); render(); },
    evAcc: function (el) {
      var f = ui.evForm, id = el.dataset.v;
      if (f.allAccounts) { f.allAccounts = false; f.accounts = data.accounts.map(function (a) { return a.id; }); }
      var i = f.accounts.indexOf(id); if (i >= 0) f.accounts.splice(i, 1); else f.accounts.push(id);
      render();
    },
    evAccAll: function () { var f = ui.evForm; f.allAccounts = !f.allAccounts; f.accounts = data.accounts.map(function (a) { return a.id; }); render(); },
    evSave: saveEvent,
    evDelAsk: function () { ui.confirmEv = true; render(); },
    evDelCancel: function () { ui.confirmEv = false; render(); },
    evDel: deleteEvent,
    dot: function (el) { cycleDot(el.dataset.task, el.dataset.acc); },
    all: function (el) { toggleAll(el.dataset.task); },
    freq: function (el) { ui.form.type = el.dataset.v; render(); },
    day: function (el) {
      var f = ui.form, d = +el.dataset.v;
      if (f.type === 'weekly') f.resetDay = d;
      else { var i = f.days.indexOf(d); if (i >= 0) f.days.splice(i, 1); else f.days.push(d); }
      render();
    },
    every: function (el) { ui.form.every = Math.min(30, Math.max(2, ui.form.every + (+el.dataset.v))); render(); },
    once: function (el) {
      var f = ui.form, was = !!f.once;
      f.once = el.dataset.v === '1';
      // Garde l'avancement déjà fait aujourd'hui quand on change de mode sur une tâche existante.
      if (f.id && was !== f.once) ui.migrateOnce = true;
      render();
    },
    reps: function (el) { ui.form.reps = Math.min(100000, Math.max(1, (ui.form.reps || 1) + (+el.dataset.v))); render(); },
    remindBefore: function (el) { ui.form.remindBefore = +el.dataset.v; render(); },
    timeClear: function () { ui.form.time = ''; ui.form.remindBefore = -1; render(); },
    cnt: function (el) { setCounter(counterValue() + (+el.dataset.v)); },
    cntMax: function () { var t = findTask(ui.counter.t); setCounter(t ? reps(t) : 0); ui.counter = null; render(); },
    cntClose: function () { ui.counter = null; render(); },
    exactOpen: function () { var LN = plugin('LocalNotifications'); if (LN && LN.changeExactNotificationSetting) LN.changeExactNotificationSetting().catch(function () {}); },
    accForm: function (el) {
      var f = ui.form, id = el.dataset.v;
      if (f.allAccounts) { f.allAccounts = false; f.accounts = data.accounts.map(function (a) { return a.id; }); }
      var i = f.accounts.indexOf(id);
      if (i >= 0) f.accounts.splice(i, 1); else f.accounts.push(id);
      render();
    },
    accAllForm: function () {
      var f = ui.form;
      f.allAccounts = !f.allAccounts;
      f.accounts = data.accounts.map(function (a) { return a.id; });
      render();
    },
    taskSave: saveTask,
    taskDelAsk: function () { ui.confirmTask = true; render(); },
    taskDelCancel: function () { ui.confirmTask = false; render(); },
    taskDel: deleteTask,
    accAdd: addAccount,
    draftColor: function (el) { ui.draft.color = el.dataset.c; render(); },
    accEdit: function (el) { ui.editAcc = el.dataset.v; ui.confirmAcc = null; render(); },
    accDone: function () { ui.editAcc = null; render(); },
    accColor: function (el) { var a = findAcc(el.dataset.v); if (a) { a.color = el.dataset.c; save(); render(); } },
    accMove: function (el) { moveAccount(el.dataset.v, +el.dataset.d); },
    accDelAsk: function (el) { ui.confirmAcc = el.dataset.v; render(); },
    accDelCancel: function () { ui.confirmAcc = null; render(); },
    accDel: function (el) { deleteAccount(el.dataset.v); },
    resAdd: addResource,
    resDelAsk: function (el) { ui.confirmRes = el.dataset.v; render(); },
    resDelCancel: function () { ui.confirmRes = null; render(); },
    resDel: function (el) { deleteResource(el.dataset.v); },
    remind: toggleRemind,
    shareTasks: shareTasks,
    backup: backup,
    paste: function () {
      if (!navigator.clipboard || !navigator.clipboard.readText) { toast('Appui long dans la zone puis Coller'); return; }
      navigator.clipboard.readText().then(function (t) { ui.importText = t; render(); }, function () { toast('Appui long dans la zone puis Coller'); });
    },
    importRead: readImport,
    importCancel: function () { ui.importPending = null; render(); },
    importConfirm: confirmImport,
    wipeAsk: function () { ui.confirmWipe = true; render(); },
    wipeCancel: function () { ui.confirmWipe = false; render(); },
    wipe: function () {
      data = defaultData(); data.lastDay = gameDay(); ui.confirmWipe = false;
      save(); toast('Tout a été effacé'); go('');
    }
  };
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    var fn = actions[el.dataset.act];
    if (fn) fn(el, e);
  });
  // Les champs texte mettent à jour l'état sans redessiner l'écran (pour garder le clavier ouvert).
  app.addEventListener('input', function (e) {
    var el = e.target, f = el.dataset.field;
    if (!f) return;
    if (ui.form && (f === 'name' || f === 'note' || f === 'from' || f === 'to')) { ui.form[f] = el.value; refreshSaveBtn(); }
    else if (f === 'draft') { ui.draft.name = el.value; var b = document.getElementById('acc-add'); if (b) b.disabled = !el.value.trim(); }
    else if (f === 'accName') { var a = findAcc(el.dataset.v); if (a && el.value.trim()) { a.name = el.value.trim(); save(); } }
    else if (f === 'importText') { ui.importText = el.value; }
    else if (ui.evForm && f === 'evName') { ui.evForm.name = el.value; refreshEvSave(); }
    else if (ui.evForm && f === 'evNote') { ui.evForm.note = el.value; }
    else if (f === 'reps' && ui.form) { var rv = parseInt(el.value.replace(/\D/g, ''), 10); ui.form.reps = Math.max(1, Math.min(100000, rv || 1)); }
    else if (f === 'resDraft') { ui.resDraft = el.value; var rb = document.getElementById('res-add'); if (rb) rb.disabled = !el.value.trim(); }
    else if (f === 'resName') { var rr = data.resources.filter(function (x) { return x.id === el.dataset.v; })[0]; if (rr && el.value.trim()) { rr.name = el.value.trim(); save(); } }
  });
  app.addEventListener('change', function (e) {
    var el = e.target, f = el.dataset.field;
    if (f === 'remindTime' && el.value) { data.settings.remindTime = el.value; save(); }
    if (f === 'accName' || f === 'resName') render();
    if (f === 'res') applyResInput(el);
    if (ui.evForm && f === 'evTime') { ui.evForm.times[+el.dataset.i] = el.value; render(); }
    if (ui.evForm && f === 'evAnchor') { ui.evForm.anchor = el.value; refreshEvSave(); }
    if (ui.evForm && f === 'sparkNext') { ui.evForm.spark[el.dataset.a] = { next: el.value ? new Date(el.value).getTime() || 0 : 0, prev: null, doneAt: null }; render(); }
    if (f === 'time' && ui.form) { ui.form.time = el.value; if (el.value && ui.form.remindBefore < 0 && !ui.form.id) ui.form.remindBefore = 15; render(); }
    if (f === 'cnt' && ui.counter) {
      var raw = el.value.replace(/\s/g, ''), m = raw.match(/^([+-]?)(\d+)$/);
      if (!m) { render(); return; }
      var cur = counterValue(), n = +m[2];
      setCounter(m[1] === '+' ? cur + n : m[1] === '-' ? cur - n : n);
    }
  });
  app.addEventListener('keydown', function (e) {
    var fld = e.target.dataset && e.target.dataset.field;
    if (e.key !== 'Enter') return;
    if (fld === 'draft') { e.preventDefault(); addAccount(); }
    else if (fld === 'resDraft') { e.preventDefault(); addResource(); }
    else if (fld === 'res' || fld === 'cnt' || fld === 'reps') { e.preventDefault(); e.target.blur(); }
  });
  // Appui ou glissé sur le graphique : affiche la valeur du jour touché ; relâcher remet la dernière valeur.
  var chartDrag = false;
  app.addEventListener('pointerdown', function (e) {
    var c = e.target.closest && e.target.closest('.chart');
    if (!c) return;
    chartDrag = true; chartPickAt(c, e.clientX);
  });
  app.addEventListener('pointermove', function (e) {
    if (!chartDrag) return;
    var c = app.querySelector('.chart');
    if (c) chartPickAt(c, e.clientX);
  });
  window.addEventListener('pointerup', function () { if (chartDrag) { chartDrag = false; setTimeout(function () { if (!chartDrag) { ui.chartPick = null; render(); } }, 1500); } });
  // Ne réagit qu'à un geste commencé sur le graphique : sinon le défilement de l'écran serait interrompu.
  window.addEventListener('pointercancel', function () { if (!chartDrag) return; chartDrag = false; ui.chartPick = null; render(); });
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    checkDay();
    var LN = plugin('LocalNotifications');
    if (LN && LN.checkExactNotificationSetting) {
      LN.checkExactNotificationSetting().then(function (r) { var ch = ui.exact !== r.exact_alarm; ui.exact = r.exact_alarm; if (ch) queueReminders(); render(); }, function () { render(); });
    } else render();
  });
  setInterval(function () { if (checkDay()) render(); }, 30000);

  render();
  queueReminders();
})();
