/**
 * Heading Detector Bookmarklet - Enhanced for Gemini/NotebookLM Chat Navigation
 * Version 2.0 - Fixed main pane detection and chat extraction
 */

javascript: (function () {
    var WIDGET_ID = 'heading-detector-widget';
    var doc = document, win = window;

    var THEME = {
        bg: '#1e1e1e',
        text: '#e3e3e3',
        border: '#444746',
        headerBg: '#2f3136',
        link: '#a8c7fa',
        hover: '#3c4043',
        highlight: 'rgba(255, 235, 59, 0.4)',
        searchHighlight: 'rgba(255, 107, 107, 0.6)',
        btnText: '#c4c7c5',
        btnHover: '#4f545c',
        activeBtnBg: '#0b57d0',
        activeBtnText: '#ffffff'
    };

    var config = {
        level: 2.5,  // デフォルトは回答レベルまで展開（回答内の見出しは折りたたみ）
        x: 20,
        y: 60,
        width: 380,
        dock: 'none',
        wrap: false,
        searchQuery: ''
    };

    var existing = document.getElementById(WIDGET_ID);
    if (existing) existing.remove();

    function createEl(tag, styles, text) {
        var el = document.createElement(tag);
        if (styles) el.style.cssText = styles;
        if (text) el.textContent = text;
        return el;
    }

    // 検出実行
    HeadingDetector.detect(); // Run detection to populate HeadingDetector.headings
    var headings = HeadingDetector.headings;

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

    // 検索欄
    var searchRow = createEl('div', 'display:flex;gap:6px;align-items:center;');
    searchRow.onmousedown = function (e) { e.stopPropagation(); };
    var searchInput = createEl('input', 'flex:1;padding:6px 10px;border:1px solid ' + THEME.border + ';border-radius:4px;background:#2a2a2a;color:' + THEME.text + ';font-size:12px;outline:none;');
    searchInput.type = 'text';
    searchInput.placeholder = '🔎 見出しを検索...';
    searchInput.oninput = function () {
        config.searchQuery = this.value.trim().toLowerCase();
        renderTree();
    };
    var searchClear = createBtn('✕', 'クリア', function () {
        searchInput.value = '';
        config.searchQuery = '';
        renderTree();
    });
    searchRow.appendChild(searchInput);
    searchRow.appendChild(searchClear);
    header.appendChild(searchRow);

    // 展開レベル選択
    var filterRow = createEl('div', 'display:flex;align-items:center;gap:6px;cursor:default;');
    filterRow.onmousedown = function (e) { e.stopPropagation(); };
    var lbl = createEl('span', 'font-size:11px;color:' + THEME.btnText + ';', 'Expand:');
    filterRow.appendChild(lbl);

    var levelBtns = [];
    // Expandレベルの選択肢: 1, 2, 2.5(回答まで), 3, 4, 5, 6
    var levelOptions = [1, 2, 2.5, 3, 4, 5, 6];
    function renderDepthBtns() {
        levelBtns.forEach(function (b) { b.remove(); });
        levelBtns = [];
        levelOptions.forEach(function (lvl) {
            var btn = document.createElement('button');
            btn.textContent = lvl === 2.5 ? 'A' : lvl;  // 2.5は「A」と表示
            btn.title = lvl === 2.5 ? '回答まで表示' : 'H' + lvl + 'まで表示';
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
        });
    }
    renderDepthBtns();
    header.appendChild(filterRow);

    // 件数表示
    var mainCount = headings.filter(function (h) { return h.isInMainPane; }).length;
    var queryCount = headings.filter(function (h) { return h.isQuery; }).length;
    var respCount = headings.filter(function (h) { return h.isResponse; }).length;
    var countRow = createEl('div', 'font-size:11px;color:' + THEME.btnText + ';',
        '🎯 メイン: ' + mainCount + ' 件  💬 Q: ' + queryCount + '  💭 A: ' + respCount + '  📌 全体: ' + headings.length + ' 件');
    header.appendChild(countRow);

    container.appendChild(header);









    function getScrollContainer() {
        if (HeadingDetector.mainPane && HeadingDetector.mainPane.scrollHeight > HeadingDetector.mainPane.clientHeight) {
            return HeadingDetector.mainPane;
        }
        return win;
    }

    function smartScrollTo(targetEl) {
        var container = getScrollContainer();
        var isWindow = (container === win);
        var currentScroll = isWindow ? win.scrollY : container.scrollTop;
        var rect = targetEl.getBoundingClientRect();
        var containerTop = isWindow ? 0 : container.getBoundingClientRect().top;
        var targetTopRel = currentScroll + rect.top - containerTop;
        // 見出しを画面上部に表示（20pxのマージン）
        var targetScrollPos = targetTopRel - 20;

        if (isWindow) win.scrollTo({ top: targetScrollPos, behavior: 'smooth' });
        else container.scrollTo({ top: targetScrollPos, behavior: 'smooth' });

        // Highlight using the core HeadingDetector's highlight function
        HeadingDetector.highlight([{ element: targetEl }]);
    }

    function markSearchMatches(nodes, query) {
        if (!query) return false;
        var hasMatch = false;
        nodes.forEach(function (node) {
            var textMatch = node.heading.text.toLowerCase().includes(query);
            var childMatch = node.children.length > 0 ? markSearchMatches(node.children, query) : false;
            node.searchMatch = textMatch;
            node.hasMatchInChildren = childMatch;
            if (textMatch || childMatch) hasMatch = true;
        });
        return hasMatch;
    }

    function buildTree(elements) {
        var root = { children: [] };
        var stack = [{ level: 0, node: root }];
        elements.forEach(function (el) {
            var node = { heading: el, level: el.level, children: [], searchMatch: false, hasMatchInChildren: false };
            while (stack.length > 1 && stack[stack.length - 1].level >= el.level) stack.pop();
            stack[stack.length - 1].node.children.push(node);
            stack.push({ level: el.level, node: node });
        });
        return root.children;
    }

    function getLevelColor(heading) {
        if (heading.isQuery) return HeadingDetector.config.highlightColors.query;
        if (heading.isResponse) return HeadingDetector.config.highlightColors.response;
        // 回答内の見出しは元のレベルで色を決定
        var displayLevel = heading.originalLevel || Math.floor(heading.level);
        return HeadingDetector.config.highlightColors['h' + displayLevel] || HeadingDetector.config.highlightColors.h6;
    }

    function getBadgeText(heading) {
        if (heading.isQuery) return '💬Q';
        if (heading.isResponse) return '💭A';
        // 回答内の見出しは元のレベルを表示
        var displayLevel = heading.originalLevel || Math.floor(heading.level);
        return (heading.isNative ? '' : '✨') + 'H' + displayLevel;
    }

    // ノードがGemini会話内かどうか判定
    function isInGeminiConversation(node) {
        // 「Gemini との会話」見出しを会話ルートとして認識
        var isConversationRoot = node.heading.text.includes('Gemini との会話') ||
            node.heading.text.includes('Conversations with Gemini');
        return isConversationRoot ||
            (node.heading.isInMainPane &&
                (node.heading.isQuery || node.heading.isResponse || node.heading.isInsideResponse));
    }

    function createTreeDom(nodes, depth, parentInGemini) {
        if (nodes.length === 0) return null;
        var ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none;padding-left:' + (depth === 0 ? '0' : '18px') + ';margin:0;';

        nodes.forEach(function (node) {
            var li = document.createElement('li');
            li.style.cssText = 'margin-bottom:6px;line-height:1.5;';

            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;';

            var hasChildren = node.children.length > 0;
            var isMain = node.heading.isInMainPane;
            var inGemini = parentInGemini || isInGeminiConversation(node);

            // 展開判定: Gemini会話内のみ展開レベルを適用
            var isCollapsed;
            if (inGemini) {
                if (node.heading.isInsideResponse && node.heading.originalLevel) {
                    // 回答内の見出し: originalLevelを使用
                    isCollapsed = node.heading.originalLevel >= config.level;
                } else {
                    // 回答外の見出し: node.levelを使用
                    isCollapsed = node.level >= config.level;
                }
            } else {
                // Gemini会話外: 常に折りたたみ
                isCollapsed = true;
            }

            // 検索でマッチした場合は展開
            if (config.searchQuery && (node.searchMatch || node.hasMatchInChildren)) {
                isCollapsed = false;
            }

            var toggle = document.createElement('span');
            toggle.textContent = hasChildren ? (isCollapsed ? '▶' : '▼') : '•';
            toggle.style.cssText = 'cursor:' + (hasChildren ? 'pointer' : 'default') + ';color:' + (hasChildren ? THEME.btnText : '#555') + ';font-size:10px;margin-top:3px;width:12px;flex-shrink:0;user-select:none;';

            var levelBadge = document.createElement('span');
            levelBadge.textContent = getBadgeText(node.heading);
            levelBadge.style.cssText = 'flex-shrink:0;font-size:9px;padding:2px 5px;border-radius:3px;background:' + getLevelColor(node.heading) + ';color:#fff;font-weight:bold;';

            if (isMain) {
                levelBadge.style.boxShadow = '0 0 0 2px rgba(100, 255, 100, 0.5)';
            }

            var link = document.createElement('a');
            link.textContent = node.heading.text.replace(/\s+/g, ' ');
            link.style.cssText = 'color:' + THEME.link + ';text-decoration:none;cursor:pointer;word-break:break-all;';
            if (!config.wrap) {
                link.style.whiteSpace = 'nowrap';
                link.style.overflow = 'hidden';
                link.style.textOverflow = 'ellipsis';
                link.style.display = 'block';
                link.style.maxWidth = '220px';
            }

            // 検索ハイライト
            if (config.searchQuery) {
                if (node.searchMatch) {
                    row.style.background = THEME.searchHighlight;
                    row.style.borderRadius = '4px';
                    row.style.padding = '2px 4px';
                    row.style.margin = '-2px -4px';
                } else if (node.hasMatchInChildren && isCollapsed) {
                    row.style.background = 'rgba(255, 107, 107, 0.3)';
                    row.style.borderRadius = '4px';
                    row.style.padding = '2px 4px';
                    row.style.margin = '-2px -4px';
                }
            }

            link.onclick = function (e) {
                e.preventDefault();
                smartScrollTo(node.heading.element);
            };
            link.onmouseover = function () { this.style.textDecoration = 'underline'; };
            link.onmouseout = function () { this.style.textDecoration = 'none'; };

            var childContainer = null;
            if (hasChildren) {
                childContainer = createTreeDom(node.children, depth + 1, inGemini);
                childContainer.style.display = isCollapsed ? 'none' : 'block';
                childContainer.style.marginTop = '6px';

                var rowRef = row;
                var nodeRef = node;
                toggle.onclick = function (e) {
                    e.stopPropagation();
                    var hidden = childContainer.style.display === 'none';
                    childContainer.style.display = hidden ? 'block' : 'none';
                    toggle.textContent = hidden ? '▼' : '▶';
                    // ハイライト更新
                    if (childContainer.style.display === 'block') {
                        if (nodeRef.hasMatchInChildren && !nodeRef.searchMatch) {
                            rowRef.style.background = '';
                            rowRef.style.padding = '';
                            rowRef.style.margin = '';
                        }
                    } else {
                        if (nodeRef.hasMatchInChildren && !nodeRef.searchMatch && config.searchQuery) {
                            rowRef.style.background = 'rgba(255, 107, 107, 0.3)';
                            rowRef.style.borderRadius = '4px';
                            rowRef.style.padding = '2px 4px';
                            rowRef.style.margin = '-2px -4px';
                        }
                    }
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
        if (HeadingDetector.headings.length === 0) {
            content.appendChild(createEl('div', 'color:#888;text-align:center;padding:30px;', '見出しが見つかりませんでした'));
            return;
        }
        var tree = buildTree(HeadingDetector.headings);

        if (config.searchQuery) {
            markSearchMatches(tree, config.searchQuery);
        }

        var dom = createTreeDom(tree, 0, false);
        if (dom) content.appendChild(dom);
    }

    // ドラッグ & ドロップ
    var isDrag = false, startX, startY, initLeft, initTop;
    header.onmousedown = function (e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
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
