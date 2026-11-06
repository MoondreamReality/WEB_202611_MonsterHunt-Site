/* mh-audio.js — 霧城怪獸搜查令 聲音系統 v1
   ・全部聲音用 Web Audio 即時合成 8-bit 晶片音色（不需要音檔）
   ・之後若在 sounds/ 放入同名音檔並列在 sounds/manifest.json，會自動改用音檔
   ・靜音狀態記在手機裡；iPhone 側邊的靜音開關打開時，網頁聲音也會被靜音 */
(function () {
  'use strict';
  // 先抓原生計時器：換頁時 dcmini 會清掉頁面計時器，聲音排程不能被清掉
  const _setTimeout = window.setTimeout.bind(window);
  const _setInterval = window.setInterval.bind(window);
  const _clearTimeout = window.clearTimeout.bind(window);

  const KEY = 'mfhunt.mute';
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch (e) {}

  let ctx = null, master = null, sfxBus = null, bgmBus = null, noiseBuf = null;
  const files = {};          // id → AudioBuffer（音檔覆蓋）
  const VOL = { sfx: 0.6, bgm: 0.11 };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = VOL.sfx; sfxBus.connect(master);
    bgmBus = ctx.createGain(); bgmBus.gain.value = VOL.bgm; bgmBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    loadManifest();
    return ctx;
  }
  function ready() { return ctx && ctx.state === 'running'; }
  function unlock() {
    const c = ensure();
    if (!c) return;
    if (c.state !== 'running') c.resume().catch(() => {});
    // iOS 需要在手勢內播一個無聲音才真正解鎖
    try { const b = c.createBuffer(1, 1, 22050); const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
  }
  ['pointerdown', 'touchend', 'keydown'].forEach((t) => window.addEventListener(t, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });

  function loadManifest() {
    fetch('sounds/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)).then((m) => {
      if (!m) return;
      Object.keys(m).forEach((id) => {
        fetch('sounds/' + m[id]).then((r) => r.arrayBuffer()).then((ab) => ctx.decodeAudioData(ab)).then((buf) => { files[id] = buf; }).catch(() => {});
      });
    }).catch(() => {});
  }

  // ---------- 合成用的小工具 ----------
  function env(g, t, a, peak, d, end) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, end || 0.0001), t + a + d);
  }
  function tone(t, o) {
    const osc = ctx.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.slide || o.d));
    const g = ctx.createGain();
    env(g, t, o.a || 0.004, o.v == null ? 0.3 : o.v, o.d);
    osc.connect(g); g.connect(o.bus || sfxBus);
    osc.start(t); osc.stop(t + (o.a || 0.004) + o.d + 0.05);
    return osc;
  }
  function noise(t, o) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1200, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    f.Q.value = o.q || 0.8;
    const g = ctx.createGain();
    env(g, t, o.a || 0.003, o.v == null ? 0.3 : o.v, o.d);
    src.connect(f); f.connect(g); g.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.5); src.stop(t + (o.a || 0.003) + o.d + 0.05);
  }
  const N = (m) => 440 * Math.pow(2, (m - 69) / 12);
  function arp(t, notes, step, o) { notes.forEach((m, i) => tone(t + i * step, Object.assign({ f: N(m), d: step * 1.2, v: 0.22 }, o))); }

  // ---------- 音效表：id → { name, scene, play(t) } ----------
  const S = {
    tap:      { name: '一般按鈕', scene: '所有按鈕／連結', play: (t) => tone(t, { f: 1100, d: 0.045, v: 0.24 }) },
    confirm:  { name: '主要按鈕', scene: '黃色按鈕（開始搜查、開啟相機、收進圖鑑…）', play: (t) => { tone(t, { f: 660, d: 0.05, v: 0.22 }); tone(t + 0.06, { f: 990, d: 0.08, v: 0.22 }); } },
    back:     { name: '返回／取消', scene: '關閉、取消、繼續搜查', play: (t) => { tone(t, { f: 700, d: 0.05, v: 0.18 }); tone(t + 0.06, { f: 470, d: 0.07, v: 0.18 }); } },
    nav:      { name: '底部選單', scene: '搜查／圖鑑／寶藏 icon', play: (t) => { tone(t, { type: 'triangle', f: 1500, d: 0.03, v: 0.3 }); tone(t + 0.035, { type: 'triangle', f: 2000, d: 0.04, v: 0.25 }); } },
    error:    { name: '錯誤', scene: '寶藏未解鎖、代碼錯誤、掃到非怪獸 QR', play: (t) => { tone(t, { f: 150, f2: 110, d: 0.09, v: 0.28 }); tone(t + 0.12, { f: 150, f2: 100, d: 0.14, v: 0.28 }); } },
    type:     { name: '打字機', scene: '開場對話框逐字出現', play: (t) => tone(t, { f: 1700 + Math.random() * 300, d: 0.016, v: 0.1 }) },
    crtOn:    { name: '舊電視開機', scene: '開場：搜查令視窗閃現', play: (t) => { noise(t, { filter: 'highpass', f: 3000, d: 0.12, v: 0.25 }); tone(t + 0.02, { type: 'sine', f: 60, f2: 1400, d: 0.32, v: 0.22 }); } },
    pop:      { name: '彈出', scene: '按鈕、提示出現', play: (t) => tone(t, { f: 420, f2: 980, d: 0.07, v: 0.16 }) },
    buzz:     { name: '對話框抖動', scene: '「我說的都是真的……QAQ」', play: (t) => { const o = tone(t, { f: 95, d: 0.6, v: 0.16, a: 0.02 }); const l = ctx.createOscillator(); const lg = ctx.createGain(); l.frequency.value = 18; lg.gain.value = 25; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.7); } },
    whoosh:   { name: '咻（飛入）', scene: '信封飛入、物件進場', play: (t) => noise(t, { f: 2600, f2: 380, d: 0.42, v: 0.7, q: 0.8, a: 0.08 }) },
    thud:     { name: '落定', scene: '信封落在定位', play: (t) => { tone(t, { type: 'sine', f: 140, f2: 50, d: 0.16, v: 0.45 }); noise(t, { filter: 'lowpass', f: 900, d: 0.06, v: 0.2 }); } },
    rustle:   { name: '紙張翻動', scene: '搜查令展開', play: (t) => { [0, 0.11, 0.25].forEach((x) => noise(t + x, { filter: 'highpass', f: 2500 + Math.random() * 1500, d: 0.07, v: 0.16 })); } },
    stamp:    { name: '蓋章', scene: '印章「砰」地蓋下、工作人員兌換', play: (t) => { tone(t, { type: 'sine', f: 110, f2: 38, d: 0.3, v: 0.7 }); noise(t, { filter: 'lowpass', f: 700, d: 0.14, v: 0.45 }); tone(t, { f: 70, d: 0.08, v: 0.2 }); } },
    wind:     { name: '風吹', scene: '搜查令被風吹走', play: (t) => noise(t, { filter: 'bandpass', f: 400, f2: 1800, d: 1.1, v: 0.8, q: 0.5, a: 0.25 }) },
    slap:     { name: '貼紙張', scene: '嫌犯檔案貼上牆', play: (t) => { noise(t, { filter: 'highpass', f: 1800, d: 0.05, v: 0.3 }); tone(t, { type: 'sine', f: 180, f2: 90, d: 0.06, v: 0.25 }); } },
    pin:      { name: '圖釘', scene: '圖釘釘上', play: (t) => { tone(t, { type: 'triangle', f: 2400, d: 0.03, v: 0.22 }); tone(t + 0.03, { type: 'triangle', f: 3300, d: 0.04, v: 0.16 }); } },
    twang:    { name: '拉紅線', scene: '紅線拉出', play: (t) => tone(t, { type: 'sawtooth', f: 330, f2: 220, d: 0.16, v: 0.2 }) },
    zip:      { name: '拉封鎖線', scene: '封鎖線拉進畫面、轉場', play: (t) => noise(t, { f: 700, f2: 3200, d: 0.24, v: 0.9, q: 1.4 }) },
    paper:    { name: '拿起紙張', scene: '放大／收起搜查清單', play: (t) => { noise(t, { filter: 'highpass', f: 2200, d: 0.08, v: 0.2 }); tone(t + 0.02, { f: 760, d: 0.04, v: 0.1 }); } },
    pickup:   { name: '拿起放大鏡', scene: '長按集氣完成', play: (t) => arp(t, [76, 83, 88], 0.045, { v: 0.2 }) },
    drop:     { name: '放大鏡歸位', scene: '放開放大鏡', play: (t) => arp(t, [84, 79, 72], 0.05, { v: 0.16 }) },
    scanOpen: { name: '相機開啟', scene: '掃描器出現', play: (t) => { tone(t, { f: 1250, d: 0.05, v: 0.18 }); tone(t + 0.09, { f: 1250, d: 0.05, v: 0.18 }); } },
    lock:     { name: '鎖定 QR', scene: '傳送轉場：準心收攏', play: (t) => tone(t, { f: 300, f2: 1400, d: 0.25, v: 0.16 }) },
    flash:    { name: '閃爍', scene: '傳送轉場：畫面閃動', play: (t) => tone(t, { f: 1500, d: 0.035, v: 0.14 }) },
    alert:    { name: '「!!」', scene: '傳送轉場：發現！', play: (t) => { tone(t, { f: 880, d: 0.06, v: 0.24 }); tone(t + 0.07, { f: 1320, d: 0.1, v: 0.24 }); } },
    burst:    { name: '粒子爆開', scene: '傳送轉場：QR 碎裂', play: (t) => { noise(t, { filter: 'lowpass', f: 3000, f2: 300, d: 0.35, v: 0.35 }); arp(t + 0.02, [96, 91, 88, 84, 79], 0.035, { v: 0.12 }); } },
    gather:   { name: '粒子聚合', scene: '傳送轉場：聚成怪獸', play: (t) => { noise(t, { f: 300, f2: 3500, d: 0.5, v: 0.6, q: 1, a: 0.2 }); tone(t, { type: 'triangle', f: 200, f2: 900, d: 0.5, v: 0.12 }); } },
    land:     { name: '怪獸現身', scene: '傳送轉場：粒子落定', play: (t) => arp(t, [84, 88, 91, 96], 0.05, { type: 'triangle', v: 0.25 }) },
    zoom:     { name: '畫框放大', scene: '傳送轉場：框框擴大（4 段）', play: (t, i) => tone(t, { f: N([72, 76, 79, 84][i || 0]), d: 0.06, v: 0.16 }) },
    pinPop:   { name: '拔圖釘', scene: '冷知識欄：圖釘拔起', play: (t) => tone(t, { f: 500, f2: 1600, d: 0.06, v: 0.16 }) },
    slide:    { name: '滑入', scene: '冷知識欄：新卡片滑入', play: (t) => noise(t, { f: 900, f2: 2400, d: 0.18, v: 0.7, q: 1 }) },
    tvOn:     { name: '電視開機', scene: '圖鑑：打開怪獸資訊卡', play: (t) => { tone(t, { type: 'sine', f: 180, f2: 2200, d: 0.18, v: 0.2 }); noise(t + 0.05, { filter: 'highpass', f: 4000, d: 0.12, v: 0.12 }); } },
    tvOff:    { name: '電視關機', scene: '圖鑑：關閉資訊卡', play: (t) => { tone(t, { type: 'sine', f: 1800, f2: 90, d: 0.2, v: 0.2 }); tone(t + 0.21, { f: 2400, d: 0.02, v: 0.1 }); } },
    tick:     { name: '捲動', scene: '圖鑑：上下捲動', play: (t) => tone(t, { type: 'triangle', f: 1900, d: 0.02, v: 0.18 }) },
    rattle:   { name: '鐵鍊晃動', scene: '寶箱搖晃、未解鎖寶箱', play: (t) => { for (let i = 0; i < 6; i++) { tone(t + i * 0.07, { type: 'triangle', f: 2600 + Math.random() * 900, d: 0.025, v: 0.12 }); noise(t + i * 0.07, { filter: 'highpass', f: 5000, d: 0.02, v: 0.08 }); } } },
    bang:     { name: '碰！寶箱打開', scene: '寶藏解鎖', play: (t) => { noise(t, { filter: 'lowpass', f: 2200, f2: 120, d: 0.7, v: 0.6 }); tone(t, { type: 'sine', f: 160, f2: 35, d: 0.45, v: 0.7 }); } },
    coin:     { name: '金幣', scene: '代幣跳出', play: (t) => { tone(t, { f: N(83), d: 0.07, v: 0.22 }); tone(t + 0.07, { f: N(88), d: 0.35, v: 0.22 }); } },
    sparkle:  { name: '閃亮', scene: '代幣閃光', play: (t) => arp(t, [96, 100, 103, 108], 0.04, { type: 'triangle', v: 0.12 }) },
    jCatch:   { name: '收服成功（短樂句）', scene: '發現怪獸', jingle: true, play: (t) => { arp(t, [72, 76, 79, 84], 0.09, { v: 0.24 }); tone(t + 0.4, { f: N(88), d: 0.5, v: 0.24 }); arp(t, [48, 55], 0.2, { type: 'triangle', v: 0.35, d: 0.3 }); } },
    jAgain:   { name: '已收服過', scene: '發現怪獸（重複掃描）', jingle: true, play: (t) => { tone(t, { f: N(79), d: 0.1, v: 0.2 }); tone(t + 0.12, { f: N(84), d: 0.25, v: 0.2 }); } },
    jUnlock:  { name: '寶藏解鎖（樂句）', scene: '寶藏解鎖對話框', jingle: true, play: (t) => { arp(t, [72, 76, 79, 72, 76, 79, 84], 0.08, { v: 0.22 }); tone(t + 0.6, { f: N(88), d: 0.8, v: 0.22 }); tone(t + 0.6, { f: N(91), d: 0.8, v: 0.14 }); arp(t, [48, 52, 55, 60], 0.15, { type: 'triangle', v: 0.35 }); } },
    jSubmit:  { name: '送出登記', scene: '領取登記送出', jingle: true, play: (t) => arp(t, [79, 84, 88], 0.07, { v: 0.2 }) }
  };

  // ---------- 背景音樂（循環） ----------
  // 每格＝8 分音符；null＝休止
  const _ = null;
  const TRACKS = {
    search: {
      name: '搜查主題（A 小調，偵探感）', bpm: 112,
      lead: [69,_,72,76,_,74,72,71, 69,_,_,72,77,76,_,72, 67,_,72,76,79,_,76,74, 71,_,68,_,64,_,_,_,
             69,72,76,81,_,79,76,72, 77,_,76,74,72,_,69,_, 74,_,77,_,81,79,77,76, 76,74,72,71,68,_,_,_],
      bass: [45,52,45,52, 41,48,41,48, 48,43,48,43, 40,47,40,44, 45,52,45,52, 41,48,41,48, 38,45,38,45, 40,47,40,44]
    },
    treasure: {
      name: '寶藏主題（C 大調，慶祝）', bpm: 128,
      lead: [72,76,79,84,79,76,72,76, 71,74,79,83,79,74,71,74, 69,72,76,81,76,72,69,72, 69,72,77,81,79,77,76,74],
      bass: [48,55,48,55, 43,50,43,50, 45,52,45,52, 41,48,41,48]
    }
  };
  let bgm = { id: null, timer: null, step: 0, next: 0, gain: null };
  function stopBgm() {
    if (bgm.timer) clearInterval(bgm.timer);
    if (bgm.src) { try { bgm.src.stop(); } catch (e) {} }
    if (bgm.gain && ctx) { const g = bgm.gain; g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15); _setTimeout(() => { try { g.disconnect(); } catch (e) {} }, 800); }
    bgm = { id: null, timer: null, step: 0, next: 0, gain: null };
  }
  function startBgm(id) {
    if (bgm.id === id) return;
    stopBgm();
    const tr = TRACKS[id];
    if (!tr || !ensure()) return;
    const g = ctx.createGain(); g.gain.value = 0.0001; g.connect(bgmBus);
    g.gain.setTargetAtTime(1, ctx.currentTime + 0.05, 0.4);
    bgm = { id, timer: null, step: 0, next: ctx.currentTime + 0.1, gain: g };
    if (files['bgm_' + id]) {   // 音檔覆蓋
      const s = ctx.createBufferSource(); s.buffer = files['bgm_' + id]; s.loop = true; s.connect(g); s.start();
      bgm.src = s;
      return;
    }
    const e8 = 60 / tr.bpm / 2;
    bgm.timer = _setInterval(() => {
      if (!ctx || ctx.state !== 'running') { bgm.next = ctx ? ctx.currentTime + 0.05 : 0; return; }
      while (bgm.next < ctx.currentTime + 0.2) {
        const i = bgm.step, t = bgm.next;
        const m = tr.lead[i % tr.lead.length];
        if (m != null) tone(t, { f: N(m), d: e8 * 0.85, v: 0.22, bus: g });
        if (i % 2 === 0) { const b = tr.bass[(i / 2) % tr.bass.length]; tone(t, { type: 'triangle', f: N(b), d: e8 * 1.7, v: 0.5, bus: g }); }
        if (i % 2 === 1) noise(t, { filter: 'highpass', f: 7000, d: 0.03, v: 0.12, bus: g });
        if (i % 4 === 0) tone(t, { type: 'sine', f: 120, f2: 45, d: 0.12, v: 0.45, bus: g });
        bgm.step++; bgm.next += e8;
      }
    }, 25);
  }
  function duck(sec) {
    if (!bgmBus || !ctx) return;
    const t = ctx.currentTime;
    bgmBus.gain.cancelScheduledValues(t);
    bgmBus.gain.setTargetAtTime(VOL.bgm * 0.25, t, 0.05);
    bgmBus.gain.setTargetAtTime(VOL.bgm, t + sec, 0.3);
  }

  // ---------- 對外介面 ----------
  let lastType = 0;
  function play(id, delay, arg) {
    if (!ensure() || !ready()) return;
    const s = S[id];
    if (!s) return;
    if (id === 'type') { const now = performance.now(); if (now - lastType < 38) return; lastType = now; }
    const t = ctx.currentTime + Math.max(0, (delay || 0) / 1000) + 0.005;
    if (files[id]) { const src = ctx.createBufferSource(); src.buffer = files[id]; src.connect(sfxBus); src.start(t); }
    else { try { s.play(t, arg); } catch (e) {} }
    if (s.jingle) duck(1.6 + (delay || 0) / 1000);
  }
  // 長按集氣：回傳停止函式
  function charge() {
    if (!ensure() || !ready()) return () => {};
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(280, t); o.frequency.linearRampToValueAtTime(900, t + 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1, t + 0.05);
    o.connect(g); g.connect(sfxBus); o.start(t);
    return () => { const n = ctx.currentTime; g.gain.cancelScheduledValues(n); g.gain.setTargetAtTime(0.0001, n, 0.02); o.stop(n + 0.15); };
  }
  function setMuted(v) {
    muted = !!v;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.03);
    document.querySelectorAll('.mh-mute').forEach(paintMute);
  }

  // ---------- 靜音按鈕 ----------
  const ICON_ON = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 7h4l5-4v14l-5-4H3z" fill="#111"/><path d="M14 7c1.2 1.6 1.2 4.4 0 6M16 5c2.2 2.8 2.2 7.2 0 10" fill="none" stroke="#111" stroke-width="2"/></svg>';
  const ICON_OFF = '<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true"><path d="M3 7h4l5-4v14l-5-4H3z" fill="#111"/><path d="M14 7l5 6M19 7l-5 6" fill="none" stroke="#111" stroke-width="2"/></svg>';
  function paintMute(b) {
    b.innerHTML = muted ? ICON_OFF : ICON_ON;
    b.setAttribute('aria-label', muted ? '開啟聲音' : '關閉聲音');
    b.setAttribute('aria-pressed', muted ? 'true' : 'false');
    b.classList.toggle('is-off', muted);
  }
  function muteButton() {
    if (document.querySelector('.mh-mute.mh-fixed')) return;
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'mh-mute mh-fixed';
    b.addEventListener('click', (e) => { e.stopPropagation(); unlock(); setMuted(!muted); if (!muted) play('tap'); });
    paintMute(b);
    document.body.appendChild(b);
  }

  // ---------- 開始畫面（解鎖聲音用）：只在直接開啟開場頁時出現 ----------
  function gate() {
    return new Promise((resolve) => {
      const g = document.createElement('div');
      g.className = 'mh-gate';
      g.innerHTML =
        '<div class="mh-gate-box"><p class="mh-gate-title">霧城怪獸搜查令</p>' +
        '<button type="button" class="mh-btn mh-yellow mh-gate-go">點一下開始</button>' +
        '<p class="mh-gate-tip">建議開啟聲音遊玩</p></div>';
      const go = () => { unlock(); g.remove(); resolve(); };
      g.querySelector('.mh-gate-go').addEventListener('click', go);
      document.body.appendChild(g);
    });
  }

  window.MHSound = { play, charge, startBgm, stopBgm, setMuted, isMuted: () => muted, unlock, ready, gate, muteButton, list: S, tracks: TRACKS, _setTimeout, _clearTimeout };
})();
