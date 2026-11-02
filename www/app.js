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
      resources: DEFAULT_RESOURCES.map(function (r) { return Object.assign({}, r); }), resLog: {},
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
        return 'd' + key;
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
      case 'event': return 'Jusqu’au ' + fmtDay(t.to, { day: 'numeric', month: 'short' });
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
      if (!(tid in current)) { delete data.progress[k]; return; }
      if (per.charAt(0) === 'e') { if (per !== current[tid]) delete data.progress[k]; return; }
      if (per.slice(1) < limit) delete data.progress[k];
    });
  }

  /* ---------- état de l'interface ---------- */
  var ui = { tab: 'jour', form: null, editAcc: null, confirmAcc: null, confirmTask: false,
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
      if (r !== 'reglages') { ui.editAcc = null; ui.confirmAcc = null; ui.confirmWipe = false; }
      if (r !== 'importer') { ui.importPending = null; }
      if (r !== 'reglages') { ui.confirmRes = null; }
    }
    var html;
    if (r === 'reglages') html = viewSettings();
    else if (r === 'historique') html = viewHistory();
    else if (r === 'ressources') html = viewResources();
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
    return '<nav class="nav">' + b('', ICON.tasks, 'Tâches') + b('ressources', ICON.gem, 'Ressources') + b('historique', ICON.hist, 'Historique') + b('reglages', ICON.gear, 'Réglages') + '</nav>';
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
    var tabs = [['jour', 'Quotidien'], ['hebdo', 'Hebdo'], ['event', 'Événements']];
    var cur = statsFor(today, ui.tab);
    var pct = cur.total ? Math.round(cur.done / cur.total * 100) : 0;
    var h = '<div class="screen">';
    h += '<div class="head"><div style="display:flex;flex-direction:column;gap:2px;min-width:0">' +
      '<span class="kicker">Tâches · ' + esc(fmtDay(today, { weekday: 'short', day: 'numeric', month: 'short' })) + '</span>' +
      '<h1>Aujourd’hui</h1>' +
      '<span class="sub">' + (cur.total ? plural(cur.total - cur.done, 'case', 'cases') + ' à cocher · ' : '') + 'reset ' + resetClock() + '</span></div>' +
      '<div class="score"><b>' + cur.done + '<small>/' + cur.total + '</small></b><div class="bar"><i style="width:' + pct + '%"></i></div></div></div>';

    h += '<div class="tabs" role="tablist">' + tabs.map(function (tb) {
      var s = statsFor(today, tb[0]);
      var left = s.total - s.done;
      return '<button role="tab" aria-selected="' + (ui.tab === tb[0]) + '" class="tab' + (ui.tab === tb[0] ? ' on' : '') + '" data-act="tab" data-tab="' + tb[0] + '">' +
        tb[1] + (s.total ? '<span class="badge">' + (left ? left : '✓') + '</span>' : '') + '</button>';
    }).join('') + '</div>';

    h += '<div class="scroll has-fab">';
    var list = data.tasks.filter(function (t) { return tabOf(t) === ui.tab && periodOf(t, today); });
    if (!data.accounts.length) {
      h += '<div class="empty">Aucun compte pour l’instant.<button class="btn primary sm" style="width:auto;padding:0 16px" data-act="go" data-to="reglages">Ajouter un compte</button></div>';
    } else if (!data.tasks.length) {
      h += '<div class="empty">Aucune tâche. Appuie sur + pour créer la première,<br>ou importe la liste d’un ami dans Réglages.</div>';
    } else if (!list.length) {
      h += '<div class="empty">' + (ui.tab === 'event' ? 'Aucun événement en cours.' : 'Rien dans cet onglet aujourd’hui.') + '</div>';
    }
    list.forEach(function (t) {
      var per = periodOf(t, today);
      var accs = taskAccounts(t);
      var r = reps(t), n = 0;
      var dots = accs.map(function (a) {
        var c = Math.min(getCount(per, t, a), r);
        var full = c >= r;
        if (full) n++;
        var style = full ? 'background:' + a.color : (c > 0 ? 'border-color:' + a.color + ';color:' + a.color : '');
        return '<button class="dot' + (full ? ' full' : '') + '" style="' + style + '" data-act="dot" data-task="' + t.id + '" data-acc="' + a.id + '" aria-label="' +
          esc(t.name + ' — ' + a.name + (r > 1 ? ' : ' + c + ' sur ' + r : full ? ' : fait' : ' : à faire')) + '">' +
          esc(initials(a.name)) + (r > 1 ? '<small>' + c + '/' + r + '</small>' : '') + '</button>';
      }).join('');
      var all = accs.length > 0 && n === accs.length;
      var sub = [t.note, freqLabel(t, today)].filter(Boolean).join(' · ');
      h += '<div class="card' + (all ? ' done' : '') + '"><div class="task-top">' +
        '<div class="task-name"><b>' + esc(t.name) + '</b>' + (sub ? '<span>' + esc(sub) + '</span>' : '') + '</div>' +
        (all ? '<span class="pill-done">TERMINÉ</span>' : '<span class="count">' + n + '<small>/' + accs.length + '</small></span>') +
        (accs.length ? '<button class="btn-small" data-act="all" data-task="' + t.id + '">' + (all ? 'Annuler' : 'Tout') + '</button>' : '') +
        '<button class="icon-btn ghost" data-act="go" data-to="tache-' + t.id + '" aria-label="Modifier ' + esc(t.name) + '">' + ICON.edit + '</button>' +
        '</div>' + (accs.length ? '<div class="dots">' + dots + '</div>' : '<span class="hint">Aucun compte sélectionné pour cette tâche.</span>') + '</div>';
    });
    h += '</div>';
    if (data.accounts.length) h += '<button class="fab" data-act="go" data-to="tache-new" aria-label="Nouvelle tâche">' + ICON.plus + '</button>';
    h += nav('') + '</div>';
    return h;
  }

  function cycleDot(tid, aid) {
    var t = findTask(tid), a = findAcc(aid);
    if (!t || !a) return;
    var per = periodOf(t, gameDay());
    if (!per) return;
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
      every: 2, start: today, from: today, to: keyFromNum(dayNum(today) + 6), reps: 1,
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

    var freqs = [['daily', 'Chaque jour'], ['weekly', 'Chaque semaine'], ['days', 'Certains jours'], ['every', 'Tous les X jours'], ['event', 'Événement daté']];
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
        '<div class="field"><label class="hint" for="f-to">Au</label><input type="date" id="f-to" class="input" data-field="to" value="' + esc(f.to) + '"></div></div>';
    }
    var summary = {
      daily: 'Remise à zéro chaque jour avec le jeu (' + resetClock() + ').',
      weekly: 'À faire une fois par semaine. Remise à zéro le ' + DAYS[f.resetDay][1] + '.',
      days: f.days.length ? 'Apparaît le ' + f.days.slice().sort().map(function (d) { return DAYS[d][1]; }).join(', ') + '.' : 'Choisis au moins un jour.',
      every: 'À faire une fois tous les ' + f.every + ' jours' + (editing ? '.' : ', à partir d’aujourd’hui.'),
      event: 'À faire chaque jour pendant l’événement, puis la tâche disparaît.'
    }[f.type];
    h += '<span class="hint">' + summary + '</span></div>';

    h += '<div class="field" style="gap:10px"><span class="label">Combien de fois par compte</span><div class="stepper"><span><strong>' + f.reps + '</strong> ' +
      (f.reps > 1 ? 'fois — la case affichera 0/' + f.reps : 'fois — une simple case à cocher') + '</span>' +
      '<button data-act="reps" data-v="-1" aria-label="Moins">−</button><button data-act="reps" data-v="1" aria-label="Plus">+</button></div></div>';

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
      days: f.days.slice(), resetDay: f.resetDay, every: f.every, start: f.start, from: f.from, to: f.to,
      reps: f.reps, allAccounts: f.allAccounts, accounts: f.allAccounts ? [] : f.accounts.slice()
    };
    var i = data.tasks.findIndex(function (x) { return x.id === t.id; });
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
    data.tasks.forEach(function (t) { if (t.accounts) t.accounts = t.accounts.filter(function (x) { return x !== id; }); });
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
      return { name: t.name, note: t.note, type: t.type, days: t.days, resetDay: t.resetDay, every: t.every, from: t.from, to: t.to, reps: t.reps };
    });
    shareText('Ma liste de tâches Multicompte',
      'Ma liste de tâches Multicompte. Dans l’appli : Réglages > Importer, puis colle tout ce message.\n\n' + encode({ kind: 'tasks', v: 1, tasks: tasks }));
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
        h += '<div class="box"><b>' + plural(p.tasks.length, 'tâche trouvée', 'tâches trouvées') + '</b><span class="hint">' +
          esc(p.tasks.slice(0, 8).map(function (t) { return t.name; }).join(', ')) + (p.tasks.length > 8 ? '…' : '') +
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
    if (obj.kind === 'tasks' && (!Array.isArray(obj.tasks) || !obj.tasks.length)) { toast('Aucune tâche dans ce message'); return; }
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
          from: t.from || today, to: t.to || today, reps: Math.max(1, Math.min(20, t.reps || 1)), allAccounts: true, accounts: []
        });
      });
      toast(plural(p.tasks.length, 'tâche importée', 'tâches importées'));
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
    var ids = [];
    for (var i = 0; i < 8; i++) ids.push({ id: REMIND_BASE_ID + i });
    LN.cancel({ notifications: ids }).catch(function () {}).then(function () {
      if (!data.settings.remind) return;
      return LN.checkPermissions().then(function (p) {
        if (p.display !== 'granted') return;
        var hm = (data.settings.remindTime || '20:00').split(':');
        var now = new Date();
        var s = statsFor(gameDay());
        var left = s.total - s.done;
        var list = [];
        for (var d = 0; d < 8; d++) {
          var at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, +hm[0], +hm[1], 0);
          if (at <= now) continue;
          if (d === 0 && left === 0) continue;
          list.push({
            id: REMIND_BASE_ID + d, title: 'Multicompte',
            body: d === 0 ? 'Il te reste ' + plural(left, 'case', 'cases') + ' à cocher aujourd’hui.' : 'Pense à faire tes tâches du jour sur tous tes comptes.',
            schedule: { at: at, allowWhileIdle: true }
          });
        }
        if (list.length) return LN.schedule({ notifications: list });
      });
    }).catch(function () {});
  }
  function toggleRemind() {
    var LN = plugin('LocalNotifications');
    if (data.settings.remind) { data.settings.remind = false; save(); render(); return; }
    if (!LN) { data.settings.remind = true; save(); render(); toast('Les rappels marchent dans l’appli Android'); return; }
    LN.requestPermissions().then(function (p) {
      if (p.display === 'granted') { data.settings.remind = true; save(); toast('Rappel activé'); }
      else toast('Notifications refusées dans les réglages Android');
      render();
    }).catch(function () { toast('Notifications indisponibles'); });
  }

  /* ---------- événements ---------- */
  var actions = {
    go: function (el) { go(el.dataset.to); },
    welcome: function (el) { data.welcomed = true; save(); go(el.dataset.to); },
    tab: function (el) { ui.tab = el.dataset.tab; render(); },
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
    reps: function (el) { ui.form.reps = Math.min(20, Math.max(1, ui.form.reps + (+el.dataset.v))); render(); },
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
    else if (f === 'resDraft') { ui.resDraft = el.value; var rb = document.getElementById('res-add'); if (rb) rb.disabled = !el.value.trim(); }
    else if (f === 'resName') { var rr = data.resources.filter(function (x) { return x.id === el.dataset.v; })[0]; if (rr && el.value.trim()) { rr.name = el.value.trim(); save(); } }
  });
  app.addEventListener('change', function (e) {
    var el = e.target, f = el.dataset.field;
    if (f === 'remindTime' && el.value) { data.settings.remindTime = el.value; save(); }
    if (f === 'accName' || f === 'resName') render();
    if (f === 'res') applyResInput(el);
  });
  app.addEventListener('keydown', function (e) {
    var fld = e.target.dataset && e.target.dataset.field;
    if (e.key !== 'Enter') return;
    if (fld === 'draft') { e.preventDefault(); addAccount(); }
    else if (fld === 'resDraft') { e.preventDefault(); addResource(); }
    else if (fld === 'res') { e.preventDefault(); e.target.blur(); }
  });
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && checkDay()) render(); });
  setInterval(function () { if (checkDay()) render(); }, 30000);

  render();
  queueReminders();
})();
