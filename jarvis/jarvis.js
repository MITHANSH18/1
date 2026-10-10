/* J.A.R.V.I.S. - browser-based voice/text assistant. No dependencies. */
(function (root) {
  'use strict';

  var STORE = {
    get: function (k, d) {
      try { var v = root.localStorage && root.localStorage.getItem('jarvis.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
    },
    set: function (k, v) { try { root.localStorage && root.localStorage.setItem('jarvis.' + k, JSON.stringify(v)); } catch (e) {} }
  };

  var JOKES = [
    'Why do programmers prefer dark mode? Because light attracts bugs.',
    'There are 10 kinds of people: those who understand binary and those who do not.',
    'I would tell you a UDP joke, but you might not get it.',
    'A SQL query walks into a bar, sees two tables and asks: may I join you?'
  ];
  var SITES = {
    google: 'https://www.google.com', youtube: 'https://www.youtube.com', github: 'https://github.com',
    wikipedia: 'https://www.wikipedia.org', gmail: 'https://mail.google.com', maps: 'https://maps.google.com',
    twitter: 'https://twitter.com', reddit: 'https://www.reddit.com', stackoverflow: 'https://stackoverflow.com'
  };
  var WMO = { 0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast', 45: 'fog', 48: 'fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle', 61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow', 80: 'rain showers', 95: 'thunderstorm' };

  var HELP = 'I can help with:\n' +
    '• time / date\n• math: "12 * (3+4)", "calculate 2^10", "sqrt of 144"\n' +
    '• timers: "set timer 10 seconds", "timer 5 minutes"\n' +
    '• notes: "note buy milk", "show notes", "clear notes"\n' +
    '• todos: "add todo call mom", "show todos", "done 1", "clear todos"\n' +
    '• weather: "weather in London"\n• search: "search cats", "wikipedia Alan Turing"\n' +
    '• open sites: "open youtube"\n• "tell me a joke", "flip a coin", "roll a dice"\n' +
    '• "dark mode" / "light mode", "my name is X", "who are you"';

  /* ---------- safe math evaluator (no eval) ---------- */
  function calc(expr) {
    var s = expr.toLowerCase()
      .replace(/(\d)\s*x\s*(\d)/g, '$1*$2')
      .replace(/\bplus\b/g, '+').replace(/\bminus\b/g, '-')
      .replace(/\b(times|multiplied by)\b/g, '*').replace(/\bdivided by\b/g, '/')
      .replace(/\bto the power of\b/g, '^').replace(/\bmod\b/g, '%')
      .replace(/sqrt of\s*([\d.]+)/g, 'sqrt($1)').replace(/\bsquare root of\s*([\d.]+)/g, 'sqrt($1)')
      .replace(/[?=]/g, '').replace(/\bwhat is\b|\bcalculate\b|\bcompute\b/g, '');
    var tokens = [], re = /\s*(\d+\.?\d*|\.\d+|sqrt|pi|[-+*\/^%()])/y, m, pos = 0;
    s = s.trim();
    while (pos < s.length) {
      re.lastIndex = pos;
      m = re.exec(s);
      if (!m) throw new Error('bad expression');
      tokens.push(m[1]); pos = re.lastIndex;
      while (s[pos] === ' ') pos++;
    }
    var i = 0;
    function peek() { return tokens[i]; }
    function expect(t) { if (tokens[i++] !== t) throw new Error('bad expression'); }
    function primary() {
      var t = tokens[i++];
      if (t === undefined) throw new Error('bad expression');
      if (t === '(') { var v = add(); expect(')'); return v; }
      if (t === '-') return -power();
      if (t === '+') return power();
      if (t === 'pi') return Math.PI;
      if (t === 'sqrt') { expect('('); var a = add(); expect(')'); return Math.sqrt(a); }
      if (/^[\d.]/.test(t)) return parseFloat(t);
      throw new Error('bad expression');
    }
    function power() { var b = primary(); if (peek() === '^') { i++; return Math.pow(b, power()); } return b; }
    function mul() {
      var v = power();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        var o = tokens[i++], r = power();
        v = o === '*' ? v * r : o === '/' ? v / r : v % r;
      }
      return v;
    }
    function add() {
      var v = mul();
      while (peek() === '+' || peek() === '-') { var o = tokens[i++], r = mul(); v = o === '+' ? v + r : v - r; }
      return v;
    }
    var result = add();
    if (i < tokens.length) throw new Error('bad expression');
    if (!isFinite(result)) throw new Error('not a finite number');
    return Math.round(result * 1e10) / 1e10;
  }

  function parseDuration(text) {
    var total = 0, found = false, re = /(\d+\.?\d*)\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b/g, m;
    while ((m = re.exec(text))) {
      found = true;
      var n = parseFloat(m[1]), u = m[2][0];
      total += u === 'h' ? n * 3600 : u === 'm' ? n * 60 : n;
    }
    return found ? Math.round(total) : 0;
  }

  function fmtDuration(sec) {
    var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60, p = [];
    if (h) p.push(h + ' hour' + (h > 1 ? 's' : ''));
    if (m) p.push(m + ' minute' + (m > 1 ? 's' : ''));
    if (s) p.push(s + ' second' + (s > 1 ? 's' : ''));
    return p.join(' ');
  }

  /* ---------- assistant core: returns a promise of {text, action?} ---------- */
  function Jarvis(opts) {
    opts = opts || {};
    this.notify = opts.notify || function () {};
    this.open = opts.open || function (url) { root.open && root.open(url, '_blank', 'noopener'); };
    this.setTheme = opts.setTheme || function () {};
    this.fetch = opts.fetch || (root.fetch && root.fetch.bind(root));
    this.notes = STORE.get('notes', []);
    this.todos = STORE.get('todos', []);
    this.name = STORE.get('name', '');
    this.timers = [];
  }

  Jarvis.prototype.reply = function (text) { return Promise.resolve(text); };

  Jarvis.prototype.handle = function (raw) {
    var self = this, q = String(raw || '').trim();
    var l = q.toLowerCase().replace(/^(hey |ok |okay )?jarvis[,:]?\s*/, '').replace(/[.!]+$/, '').trim();
    var m, who = this.name ? ', ' + this.name : '';
    if (!l) return this.reply('I am listening.');

    if (/^(help|what can you do)/.test(l)) return this.reply(HELP);
    if (/^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(l)) return this.reply('Hello' + who + '. How may I assist you?');
    if (/who are you|your name/.test(l)) return this.reply('I am J.A.R.V.I.S., your just-a-rather-very-intelligent browser assistant.');
    if ((m = l.match(/^(?:my name is|call me)\s+(.+)/))) {
      this.name = m[1].replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      STORE.set('name', this.name);
      return this.reply('Pleased to meet you, ' + this.name + '.');
    }
    if (/how are you/.test(l)) return this.reply('All systems nominal' + who + '.');
    if (/\bthank/.test(l)) return this.reply('At your service' + who + '.');

    if (/\btime\b/.test(l) && !/timer/.test(l)) return this.reply('It is ' + new Date().toLocaleTimeString() + '.');
    if (/\b(date|day is it|today)\b/.test(l)) return this.reply('Today is ' + new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.');

    if ((m = l.match(/^(?:set (?:a )?)?timer(?: for)?\s+(.+)/)) || (m = l.match(/^(?:set (?:a )?)?(.+?)\s+timer$/))) {
      var secs = parseDuration(m[1]);
      if (!secs) return this.reply('Please give a duration, e.g. "timer 5 minutes".');
      var t = setTimeout(function () { self.notify('Timer finished: ' + fmtDuration(secs) + '.'); }, secs * 1000);
      this.timers.push(t);
      return this.reply('Timer set for ' + fmtDuration(secs) + '.');
    }
    if (/^(cancel|stop) (all )?timers?/.test(l)) {
      this.timers.forEach(clearTimeout); this.timers = [];
      return this.reply('All timers cancelled.');
    }

    if ((m = l.match(/^(?:add )?(?:a )?(?:todo|task|to-do)[:\s]+(.+)/)) && !/^(show|list)/.test(l)) {
      this.todos.push({ text: q.slice(q.length - m[1].length), done: false }); STORE.set('todos', this.todos);
      return this.reply('Added to your to-do list.');
    }
    if (/^(show|list|what are)( my)? (todos|tasks|to-dos)/.test(l)) {
      return this.reply(this.todos.length ? this.todos.map(function (t, i) { return (i + 1) + '. [' + (t.done ? 'x' : ' ') + '] ' + t.text; }).join('\n') : 'Your to-do list is empty.');
    }
    if ((m = l.match(/^(?:done|complete|finish)(?: todo| task)?\s+(\d+)/))) {
      var t2 = this.todos[parseInt(m[1], 10) - 1];
      if (!t2) return this.reply('No such task.');
      t2.done = true; STORE.set('todos', this.todos);
      return this.reply('Marked "' + t2.text + '" as done.');
    }
    if (/^clear (my )?(todos|tasks|to-dos)/.test(l)) { this.todos = []; STORE.set('todos', []); return this.reply('To-do list cleared.'); }

    if ((m = l.match(/^(?:take a )?(?:note|remember)(?: that)?[:\s]+(.+)/))) {
      this.notes.push(q.slice(q.length - m[1].length)); STORE.set('notes', this.notes);
      return this.reply('Noted.');
    }
    if (/^(show|list|read)( my)? notes/.test(l)) {
      return this.reply(this.notes.length ? this.notes.map(function (n, i) { return (i + 1) + '. ' + n; }).join('\n') : 'You have no notes.');
    }
    if (/^clear (my )?notes/.test(l)) { this.notes = []; STORE.set('notes', []); return this.reply('Notes cleared.'); }

    if ((m = l.match(/weather(?: (?:in|for|at))?\s*(.*)/))) return this.weather(m[1].trim());

    if ((m = l.match(/^(?:open|launch|go to)\s+(.+)/))) {
      var site = m[1].replace(/^www\./, '').replace(/\.com$/, '');
      if (SITES[site]) { this.open(SITES[site]); return this.reply('Opening ' + site + '.'); }
      if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(m[1])) { this.open('https://' + m[1]); return this.reply('Opening ' + m[1] + '.'); }
      return this.reply('I do not know how to open "' + m[1] + '".');
    }
    if ((m = l.match(/^(?:wikipedia|wiki)\s+(.+)/))) {
      this.open('https://en.wikipedia.org/wiki/Special:Search?search=' + encodeURIComponent(m[1]));
      return this.reply('Searching Wikipedia for ' + m[1] + '.');
    }
    if ((m = l.match(/^(?:search|google|look up|find)(?: for)?\s+(.+)/))) {
      this.open('https://www.google.com/search?q=' + encodeURIComponent(m[1]));
      return this.reply('Searching the web for ' + m[1] + '.');
    }
    if ((m = l.match(/^play\s+(.+)/))) {
      this.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(m[1]));
      return this.reply('Looking for ' + m[1] + ' on YouTube.');
    }

    if (/joke/.test(l)) return this.reply(JOKES[Math.floor(Math.random() * JOKES.length)]);
    if (/flip a coin|coin flip|toss a coin/.test(l)) return this.reply(Math.random() < 0.5 ? 'Heads.' : 'Tails.');
    if (/roll (a )?(dice|die)/.test(l)) return this.reply('You rolled a ' + (1 + Math.floor(Math.random() * 6)) + '.');
    if (/dark mode|dark theme/.test(l)) { this.setTheme('dark'); return this.reply('Dark mode enabled.'); }
    if (/light mode|light theme/.test(l)) { this.setTheme('light'); return this.reply('Light mode enabled.'); }

    if (/[\d(]|\bpi\b/.test(l) && /^[\d\s+\-*\/^%().x=?a-z]+$/.test(l)) {
      try { return this.reply('The answer is ' + calc(l) + '.'); } catch (e) { /* fall through */ }
    }
    return this.reply('I did not understand "' + q + '". Say "help" to see what I can do.');
  };

  Jarvis.prototype.weather = function (place) {
    var f = this.fetch;
    if (!f) return this.reply('Weather requires network access.');
    var getCity = place ? Promise.resolve(place) : Promise.reject(new Error('no place'));
    return getCity.then(function (city) {
      return f('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(city))
        .then(function (r) { return r.json(); })
        .then(function (g) {
          if (!g.results || !g.results.length) throw new Error('Unknown place "' + city + '".');
          var p = g.results[0];
          return f('https://api.open-meteo.com/v1/forecast?current=temperature_2m,weather_code,wind_speed_10m&latitude=' + p.latitude + '&longitude=' + p.longitude)
            .then(function (r) { return r.json(); })
            .then(function (w) {
              var c = w.current;
              return 'In ' + p.name + ' it is ' + c.temperature_2m + '°C with ' + (WMO[c.weather_code] || 'mixed conditions') + ' and wind at ' + c.wind_speed_10m + ' km/h.';
            });
        });
    }).catch(function (e) {
      return e.message === 'no place' ? 'Which city? Try "weather in London".' : 'Sorry, I could not fetch the weather. ' + (/^Unknown/.test(e.message) ? e.message : '');
    });
  };

  /* ---------- UI ---------- */
  function initUI() {
    var $ = function (id) { return document.getElementById(id); };
    var log = $('log'), input = $('input'), status = $('status'), orb = $('orb'), mic = $('mic');

    function add(cls, text) {
      var d = document.createElement('div');
      d.className = 'msg ' + cls; d.textContent = text;
      log.appendChild(d); log.scrollTop = log.scrollHeight;
    }
    function say(text) {
      add('bot', text);
      if ($('speak').checked && 'speechSynthesis' in window) {
        speechSynthesis.cancel();
        speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/\n.*/s, '')));
      }
    }

    var jarvis = new Jarvis({
      notify: say,
      setTheme: function (t) { document.body.classList.toggle('light', t === 'light'); STORE.set('theme', t); }
    });
    if (STORE.get('theme') === 'light') document.body.classList.add('light');

    function run(text) {
      if (!text.trim()) return;
      add('user', text);
      orb.classList.add('busy'); status.textContent = 'Processing…';
      jarvis.handle(text).then(say).catch(function () { say('Something went wrong.'); }).then(function () {
        orb.classList.remove('busy'); status.textContent = 'Standing by';
      });
    }

    $('form').addEventListener('submit', function (e) { e.preventDefault(); var t = input.value; input.value = ''; run(t); });

    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      var rec = new SR(), listening = false;
      rec.lang = 'en-US'; rec.interimResults = false;
      rec.onresult = function (e) { run(e.results[0][0].transcript); };
      rec.onend = rec.onerror = function () { listening = false; mic.classList.remove('on'); };
      mic.addEventListener('click', function () {
        if (listening) { rec.stop(); return; }
        listening = true; mic.classList.add('on'); status.textContent = 'Listening…'; rec.start();
      });
    } else {
      mic.disabled = true; mic.title = 'Voice input is not supported in this browser';
    }

    say('Good day' + (jarvis.name ? ', ' + jarvis.name : '') + '. Say "help" to see what I can do.');
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { Jarvis: Jarvis, calc: calc, parseDuration: parseDuration };
  else if (typeof document !== 'undefined') initUI();
})(typeof window !== 'undefined' ? window : globalThis);
