/*!
 * Linkabara Sounds — tiny synthesized sound kit for the Linkabara mascot.
 * Pure Web Audio synthesis: no samples, no dependencies.
 * Designed by dmeneri
 *
 * API (window.LinkabaraSounds):
 *   talk.start() / talk.stop()   – looping cute gibberish babble (also talk(true|false))
 *   type.start() / type.stop()   – looping soft keyboard tapping (also type(true|false))
 *   done()                       – happy rising chime with sparkle
 *   click()                      – soft UI click / pop
 *   setMuted(bool) / isMuted()   – persisted in localStorage('linkabaraMuted')
 *   unlock()                     – optional: create/resume audio from your own gesture handler
 */
(function (global) {
  'use strict';
  if (!global || global.LinkabaraSounds) return;

  var STORAGE_KEY = 'linkabaraMuted';
  var MASTER_VOLUME = 0.6;
  var AC = global.AudioContext || global.webkitAudioContext;

  var ctx = null;
  var master = null;
  var noiseBuf = null;
  var muted = readMuted();

  function readMuted() {
    try { return global.localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { return false; }
  }
  function writeMuted(v) {
    try { global.localStorage.setItem(STORAGE_KEY, v ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // ---- AudioContext (lazy) -------------------------------------------------
  function ensureCtx() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER_VOLUME;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && ctx.resume) {
      try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) { /* ignore */ }
    }
    return ctx;
  }

  function ready() {
    // Usable for scheduling right now (created, running, not muted).
    return !muted && ensureCtx() && ctx.state === 'running';
  }

  var unlocked = false;
  var UNLOCK_EVENTS = ['pointerdown', 'touchstart', 'touchend', 'mousedown', 'keydown'];
  function unlock() {
    var c = ensureCtx();
    if (!c) return;
    if (!unlocked) {
      // iOS: play a 1-sample silent buffer inside the gesture to fully unlock output.
      try {
        var b = c.createBuffer(1, 1, 22050);
        var s = c.createBufferSource();
        s.buffer = b; s.connect(c.destination); s.start(0);
      } catch (e) { /* ignore */ }
    }
    if (c.state === 'running') {
      unlocked = true;
      UNLOCK_EVENTS.forEach(function (ev) { global.removeEventListener(ev, unlock, true); });
    }
  }
  if (global.addEventListener) {
    UNLOCK_EVENTS.forEach(function (ev) {
      global.addEventListener(ev, unlock, { capture: true, passive: true });
    });
  }

  function getNoise() {
    if (!noiseBuf) {
      var len = Math.floor(ctx.sampleRate * 1.0);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  function cleanup(src, nodes) {
    src.onended = function () {
      for (var i = 0; i < nodes.length; i++) { try { nodes[i].disconnect(); } catch (e) { /* ignore */ } }
    };
  }

  // ---- Loop helper (prevents stacking, own fade bus) -----------------------
  function makeLoop(scheduleOne) {
    var running = false;
    var timer = null;
    var bus = null;

    function tick() {
      timer = null;
      if (!running) return;
      var wait = 120;
      if (ready()) {
        if (!bus) { bus = ctx.createGain(); bus.gain.value = 1; bus.connect(master); }
        wait = scheduleOne(ctx, bus, ctx.currentTime + 0.01);
      }
      timer = setTimeout(tick, Math.max(15, wait));
    }

    function silenceBus() {
      if (bus && ctx) {
        var old = bus, t = ctx.currentTime;
        try {
          old.gain.cancelScheduledValues(t);
          old.gain.setValueAtTime(old.gain.value, t);
          old.gain.linearRampToValueAtTime(0, t + 0.03);
        } catch (e) { /* ignore */ }
        setTimeout(function () { try { old.disconnect(); } catch (e) { /* ignore */ } }, 120);
      }
      bus = null;
    }

    function start() {
      ensureCtx();
      if (running) return;          // never stack loops
      running = true;
      tick();
    }
    function stop() {
      running = false;
      if (timer) { clearTimeout(timer); timer = null; }
      silenceBus();
    }

    var api = function (on) { if (on === false) stop(); else start(); };
    api.start = start;
    api.stop = stop;
    api.isPlaying = function () { return running; };
    api._silence = silenceBus;
    return api;
  }

  // ---- talk: cute gibberish babble -----------------------------------------
  // Vowel-ish formant pairs (scaled up for a small, fluffy creature voice).
  var FORMANTS = [
    [900, 2300],  // "ee"/"ih"
    [1100, 1900], // "eh"
    [1300, 1700], // "ah"
    [800, 1300],  // "oh"
    [600, 1500],  // "oo"
  ];
  var talkBase = 620;

  function babble(c, out, t) {
    var dur = rand(0.07, 0.14);
    // Wander the base pitch a little so phrases feel melodic.
    talkBase = Math.min(820, Math.max(480, talkBase * rand(0.9, 1.1)));
    var f0 = talkBase * rand(0.92, 1.12);
    var contour = pick(['up', 'down', 'hill', 'flat']);
    var vol = rand(0.18, 0.28);

    var osc = c.createOscillator();
    osc.type = Math.random() < 0.6 ? 'triangle' : 'sine';
    var fq = osc.frequency;
    fq.setValueAtTime(f0, t);
    if (contour === 'up') fq.exponentialRampToValueAtTime(f0 * rand(1.15, 1.4), t + dur);
    else if (contour === 'down') fq.exponentialRampToValueAtTime(f0 * rand(0.75, 0.88), t + dur);
    else if (contour === 'hill') {
      fq.exponentialRampToValueAtTime(f0 * rand(1.15, 1.3), t + dur * 0.45);
      fq.exponentialRampToValueAtTime(f0 * rand(0.9, 1.0), t + dur);
    } else fq.linearRampToValueAtTime(f0 * rand(0.97, 1.03), t + dur);

    // Slight vibrato
    var lfo = c.createOscillator();
    var lfoGain = c.createGain();
    lfo.frequency.value = rand(6, 10);
    lfoGain.gain.value = f0 * rand(0.015, 0.035);
    lfo.connect(lfoGain); lfoGain.connect(fq);

    // Formant-ish bandpasses in parallel + a little dry body
    var fm = pick(FORMANTS), k = rand(1.0, 1.25);
    var bp1 = c.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = fm[0] * k; bp1.Q.value = rand(3, 6);
    var bp2 = c.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = fm[1] * k; bp2.Q.value = rand(4, 8);
    var dry = c.createGain(); dry.gain.value = 0.35;
    var b2g = c.createGain(); b2g.gain.value = 0.6;

    var env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    env.gain.setValueAtTime(vol, t + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;

    osc.connect(bp1); osc.connect(bp2); osc.connect(dry);
    bp1.connect(env); bp2.connect(b2g); b2g.connect(env); dry.connect(env);
    env.connect(lp); lp.connect(out);

    osc.start(t); lfo.start(t);
    osc.stop(t + dur + 0.02); lfo.stop(t + dur + 0.02);
    cleanup(osc, [osc, lfo, lfoGain, bp1, bp2, dry, b2g, env, lp]);

    // Gap: mostly short, sometimes a "word" pause, rarely a breath.
    var r = Math.random(), gap;
    if (r < 0.7) gap = rand(0.015, 0.06);
    else if (r < 0.93) gap = rand(0.12, 0.26);
    else { gap = rand(0.3, 0.5); talkBase = rand(560, 720); }
    return (dur + gap) * 1000;
  }

  // ---- type: soft keyboard tapping -----------------------------------------
  var keysSinceSpace = 0;

  function tap(c, out, t) {
    var noise = getNoise();
    var isSpace = keysSinceSpace > 3 && Math.random() < 0.12;
    keysSinceSpace = isSpace ? 0 : keysSinceSpace + 1;

    var src = c.createBufferSource();
    src.buffer = noise;
    src.playbackRate.value = rand(0.85, 1.15);
    var filt = c.createBiquadFilter();
    var env = c.createGain();
    var len, vol, nodes = [src, filt, env];

    if (isSpace) {
      filt.type = 'bandpass'; filt.frequency.value = rand(380, 600); filt.Q.value = 1.2;
      len = rand(0.05, 0.07); vol = rand(0.35, 0.45);
      // Low "thock" body
      var th = c.createOscillator(), thg = c.createGain();
      th.type = 'sine';
      th.frequency.setValueAtTime(rand(150, 190), t);
      th.frequency.exponentialRampToValueAtTime(90, t + 0.06);
      thg.gain.setValueAtTime(0.0001, t);
      thg.gain.exponentialRampToValueAtTime(0.22, t + 0.003);
      thg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      th.connect(thg); thg.connect(out);
      th.start(t); th.stop(t + 0.08);
      cleanup(th, [th, thg]);
    } else {
      filt.type = 'bandpass'; filt.frequency.value = rand(1800, 4200); filt.Q.value = rand(0.8, 1.6);
      len = rand(0.018, 0.035); vol = rand(0.12, 0.22);
    }

    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.0015);
    env.gain.exponentialRampToValueAtTime(0.0001, t + len);

    src.connect(filt); filt.connect(env); env.connect(out);
    src.start(t, rand(0, noise.duration - 0.2));
    src.stop(t + len + 0.01);
    cleanup(src, nodes);

    // Irregular rhythm; a bit longer after a space, rare short "thinking" pause.
    var next = rand(60, 140);
    if (isSpace) next += rand(40, 120);
    else if (Math.random() < 0.05) next += rand(200, 450);
    return next;
  }

  var talk = makeLoop(babble);
  var type = makeLoop(tap);

  // ---- done: happy rising chime ---------------------------------------------
  function done() {
    if (!ready()) return;
    var c = ctx, t0 = c.currentTime + 0.02;
    var notes = [1046.5, 1318.5, 1568.0, 2093.0]; // C6 E6 G6 C7
    var step = 0.085;
    notes.forEach(function (f, i) {
      var t = t0 + i * step;
      var last = i === notes.length - 1;
      var len = last ? 0.7 : 0.35;
      var o1 = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
      o1.type = 'triangle'; o1.frequency.value = f;
      o2.type = 'sine'; o2.frequency.value = f * 2; o2.detune.value = 4;
      var g2 = c.createGain(); g2.gain.value = 0.25;
      var peak = last ? 0.22 : 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o1.connect(g); o2.connect(g2); g2.connect(g); g.connect(master);
      o1.start(t); o2.start(t); o1.stop(t + len + 0.02); o2.stop(t + len + 0.02);
      cleanup(o1, [o1, o2, g, g2]);
    });
    // Sparkle: tiny high glints after the last note
    var sStart = t0 + (notes.length - 1) * step + 0.04;
    for (var i = 0; i < 6; i++) {
      var t = sStart + i * rand(0.04, 0.07);
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine';
      o.frequency.value = rand(3200, 6200);
      var v = 0.05 * (1 - i / 7);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.1);
      cleanup(o, [o, g]);
    }
  }

  // ---- click: soft UI pop -----------------------------------------------------
  function click() {
    if (!ready()) return;
    var c = ctx, t = c.currentTime + 0.005;
    var o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(rand(820, 900), t);
    o.frequency.exponentialRampToValueAtTime(360, t + 0.045);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + 0.07);
    cleanup(o, [o, g]);

    var n = c.createBufferSource(), f = c.createBiquadFilter(), ng = c.createGain();
    n.buffer = getNoise();
    f.type = 'highpass'; f.frequency.value = 3000;
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(0.05, t + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    n.connect(f); f.connect(ng); ng.connect(master);
    n.start(t, Math.random() * 0.5); n.stop(t + 0.02);
    cleanup(n, [n, f, ng]);
  }

  // ---- mute -----------------------------------------------------------------
  function setMuted(v) {
    muted = !!v;
    writeMuted(muted);
    if (ctx && master) {
      var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(muted ? 0 : MASTER_VOLUME, t + 0.02);
    }
    if (muted) {
      // Cut any in-flight loop voices. Loops stay logically "on" (no new audio
      // is scheduled while muted) and resume automatically on unmute.
      talk._silence();
      type._silence();
    }
  }
  function isMuted() { return muted; }

  // Keep in sync if another tab changes the setting.
  if (global.addEventListener) {
    global.addEventListener('storage', function (e) {
      if (e.key === STORAGE_KEY) setMuted(e.newValue === '1');
    });
  }

  global.LinkabaraSounds = {
    talk: talk,
    type: type,
    done: done,
    click: click,
    setMuted: setMuted,
    isMuted: isMuted,
    unlock: unlock,
  };
})(typeof window !== 'undefined' ? window : undefined);
