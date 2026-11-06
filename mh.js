/* mh.js — 遊戲共用資料與功能：怪獸名冊、收服進度、除錯模式、內建瀏覽器提示、QR 掃描器 */
(function () {
  'use strict';
  const ROSTER = [
 {
  "no": 1,
  "name": "炭吉",
  "fill": "solid",
  "img": "img/01.png",
  "type": "吉祥物",
  "trait": "能變成各種造型",
  "seen": "館內四處飄",
  "note": "場館的吉祥物，會保佑大家賺大錢。身體像水球，哪裡都關不住他，常常調皮搗蛋。開心時會跳起來，館長很希望他跳的時候順便掉兩枚金幣。",
  "catchLine": "會保佑大家賺大錢的場館吉祥物。",
  "key": "PN6JB"
 },
 {
  "no": 2,
  "name": "可可 Koko",
  "fill": "h",
  "img": "img/02.png",
  "type": "無尾熊",
  "trait": "溫暖又善良",
  "seen": "魔法森林",
  "note": "懶懶的哥哥。和妹妹一起住在魔法森林，認識了山山和斑斑之後，每天都一起四處冒險，開心地學英文！",
  "catchLine": "溫暖又善良的無尾熊哥哥。",
  "key": "YTFSU"
 },
 {
  "no": 3,
  "name": "懶懶 Lanlan",
  "fill": "v",
  "img": "img/03.png",
  "type": "樹懶",
  "trait": "有點愛賴床",
  "seen": "魔法森林",
  "note": "可可的妹妹，愛做夢的小迷糊蛋。每天都要大樹奶奶 Morning Call 才起得來，最喜歡和哥哥、山山、斑斑在魔法森林裡玩耍。",
  "catchLine": "有點愛賴床的樹懶妹妹。",
  "key": "E92U9"
 },
 {
  "no": 4,
  "name": "諦聽",
  "fill": "solid",
  "img": "img/04.png",
  "type": "神獸",
  "trait": "非常愛撒嬌",
  "seen": "地府",
  "note": "地藏王菩薩身旁的神獸，能辨別真偽、明察善惡。平時在地府四處閒晃，偶爾嘴饞、偶爾偷懶，還會主動靠近旅客撒嬌。想摸摸諦聽，就一起下地獄吧！",
  "catchLine": "生活在地府、超愛撒嬌的神祕犬獸。",
  "key": "7ZU5V"
 },
 {
  "no": 5,
  "name": "橘毛猴",
  "fill": "h",
  "img": "img/05.png",
  "type": "待補",
  "trait": "頭頂一撮橘毛",
  "seen": "待補",
  "note": "（資料待補）白色臉蛋的小猴子，頭頂有一撮翹起來的橘色毛，總是張大嘴巴笑得很開心。",
  "catchLine": "頭頂一撮橘毛的小猴子。",
  "key": "P3KGQ"
 },
 {
  "no": 6,
  "name": "粉粉蟲",
  "fill": "v",
  "img": "img/06.png",
  "type": "待補",
  "trait": "頭上兩顆黃球",
  "seen": "待補",
  "note": "（資料待補）粉紅色的圓頭小毛毛蟲，頭上有兩根掛著黃色小球的觸角，紅通通的臉頰總是笑嘻嘻。",
  "catchLine": "頭上有兩顆黃球的小毛毛蟲。",
  "key": "4JNFV"
 },
 {
  "no": 7,
  "name": "鐵達尼",
  "fill": "solid",
  "img": "img/07.png",
  "type": "待補",
  "trait": "四根大煙囪",
  "seen": "待補",
  "note": "（資料待補）豪華郵輪，白色船艙上立著四根橘色大煙囪，黑色船身配上紅色船底。",
  "catchLine": "有四根大煙囪的豪華郵輪。",
  "key": "AA8U2"
 },
 {
  "no": 8,
  "name": "石虎",
  "fill": "h",
  "img": "img/08.png",
  "type": "野生貓科",
  "trait": "額頭兩條白紋",
  "seen": "待補",
  "note": "台灣僅存的原生野生貓科動物。最好認的是從眼角延伸到額頭的兩條白色條紋，還有耳朵背面的白斑。",
  "catchLine": "台灣僅存的原生野生貓科動物。",
  "key": "WALT5"
 },
 {
  "no": 9,
  "name": "河馬",
  "fill": "solid",
  "img": "img/09.png",
  "type": "馬戲團舞者",
  "trait": "最會套圈圈",
  "seen": "待補",
  "note": "從知名馬戲團挖角來的一級舞者，最擅長玩套圈圈。牠帶領的河馬舞團享譽國際，來夢境現實的話，一定要買票瞧瞧喔！",
  "catchLine": "最會套圈圈的馬戲團一級舞者。",
  "key": "QHZ9C"
 }
];
  const TOTAL = ROSTER.length;
  const P = 'mfhunt.';
  const ls = {
    get(k) { try { return window.localStorage.getItem(P + k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(P + k, String(v)); } catch (e) {} }
  };
  let ss = null; try { ss = window.sessionStorage; } catch (e) {}

  // ?debug=1 開啟除錯工具（同一個分頁內有效），?debug=0 關閉
  let q = new URLSearchParams(location.search);
  if (q.get('debug') === '1') { try { ss.setItem(P + 'debug', '1'); } catch (e) {} }
  if (q.get('debug') === '0') { try { ss.removeItem(P + 'debug'); } catch (e) {} }
  let debug = false; try { debug = ss.getItem(P + 'debug') === '1'; } catch (e) {}

  function caughtList() {
    try { const v = JSON.parse(ls.get('caught') || 'null'); return Array.isArray(v) ? v : null; } catch (e) { return null; }
  }
  function saveCaught(list) {
    const uniq = Array.from(new Set(list)).filter((n) => n >= 1 && n <= TOTAL).sort((a, b) => a - b);
    ls.set('caught', JSON.stringify(uniq));
    ls.set('collected', uniq.length);
    return uniq;
  }

  const MH = {
    roster: ROSTER,
    total: TOTAL,
    debug,
    caughtList,
    caughtCount() { const l = caughtList(); return l ? l.length : 0; },
    isCaught(no, gotFallback) { const l = caughtList(); return l ? l.indexOf(no) >= 0 : no <= (gotFallback || 0); },
    setCaughtCount(n) { const l = []; for (let i = 1; i <= n; i++) l.push(i); saveCaught(l); },
    /** 驗證 QR 內容，回傳怪獸編號或 0 */
    parseCode(text) {
      if (!text) return 0;
      let m = null, k = null;
      try {
        const u = new URL(String(text).trim(), location.href);
        m = u.searchParams.get('m'); k = u.searchParams.get('k');
      } catch (e) { return 0; }
      const no = parseInt(m, 10);
      const mon = ROSTER[no - 1];
      return mon && k && k.toUpperCase() === mon.key ? no : 0;
    },
    /** 收服頁：讀網址上的 m、k，記錄進度 */
    handleCatchUrl() {
      const no = MH.parseCode(location.href);
      if (!no) {
        if (debug && q.get('m')) { const d = parseInt(q.get('m'), 10); if (ROSTER[d - 1]) return MH._record(d); }
        // 重新整理收服頁時網址已清掉代碼：顯示同一次的結果
        if (!q.get('m')) {
          try {
            const last = JSON.parse(ss.getItem(P + 'lastCatch') || 'null');
            if (last && ROSTER[last.no - 1]) return { status: last.status, mon: ROSTER[last.no - 1], got: MH.caughtCount() };
          } catch (e) {}
        }
        return { status: 'invalid', mon: null, got: MH.caughtCount() };
      }
      return MH._record(no);
    },
    _record(no) {
      const before = caughtList() || [];
      const again = before.indexOf(no) >= 0;
      const after = saveCaught(before.concat([no]));
      const status = again ? 'again' : 'new';
      try { ss.setItem(P + 'lastCatch', JSON.stringify({ no, status })); } catch (e) {}
      try { history.replaceState(null, '', location.pathname); } catch (e) {}
      return { status, mon: ROSTER[no - 1], got: after.length };
    },
    refresh() { q = new URLSearchParams(location.search); },
    catchUrl(no) {
      const mon = ROSTER[no - 1];
      return 'catch.html?m=' + String(no).padStart(2, '0') + '&k=' + mon.key;
    }
  };
  window.MH = MH;
  const snd = (id) => { try { window.MHSound && window.MHSound.play(id); } catch (e) {} };

  // ---------- 內建瀏覽器（LINE / FB / IG）提示 ----------
  const ua = navigator.userAgent || '';
  const inLine = / Line\//i.test(ua);
  const inApp = inLine || /FBAN|FBAV|FB_IAB|Instagram|Messenger/i.test(ua);
  MH.inApp = inApp;
  function banner() {
    if (!inApp) return;
    try { if (ss.getItem(P + 'inappDismissed') === '1') return; } catch (e) {}
    const b = document.createElement('div');
    b.className = 'mh-inapp';
    b.setAttribute('role', 'alert');
    const ext = location.href + (location.search ? '&' : '?') + 'openExternalBrowser=1';
    b.innerHTML =
      '<p>你正在 App 內建瀏覽器裡玩。<br>建議改用 <b>Safari 或 Chrome</b> 開啟，<br>相機掃描比較順，收服進度也不會不見。</p>' +
      '<div class="mh-row">' +
      (inLine ? '<a class="mh-btn mh-yellow" href="' + ext + '">用瀏覽器開啟</a>' : '<span class="mh-tip">點右上角「⋯」→ 用瀏覽器開啟</span>') +
      '<button type="button" class="mh-btn">先這樣玩</button></div>';
    b.querySelector('button').addEventListener('click', () => { try { ss.setItem(P + 'inappDismissed', '1'); } catch (e) {} b.remove(); });
    document.body.appendChild(b);
  }

  // ---------- QR 掃描器 ----------
  const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
  let jsqrLoading = null;
  function loadJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (jsqrLoading) return jsqrLoading;
    jsqrLoading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = JSQR_URL; s.async = true;
      s.onload = () => (window.jsQR ? res(window.jsQR) : rej(new Error('jsQR missing')));
      s.onerror = () => { jsqrLoading = null; rej(new Error('jsQR load failed')); };
      document.head.appendChild(s);
    });
    return jsqrLoading;
  }

  /** 開啟相機掃描。成功回傳怪獸編號；使用者取消回傳 0 */
  MH.scan = function () {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'mh-scan';
      ov.innerHTML =
        '<div class="mh-scan-bar"><span>搜查中…</span></div>' +
        '<div class="mh-scan-view"><video playsinline muted autoplay></video>' +
        '<div class="mh-scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div></div>' +
        '<p class="mh-scan-msg" aria-live="polite">把怪獸旁邊的 QR code 放進框框裡</p>' +
        '<button type="button" class="mh-btn mh-scan-cancel">取消</button>';
      document.body.appendChild(ov);
      snd('scanOpen');
      const video = ov.querySelector('video');
      const msg = ov.querySelector('.mh-scan-msg');
      let stream = null, done = false, timer = null, warnT = null;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      function finish(no) {
        if (done) return; done = true;
        clearTimeout(timer); clearTimeout(warnT);
        if (stream) stream.getTracks().forEach((t) => t.stop());
        ov.remove();
        resolve(no);
      }
      ov.querySelector('.mh-scan-cancel').addEventListener('click', () => finish(0));
      function fail(text) {
        snd('error');
        ov.classList.add('mh-scan-error');
        msg.innerHTML = text;
      }
      function handle(text) {
        const no = MH.parseCode(text);
        if (no) { try { navigator.vibrate && navigator.vibrate(80); } catch (e) {} snd('confirm'); finish(no); return true; }
        if (!warnT) snd('error');
        msg.textContent = '這不是怪獸的 QR code 喔，再找找看！';
        clearTimeout(warnT);
        warnT = setTimeout(() => { warnT = null; if (!done) msg.textContent = '把怪獸旁邊的 QR code 放進框框裡'; }, 1800);
        return false;
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        fail('這個瀏覽器不能開相機。<br>請改用 Safari 或 Chrome 開啟遊戲，<br>或直接用手機相機掃怪獸的 QR code。');
        return;
      }
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        .then(async (s) => {
          if (done) { s.getTracks().forEach((t) => t.stop()); return; }
          stream = s;
          video.srcObject = s;
          try { await video.play(); } catch (e) {}
          let detector = null;
          try {
            if ('BarcodeDetector' in window) {
              const fmts = await window.BarcodeDetector.getSupportedFormats();
              if (fmts.indexOf('qr_code') >= 0) detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            }
          } catch (e) { detector = null; }
          let jsqr = null;
          if (!detector) {
            try { jsqr = await loadJsQR(); }
            catch (e) { fail('掃描元件載入失敗，請確認網路後再試一次。'); return; }
          }
          const tick = async () => {
            if (done) return;
            try {
              if (video.readyState >= 2) {
                if (detector) {
                  const r = await detector.detect(video);
                  if (r && r.length && handle(r[0].rawValue)) return;
                } else {
                  const vw = video.videoWidth, vh = video.videoHeight;
                  const side = Math.min(vw, vh);
                  const size = Math.min(640, side);
                  canvas.width = size; canvas.height = size;
                  ctx.drawImage(video, (vw - side) / 2, (vh - side) / 2, side, side, 0, 0, size, size);
                  const img = ctx.getImageData(0, 0, size, size);
                  const code = jsqr(img.data, size, size, { inversionAttempts: 'dontInvert' });
                  if (code && code.data && handle(code.data)) return;
                }
              }
            } catch (e) {}
            timer = setTimeout(tick, 160);
          };
          tick();
        })
        .catch((err) => {
          const name = err && err.name;
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            fail('需要相機權限才能掃描。<br>請到瀏覽器設定允許「相機」，再按一次掃描；<br>也可以直接用手機相機掃怪獸的 QR code。');
          } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            fail('找不到可以用的相機。<br>可以直接用手機相機掃怪獸的 QR code。');
          } else {
            fail('相機開啟失敗，請關掉其他正在用相機的 App 再試一次。');
          }
        });
    });
  };

  /** 手動輸入怪獸牌子上的代碼（例如 04-7ZU5V），回傳怪獸編號或 0 */
  MH.manual = function () {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'mh-scan';
      ov.innerHTML =
        '<div class="mh-scan-bar"><span>手動輸入代碼</span></div>' +
        '<form class="mh-manual"><label for="mh-code">輸入怪獸 QR code 下方的代碼</label>' +
        '<input id="mh-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="例如 04-ABCDE" maxlength="12">' +
        '<p class="mh-scan-msg" aria-live="polite"></p>' +
        '<div class="mh-row"><button type="submit" class="mh-btn mh-yellow">送出</button>' +
        '<button type="button" class="mh-btn mh-scan-cancel">取消</button></div></form>';
      document.body.appendChild(ov);
      const input = ov.querySelector('input');
      const msg = ov.querySelector('.mh-scan-msg');
      setTimeout(() => input.focus(), 50);
      ov.querySelector('.mh-scan-cancel').addEventListener('click', () => { ov.remove(); resolve(0); });
      ov.querySelector('form').addEventListener('submit', (e) => {
        e.preventDefault();
        const raw = input.value.toUpperCase().replace(/[^0-9A-Z]/g, '');
        const no = parseInt(raw.slice(0, 2), 10);
        const mon = ROSTER[no - 1];
        if (mon && raw.slice(2) === mon.key) { ov.remove(); resolve(no); return; }
        snd('error');
        msg.textContent = '代碼不對喔，再檢查一次！';
      });
    });
  };

  // 測試用：除錯模式下可以不掃描，直接選一隻怪獸
  MH.fakeScan = function () {
    return new Promise((resolve) => {
      const ov = document.createElement('div');
      ov.className = 'mh-scan';
      ov.innerHTML = '<div class="mh-scan-bar"><span>除錯：模擬掃描</span></div><div class="mh-fake"></div><button type="button" class="mh-btn mh-scan-cancel">取消</button>';
      const box = ov.querySelector('.mh-fake');
      ROSTER.forEach((m) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mh-btn';
        b.textContent = 'No.' + String(m.no).padStart(2, '0') + ' ' + m.name;
        b.addEventListener('click', () => { ov.remove(); resolve(m.no); });
        box.appendChild(b);
      });
      const real = document.createElement('button');
      real.type = 'button'; real.className = 'mh-btn mh-yellow'; real.textContent = '改用真的相機';
      real.addEventListener('click', () => { ov.remove(); MH.scan().then(resolve); });
      box.appendChild(real);
      ov.querySelector('.mh-scan-cancel').addEventListener('click', () => { ov.remove(); resolve(0); });
      document.body.appendChild(ov);
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', banner);
  else banner();
})();
