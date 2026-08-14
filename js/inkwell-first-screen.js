/* =========================================================================
   纸境 Inkwell — 首页首屏交互脚本（独立，不与 Matery 的 matery.js 冲突）
   - 多张壁纸背景层生成 + 滚动停止后交叉切换
   - 《道德经》随机引言（每次刷新更换，数据源 js/inkwell-laozi.json）
   - 滚动提示淡出
   注：「本站已运行」计时器的实时刷新由 first-screen.ejs 内的内联脚本负责
   （随 HTML 加载执行，不依赖本文件），本文件不再重复管理。
   仅当页面存在 #ikwFirstScreen 时初始化。每个模块独立 try-catch。
   ========================================================================= */
(function () {
  'use strict';

  /* ---------- A. 壁纸背景层 + 滚动切换 ---------- */
  function initWallpapers(root) {
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var bgEl = document.getElementById('ikwBg');
    var raw = root.getAttribute('data-ikw-wallpapers');
    var wallpapers = [];
    try { wallpapers = JSON.parse(raw || '[]'); } catch (e) { wallpapers = []; }

    if (!bgEl || !wallpapers.length) return;

    wallpapers.forEach(function (url) {
      var layer = document.createElement('div');
      layer.className = 'ikw-bg-layer';
      layer.style.backgroundImage = 'url("' + url + '")';
      bgEl.appendChild(layer);
    });
    var layers = bgEl.querySelectorAll('.ikw-bg-layer');
    var current = Math.floor(Math.random() * layers.length);
    layers[current] && layers[current].classList.add('is-active');

    var scrim = parseFloat(root.getAttribute('data-ikw-scrim') || '0.5');
    if (!isNaN(scrim)) bgEl.style.setProperty('--ikw-scrim', scrim);

    if (!reduced) {
      var timer = null;
      function pickNext() {
        var next;
        do { next = Math.floor(Math.random() * layers.length); } while (next === current && layers.length > 1);
        layers[current] && layers[current].classList.remove('is-active');
        layers[next] && layers[next].classList.add('is-active');
        current = next;
      }
      function schedule() {
        clearTimeout(timer);
        timer = setTimeout(function () { if (layers.length > 1) pickNext(); }, 350);
      }
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('wheel', schedule, { passive: true });
    }
  }

  /* ---------- D. 《道德经》随机引言 ---------- */
  function initQuote(root) {
    var quoteEl = document.getElementById('ikwQuote');
    if (!quoteEl) return;
    var quoteTextEl = document.getElementById('ikwQuoteText');
    var quoteChapterEl = document.getElementById('ikwQuoteChapter');
    var quoteSrc = root.getAttribute('data-ikw-quote-src') || 'js/inkwell-laozi.json';

    var fallbackQuotes = [
      { text: '道可道，非常道；名可名，非常名。', chapter: '第一章' },
      { text: '上善若水，水善利万物而不争。', chapter: '第八章' },
      { text: '千里之行，始于足下。', chapter: '第六十四章' }
    ];

    function pickQuote(list) {
      if (!list || !list.length) return null;
      var last = -1;
      try { last = parseInt(localStorage.getItem('ikw-quote-index') || '-1', 10); } catch (e) { last = -1; }
      var idx = 0;
      if (list.length > 1) {
        do { idx = Math.floor(Math.random() * list.length); } while (idx === last);
      }
      try { localStorage.setItem('ikw-quote-index', String(idx)); } catch (e) { /* 忽略 */ }
      return list[idx];
    }

    function renderQuote(q) {
      if (!q) return;
      if (quoteTextEl) quoteTextEl.textContent = q.text;
      if (quoteChapterEl) quoteChapterEl.textContent = q.chapter ? ('《道德经 · ' + q.chapter + '》') : '《道德经》';
      quoteEl.classList.add('is-loaded');
    }

    fetch(quoteSrc, { cache: 'no-store' })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(function (data) { renderQuote(pickQuote(data)); })
      .catch(function () { renderQuote(pickQuote(fallbackQuotes)); });
  }

  /* ---------- E. 滚动提示淡出 ---------- */
  function initScrollCue(root) {
    var cue = root.querySelector('.ikw-scroll-cue');
    if (!cue) return;
    var onScroll = function () {
      if (window.scrollY > 48) root.classList.add('is-scrolled');
      else root.classList.remove('is-scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function init() {
    var root = document.getElementById('ikwFirstScreen');
    if (!root) return;

    // 各模块独立 try-catch，互不影响
    try { initWallpapers(root); } catch (e) {}
    try { initQuote(root); } catch (e) {}
    try { initScrollCue(root); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
