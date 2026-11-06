/* mh-cues.js — 音效對照：哪個按鈕、哪段動畫要發出哪個聲音
   ・按鈕：全頁統一處理（黃色主要按鈕、返回、底部選單、一般按鈕）
   ・動畫：看畫面狀態的變化，或讀畫面元素實際的動畫延遲時間來排程 */
(function () {
  'use strict';
  const S = () => window.MHSound;
  const play = (id, delay, arg) => { const s = S(); if (s) s.play(id, delay, arg); };
  const later = (ms, fn) => setTimeout(fn, ms);   // 頁面計時器：換頁時會一起被清掉

  // ---------- 按鈕：統一處理 ----------
  const BACK_WORDS = /取消|關閉|返回|繼續搜查|先這樣玩/;
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('button, a[href], [role="button"]');
    if (!el || el.classList.contains('mh-mute') || el.classList.contains('mh-gate-go') || el.getAttribute('aria-hidden') === 'true') return;
    if (el.closest('nav')) return play('nav');
    const label = (el.getAttribute('aria-label') || el.textContent || '').trim();
    if (/鎖定中|上鎖|鎖住/.test(label)) return;   // 未解鎖時只放錯誤音（由頁面處理）
    if (BACK_WORDS.test(label)) return play('back');
    const bg = (el.getAttribute('style') || '') + ' ' + el.className;
    if (/#ffd23f|mh-yellow/i.test(bg)) return play('confirm');
    play('tap');
  }, true);

  // 依元素的動畫延遲時間排程音效（例如嫌犯檔案依序貼上）
  function byAnimation(selector, id, opts) {
    const app = document.getElementById('app');
    const els = Array.from(app.querySelectorAll(selector)).filter((n) => !n.closest('[data-mag]') && !(opts && opts.skip && opts.skip(n)));
    const seen = new Set();
    els.forEach((n, i) => {
      const d = getComputedStyle(n).animationDelay.split(',')[0];
      const ms = Math.round(parseFloat(d) * (d.indexOf('ms') > 0 ? 1 : 1000)) || 0;
      const key = Math.round(ms / 30);
      if (seen.has(key) || (opts && opts.max && seen.size >= opts.max)) return;
      seen.add(key);
      play(id, ms + ((opts && opts.offset) || 0), i);
    });
  }
  const rose = (prev, cur, k) => !prev[k] && cur[k];
  const fell = (prev, cur, k) => prev[k] && !cur[k];
  const changed = (prev, cur, k) => (prev[k] || '') !== (cur[k] || '');

  const PAGES = {
    // ---------- 01 開場 ----------
    index: {
      bgm: 'search',
      mount(c) { this.c = c; this.stop = null; },
      update(c, p) {
        const s = c.state;
        if (changed(p, s, 'stage')) {
          switch (s.stage) {
            case 'crt': play('crtOn'); break;
            case 'choice': case 'doubtChoice': play('pop'); break;
            case 'letter': if (!s.landed) play('whoosh'); break;
            case 'unfold': play('rustle'); play('rustle', 900); play('rustle', 1800); break;
            case 'stamp': play('whoosh', 0); break;
            case 'stamped': play('pop'); break;
            case 'wind': play('wind'); break;
            case 'end':
              later(30, () => {
                byAnimation('.slapin', 'slap');
                byAnimation('.pinin', 'pin');
                byAnimation('.drawline', 'twang', { max: 6 });
                byAnimation('.pulltape', 'zip', { max: 5 });
                byAnimation('.magin', 'whoosh', { max: 1 });
              });
              break;
          }
        }
        if (s.typed > (p.typed || 0) && s.typed < (s.text || '').length + 1) play('type');
        if (rose(p, s, 'dshake') || rose(p, s, 'shaking') && s.stage === 'doubt') play('buzz');
        if (rose(p, s, 'landed') && s.stage === 'letter') play('thud');
        if (rose(p, s, 'marked') && s.stage === 'stamp') play('stamp');
        if (changed(p, s, 'zoomList')) play('paper');
        if (rose(p, s, 'pressing')) { if (this.stop) this.stop(); this.stop = S() ? S().charge() : null; }
        if (fell(p, s, 'pressing') && this.stop) { this.stop(); this.stop = null; }
        if (rose(p, s, 'dragging')) play('pickup');
        if (fell(p, s, 'dragging')) play('drop');
        if (rose(p, s, 'go')) { [0, 70, 140, 210, 300, 380].forEach((d) => play('zip', d)); [900, 980, 1060].forEach((d) => play('zip', d)); }
      }
    },
    // ---------- 02 搜查模式 ----------
    scan: {
      bgm: 'search',
      update(c, p) {
        const s = c.state;
        if (changed(p, s, 'phase')) {
          if (s.phase === 'bounce') play('pop');
          if (s.phase === 'pull') play('pinPop');
          if (s.phase === 'blow') play('whoosh');
          if (s.phase === 'in') play('slide');
        }
        const a = p.fxT, b = s.fxT;
        if (b != null && b !== a) {
          const from = a == null ? -1 : a;
          const at = (ms) => from < ms && b >= ms;
          if (at(0)) play('lock');
          [250, 350, 450].forEach((ms) => { if (at(ms)) play('flash'); });
          if (at(450)) play('alert');
          if (at(600)) play('burst');
          if (at(1100)) play('gather');
          if (at(1600)) play('land');
          [1800, 1900, 2000, 2100].forEach((ms, i) => { if (at(ms)) play('zoom', 0, i); });
        }
      }
    },
    // ---------- 03 發現怪獸 ----------
    catch: {
      bgm: 'search',
      mount(c) {
        const r = c.r || {};
        if (r.status === 'new') play('jCatch', 250);
        else if (r.status === 'again') play('jAgain', 200);
        else play('error', 200);
      }
    },
    // ---------- 04 怪獸圖鑑 ----------
    dex: {
      bgm: 'search',
      update(c, p) {
        const s = c.state;
        if (changed(p, s, 'cardPhase')) {
          if (s.cardPhase === 'open') play('tvOn');
          if (s.cardPhase === 'closing') play('tvOff');
        }
        if (rose(p, s, 'lockErr')) play('error');
      }
    },
    // ---------- 05 寶藏解鎖 ----------
    reward: {
      bgm: null,   // 這頁自己控制：先停音樂 → 鼓聲 → 碰！→ 成就樂句 → 換歡快背景樂
      mount() {
        const s = S();
        if (s) s.stopBgm(true);
        play('drumroll', 40);
        play('bang', 1400);
        play('coin', 1500);
        play('jAchieve', 1650);
        play('sparkle', 2750);
        play('whoosh', 3300);
        if (s) s.startBgm('treasure', 3.6);
      },
      update(c, p) {
        const s = c.state;
        if (rose(p, s, 'claimed')) play('jSubmit');
        if (rose(p, s, 'redeemed')) { play('stamp'); play('coin', 250); }
      }
    },
    // ---------- 06 寶藏未解鎖 ----------
    locked: {
      bgm: 'search',
      mount() { play('rattle', 350); },
      update(c, p) { if (rose(p, c.state, 'err')) { play('error'); play('rattle', 80); } }
    }
  };

  window.MHCues = {
    mount(id, comp) {
      const P = PAGES[id];
      if (S() && P && P.bgm) S().startBgm(P.bgm);
      if (P && P.mount) P.mount(comp);
    },
    update(id, comp, prev) {
      const P = PAGES[id];
      if (P && P.update && prev) P.update(comp, prev);
    }
  };
})();
