/**
 * Heading Detector Bookmarklet - Enhanced with Tree TOC Popup
 * 
 * スタイル解析で見出しを検出し、ツリー形式のポップアップで表示
 */

javascript: (function () {
    var WIDGET_ID = 'heading-detector-widget';
    var doc = document, win = window;

    // テーマ設定
    var THEME = {
        bg: '#1e1e1e',
        text: '#e3e3e3',
        border: '#444746',
        headerBg: '#2f3136',
        link: '#a8c7fa',
        hover: '#3c4043',
        highlight: 'rgba(255, 235, 59, 0.4)',
        btnText: '#c4c7c5',
        btnHover: '#4f545c',
        activeBtnBg: '#0b57d0',
        activeBtnText: '#ffffff',
        h1: 'rgba(255, 107, 107, 0.8)',
        h2: 'rgba(255, 159, 67, 0.8)',
        h3: 'rgba(255, 220, 0, 0.8)',
        h4: 'rgba(72, 219, 251, 0.8)',
        h5: 'rgba(162, 155, 254, 0.8)',
        h6: 'rgba(200, 200, 200, 0.8)'
    };

    // 設定
    var config = {
        level: 4,
        x: 20,
        y: 60,
        width: 360,
        dock: 'none',
        wrap: false
    };

    // 既存ウィジェットを削除
    var existing = document.getElementById(WIDGET_ID);
    if (existing) existing.remove();

    // ユーティリティ関数
    function createEl(tag, styles, text) {
        var el = document.createElement(tag);
        if (styles) el.style.cssText = styles;
        if (text) el.textContent = text;
        return el;
    }

    // スクロールコンテナ取得
    function getScrollContainer() {
        if (win.scrollY > 0 || doc.documentElement.scrollHeight > win.innerHeight) {
            var main = doc.querySelector('main, [role="main"], .infinite-scroller');
            if (main && main.scrollHeight > main.clientHeight) {
                var style = getComputedStyle(main);
                if (style.overflowY === 'scroll' || style.overflowY === 'auto') return main;
            }
            if (win.scrollY > 0) return win;
        }
        var candidates = Array.from(doc.querySelectorAll('*'));
        var scrollable = candidates.filter(function (el) {
            var style = win.getComputedStyle(el);
            var isOverflow = style.overflowY === 'auto' || style.overflowY === 'scroll';
            return isOverflow && el.scrollHeight > el.clientHeight;
        });
        scrollable.sort(function (a, b) {
            return (b.clientHeight * b.clientWidth) - (a.clientHeight * a.clientWidth);
        });
        return scrollable.length > 0 ? scrollable[0] : win;
    }

    // スムーズスクロール
    function smartScrollTo(targetEl) {
        var container = getScrollContainer();
        var isWindow = (container === win);
        var currentScroll = isWindow ? win.scrollY : container.scrollTop;
        var rect = targetEl.getBoundingClientRect();
        var containerTop = isWindow ? 0 : container.getBoundingClientRect().top;
        var targetTopRel = currentScroll + rect.top - containerTop;
        var viewHeight = isWindow ? win.innerHeight : container.clientHeight;
        var targetScrollPos = targetTopRel - (viewHeight / 2) + (rect.height / 2);

        if (isWindow) win.scrollTo({ top: targetScrollPos, behavior: 'smooth' });
        else container.scrollTo({ top: targetScrollPos, behavior: 'smooth' });

        highlightElement(targetEl);
    }

    function highlightElement(el) {
        var originalBg = el.style.backgroundColor;
        el.style.transition = 'background 0.3s ease-out';
        el.style.backgroundColor = THEME.highlight;
        setTimeout(function () {
            el.style.backgroundColor = originalBg;
            setTimeout(function () { el.style.transition = ''; }, 300);
        }, 1500);
    }

    // HeadingDetector コア
    var HeadingDetector = {
        config: {
            fontSizeRatio: 1.15,
            boldThreshold: 600,
            maxTextLength: 150,
            maxHeadings: 100
        },

        getBaseFontSize: function () {
            var body = document.body;
            if (!body) return 16;
            return parseFloat(window.getComputedStyle(body).fontSize) || 16;
        },

        isHeadingCandidate: function (element, baseFontSize) {
            if (element.offsetParent === null && element.tagName !== 'BODY') return null;
            var style = window.getComputedStyle(element);
            var fontSize = parseFloat(style.fontSize);
            var fontWeight = parseInt(style.fontWeight) || 400;
            var display = style.display;
            var text = element.textContent.trim();

            if (!text || text.length > this.config.maxTextLength || text.length < 2) return null;
            if (element.children.length > 5) return null;

            var isBigger = fontSize >= baseFontSize * this.config.fontSizeRatio;
            var isBold = fontWeight >= this.config.boldThreshold;
            var isBlock = ['block', 'flex', 'grid', 'list-item'].includes(display) || display.startsWith('table');

            var score = 0;
            var level = 6;

            if (isBigger) {
                score += 30;
                var ratio = fontSize / baseFontSize;
                if (ratio >= 2.0) level = 1;
                else if (ratio >= 1.6) level = 2;
                else if (ratio >= 1.3) level = 3;
                else if (ratio >= 1.15) level = 4;
                else level = 5;
            }

            if (isBold) {
                score += 25;
                if (level > 3) level = Math.max(level - 1, 1);
            }

            if (isBlock) score += 15;

            var mt = parseFloat(style.marginTop) || 0;
            var pt = parseFloat(style.paddingTop) || 0;
            var mb = parseFloat(style.marginBottom) || 0;
            var pb = parseFloat(style.paddingBottom) || 0;
            if (mt > 10 || pt > 10) score += 10;
            if (mb > 5 || pb > 5) score += 5;
            if (text.length <= 50) score += 10;
            if (text.length <= 20) score += 5;

            var ci = ((element.className || '') + ' ' + (element.id || '')).toLowerCase();
            if (/heading|title|header|section-title|headline/i.test(ci)) score += 15;

            if (score < 40) return null;
            return { element: element, text: text.substring(0, 100), level: level, score: score, isNative: false };
        },

        removeDuplicates: function (headings) {
            var result = [];
            var elements = headings.map(function (h) { return h.element; });
            for (var i = 0; i < headings.length; i++) {
                var heading = headings[i];
                var isDuplicate = false;
                for (var j = 0; j < elements.length; j++) {
                    var other = elements[j];
                    if (heading.element === other) continue;
                    if (heading.element.contains(other) || other.contains(heading.element)) {
                        var otherHeading = headings.find(function (h) { return h.element === other; });
                        if (other.contains(heading.element) && otherHeading && otherHeading.score >= heading.score) {
                            isDuplicate = true;
                            break;
                        }
                    }
                }
                if (!isDuplicate) result.push(heading);
            }
            return result;
        },

        detect: function () {
            var baseFontSize = this.getBaseFontSize();
            var existingHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            var candidates = [];
            var selectors = 'p, div, span, li, td, th, a, strong, b, em, article, section, header, footer, main, aside, nav, label';
            var elements = document.querySelectorAll(selectors);

            for (var i = 0; i < elements.length; i++) {
                var element = elements[i];
                var isInsideHeading = false;
                for (var j = 0; j < existingHeadings.length; j++) {
                    if (existingHeadings[j].contains(element)) {
                        isInsideHeading = true;
                        break;
                    }
                }
                if (isInsideHeading) continue;
                var result = this.isHeadingCandidate(element, baseFontSize);
                if (result) candidates.push(result);
            }

            candidates.sort(function (a, b) { return b.score - a.score; });
            var topCandidates = candidates.slice(0, this.config.maxHeadings * 2);
            var filtered = this.removeDuplicates(topCandidates);

            var allHeadings = [];

            // ネイティブ見出しを追加
            for (var k = 0; k < existingHeadings.length; k++) {
                var h = existingHeadings[k];
                var text = h.textContent.trim();
                if (text) {
                    allHeadings.push({
                        element: h,
                        text: text.substring(0, 100),
                        level: parseInt(h.tagName.charAt(1)),
                        score: 100,
                        isNative: true
                    });
                }
            }

            // スタイル検出見出しを追加
            for (var m = 0; m < Math.min(filtered.length, this.config.maxHeadings); m++) {
                allHeadings.push(filtered[m]);
            }

            // DOMの出現順にソート
            allHeadings.sort(function (a, b) {
                var pos = a.element.compareDocumentPosition(b.element);
                return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });

            return allHeadings;
        }
    };

    // 検出実行
    var headings = HeadingDetector.detect();

    // ウィジェット作成
    var container = createEl('div', '');
    container.id = WIDGET_ID;

    function updateContainerStyle() {
        var baseStyle = 'position:fixed;z-index:999999;background:' + THEME.bg + ';border:1px solid ' + THEME.border + ';display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;color:' + THEME.text + ';box-sizing:border-box;';
        if (config.dock === 'left') {
            container.style.cssText = baseStyle + 'top:0;left:0;bottom:0;width:' + config.width + 'px;border-radius:0;box-shadow:2px 0 5px rgba(0,0,0,0.3);max-height:100vh;';
        } else if (config.dock === 'right') {
            container.style.cssText = baseStyle + 'top:0;right:0;bottom:0;width:' + config.width + 'px;border-radius:0;box-shadow:-2px 0 5px rgba(0,0,0,0.3);max-height:100vh;';
        } else {
            container.style.cssText = baseStyle + 'top:' + config.y + 'px;left:' + config.x + 'px;width:' + config.width + 'px;max-height:85vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
        }
    }
    updateContainerStyle();

    // ヘッダー
    var header = createEl('div', 'padding:10px 12px;background:' + THEME.headerBg + ';border-bottom:1px solid ' + THEME.border + ';display:flex;flex-direction:column;gap:8px;flex-shrink:0;user-select:none;cursor:move;border-radius:8px 8px 0 0;');
    var topRow = createEl('div', 'display:flex;justify-content:space-between;align-items:center;');
    var titleSpan = createEl('span', 'font-weight:bold;font-size:14px;', '🔍 Heading Detector');
    var ctrlGroup = createEl('div', 'display:flex;gap:6px;align-items:center;');

    function createBtn(text, title, onClick) {
        var b = document.createElement('button');
        b.textContent = text;
        b.title = title;
        b.style.cssText = 'border:1px solid ' + THEME.border + ';background:transparent;cursor:pointer;border-radius:4px;padding:4px 8px;font-size:11px;color:' + THEME.btnText + ';';
        b.onmouseover = function () { if (!b.classList.contains('active')) b.style.background = THEME.btnHover; };
        b.onmouseout = function () { if (!b.classList.contains('active')) b.style.background = 'transparent'; };
        b.onclick = onClick;
        b.onmousedown = function (e) { e.stopPropagation(); };
        return b;
    }

    var btnWrap = createBtn('Wrap', '折り返し On/Off', function () {
        config.wrap = !config.wrap;
        updateWrapBtn();
        renderTree();
    });

    function updateWrapBtn() {
        if (config.wrap) {
            btnWrap.style.background = THEME.activeBtnBg;
            btnWrap.style.color = THEME.activeBtnText;
            btnWrap.classList.add('active');
        } else {
            btnWrap.style.background = 'transparent';
            btnWrap.style.color = THEME.btnText;
            btnWrap.classList.remove('active');
        }
    }
    updateWrapBtn();

    var btnDockLeft = createBtn('⇦', '左ドック', function () {
        config.dock = (config.dock === 'left') ? 'none' : 'left';
        updateContainerStyle();
    });
    var btnDockRight = createBtn('⇨', '右ドック', function () {
        config.dock = (config.dock === 'right') ? 'none' : 'right';
        updateContainerStyle();
    });
    var btnClose = createBtn('×', '閉じる', function () { container.remove(); });

    ctrlGroup.appendChild(btnWrap);
    ctrlGroup.appendChild(btnDockLeft);
    ctrlGroup.appendChild(btnDockRight);
    ctrlGroup.appendChild(btnClose);
    topRow.appendChild(titleSpan);
    topRow.appendChild(ctrlGroup);
    header.appendChild(topRow);

    // 展開レベル選択
    var filterRow = createEl('div', 'display:flex;align-items:center;gap:6px;cursor:default;');
    filterRow.onmousedown = function (e) { e.stopPropagation(); };
    var lbl = createEl('span', 'font-size:11px;color:' + THEME.btnText + ';', 'Expand:');
    filterRow.appendChild(lbl);

    var levelBtns = [];
    function renderDepthBtns() {
        levelBtns.forEach(function (b) { b.remove(); });
        levelBtns = [];
        for (var i = 1; i <= 6; i++) {
            (function (lvl) {
                var btn = document.createElement('button');
                btn.textContent = lvl;
                var baseStyle = 'border:1px solid ' + THEME.border + ';cursor:pointer;border-radius:4px;width:26px;height:26px;font-size:11px;padding:0;text-align:center;color:' + THEME.text + ';';
                if (lvl === config.level) {
                    btn.style.cssText = baseStyle + 'background:' + THEME.activeBtnBg + ';color:' + THEME.activeBtnText + ';font-weight:bold;border-color:' + THEME.activeBtnBg + ';';
                } else {
                    btn.style.cssText = baseStyle + 'background:transparent;';
                    btn.onmouseover = function () { this.style.background = THEME.btnHover; };
                    btn.onmouseout = function () { this.style.background = 'transparent'; };
                }
                btn.onclick = function () {
                    config.level = lvl;
                    renderDepthBtns();
                    renderTree();
                };
                filterRow.appendChild(btn);
                levelBtns.push(btn);
            })(i);
        }
    }
    renderDepthBtns();
    header.appendChild(filterRow);

    // 件数表示
    var countRow = createEl('div', 'font-size:11px;color:' + THEME.btnText + ';', '📌 ネイティブ: ' + headings.filter(function (h) { return h.isNative; }).length + ' 件  ✨ 検出: ' + headings.filter(function (h) { return !h.isNative; }).length + ' 件');
    header.appendChild(countRow);

    container.appendChild(header);

    // コンテンツ
    var content = createEl('div', 'flex-grow:1;overflow-y:auto;padding:12px;background:' + THEME.bg + ';');
    container.appendChild(content);

    // ツリー構築
    function buildTree(elements) {
        var root = { children: [] };
        var stack = [{ level: 0, node: root }];
        elements.forEach(function (el) {
            var node = { heading: el, level: el.level, children: [] };
            while (stack.length > 1 && stack[stack.length - 1].level >= el.level) stack.pop();
            stack[stack.length - 1].node.children.push(node);
            stack.push({ level: el.level, node: node });
        });
        return root.children;
    }

    function getLevelColor(level) {
        return THEME['h' + level] || THEME.h6;
    }

    function createTreeDom(nodes, depth) {
        if (nodes.length === 0) return null;
        var ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none;padding-left:' + (depth === 0 ? '0' : '18px') + ';margin:0;';

        nodes.forEach(function (node) {
            var li = document.createElement('li');
            li.style.cssText = 'margin-bottom:6px;line-height:1.5;';

            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;';

            var hasChildren = node.children.length > 0;
            var isCollapsed = (node.level >= config.level);

            var toggle = document.createElement('span');
            toggle.textContent = hasChildren ? (isCollapsed ? '▶' : '▼') : '•';
            toggle.style.cssText = 'cursor:' + (hasChildren ? 'pointer' : 'default') + ';color:' + (hasChildren ? THEME.btnText : '#555') + ';font-size:10px;margin-top:3px;width:12px;flex-shrink:0;user-select:none;';

            var levelBadge = document.createElement('span');
            levelBadge.textContent = (node.heading.isNative ? '' : '✨') + 'H' + node.level;
            levelBadge.style.cssText = 'flex-shrink:0;font-size:9px;padding:2px 5px;border-radius:3px;background:' + getLevelColor(node.level) + ';color:#fff;font-weight:bold;';

            var link = document.createElement('a');
            link.textContent = node.heading.text.replace(/\s+/g, ' ');
            link.style.cssText = 'color:' + THEME.link + ';text-decoration:none;cursor:pointer;word-break:break-all;';
            if (!config.wrap) {
                link.style.whiteSpace = 'nowrap';
                link.style.overflow = 'hidden';
                link.style.textOverflow = 'ellipsis';
                link.style.display = 'block';
                link.style.maxWidth = '200px';
            }
            link.onclick = function (e) {
                e.preventDefault();
                smartScrollTo(node.heading.element);
            };
            link.onmouseover = function () { this.style.textDecoration = 'underline'; };
            link.onmouseout = function () { this.style.textDecoration = 'none'; };

            var childContainer = null;
            if (hasChildren) {
                childContainer = createTreeDom(node.children, depth + 1);
                childContainer.style.display = isCollapsed ? 'none' : 'block';
                childContainer.style.marginTop = '6px';
                toggle.onclick = function (e) {
                    e.stopPropagation();
                    var hidden = childContainer.style.display === 'none';
                    childContainer.style.display = hidden ? 'block' : 'none';
                    toggle.textContent = hidden ? '▼' : '▶';
                };
            }

            row.appendChild(toggle);
            row.appendChild(levelBadge);
            row.appendChild(link);
            li.appendChild(row);
            if (childContainer) li.appendChild(childContainer);
            ul.appendChild(li);
        });
        return ul;
    }

    function renderTree() {
        content.textContent = '';
        if (headings.length === 0) {
            content.appendChild(createEl('div', 'color:#888;text-align:center;padding:30px;', '見出しが見つかりませんでした'));
            return;
        }
        var tree = buildTree(headings);
        var dom = createTreeDom(tree, 0);
        if (dom) content.appendChild(dom);
    }

    // ドラッグ & ドロップ
    var isDrag = false, startX, startY, initLeft, initTop;
    header.onmousedown = function (e) {
        if (e.target.tagName === 'BUTTON') return;
        isDrag = true;
        startX = e.clientX;
        startY = e.clientY;
        var rect = container.getBoundingClientRect();
        initLeft = rect.left;
        initTop = rect.top;
    };
    win.addEventListener('mousemove', function (e) {
        if (!isDrag) return;
        e.preventDefault();
        if (config.dock !== 'none') {
            config.dock = 'none';
            updateContainerStyle();
            initLeft = e.clientX - 100;
            initTop = e.clientY - 20;
        }
        container.style.left = (initLeft + (e.clientX - startX)) + 'px';
        container.style.top = (initTop + (e.clientY - startY)) + 'px';
        container.style.right = '';
    });
    win.addEventListener('mouseup', function () {
        if (isDrag) {
            isDrag = false;
            if (config.dock === 'none') {
                var rect = container.getBoundingClientRect();
                config.x = rect.left;
                config.y = rect.top;
            }
        }
    });

    document.body.appendChild(container);
    renderTree();
})();
