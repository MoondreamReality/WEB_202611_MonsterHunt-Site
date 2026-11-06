/* dcmini.js — 迷你元件執行環境
   讓畫布原型的 .dc.html 版型（{{洞}}、<sc-for>、<sc-if>、事件、ref、DCLogic 生命週期）
   可以脫離 Claude 畫布，直接在一般瀏覽器裡執行。
   作法：模板 → 虛擬節點 → 以「模板位置＋迴圈索引」為鍵做差異更新，
   讓沒有變動的元素保持原狀（CSS 動畫不會被重播、捲動位置不會跑掉）。 */
(function () {
  'use strict';

  // ---------- DCLogic：類 React class 元件 ----------
  class DCLogic {
    constructor(props) {
      this.props = props || {};
      this.state = {};
    }
    setState(update, cb) {
      const patch = typeof update === 'function' ? update(this.state, this.props) : update;
      if (patch == null) { if (cb) this.__host && this.__host.after(cb); return; }
      if (this.__host && !this.__host.prevState) this.__host.prevState = this.state;
      this.state = Object.assign({}, this.state, patch);
      if (this.__host) { if (cb) this.__host.after(cb); this.__host.schedule(); }
    }
    forceUpdate(cb) {
      if (this.__host) { if (cb) this.__host.after(cb); this.__host.schedule(); }
    }
  }
  window.DCLogic = DCLogic;

  // ---------- 模板 → 虛擬節點 ----------
  const WHOLE = /^\s*\{\{\s*([^{}]+?)\s*\}\}\s*$/;
  const HOLE = /\{\{\s*([^{}]+?)\s*\}\}/g;
  let tidSeq = 0;
  const tids = new WeakMap();
  const tid = (node) => { let t = tids.get(node); if (t == null) { t = ++tidSeq; tids.set(node, t); } return t; };

  function lookup(path, scope) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (path === 'null') return null;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    if (/^'.*'$|^".*"$/.test(path)) return path.slice(1, -1);
    const parts = path.split('.');
    let v = scope[parts[0]];
    for (let i = 1; i < parts.length; i++) {
      if (v == null) return undefined;
      v = v[parts[i]];
    }
    return v;
  }
  function interp(str, scope) {
    if (str.indexOf('{{') < 0) return str;
    return str.replace(HOLE, (m, p) => { const v = lookup(p, scope); return v == null ? '' : String(v); });
  }
  function whole(str, scope) {
    const m = WHOLE.exec(str);
    return m ? { hit: true, v: lookup(m[1], scope) } : { hit: false };
  }

  function build(nodes, scope, path, out) {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.nodeType === 3) {
        out.push({ k: tid(node) + path, t: interp(node.data, scope) });
        continue;
      }
      if (node.nodeType !== 1) continue;
      const ln = node.localName;
      if (ln === 'sc-for') {
        const w = whole(node.getAttribute('list') || '', scope);
        const list = w.hit && Array.isArray(w.v) ? w.v : [];
        const as = node.getAttribute('as') || 'item';
        const id = tid(node);
        for (let j = 0; j < list.length; j++) {
          const s = Object.create(scope);
          s[as] = list[j];
          s.$index = j;
          build(node.childNodes, s, path + '/' + id + '.' + j, out);
        }
        continue;
      }
      if (ln === 'sc-if') {
        const w = whole(node.getAttribute('value') || '', scope);
        if (w.hit && w.v) build(node.childNodes, scope, path, out);
        continue;
      }
      if (ln === 'helmet') continue;
      const v = { k: tid(node) + path, tag: ln, ns: node.namespaceURI, a: {}, ev: {}, ref: null, c: [] };
      const attrs = node.attributes;
      for (let j = 0; j < attrs.length; j++) {
        const name = attrs[j].name, val = attrs[j].value;
        if (name.indexOf('hint-') === 0) continue;
        if (name === 'ref') { const w = whole(val, scope); if (w.hit && typeof w.v === 'function') v.ref = w.v; continue; }
        if (/^on[a-z]+$/.test(name)) {
          const w = whole(val, scope);
          if (w.hit) { if (typeof w.v === 'function') v.ev[name.slice(2)] = w.v; continue; }
        }
        const w = whole(val, scope);
        if (w.hit) {
          if (w.v == null || w.v === false) continue;
          v.a[name] = w.v === true ? '' : String(w.v);
        } else {
          v.a[name] = interp(val, scope);
        }
      }
      build(node.childNodes, scope, path, v.c);
      out.push(v);
    }
    return out;
  }

  // ---------- 差異更新 ----------
  function create(v) {
    if (v.t != null) return document.createTextNode(v.t);
    const el = v.ns && v.ns !== 'http://www.w3.org/1999/xhtml'
      ? document.createElementNS(v.ns, v.tag)
      : document.createElement(v.tag);
    for (const k in v.a) { try { el.setAttribute(k, v.a[k]); } catch (e) {} }
    bindEvents(el, v);
    patchChildren(el, [], v.c);
    if (v.ref) v.ref(el);
    return el;
  }
  function bindEvents(el, v) {
    el.__ev = v.ev;
    if (!el.__ls) el.__ls = {};
    for (const type in v.ev) {
      if (el.__ls[type]) continue;
      el.__ls[type] = true;
      el.addEventListener(type, (e) => { const f = el.__ev && el.__ev[type]; if (f) f(e); });
    }
  }
  function update(el, o, n) {
    if (n.t != null) { if (o.t !== n.t) el.data = n.t; return; }
    for (const k in n.a) if (o.a[k] !== n.a[k]) { try { el.setAttribute(k, n.a[k]); } catch (e) {} }
    for (const k in o.a) if (!(k in n.a)) el.removeAttribute(k);
    bindEvents(el, n);
    patchChildren(el, o.c, n.c);
    if (n.ref && n.ref !== o.ref) n.ref(el);
  }
  const same = (o, n) => (o.t != null) === (n.t != null) && o.tag === n.tag && o.ns === n.ns;
  function patchChildren(parent, oldList, newList) {
    const oldMap = new Map();
    for (const o of oldList) oldMap.set(o.k, o);
    const keep = new Set();
    for (const n of newList) {
      const o = oldMap.get(n.k);
      if (o && same(o, n) && o.dom) { n.__o = o; keep.add(o); }
    }
    // 先移除不再需要的節點，避免後面的元素被搬動（搬動會讓 CSS 動畫重播）
    for (const o of oldList) if (!keep.has(o) && o.dom && o.dom.parentNode === parent) parent.removeChild(o.dom);
    for (let i = 0; i < newList.length; i++) {
      const n = newList[i];
      let dom;
      if (n.__o) { dom = n.__o.dom; update(dom, n.__o, n); n.__o = null; }
      else dom = create(n);
      n.dom = dom;
      const at = parent.childNodes[i];
      if (at !== dom) parent.insertBefore(dom, at || null);
    }
    while (parent.childNodes.length > newList.length) parent.removeChild(parent.lastChild);
  }

  // ---------- 啟動 ----------
  function readProps() {
    const props = {};
    if (!(window.MH && window.MH.debug)) return props;
    const q = new URLSearchParams(location.search);
    q.forEach((val, key) => {
      if (key === 'debug' || key === 'm' || key === 'k' || key === 'openExternalBrowser') return;
      props[key] = /^-?\d+(\.\d+)?$/.test(val) ? Number(val) : val;
    });
    return props;
  }

  // ---------- 頁面計時器追蹤：換頁時一次清掉，避免舊頁面在背景繼續跑 ----------
  const T = { to: new Set(), iv: new Set(), raf: new Set() };
  const _st = window.setTimeout.bind(window), _ct = window.clearTimeout.bind(window);
  const _si = window.setInterval.bind(window), _ci = window.clearInterval.bind(window);
  const _raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : null;
  const _caf = window.cancelAnimationFrame ? window.cancelAnimationFrame.bind(window) : null;
  window.setTimeout = function (fn, ms, ...a) { const id = _st(function () { T.to.delete(id); if (typeof fn === 'function') fn.apply(this, a); }, ms); T.to.add(id); return id; };
  window.clearTimeout = function (id) { T.to.delete(id); _ct(id); };
  window.setInterval = function (fn, ms, ...a) { const id = _si(fn, ms, ...a); T.iv.add(id); return id; };
  window.clearInterval = function (id) { T.iv.delete(id); _ci(id); };
  if (_raf) {
    window.requestAnimationFrame = function (fn) { const id = _raf((t) => { T.raf.delete(id); fn(t); }); T.raf.add(id); return id; };
    window.cancelAnimationFrame = function (id) { T.raf.delete(id); _caf(id); };
  }
  function clearPageTimers() {
    T.to.forEach((id) => _ct(id)); T.iv.forEach((id) => _ci(id)); if (_caf) T.raf.forEach((id) => _caf(id));
    T.to.clear(); T.iv.clear(); T.raf.clear();
  }

  let current = null;   // { comp, host }
  const pageId = () => (location.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';

  function boot(Comp) {
    const tpl = document.getElementById('dc-tpl').content;
    const app = document.getElementById('app');
    const comp = new Comp(readProps());
    let vtree = [];
    let queued = false;
    let cbs = [];
    let mounted = false;
    const id = pageId();
    const host = {
      dead: false,
      prevState: null,
      schedule() { if (queued || host.dead) return; queued = true; Promise.resolve().then(render); },
      after(cb) { cbs.push(cb); }
    };
    comp.__host = host;
    window.__dcComp = comp;
    current = { comp, host };
    function render() {
      queued = false;
      if (host.dead) return;
      let vals;
      try { vals = comp.renderVals() || {}; } catch (e) { console.error(e); return; }
      const next = build(tpl.childNodes, vals, '', []);
      patchChildren(app, vtree, next);
      vtree = next;
      const prevState = host.prevState || comp.state;
      host.prevState = null;
      if (mounted && comp.componentDidUpdate) { try { comp.componentDidUpdate(comp.props, prevState); } catch (e) { console.error(e); } }
      if (mounted && window.MHCues) { try { window.MHCues.update(id, comp, prevState); } catch (e) { console.error(e); } }
      const run = cbs; cbs = [];
      run.forEach((f) => { try { f(); } catch (e) { console.error(e); } });
    }
    render();
    mounted = true;
    if (comp.componentDidMount) { try { comp.componentDidMount(); } catch (e) { console.error(e); } }
    if (window.MHCues) { try { window.MHCues.mount(id, comp); } catch (e) { console.error(e); } }
    fit();
    watch();
  }
  window.addEventListener('pagehide', () => { try { current && current.comp.componentWillUnmount && current.comp.componentWillUnmount(); } catch (e) {} });

  // 第一次開啟：開場頁先顯示「點一下開始」（同時解鎖手機的聲音）
  function start(Comp) {
    if (window.MHSound) window.MHSound.muteButton();
    if (pageId() === 'index' && window.MHSound && !(window.MH && window.MH.debug && /startAt=/.test(location.search))) {
      window.MHSound.gate().then(() => boot(Comp));
    } else boot(Comp);
  }

  // ---------- 不重新載入的換頁：聲音與背景音樂不中斷 ----------
  const PAGES = ['index', 'scan', 'catch', 'dex', 'reward', 'locked'];
  function isOurPage(url) {
    if (url.origin !== location.origin) return false;
    const name = (url.pathname.split('/').pop() || 'index.html').replace('.html', '') || 'index';
    const dir = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
    const here = location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1);
    return dir === here && PAGES.indexOf(name) >= 0;
  }
  let navigating = false;
  async function softNav(href, push) {
    const url = new URL(href, location.href);
    if (navigating) return;
    navigating = true;
    try {
      const res = await fetch(url.pathname + url.search, { cache: 'no-cache' });
      if (!res.ok) throw new Error('fetch ' + res.status);
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const tplNew = doc.getElementById('dc-tpl');
      const scripts = Array.from(doc.body.querySelectorAll('script')).filter((x) => !x.src && !/DCMini\./.test(x.textContent));
      const logic = scripts.length ? scripts[scripts.length - 1].textContent : '';
      const Comp = new Function(logic + '\n;return Component;')();
      // 頁面守門（例如未集滿不能進寶藏頁）：要轉去別頁就直接換成那一頁
      const guard = doc.head.querySelector('script[data-guard]');
      if (guard) {
        let to = null;
        (new Function('location', guard.textContent))({ replace: (u) => { to = u; } });
        if (to) { navigating = false; return softNav(new URL(to, url.href).href, push); }
      }
      // 拆掉舊頁面
      if (current) {
        current.host.dead = true;
        try { current.comp.componentWillUnmount && current.comp.componentWillUnmount(); } catch (e) {}
      }
      clearPageTimers();
      document.querySelectorAll('.mh-scan').forEach((n) => n.remove());
      if (ro) { ro.disconnect(); ro = null; }
      // 換網址、標題、版面設定、頁面樣式
      if (push) history.pushState({ mh: 1 }, '', url.pathname.split('/').pop() + url.search);
      document.title = doc.title;
      document.body.setAttribute('data-layout', doc.body.getAttribute('data-layout') || 'flex');
      document.querySelectorAll('head [data-page]').forEach((n) => n.remove());
      doc.head.querySelectorAll('[data-page]').forEach((n) => document.head.appendChild(document.importNode(n, true)));
      // 頁面守門（例如未集滿不能進寶藏頁）
      const old = document.getElementById('dc-tpl');
      const t = document.createElement('template');
      t.id = 'dc-tpl';
      t.innerHTML = tplNew.innerHTML;
      old.replaceWith(t);
      const app = document.getElementById('app');
      while (app.firstChild) app.removeChild(app.firstChild);
      window.scrollTo(0, 0);
      if (window.MH && window.MH.refresh) window.MH.refresh();
      boot(Comp);
    } catch (e) {
      console.error('soft nav failed', e);
      location.href = url.href;
    } finally {
      navigating = false;
    }
  }
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const url = new URL(a.getAttribute('href'), location.href);
    if (!isOurPage(url)) return;
    e.preventDefault();
    softNav(url.href, true);
  });
  window.addEventListener('popstate', () => softNav(location.href, false));

  // ---------- 版面：寬度填滿手機，高度跟著手機走 ----------
  // body[data-layout]：flex＝上下排列、選單貼底（內容比螢幕高就整頁捲動）
  //                    main＝開場（絕對定位，高度介於 620～844）
  //                    tall＝寶藏解鎖（內容自然長高，整頁捲動）
  const MAXW = 480;
  function viewport() {
    const vv = window.visualViewport;
    // 用 innerHeight 而不是 visualViewport.height：避免 iOS 鍵盤跳出時整個畫面重排
    return { W: vv ? vv.width : window.innerWidth, H: window.innerHeight };
  }
  function scaleOf(W) { return Math.min(W, MAXW) / 390; }
  // 開場頁的高度在元件建立前就要決定（放大鏡的原點依它計算），之後只在轉向時重算
  function mainHeight() {
    const v = viewport();
    return Math.round(Math.min(844, Math.max(620, v.H / scaleOf(v.W))));
  }
  window.MH_PAGE_H = mainHeight();
  let lastW = 0;

  function sizePage() {
    const app = document.getElementById('app');
    const root = app.firstElementChild;
    const mode = document.body.getAttribute('data-layout') || 'flex';
    const v = viewport();
    const s = scaleOf(v.W);
    const Hl = v.H / s;
    if (mode === 'main') {
      if (Math.abs(v.W - lastW) > 40) window.MH_PAGE_H = mainHeight();
      app.style.setProperty('--mh-h', window.MH_PAGE_H + 'px');
    } else if (mode === 'tall') {
      app.style.setProperty('--mh-h', Math.floor(Hl) + 'px');
    } else {
      // data-fit：可伸縮的區塊（例如圖鑑列表），先回到設計高度，放不下再縮，最小到 data-fit-min
      const fitEl = root && root.querySelector('[data-fit]');
      let base = fitEl ? +fitEl.getAttribute('data-fit') : 0;
      if (fitEl && fitEl.getAttribute('data-fit-max') === 'square') base = Math.min(base, fitEl.offsetWidth);
      if (fitEl) fitEl.style.height = base + 'px';
      app.style.setProperty('--mh-h', 'auto');
      let natural = root ? root.offsetHeight : 844;
      if (fitEl && natural > Hl) {
        const min = +(fitEl.getAttribute('data-fit-min') || base);
        fitEl.style.height = Math.max(min, Math.floor(base - (natural - Hl))) + 'px';
        natural = root.offsetHeight;
      } else if (fitEl && fitEl.getAttribute('data-fit-max') && natural < Hl) {
        const mx = fitEl.getAttribute('data-fit-max');
        const max = mx === 'square' ? fitEl.offsetWidth : +mx;
        fitEl.style.height = Math.min(max, Math.floor(base + (Hl - natural))) + 'px';
        natural = root.offsetHeight;
      }
      app.style.setProperty('--mh-h', Math.max(Math.floor(Hl), natural) + 'px');
    }
    lastW = v.W;
    place();
  }
  function place() {
    const app = document.getElementById('app');
    const stage = document.getElementById('stage');
    const root = app.firstElementChild;
    const v = viewport();
    const s = scaleOf(v.W);
    const h = root ? root.offsetHeight : 844;
    const sh = h * s;
    app.style.transform = 'scale(' + s + ')';
    app.style.left = Math.max(0, (v.W - 390 * s) / 2) + 'px';
    app.style.top = sh < v.H ? Math.round((v.H - sh) / 2) + 'px' : '0px';
    app.style.height = h + 'px';
    stage.style.height = Math.max(sh, v.H) + 'px';
  }
  function fit() {
    try { sizePage(); } catch (e) {}
    try { if (window.__dcComp) window.__dcComp.forceUpdate(); } catch (e) {}
  }
  let rt = null;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(fit, 60); };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  let ro = null;
  function watch() {
    const root = document.getElementById('app').firstElementChild;
    if (ro) { ro.disconnect(); ro = null; }
    if (root && window.ResizeObserver) { ro = new ResizeObserver(() => place()); ro.observe(root); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    setTimeout(fit, 300); setTimeout(fit, 1200);
  }

  window.DCMini = { boot: start, fit, nav: (h) => softNav(h, true) };
})();
