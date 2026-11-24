/* =====================================================================
   A Hogwarts letter — main script
   ---------------------------------------------------------------------
   EDIT ME:  the CONFIG block just below.
   The letter text itself lives in index.html (look for "EDIT THE LETTER HERE").
   ===================================================================== */
(() => {
'use strict';

const CONFIG = {
  // Your name, as it should appear when you sign the letter.
  // Leave empty ('') and it will simply sign off as "Your Muggle".
  fromName: 'Bhavya',

  // Optional: your WhatsApp number (digits only, with country code, e.g. '919876543210').
  // If set, a "Send an owl back 🦉" button appears after she taps Reparo, which opens a
  // WhatsApp chat with you with the message below pre-filled. Leave empty to hide it.
  replyWhatsApp: '',
  replyText: 'I got your owl 🦉',
};

/* ---------------------------------------------------------------------
   helpers
   --------------------------------------------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = t => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const TAU = Math.PI * 2;
const haptic = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (_) {} };

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** value noise, returns fn(x,y) in 0..1 with .fbm(x,y,octaves) */
function makeNoise(seed) {
  const r = mulberry32(seed), g = new Float32Array(65536);
  for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[((y & 255) << 8) | (x & 255)];
  function n(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  n.fbm = (x, y, o = 4) => {
    let s = 0, a = .5, f = 1, t = 0;
    for (let i = 0; i < o; i++) { s += a * n(x * f, y * f); t += a; a *= .5; f *= 2.03; }
    return s / t;
  };
  return n;
}

/** run a Web-Animation, then bake its last keyframe into inline style and cancel it */
async function play(el, kf, opt = {}) {
  const a = el.animate(kf, Object.assign({ duration: 600, easing: 'ease', fill: 'both' }, opt));
  try { await a.finished; } catch (_) { return; }
  const last = kf[kf.length - 1];
  for (const k in last) {
    if (k === 'offset' || k === 'easing' || k === 'composite') continue;
    el.style[k] = last[k];
  }
  a.cancel();
}

/** handwriting-style left→right reveal */
function writeIn(el, ms, soft = 7) {
  return new Promise(res => {
    const set = p => {
      const m = `linear-gradient(90deg,#000 ${p}%,transparent ${p + soft}%)`;
      el.style.webkitMaskImage = m; el.style.maskImage = m;
    };
    set(-soft);
    el.style.visibility = 'visible';
    const t0 = performance.now();
    (function f(now) {
      const k = clamp((now - t0) / ms, 0, 1);
      set(easeIO(k) * (100 + soft * 1.5) - soft);
      if (k < 1) requestAnimationFrame(f);
      else { el.style.webkitMaskImage = el.style.maskImage = 'none'; res(); }
    })(t0);
  });
}

/* ---------------------------------------------------------------------
   DOM
   --------------------------------------------------------------------- */
const body = document.body, root = document.documentElement;
const gate = $('#gate'), beginBtn = $('#beginBtn');
const owl = $('#owl'), owlLetter = $('#owlLetter');
const envWrap = $('#envWrap'), env = $('#env'), envShadow = $('#envShadow');
const addrTo = $('#addrTo'), addrRule = $('#addrRule'), addrLines = $$('.addr .l'), postmark = $('#postmark');
const letterIn = $('#letterIn'), flapHinge = $('#flapHinge');
const seal = $('#seal'), sealL = $('.seal .half.l'), sealR = $('.seal .half.r'), stampTool = $('#stampTool');
const paperWrap = $('#paperWrap'), paper = $('#paper'), creases = $('#creases');
const noteCard = $('#noteCard'), noteBg = $('#noteBg'), noteLines = $$('#noteCard .ink-line');
const matchScene = $('#matchScene'), strip = $('#strip'), swipeCue = $('#swipeCue'), matchEl = $('#match'), lightpool = $('#lightpool');
const letterLayer = $('#letterLayer'), scroller = $('#scroller'), parchment = $('#parchment');
const parchBurnt = $('#parchBurnt'), parchMended = $('#parchMended');
const flash = $('#flash'), spell = $('#spell'), hint = $('#hint'), cta = $('#cta'), ctaBtn = $('#ctaBtn');
const heat = $('#heat'), muteBtn = $('#mute'), scrollCue = $('#scrollCue');

/* ---------------------------------------------------------------------
   layout (everything sized from the viewport)
   --------------------------------------------------------------------- */
let VW = 360, VH = 700, EW = 340, EH = 224, PW = 300, PH = 414, PL = 30, PT = 30;
function layout() {
  VW = window.innerWidth; VH = window.innerHeight;
  const cw = Math.min(VW * .88, 440);
  EW = Math.min(cw, (VH * .5) / .66); EH = EW * .66;
  const mbw = clamp(VW * .6, 190, 260);
  const reserve = Math.max(236, mbw * .46 + 130);
  PH = Math.max(220, Math.min(cw * 1.38, VH - reserve - 20));
  PW = Math.min(PH / 1.38, cw); PH = PW * 1.38;
  PT = Math.max(14, Math.min(VH * .06, VH - PH - reserve)); PL = (VW - PW) / 2;
  const s = root.style;
  s.setProperty('--vh', VH / 100 + 'px');
  s.setProperty('--ew', EW + 'px'); s.setProperty('--eh', EH + 'px');
  s.setProperty('--pw', PW + 'px'); s.setProperty('--ph', PH + 'px');
  s.setProperty('--pl', PL + 'px'); s.setProperty('--pt', PT + 'px');
  s.setProperty('--mbw', mbw + 'px');
  s.setProperty('--hint-mid', (PT + PH + 12) + 'px');
}

/* ---------------------------------------------------------------------
   sky: stars + floating candles
   --------------------------------------------------------------------- */
function buildSky() {
  const st = $('#stars'); const f = document.createDocumentFragment();
  for (let i = 0; i < 80; i++) {
    const s = document.createElement('i'); s.className = 'star';
    const z = rand(.7, 2.1);
    s.style.cssText = `left:${rand(0, 100)}%;top:${Math.pow(Math.random(), 1.4) * 82}%;width:${z}px;height:${z}px;` +
      `animation-duration:${rand(2.4, 5.5)}s;animation-delay:${-rand(0, 5)}s`;
    f.appendChild(s);
  }
  st.appendChild(f);

  const c = $('#candles'); const cf = document.createDocumentFragment();
  const n = 9;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div'); d.className = 'candle';
    d.style.cssText = `left:${(i + .5) / n * 100 + rand(-3.5, 3.5)}%;top:${rand(3, 66)}%;` +
      `animation-duration:${rand(5, 8.5)}s;animation-delay:${-rand(0, 8)}s;opacity:${rand(.7, 1)}`;
    d.innerHTML = '<i class="wax"></i><i class="wick"></i><i class="fl" style="animation-delay:' + -rand(0, .3) + 's"></i>';
    cf.appendChild(d);
  }
  c.appendChild(cf);
}

/* ---------------------------------------------------------------------
   sound — everything is synthesised (no audio files), kept soft
   --------------------------------------------------------------------- */
const Snd = (() => {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, master = null, noiseBuf = null, muted = false, fire = null;
  const T = () => ctx.currentTime;

  function init() {
    if (ctx || !AC) return;
    try {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : .9; master.connect(ctx.destination);
      const len = ctx.sampleRate * 2;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      ambient();
    } catch (e) { ctx = null; }
  }
  function resume() { try { ctx && ctx.state === 'suspended' && ctx.resume(); } catch (_) {} }
  function suspend() { try { ctx && ctx.state === 'running' && ctx.suspend(); } catch (_) {} }
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }

  function burst({ type = 'bandpass', f0 = 1000, f1 = null, q = 1, vol = .2, a = .005, d = .2, when = 0 }) {
    if (!ctx) return;
    try {
      const t = T() + when, s = noiseSrc(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t);
      if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + a + d);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t, Math.random() * 1.5); s.stop(t + a + d + .05);
    } catch (_) {}
  }
  function tone({ f = 440, f1 = null, type = 'sine', vol = .1, a = .01, d = .6, when = 0 }) {
    if (!ctx) return;
    try {
      const t = T() + when, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
      g.gain.exponentialRampToValueAtTime(.0001, t + a + d);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + a + d + .05);
    } catch (_) {}
  }
  function ambient() {
    const s = noiseSrc(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 360; g.gain.value = .026;
    s.connect(lp); lp.connect(g); g.connect(master); s.start();
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = .1; lg.gain.value = .011; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    [110, 164.81, 220.5].forEach(f => {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f; og.gain.value = .005; o.connect(og); og.connect(master); o.start();
    });
  }

  return {
    init, resume, suspend,
    toggle() { muted = !muted; if (master) master.gain.setTargetAtTime(muted ? 0 : .9, T(), .06); return muted; },
    whoosh(dur = .6, f0 = 400, f1 = 2200, vol = .2) { burst({ f0, f1, q: .8, vol, a: dur * .45, d: dur * .55 }); },
    thud() {
      tone({ f: 150, f1: 38, vol: .6, a: .004, d: .3 });
      burst({ type: 'lowpass', f0: 500, vol: .3, a: .002, d: .09 });
    },
    crack() {
      burst({ type: 'highpass', f0: 1800, vol: .45, a: .001, d: .05 });
      burst({ type: 'highpass', f0: 2600, vol: .3, a: .001, d: .04, when: .05 });
      tone({ f: 220, f1: 90, vol: .12, a: .002, d: .1 });
    },
    rustle(n = 6, span = .7) {
      for (let i = 0; i < n; i++) burst({ f0: rand(2400, 4200), q: .7, vol: rand(.05, .11), a: .01, d: rand(.05, .11), when: i * span / n + rand(0, .05) });
    },
    scratch() { burst({ f0: 2300, q: 3, vol: .09, a: .004, d: .09 }); },
    flare() {
      burst({ f0: 700, f1: 3200, q: .7, vol: .34, a: .05, d: .45 });
      burst({ type: 'lowpass', f0: 900, vol: .2, a: .01, d: .3 });
    },
    fireStart() {
      if (!ctx || fire) return;
      const s = noiseSrc(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 720; g.gain.value = 0;
      s.connect(lp); lp.connect(g); g.connect(master); s.start();
      fire = { s, g, lvl: 0, iv: setInterval(() => {
        if (!fire) return;
        if (Math.random() < fire.lvl * .9) burst({ type: 'highpass', f0: rand(2200, 4700), vol: .08 + rand(0, .22) * fire.lvl, a: .001, d: rand(.015, .045) });
      }, 70) };
    },
    fireLevel(x) { if (fire) { fire.lvl = x; fire.g.gain.setTargetAtTime(x * .3, T(), .12); } },
    fireStop() {
      if (!fire) return; const f = fire; fire = null; clearInterval(f.iv);
      f.g.gain.setTargetAtTime(0, T(), .5); setTimeout(() => { try { f.s.stop(); } catch (_) {} }, 2600);
    },
    chime(notes, gap = .13, vol = .09) {
      (notes || [659.25, 783.99, 987.77, 1318.5]).forEach((f, i) => {
        tone({ f, vol, a: .006, d: 1.5, when: i * gap });
        tone({ f: f * 2, vol: vol * .35, a: .004, d: .9, when: i * gap });
      });
    },
    click() { tone({ f: 880, f1: 520, vol: .05, a: .002, d: .09 }); },
  };
})();

/* ---------------------------------------------------------------------
   FX — fire, embers, smoke, wax crumbs, golden sparkles (one canvas)
   --------------------------------------------------------------------- */
const FX = (() => {
  const cv = $('#fx'), ctx = cv.getContext('2d');
  let W = 0, H = 0, dirty = false;
  function resize() { W = cv.width = Math.round(innerWidth); H = cv.height = Math.round(innerHeight); }

  function mk(rgb, stops) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(${rgb},${a})`));
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
  }
  const SP = {
    core: mk('255,238,170', [[0, 1], [.4, .55], [1, 0]]),
    flame: mk('255,128,24', [[0, .95], [.45, .45], [1, 0]]),
    red: mk('214,52,10', [[0, .8], [.5, .3], [1, 0]]),
    smoke: mk('62,56,54', [[0, .5], [1, 0]]),
  };
  SP.star = (() => {
    const c = mk('255,226,140', [[0, .9], [.25, .35], [1, 0]]), g = c.getContext('2d');
    g.fillStyle = 'rgba(255,250,225,.95)';
    g.beginPath(); g.ellipse(32, 32, 30, 1.8, 0, 0, TAU); g.fill();
    g.beginPath(); g.ellipse(32, 32, 1.8, 30, 0, 0, TAU); g.fill();
    return c;
  })();

  const P = [];
  const push = p => { if (P.length < 560) { p.t = 0; p.ph = Math.random() * TAU; P.push(p); dirty = true; } };

  const api = {
    resize,
    count: () => P.length,
    flame(x, y, size, vx, vy, life) { push({ k: 'f', x, y, size, vx, vy, life }); },
    ember(x, y, vx, vy, life) { push({ k: 'e', x, y, vx, vy, life, size: rand(3, 6.5) }); },
    smoke(x, y, size, vx, vy, life) { push({ k: 's', x, y, size, vx, vy, life }); },
    crumb(x, y, vx, vy) { push({ k: 'c', x, y, vx, vy, life: rand(.7, 1.2), size: rand(2, 4.5) }); },
    gold(x, y, vx, vy, life, size = rand(9, 20), g = 90) { push({ k: 'g', x, y, vx, vy, life, size, g }); },
    swirl(cx, cy, n = 100) {
      for (let i = 0; i < n; i++) push({ k: 'w', cx, cy, a0: rand(0, TAU), w: rand(1.6, 3.2) * (Math.random() < .5 ? -1 : 1),
        R: rand(60, Math.min(innerWidth, innerHeight) * .5), life: rand(1.3, 2.4), size: rand(9, 20), delay: rand(0, .35), x: cx, y: cy });
    },
    burst(x, y, n = 60, speed = 260) {
      for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(.25, 1) * speed;
        api.gold(x, y, Math.cos(a) * s, Math.sin(a) * s - 40, rand(1, 2.2), rand(8, 20), 60); }
    },
    update(dt) {
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.t += dt;
        if (p.t >= p.life) { P[i] = P[P.length - 1]; P.pop(); continue; }
        switch (p.k) {
          case 'f': p.x += (p.vx + Math.sin(p.t * 11 + p.ph) * 14) * dt; p.y += p.vy * dt; p.vy -= 40 * dt; break;
          case 'e': p.vx += (Math.random() - .5) * 90 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 12 * dt; break;
          case 's': p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .995; break;
          case 'c': p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; break;
          case 'g': p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; p.vx *= .992; break;
          case 'w': {
            const tt = Math.max(0, p.t - p.delay), k = clamp(tt / (p.life - p.delay), 0, 1);
            const r = Math.pow(k, .6) * p.R, a = p.a0 + p.w * tt;
            p.x = p.cx + Math.cos(a) * r; p.y = p.cy + Math.sin(a) * r * .85; break;
          }
        }
      }
    },
    draw() {
      if (!P.length) { if (dirty) { ctx.clearRect(0, 0, W, H); dirty = false; } return; }
      dirty = true;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';
      for (const p of P) {
        const k = p.t / p.life;
        if (p.k === 's') {
          const s = p.size * (1 + k * 1.8); ctx.globalAlpha = Math.sin(Math.min(1, k * 1.6) * Math.PI * .5) * (1 - k) * .55;
          ctx.drawImage(SP.smoke, p.x - s / 2, p.y - s / 2, s, s);
        } else if (p.k === 'c') {
          ctx.globalAlpha = 1 - k * k; ctx.fillStyle = '#7e121a';
          ctx.fillRect(p.x, p.y, p.size, p.size);
        }
      }
      ctx.globalCompositeOperation = 'lighter';
      for (const p of P) {
        const k = p.t / p.life;
        if (p.k === 'f') {
          const s = p.size * (1 - k * .72), a = (1 - k) * (1 - k) * .95;
          ctx.globalAlpha = a; ctx.drawImage(k < .45 ? SP.flame : SP.red, p.x - s / 2, p.y - s / 2, s, s);
          if (k < .38) { const c = s * .58; ctx.globalAlpha = a; ctx.drawImage(SP.core, p.x - c / 2, p.y - c / 2, c, c); }
        } else if (p.k === 'e') {
          const s = p.size * (1 - k * .5); ctx.globalAlpha = (1 - k) * (.55 + .45 * Math.sin(p.t * 22 + p.ph));
          ctx.drawImage(SP.core, p.x - s, p.y - s, s * 2, s * 2);
        } else if (p.k === 'g' || p.k === 'w') {
          if (p.k === 'w' && p.t < p.delay) continue;
          const s = p.size * (.65 + .35 * Math.sin(p.t * 16 + p.ph)) * (1 - k * .6);
          ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
          ctx.drawImage(SP.star, p.x - s, p.y - s, s * 2, s * 2);
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    },
  };
  return api;
})();

/* ---------------------------------------------------------------------
   parchment painter (time-sliced so it never janks)
   --------------------------------------------------------------------- */
async function paintParchment(cv, W, H, o = {}) {
  const scale = o.scale || .8, burnt = o.burnt !== false, seed = o.seed || 7;
  const w = Math.max(8, Math.round(W * scale)), h = Math.max(8, Math.round(H * scale)), inv = 1 / scale;
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d', o.ctxOpts);
  const img = ctx.createImageData(w, h), d = img.data;
  const N = makeNoise(seed), rnd = mulberry32(seed * 13 + 5);

  const bites = [];
  if (burnt) {
    const cd = o.corner || 54, cr = o.cornerR || 112;
    [[0, 0], [W, 0], [0, H], [W, H]].forEach(([x, y]) => {
      const r = cr * (.82 + rnd() * .45);
      bites.push({ x, y, r, r2: r * r, dep: cd * (.72 + rnd() * .5) });
    });
    const sb = o.sideBites == null ? 4 : o.sideBites;
    for (let i = 0; i < sb; i++) {
      const r = 46 + rnd() * 52;
      bites.push({ x: i % 2 ? W : 0, y: 170 + rnd() * Math.max(10, H - 340), r, r2: r * r, dep: 14 + rnd() * 20 });
    }
    for (let i = 0; i < 2; i++) {
      const r = 40 + rnd() * 40;
      bites.push({ x: W * (.25 + rnd() * .5), y: i ? H : 0, r, r2: r * r, dep: 10 + rnd() * 14 });
    }
  }
  const cz = 150;
  let y = 0;
  while (y < h) {
    const t0 = performance.now();
    while (y < h && performance.now() - t0 < 5) {
      const Y = y * inv;
      for (let x = 0; x < w; x++) {
        const X = x * inv, i = (y * w + x) << 2;
        const e = Math.min(X, W - X, Y, H - Y);
        const b1 = N.fbm(X * .012, Y * .012, 3), g1 = N(X * .3, Y * .3), fib = N(X * .05, Y * .9);
        const L = o.lift || 0;
        let r = 240 + L - b1 * 30 - g1 * 7 - fib * 3.5, g = 223 + L * 1.1 - b1 * 38 - g1 * 9 - fib * 4.5, b = 178 + L * 1.5 - b1 * 52 - g1 * 12 - fib * 6;
        const vg = smooth(90, 0, e) * (burnt ? 1 : .4);
        r -= vg * 34; g -= vg * 50; b -= vg * 64;
        if (o.creases) {
          const dc = Math.min(Math.abs(Y - H / 3), Math.abs(Y - 2 * H / 3));
          const cs = 1 - smooth(0, 2.4, dc); r -= cs * 20; g -= cs * 24; b -= cs * 28;
        }
        if (o.gold) { r += 8; g += 4; b -= 4; }
        let a = 255;
        if (burnt) {
          const near = e < 64 || ((X < cz || X > W - cz) && (Y < cz || Y > H - cz));
          if (near) {
            let v = e + (N.fbm(X * .07 + 9, Y * .07 + 4, 4) - .5) * 22 + (N(X * .6, Y * .6) - .5) * 3.5;
            for (let k = 0; k < bites.length; k++) {
              const bt = bites[k], dx = X - bt.x, dy = Y - bt.y, dd = dx * dx + dy * dy;
              if (dd < bt.r2) { const q = 1 - Math.sqrt(dd) / bt.r; v -= bt.dep * q * q * 1.2; }
            }
            if (v <= 0) a = 0;
            else {
              if (v < 1.2) a = (v / 1.2) * 255;
              if (v < 17) {
                const t1 = smooth(1.2, 4.6, v), t2 = smooth(4.6, 17, v);
                let cr = 24 + (94 - 24) * t1, cg = 13 + (46 - 13) * t1, cb = 9 + (18 - 9) * t1;
                const em = smooth(1.1, 2, v) * (1 - smooth(2, 4.4, v));
                cr += em * 70; cg += em * 18;
                r = cr + (r - cr) * t2; g = cg + (g - cg) * t2; b = cb + (b - cb) * t2;
              }
            }
          }
        }
        const gr = (Math.random() - .5) * 9;
        d[i] = r + gr; d[i + 1] = g + gr; d[i + 2] = b + gr * .8; d[i + 3] = a;
      }
      y++;
    }
    if (y < h) await nextFrame();
  }
  ctx.putImageData(img, 0, 0);
}

/* ---------------------------------------------------------------------
   Burn — the plain paper is eaten by fire, revealing what lies beneath
   --------------------------------------------------------------------- */
const Burn = {
  w: 0, h: 0, s: 1, ctx: null, base: null, out: null, bt: null, n2: null, gone: null,
  running: false, t: 0, T: 6800, pmax: 1.2, front: 0, done: null, lx: 0, ly: 0,

  prepare() {
    const ctx = paper.getContext('2d', { willReadFrequently: true });
    this.ctx = ctx; this.w = paper.width; this.h = paper.height;
    this.s = this.w / PW;
    const img = ctx.getImageData(0, 0, this.w, this.h);
    this.base = img.data;
    this.out = new ImageData(new Uint8ClampedArray(this.base), this.w, this.h);
    const N = this.w * this.h; this.n2 = new Float32Array(N); this.gone = new Uint8Array(N);
    const nz = makeNoise(5);
    for (let y = 0, i = 0; y < this.h; y++) for (let x = 0; x < this.w; x++, i++) {
      const X = x / this.s, Y = y / this.s;
      this.n2[i] = nz(X * .42, Y * .42) * .6 + nz(X * 1.1, Y * 1.1) * .4;
    }
  },

  ignite(lx, ly, done) {
    const { w, h, s } = this, N = w * h;
    this.lx = clamp(lx, 0, w - 1); this.ly = clamp(ly, 0, h - 1);
    const maxD = Math.max(Math.hypot(this.lx, this.ly), Math.hypot(w - this.lx, this.ly), Math.hypot(this.lx, h - this.ly), Math.hypot(w - this.lx, h - this.ly));
    const nz = makeNoise(21), bt = this.bt = new Float32Array(N);
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++) {
      bt[i] = .82 * Math.hypot(x - this.lx, y - this.ly) / maxD + .3 * nz.fbm(x / s * .017, y / s * .017, 4);
    }
    const b0 = bt[(this.ly | 0) * w + (this.lx | 0)]; let mx = 0;
    for (let i = 0; i < N; i++) { const v = Math.max(0, bt[i] - b0); bt[i] = v; if (v > mx) mx = v; }
    this.pmax = mx + .12; this.t = 0; this.running = true; this.done = done;
  },

  step(p, time) {
    const { w, h, base, out, bt, n2, gone } = this, o = out.data, b = base, N = w * h;
    let front = 0;
    for (let i = 0; i < N; i++) {
      if (gone[i]) continue;
      const d = p - bt[i];
      if (d < -.13) continue;
      const j = i << 2;
      if (d < 0) {
        const s = smooth(-.13, 0, d), k = s * s * .9, g4 = s * s * s * s * s * s;
        o[j] = b[j] * (1 - k) + 84 * k + g4 * 120;
        o[j + 1] = b[j + 1] * (1 - k) + 40 * k + g4 * 32;
        o[j + 2] = b[j + 2] * (1 - k) + 14 * k;
      } else if (d < .028) {
        const u = d / .028; let r, g, bl;
        if (u < .3) { const t = u / .3; r = 255; g = lerp(250, 170, t); bl = lerp(190, 40, t); }
        else if (u < .65) { const t = (u - .3) / .35; r = lerp(255, 190, t); g = lerp(170, 45, t); bl = lerp(40, 10, t); }
        else { const t = (u - .65) / .35; r = lerp(190, 28, t); g = lerp(45, 15, t); bl = lerp(10, 9, t); }
        o[j] = r; o[j + 1] = g; o[j + 2] = bl; o[j + 3] = 255; front++;
      } else if (d < .1) {
        const c = n2[i];
        const a = 1 - smooth(.04, .1, d + (c - .5) * .05);
        let r = 26, g = 14, bl = 9;
        if (c > .66 && d < .085) {
          const f = .5 + .5 * Math.sin(time * 14 + i * .37), em = smooth(.66, .86, c) * f * (1 - smooth(.04, .085, d));
          r = lerp(r, 255, em * .8); g = lerp(g, 110, em * .7); bl = lerp(bl, 20, em * .5);
        }
        o[j] = r; o[j + 1] = g; o[j + 2] = bl; o[j + 3] = a * 255;
        if (a <= .01) { gone[i] = 1; o[j + 3] = 0; }
      } else { gone[i] = 1; o[j + 3] = 0; }
    }
    this.ctx.putImageData(out, 0, 0);
    this.front = front;
  },

  update(dt, now) {
    if (!this.running) return;
    this.t += dt * 1000;
    const k = clamp(this.t / this.T, 0, 1), p = this.pmax * Math.pow(k, 1.18);
    this.step(p, now / 1000);

    const { w, h, bt, gone } = this, N = w * h;
    const inten = clamp(this.front / 2600, 0, 1);
    heat.style.opacity = (.15 + inten * .85).toFixed(3);
    Snd.fireLevel(.25 + inten * .75);

    // flames, embers & smoke from the burning front
    const want = clamp(this.front / 140, 2, 22);
    let spawned = 0;
    const cx = PW / w, cy = PH / h;
    for (let q = 0; q < 700 && spawned < want; q++) {
      const i = (Math.random() * N) | 0;
      if (gone[i]) continue;
      const d = p - bt[i];
      if (d >= 0 && d < .03) {
        const x = PL + (i % w) * cx, y = PT + ((i / w) | 0) * cy;
        FX.flame(x + rand(-3, 3), y + rand(-3, 3), rand(12, 26), rand(-12, 12), rand(-70, -125), rand(.35, .8));
        if (Math.random() < .2) FX.ember(x, y, rand(-30, 30), rand(-60, -130), rand(.9, 2.2));
        if (Math.random() < .13) FX.smoke(x, y - 8, rand(26, 46), rand(-12, 12), rand(-40, -75), rand(1.4, 2.6));
        spawned++;
      }
    }
    if (k < .12 || spawned === 0 && k < .5) {   // make sure the very first flames are visible
      const x = PL + this.lx * cx, y = PT + this.ly * cy;
      for (let n = 0; n < 3; n++) FX.flame(x + rand(-5, 5), y + rand(-4, 4), rand(14, 26), rand(-10, 10), rand(-70, -120), rand(.4, .8));
    }

    if (k >= 1) {
      this.running = false;
      const cb = this.done; this.done = null;
      cb && cb();
    }
  },
};

/* ---------------------------------------------------------------------
   Match — drag across the strip to strike, then carry the flame to the page
   --------------------------------------------------------------------- */
const Match = {
  el: matchEl, phase: 'off', lit: false, dragging: false, pid: null, auto: null,
  hx: 0, hy: 0, tx: 0, ty: 0, ang: 205, tang: 205, sL: 0, sR: 0, sY: 0,
  sx: 0, sy: 0, px: 0, py: 0, hx0: 0, moved: 0, downT: 0, lastScratch: 0, dwell: 0,
  off: { x: 0, y: -66 }, offT: { x: 0, y: -66 }, onPaper: null, hintT: 0,

  init() {
    const r = strip.getBoundingClientRect();
    this.sL = r.left + 16; this.sR = r.right - 16; this.sY = r.top + r.height / 2;
    this.hx = this.tx = this.sL; this.hy = this.ty = this.sY; this.ang = this.tang = 205;
    this.phase = 'rest'; this.lit = false;
    this.render();
    this.el.style.visibility = 'visible';
    this.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, fill: 'both' });
    const el = this.el;
    el.addEventListener('pointerdown', e => this.onDown(e));
    el.addEventListener('pointermove', e => this.onMove(e));
    el.addEventListener('pointerup', e => this.onUp(e));
    el.addEventListener('pointercancel', e => this.onUp(e));
  },

  onDown(e) {
    if (this.phase !== 'rest') return;
    e.preventDefault();
    this.dragging = true; this.pid = e.pointerId; this.auto = null;
    try { this.el.setPointerCapture(e.pointerId); } catch (_) {}
    this.sx = e.clientX; this.sy = e.clientY; this.px = e.clientX; this.py = e.clientY;
    this.moved = 0; this.downT = performance.now(); this.hx0 = this.hx;
    if (this.lit) { this.off = { x: this.hx - e.clientX, y: this.hy - e.clientY }; this.offT = { x: 0, y: -66 }; }
  },
  onMove(e) {
    if (!this.dragging || e.pointerId !== this.pid) return;
    e.preventDefault();
    const dx = e.clientX - this.sx, dy = e.clientY - this.sy;
    this.moved = Math.max(this.moved, Math.hypot(dx, dy));
    this.px = e.clientX; this.py = e.clientY;
    if (!this.lit) {
      this.tx = clamp(this.hx0 + dx, this.sL, this.sR); this.ty = this.sY;
      const now = performance.now();
      if (now - this.lastScratch > 85 && Math.abs(this.tx - this.hx) > 1.5) { Snd.scratch(); this.lastScratch = now; }
      if (this.tx - this.sL > (this.sR - this.sL) * .6) this.light();
    }
  },
  onUp(e) {
    if (!this.dragging || e.pointerId !== this.pid) return;
    this.dragging = false;
    try { this.el.releasePointerCapture(e.pointerId); } catch (_) {}
    const tap = this.moved < 9 && performance.now() - this.downT < 500;
    if (!this.lit) {
      if (tap) this.autoStrike();
      else { this.tx = this.sL; this.ty = this.sY; }       // swipe wasn't long enough: slide back
    }
  },

  autoStrike() {
    this.auto = { t0: performance.now(), from: this.hx, to: this.sR, dur: 560 };
  },
  light() {
    if (this.lit) return;
    this.lit = true; this.auto = null; this.el.classList.add('lit');
    Snd.flare(); haptic(20); castSpell('Lumos');
    this.tang = 346; this.offT = { x: 0, y: -66 };
    if (this.dragging) this.off = { x: this.hx - this.px, y: this.hy - this.py };
    else { this.tx = this.hx; this.ty = this.hy; }
    FX.burst(this.hx, this.hy - 8, 26, 180);
    swipeCue.style.opacity = 0;
    setHint('Now touch the flame to the page', 'mid');
    clearTimeout(this.hintT);
    this.hintT = setTimeout(() => this.lit && this.phase === 'rest' && setHint('Bring the flame to the page — or just tap it', 'mid'), 8000);
  },
  goTo(x, y) { if (this.lit && !this.dragging) { this.tx = x; this.ty = y; } },

  finish() {
    this.phase = 'gone'; clearTimeout(this.hintT);
    this.el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
    lightpool.animate([{ opacity: lightpool.style.opacity || .8 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
    matchScene.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' });
  },

  render() { this.el.style.transform = `translate(${this.hx - 7}px,${this.hy - 8.5}px) rotate(${this.ang}deg)`; },

  update(dt, now) {
    if (this.phase !== 'rest') return;
    if (this.auto) {
      const k = clamp((performance.now() - this.auto.t0) / this.auto.dur, 0, 1);
      this.tx = lerp(this.auto.from, this.auto.to, easeIO(k)); this.ty = this.sY;
      if (now - this.lastScratch > 85) { Snd.scratch(); this.lastScratch = now; }
      if (k >= 1) this.light();
    }
    if (this.lit && this.dragging) {
      const o = 1 - Math.exp(-8 * dt);
      this.off.x = lerp(this.off.x, this.offT.x, o); this.off.y = lerp(this.off.y, this.offT.y, o);
      this.tx = this.px + this.off.x; this.ty = this.py + this.off.y;
    }
    const k = 1 - Math.exp(-25 * dt), ka = 1 - Math.exp(-9 * dt);
    this.hx = lerp(this.hx, this.tx, k); this.hy = lerp(this.hy, this.ty, k); this.ang = lerp(this.ang, this.tang, ka);
    this.render();

    if (this.lit) {
      const th = this.ang * Math.PI / 180, ux = Math.sin(th), uy = -Math.cos(th);   // "up" along the match
      const bx = this.hx + ux * 6, by = this.hy + uy * 6;
      for (let i = 0; i < 2; i++) FX.flame(bx + rand(-1.5, 1.5), by + rand(-1, 1), rand(11, 19), rand(-7, 7), rand(-70, -105), rand(.22, .42));
      if (Math.random() < .12) FX.ember(bx, by - 6, rand(-25, 25), rand(-60, -110), rand(.7, 1.6));
      if (Math.random() < .08) FX.smoke(bx, by - 14, rand(14, 22), rand(-6, 6), rand(-30, -50), rand(.9, 1.5));
      lightpool.style.transform = `translate(${bx}px,${by - 6}px)`;
      lightpool.style.opacity = (.72 + Math.random() * .22).toFixed(2);

      // touch the page → it catches fire
      const inside = this.hx > PL + 22 && this.hx < PL + PW - 22 && this.hy > PT + 22 && this.hy < PT + PH - 22;
      this.dwell = inside ? this.dwell + dt : 0;
      if (this.dwell > .16 && this.onPaper) { const cb = this.onPaper; this.onPaper = null; cb(this.hx, this.hy); }
    }
  },
};

/* ---------------------------------------------------------------------
   small UI helpers
   --------------------------------------------------------------------- */
let hintTimer = 0;
function setHint(txt, pos = 'bottom') {
  hint.classList.remove('show'); clearTimeout(hintTimer);
  if (!txt) return;
  hintTimer = setTimeout(() => { hint.textContent = txt; hint.dataset.pos = pos; hint.classList.add('show'); }, 320);
}
function castSpell(txt) {
  spell.textContent = txt; spell.classList.remove('go'); void spell.offsetWidth; spell.classList.add('go');
}
function showCTA(label) {
  return new Promise(res => {
    ctaBtn.textContent = label; cta.classList.add('show');
    const h = () => { ctaBtn.removeEventListener('click', h); cta.classList.remove('show'); Snd.click(); haptic(10); res(); };
    ctaBtn.addEventListener('click', h);
  });
}

/* ---------------------------------------------------------------------
   scenes
   --------------------------------------------------------------------- */
let envDeg = 180, paperReady = null, noteReady = null, letterReady = null;

async function flipEnv(to) {
  Snd.whoosh(.9, 300, 1700, .16);
  await play(env, [{ transform: `rotateY(${envDeg}deg)`, scale: 1 }, { scale: 1.12, offset: .5 }, { transform: `rotateY(${to}deg)`, scale: 1 }],
    { duration: 1150, easing: 'cubic-bezier(.45,.05,.2,1)' });
  envDeg = to;
}

async function deliver() {
  await sleep(600);
  owl.style.visibility = 'visible';
  Snd.whoosh(1.8, 180, 650, .1);
  const y0 = VH * .17;
  const flight = owl.animate([
    { transform: `translate(${VW + 40}px,${y0}px) scale(.7)` },
    { transform: `translate(${VW * .62}px,${y0 + 14}px) scale(.95)`, offset: .3 },
    { transform: `translate(${VW * .38}px,${y0 - 4}px) scale(1.1)`, offset: .55 },
    { transform: `translate(-260px,${y0 - 34}px) scale(1.3)` },
  ], { duration: 5600, easing: 'linear', fill: 'forwards' });
  await sleep(2350);

  // the owl lets go of the letter
  const lr = owlLetter.getBoundingClientRect(), cx = lr.left + lr.width / 2, cy = lr.top + lr.height / 2;
  owlLetter.setAttribute('opacity', '0');
  const ex = VW / 2, ey = VH * .46;
  envWrap.style.visibility = 'visible';
  Snd.whoosh(1.2, 500, 1800, .14);
  const fall = play(envWrap, [
    { transform: `translate(${cx - ex}px,${cy - ey}px) scale(.16) rotate(-30deg)` },
    { transform: `translate(${(cx - ex) * .3}px,${(cy - ey) * .22}px) scale(.8) rotate(8deg)`, offset: .62 },
    { transform: 'translate(0,0) scale(1) rotate(0deg)' },
  ], { duration: 1900, easing: 'cubic-bezier(.3,.6,.3,1)' });
  const spin = play(env, [{ transform: 'rotateY(540deg)' }, { transform: 'rotateY(180deg)' }], { duration: 1900, easing: 'cubic-bezier(.3,.7,.3,1)' });
  play(envShadow, [{ opacity: 0 }, { opacity: .85 }], { duration: 1800 });
  await Promise.all([fall, spin]);
  env.classList.add('float');
  flight.finished.then(() => { owl.style.visibility = 'hidden'; body.classList.add('deep'); }).catch(() => {});

  await sleep(350);
  await stampSeal();
  await sleep(450);
  await flipEnv(0);
  await writeAddress();
}

async function stampSeal() {
  stampTool.style.visibility = 'visible';
  await play(stampTool, [
    { transform: 'translateY(-150px) scale(1.3)', opacity: 0 },
    { opacity: 1, offset: .3 },
    { transform: 'translateY(0) scale(1)', opacity: 1 },
  ], { duration: 700, easing: 'cubic-bezier(.55,0,.9,.55)' });
  Snd.thud(); haptic(30);
  play(seal, [
    { transform: 'translate(-50%,-50%) scale(.2)', opacity: 0 },
    { transform: 'translate(-50%,-50%) scale(1.14)', opacity: 1, offset: .5 },
    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
  ], { duration: 480, easing: 'ease-out' });
  play(env, [{ scale: 1 }, { scale: .985, offset: .3 }, { scale: 1 }], { duration: 320 });
  await sleep(420);
  await play(stampTool, [
    { transform: 'translateY(0) scale(1)', opacity: 1 },
    { transform: 'translateY(-170px) scale(1.2)', opacity: 0 },
  ], { duration: 620, easing: 'cubic-bezier(.4,0,.8,.4)' });
  stampTool.style.visibility = 'hidden';
}

async function writeAddress() {
  await sleep(250);
  await writeIn(addrTo, 1900);
  addrRule.style.visibility = 'visible'; play(addrRule, [{ opacity: 0 }, { opacity: .7 }], { duration: 500 });
  for (const l of addrLines) await writeIn(l, 1000);
  await sleep(150);
  Snd.thud(); haptic(15);
  await play(postmark, [{ opacity: 0, transform: 'rotate(-14deg) scale(1.55)' }, { opacity: .72, transform: 'rotate(-14deg) scale(1)' }], { duration: 380, easing: 'ease-in' });
}

function prepareCanvases() {
  const s = Math.min(window.devicePixelRatio || 1, 1.5, Math.sqrt(220000 / (PW * PH)));
  paperReady = paintParchment(paper, PW, PH, { scale: s, burnt: false, creases: true, lift: 17, seed: 11, ctxOpts: { willReadFrequently: true } })
    .then(() => Burn.prepare());
  noteReady = paintParchment(noteBg, PW, PH, { scale: .9, burnt: true, seed: 23, corner: 50, sideBites: 2 });
}
function paintLetter() {
  if (letterReady) return letterReady;
  const W = parchment.offsetWidth, H = parchment.offsetHeight, sc = clamp(560 / W, .5, .85);
  letterReady = (async () => {
    await paintParchment(parchBurnt, W, H, { scale: sc, burnt: true, seed: 31, corner: 58, cornerR: 118, sideBites: Math.max(3, Math.round(H / 420)) });
    await paintParchment(parchMended, W, H, { scale: sc, burnt: false, gold: true, seed: 31 });
  })();
  return letterReady;
}

async function openEnvelope() {
  Snd.crack(); haptic([20, 40, 20]);
  const sr = seal.getBoundingClientRect(), cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
  for (let i = 0; i < 16; i++) FX.crumb(cx + rand(-16, 16), cy + rand(-10, 10), rand(-110, 110), rand(-190, -40));
  play(sealL, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: 'translate(-18px,36px) rotate(-28deg)', opacity: 0 }], { duration: 780, easing: 'ease-in' });
  play(sealR, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: 'translate(18px,40px) rotate(24deg)', opacity: 0 }], { duration: 820, easing: 'ease-in' });
  await sleep(280);
  Snd.rustle(3, .3);
  const P = 'perspective(900px) ';
  await play(flapHinge, [
    { transform: P + 'rotateX(0deg)', zIndex: 4, offset: 0 },
    { transform: P + 'rotateX(89.8deg)', zIndex: 4, offset: .499 },
    { transform: P + 'rotateX(90deg)', zIndex: 1, offset: .5 },
    { transform: P + 'rotateX(180deg)', zIndex: 1, offset: 1 },
  ], { duration: 950, easing: 'ease-in-out' });
  seal.style.visibility = 'hidden';
  await sleep(120);
  Snd.rustle(7, .9);
  await play(letterIn, [{ transform: 'translateY(0)' }, { transform: `translateY(${-EH * 1.06}px)` }], { duration: 1250, easing: 'cubic-bezier(.3,.1,.25,1)' });
  await paperReady;

  // swap the little folded letter for the real page, then let it unfold
  const r = letterIn.getBoundingClientRect();
  const start = `translate(${r.left - PL}px,${r.top - PT}px) scale(${r.width / PW},${r.height / PH})`;
  paperWrap.style.transform = start; paperWrap.style.visibility = 'visible';
  creases.style.opacity = 1; letterIn.style.visibility = 'hidden';
  await nextFrame();
  Snd.rustle(8, 1.1);
  play(creases, [{ opacity: 1 }, { opacity: 0 }], { duration: 1300, easing: 'ease-in' });
  play(envWrap, [{ transform: 'translate(0,0) rotate(0deg)', opacity: 1 }, { transform: `translate(0,${VH * .62}px) rotate(7deg)`, opacity: 0 }], { duration: 1150, delay: 120, easing: 'ease-in' });
  play(envShadow, [{ opacity: .85 }, { opacity: 0 }], { duration: 800 });
  await play(paperWrap, [{ transform: start }, { transform: 'translate(0,0) scale(1,1)' }], { duration: 1300, easing: 'cubic-bezier(.3,.7,.2,1)' });
  envScene.style.display = 'none';
}
const envScene = $('#envScene');

async function lightThePage() {
  matchScene.style.visibility = 'visible';
  await play(matchScene, [{ transform: 'translateY(170%)' }, { transform: 'translateY(0)' }], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' });
  Match.init();
  setHint('Strike the match — drag it across the strip', 'mid');
  paintLetter();

  const hit = await new Promise(resolve => {
    Match.onPaper = (x, y) => resolve({ x, y });
    paperWrap.addEventListener('pointerdown', e => {
      if (Match.phase !== 'rest') return;
      if (Match.lit) { Match.goTo(e.clientX, e.clientY); }
      else { setHint('Strike the match first — drag it across the strip', 'mid'); }
    });
  });

  // ---- ignition ----
  Match.finish();
  setHint('');
  paperWrap.classList.add('nosh');
  noteCard.style.visibility = 'visible';
  castSpell('Incendio'); Snd.fireStart(); Snd.flare(); haptic([30, 30, 60]);
  await noteReady;
  const lx = clamp((hit.x - PL) / PW, 0, 1) * Burn.w, ly = clamp((hit.y - PT) / PH, 0, 1) * Burn.h;
  await new Promise(res => Burn.ignite(lx, ly, res));
  Snd.fireStop();
  paperWrap.style.visibility = 'hidden';
  matchScene.style.display = 'none';
  play(heat, [{ opacity: parseFloat(heat.style.opacity) || .5 }, { opacity: 0 }], { duration: 1800 });
}

async function readNote() {
  await sleep(700);
  Snd.chime([523.25, 659.25, 783.99], .2, .06);
  await writeIn(noteLines[0], 1700);
  for (let i = 1; i < noteLines.length; i++) await writeIn(noteLines[i], 950);
  await sleep(500);
  await showCTA('Read my letter');
}

async function convertToLetter() {
  castSpell('Revelio');
  Snd.chime([392, 523.25, 659.25, 783.99, 1046.5, 1318.5], .11, .08); Snd.rustle(5, .8);
  FX.swirl(PL + PW / 2, PT + PH / 2, 120);
  play(flash, [{ opacity: 0 }, { opacity: .95, offset: .32 }, { opacity: 0 }], { duration: 1000 });
  await sleep(380);
  const hide = play(noteCard, [
    { opacity: 1, transform: 'scale(1)', filter: 'blur(0px)' },
    { opacity: 0, transform: 'scale(.9) translateY(-14px)', filter: 'blur(9px)' },
  ], { duration: 1000, easing: 'ease-in' });

  await letterReady;
  letterLayer.style.visibility = 'visible'; scroller.scrollTop = 0;
  const show = play(letterLayer, [{ opacity: 0 }, { opacity: 1 }], { duration: 1300, easing: 'ease-out', delay: 250 });
  play(parchment, [{ transform: 'translateY(40px) scale(.96)' }, { transform: 'translateY(0) scale(1)' }], { duration: 1600, easing: 'cubic-bezier(.2,.8,.2,1)', delay: 250 });
  await Promise.all([hide, show]);
  noteCard.style.visibility = 'hidden';
  startReading();
}

function startReading() {
  body.classList.add('reading');
  const items = $$('.reveal');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { root: scroller, threshold: .1, rootMargin: '0px 0px -5% 0px' });
  let n = 0;
  items.forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.top < VH) el.style.transitionDelay = (.15 + n++ * .22) + 's';
    io.observe(el);
  });
  setTimeout(() => scrollCue.classList.add('show'), 3200);
  scroller.addEventListener('scroll', () => { if (scroller.scrollTop > 30) scrollCue.classList.remove('show'); }, { passive: true });
}

/* ---- Reparo: the happy ending ---- */
function setupReparo() {
  const btn = $('#reparoBtn'), after = $('#rpAfter'), reply = $('#replyBtn');
  if (CONFIG.replyWhatsApp) {
    reply.href = 'https://wa.me/' + CONFIG.replyWhatsApp.replace(/\D/g, '') + '?text=' + encodeURIComponent(CONFIG.replyText);
    reply.style.display = 'inline-block';
  }
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    castSpell('Reparo'); haptic([30, 40, 80]);
    Snd.chime([523.25, 659.25, 783.99, 987.77, 1174.66, 1568], .12, .09); Snd.rustle(6, .9);
    FX.burst(x, y, 90, 340); FX.swirl(x, y, 70);
    play(flash, [{ opacity: 0 }, { opacity: .6, offset: .3 }, { opacity: 0 }], { duration: 1100 });
    parchment.classList.add('mended'); parchMended.style.opacity = 1;
    setTimeout(() => { parchBurnt.style.opacity = 0; }, 900);
    play(btn, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.8)' }], { duration: 700 });
    await sleep(900);
    btn.style.display = 'none'; $('.rp-text').style.display = 'none';
    after.style.display = 'block'; await nextFrame(); after.classList.add('in');
    scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
    for (let i = 0; i < 4; i++) setTimeout(() => FX.burst(rand(40, VW - 40), rand(VH * .2, VH * .8), 24, 200), 500 + i * 650);
  }, { once: true });
}

/* ---------------------------------------------------------------------
   boot
   --------------------------------------------------------------------- */
let lastFrame = performance.now(), frameErr = false;
function frame(now) {
  const dt = Math.min(.05, (now - lastFrame) / 1000); lastFrame = now;
  try { Match.update(dt, now); Burn.update(dt, now); FX.update(dt); FX.draw(); }
  catch (e) { if (!frameErr) { console.error(e); frameErr = true; } }
  requestAnimationFrame(frame);
}

async function run() {
  Snd.init(); Snd.resume();
  body.classList.add('started'); gate.classList.add('out');
  await deliver();
  setHint('It is addressed to you…');
  await showCTA('Turn it over');
  setHint('');
  await flipEnv(180);
  prepareCanvases();
  setHint('Sealed with the crest of Hogwarts');
  await showCTA('Break the seal');
  setHint('');
  await openEnvelope();
  await lightThePage();
  await readNote();
  await convertToLetter();
}

async function boot() {
  layout(); buildSky(); FX.resize();
  $('#signature').textContent = CONFIG.fromName || 'Your Muggle';
  setupReparo();

  let rt = 0;
  window.addEventListener('resize', () => {
    layout(); FX.resize();
    clearTimeout(rt); rt = setTimeout(() => { if (Match.phase === 'rest') { const r = strip.getBoundingClientRect(); Match.sL = r.left + 16; Match.sR = r.right - 16; Match.sY = r.top + r.height / 2; } }, 200);
  });
  document.addEventListener('visibilitychange', () => document.hidden ? Snd.suspend() : Snd.resume());
  muteBtn.addEventListener('click', () => {
    const m = Snd.toggle(); $('#muteWaves').style.display = m ? 'none' : ''; $('#muteSlash').style.display = m ? '' : 'none';
  });

  const fontsReady = document.fonts ? Promise.all([
    document.fonts.load('40px "Pinyon Script"', 'Divakshi'), document.fonts.load('500 20px "Dancing Script"', 'Divakshi'),
    document.fonts.load('600 14px "Cinzel"', 'HOGWARTS'), document.fonts.load('700 30px "Cinzel Decorative"', 'HOGWARTS'),
  ]).catch(() => {}) : Promise.resolve();
  await Promise.race([fontsReady, sleep(3500)]);

  requestAnimationFrame(() => body.classList.add('ready'));
  beginBtn.addEventListener('click', run, { once: true });
  requestAnimationFrame(frame);
}

window.__hp = { Match, Burn, FX, Snd, CONFIG };   // handy for debugging in the console
boot();

})();
