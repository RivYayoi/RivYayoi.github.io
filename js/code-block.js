/* ============================================================
 * 代码块统一增强模块（原生 JS，无框架依赖）
 * ------------------------------------------------------------
 * 这是站内「所有代码块相关功能」的唯一实现，取代了主题原先零散的
 * jQuery 脚本（codeBlockFuction / codeCopy / codeShrink / codeBLang）。
 *
 * 覆盖能力：
 *   1. 渲染包裹：为每种高亮产物（Hexo highlight.js 表格布局
 *      figure.highlight、Shiki 的 pre.shiki、Prism 的 pre[class*=language-]）
 *      建立统一的 .code-block 容器，与 matery 视觉风格一致。
 *   2. 语法高亮：由构建期（highlight.js / Shiki / Prism）产出，本模块仅增强，
 *      不破坏原有高亮；深色模式下沿用构建产物的配色。
 *   3. 复制按钮：Clipboard API + execCommand 降级 + 成功/失败彩色反馈。
 *   4. 折叠/展开：超长代码（>阈值行）显示「展开/收起」按钮。
 *   5. 行号显示：构建期表格布局的 td.gutter 行号原样保留；
 *      对无行号的 pre（Shiki/Prism/纯文本）补齐行号（CSS 计数器，避免与
 *      构建产物自带行号重复）。
 *   6. macOS 风格窗口圆点（红/黄/绿），兼容原主题观感。
 *   7. 语言标识：从 class / data-lang 提取并映射为友好名称。
 *   8. 响应式：代码横向滚动（不折行）、按钮触控尺寸、窄屏自适应。
 *   9. 无障碍：aria-label / aria-expanded / 键盘可操作 / 尊重 reduced-motion。
 *
 * 设计见 specs/code-block-spec.md
 * ============================================================ */
(function () {
  'use strict';

  /* ---------- 语言名称映射 ---------- */
  var LANG_LABELS = {
    plaintext: 'Text', text: 'Text', plain: 'Text', txt: 'Text',
    js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX',
    ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
    sh: 'Shell', bash: 'Bash', shell: 'Shell', zsh: 'Zsh', console: 'Console',
    py: 'Python', python: 'Python', rb: 'Ruby', go: 'Go', golang: 'Go',
    rust: 'Rust', rs: 'Rust', java: 'Java', kotlin: 'Kotlin', kt: 'Kotlin',
    c: 'C', h: 'C', cpp: 'C++', 'c++': 'C++', cc: 'C++', hpp: 'C++',
    cs: 'C#', csharp: 'C#', php: 'PHP', swift: 'Swift', dart: 'Dart',
    html: 'HTML', xml: 'XML', svg: 'SVG', vue: 'Vue',
    css: 'CSS', scss: 'SCSS', sass: 'Sass', less: 'Less', styl: 'Stylus',
    json: 'JSON', yaml: 'YAML', yml: 'YAML', toml: 'TOML', ini: 'INI',
    md: 'Markdown', markdown: 'Markdown',
    sql: 'SQL', dockerfile: 'Dockerfile', makefile: 'Makefile', cmake: 'CMake',
    diff: 'Diff', properties: 'Properties', gradle: 'Gradle', npm: 'NPM',
    objectivec: 'Objective-C', objc: 'Objective-C',
    lua: 'Lua', r: 'R', scala: 'Scala', perl: 'Perl', haskell: 'Haskell'
  };

  function labelFor(lang) {
    if (!lang) return '';
    var l = String(lang).toLowerCase().replace(/[^a-z0-9+#.-]/g, '');
    if (LANG_LABELS[l]) return LANG_LABELS[l];
    return lang.charAt(0).toUpperCase() + lang.slice(1);
  }

  /* ---------- 工具：沿祖先链查找 class ---------- */
  function closestByClass(el, cls) {
    while (el && el.nodeType === 1) {
      if (el.classList && el.classList.contains(cls)) return el;
      el = el.parentNode;
    }
    return null;
  }

  /* ---------- 提取语言名 ---------- */
  function getLang(root) {
    var d = root.getAttribute && root.getAttribute('data-lang');
    if (d) return String(d).replace(/^(?:language|lang)-/i, '');
    var cls = root.className || '';
    var m = cls.match(/\bhighlight\s+([\w#+.-]+)/) || cls.match(/\blang(?:uage)?-([\w#+.-]+)/);
    if (m) return m[1].replace(/^(?:language|lang)-/i, '');
    var pre = root.tagName === 'PRE' ? root : root.querySelector('pre');
    if (pre) {
      var pc = pre.className || '';
      var mm = pc.match(/language-([\w#+.-]+)/) || pc.match(/lang-([\w#+.-]+)/);
      if (mm) return mm[1];
    }
    return '';
  }

  /* ---------- 找到「真正的代码 pre」（避开 highlight.js 行号列的 pre） ---------- */
  function findCodePre(block) {
    if (block.tagName === 'PRE') return block;
    var inArea = block.querySelector('.code-area pre');
    if (inArea) return inArea;
    var inCodeTd = block.querySelector('td.code pre');
    if (inCodeTd) return inCodeTd;
    var all = block.querySelectorAll('pre');
    return all.length ? all[all.length - 1] : null;
  }

  /* ---------- 统计行数 ---------- */
  function countLines(block) {
    var codeCell = block.querySelector('td.code') || block.querySelector('.code');
    if (codeCell) {
      var rows = codeCell.querySelectorAll('.line');
      if (rows.length) return rows.length;
      var p = codeCell.querySelector('pre');
      if (p) return (p.textContent || '').split('\n').length;
    }
    var pre = findCodePre(block);
    if (pre) {
      var ls = pre.querySelectorAll('.line');
      if (ls.length) return ls.length;
      return (pre.textContent || '').split('\n').length;
    }
    return 0;
  }

  /* ---------- 提取原始代码（去除行号列） ---------- */
  function getRawCode(block) {
    var src = block.querySelector('td.code') || block.querySelector('.code') ||
      (block.tagName === 'PRE' ? block : (findCodePre(block) || block));
    var lines = src.querySelectorAll('.line');
    if (lines.length) {
      var parts = [];
      for (var i = 0; i < lines.length; i++) parts.push(lines[i].textContent);
      return parts.join('\n');
    }
    return (src.textContent || '').replace(/\n+$/, '');
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ---------- 复制降级 ---------- */
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  /* ---------- 行号补齐（仅在构建产物未提供行号时） ---------- */
  function ensureLineNumbers(block) {
    var pre = findCodePre(block);
    if (!pre) return;
    // 表格布局已有 td.gutter 行号 -> 原样保留
    if (block.querySelector('.gutter') || pre.querySelector('.gutter')) return;

    var code = pre.querySelector('code') || pre;
    var lines = code.querySelectorAll('.line');

    if (lines.length) {
      // 已有 .line 结构（Shiki / Prism）：检测是否已被构建产物加过行号
      var before = '';
      try { before = getComputedStyle(lines[0], '::before').content || ''; } catch (e) {}
      if (before && before !== 'none' && before !== 'normal' && before !== '""' && before !== '"none"') {
        return; // 已带行号，避免重复
      }
      pre.classList.add('code-block--linenos');
      return;
    }

    // 纯文本 pre（无子元素、无行号）：按行拆分并补齐行号
    if (code.querySelector('*')) return; // 含高亮 span 等，勿破坏结构
    var text = (code.textContent || '').replace(/\n+$/, '');
    var parts = text.split('\n');
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      html += '<span class="code-block__line"><span class="code-block__ln">' + (i + 1) +
        '</span><span class="code-block__ct">' + escapeHtml(parts[i]) + '</span></span>\n';
    }
    code.innerHTML = html;
    pre.classList.add('code-block--linenos-plain');
  }

  /* ---------- 复制反馈（彩色状态） ----------
   * feedbackMode:
   *   'text'  —— 复制按钮本身是文字按钮，直接改写 textContent（完整增强路径）
   *   'title' —— 复用主题图标（如 <i class="fa-copy">），改用 title/aria-label 反馈，
   *             避免覆盖图标字形产生「图标 + 文字」的尴尬叠加
   */
  function bindCopy(button, getText, feedbackMode) {
    feedbackMode = feedbackMode || 'text';
    function setFeedback(state, msg) {
      button.classList.remove('is-copied', 'is-error');
      if (state === 'copied') button.classList.add('is-copied');
      else if (state === 'error') button.classList.add('is-error');
      if (feedbackMode === 'title') {
        button.setAttribute('title', msg);
        button.setAttribute('aria-label', msg);
      } else {
        button.textContent = msg;
      }
    }
    function onCopied() {
      setFeedback('copied', button.dataset.copied || '已复制');
      setTimeout(function () { setFeedback('', button.dataset.copy || '复制'); }, 2000);
    }
    function onError() {
      setFeedback('error', button.dataset.error || '复制失败');
      setTimeout(function () { setFeedback('', button.dataset.copy || '复制'); }, 2000);
    }
    button.addEventListener('click', function () {
      button.classList.remove('is-error');
      var text = getText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(onCopied, function () {
          if (legacyCopy(text)) onCopied(); else onError();
        });
      } else if (legacyCopy(text)) {
        onCopied();
      } else {
        onError();
      }
    });
  }

  /* ---------- 折叠 / 展开 ---------- */
  function bindFold(toggle, body, threshold, lineCount) {
    if (lineCount <= threshold) {
      toggle.hidden = true;
      return;
    }
    toggle.hidden = false;
    toggle.textContent = '展开';
    body.classList.add('is-collapsed');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.addEventListener('click', function () {
      var collapsed = body.classList.toggle('is-collapsed');
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.textContent = collapsed ? '展开' : '收起';
    });
  }

  /* ---------- 构建统一容器并增强单个代码块 ---------- */
  function enhanceBlock(block, opts) {
    var lang = getLang(block);
    var label = labelFor(lang);

    // 兼容：若主题仍把 pre 包进了 .code-area，则在其内部增量增强
    var pre = findCodePre(block);
    var codeArea = pre ? closestByClass(pre, 'code-area') : null;

    if (codeArea) {
      // 增量模式：主题已用 .code-area 接管，复用其结构，避免双重包裹 / 双复制按钮
      if (codeArea.__cbEnhanced) return;
      codeArea.__cbEnhanced = true;
      codeArea.classList.add('code-block--legacy'); // CSS 钩子：抑制主题自带的重复 macOS 圆点

      var bar = document.createElement('div');
      bar.className = 'code-block__bar';

      var langEl = document.createElement('span');
      langEl.className = 'code-block__lang';
      langEl.textContent = label;
      if (!label) langEl.style.display = 'none';

      // 优先复用主题已有的复制控件（.fa-copy / .code_copy 等），避免新增第二个复制按钮
      var themeCopy = codeArea.querySelector('.fa-copy, .fa-clipboard, .code_copy, [data-clipboard-target]');
      var copyBtn, copyMode;
      if (themeCopy) {
        copyBtn = themeCopy;
        copyBtn.classList.add('code-block__copy'); // 复用样式与彩色反馈状态机
        if (copyBtn.tagName === 'I' || copyBtn.tagName === 'SPAN') {
          copyBtn.setAttribute('role', 'button');
          copyBtn.setAttribute('tabindex', '0');
        }
        if (!copyBtn.getAttribute('aria-label')) copyBtn.setAttribute('aria-label', '复制代码');
        copyMode = 'title'; // 复用图标时用 title 反馈，避免图标与文字叠加
      } else {
        copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'code-block__copy';
        copyBtn.setAttribute('aria-label', '复制代码');
        copyBtn.dataset.copy = opts.copyLabel;
        copyBtn.dataset.copied = opts.copiedLabel;
        copyBtn.dataset.error = opts.errorLabel;
        copyBtn.textContent = opts.copyLabel;
        copyMode = 'text';
      }

      bar.appendChild(langEl);
      bar.appendChild(copyBtn);
      codeArea.insertBefore(bar, codeArea.firstChild);

      bindCopy(copyBtn, function () { return getRawCode(block); }, copyMode);

      var lineCount = countLines(block);
      if (lineCount > opts.threshold) {
        var toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'code-block__toggle';
        toggle.setAttribute('aria-label', '折叠或展开代码');
        codeArea.appendChild(toggle);
        bindFold(toggle, codeArea, opts.threshold, lineCount);
      }
      ensureLineNumbers(block);
      return;
    }

    // 完整模式：建立 .code-block 统一容器
    if (block.__cbEnhanced) return;
    block.__cbEnhanced = true;

    var wrapper = document.createElement('div');
    wrapper.className = 'code-block';
    if (lang) wrapper.setAttribute('data-lang', lang);

    var bar = document.createElement('div');
    bar.className = 'code-block__bar';

    var langEl = document.createElement('span');
    langEl.className = 'code-block__lang';
    langEl.textContent = label;
    if (!label) langEl.style.display = 'none';

    var copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'code-block__copy';
    copyBtn.setAttribute('aria-label', '复制代码');
    copyBtn.dataset.copy = opts.copyLabel;
    copyBtn.dataset.copied = opts.copiedLabel;
    copyBtn.dataset.error = opts.errorLabel;
    copyBtn.textContent = opts.copyLabel;

    bar.appendChild(langEl);
    bar.appendChild(copyBtn);

    var body = document.createElement('div');
    body.className = 'code-block__body';

    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'code-block__toggle';
    toggle.hidden = true;
    toggle.setAttribute('aria-label', '折叠或展开代码');

    // 将原有代码块移入统一容器
    block.parentNode.insertBefore(wrapper, block);
    wrapper.appendChild(bar);
    wrapper.appendChild(body);
    body.appendChild(block);
    wrapper.appendChild(toggle);

    bindCopy(copyBtn, function () { return getRawCode(block); }, 'text');

    var lineCount = countLines(block);
    bindFold(toggle, body, opts.threshold, lineCount);

    ensureLineNumbers(block);
  }

  /* ---------- 入口：扫描并增强容器内所有代码块（幂等） ---------- */
  function enhanceCodeBlocks(root, options) {
    root = root || document;
    options = options || {};
    var opts = {
      threshold: typeof options.collapseThreshold === 'number' ? options.collapseThreshold : 16,
      copyLabel: options.copyLabel || '复制',
      copiedLabel: options.copiedLabel || '已复制',
      errorLabel: options.errorLabel || '复制失败'
    };

    var blocks = root.querySelectorAll('figure.highlight, pre.shiki, pre[class*="language-"]');
    Array.prototype.forEach.call(blocks, function (block) {
      try {
        enhanceBlock(block, opts);
      } catch (err) {
        if (block) block.__cbEnhanced = false;
        if (window.console) console.error('[code-block] enhance failed:', err);
      }
    });
  }

  function scope() {
    return document.getElementById('articleContent') || document;
  }

  function boot() {
    try { enhanceCodeBlocks(scope()); } catch (e) {
      if (window.console) console.error('[code-block] init failed:', e);
    }
  }

  /* 等文档解析完成后再增强，确保代码块 DOM 已就绪且不与其他脚本争抢 */
  if (document.readyState === 'complete') {
    setTimeout(boot, 0);
  } else {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 0); }, { once: true });
    window.addEventListener('load', boot, { once: true });
  }

  // 暴露给可能的异步加载 / 客户端路由场景，重复调用幂等
  window.enhanceCodeBlocks = enhanceCodeBlocks;
})();
