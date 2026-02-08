/**
 * Heading Detector Bookmarklet - Self-contained version
 * Based on working original version
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
        activeBtnText: '#ffffff',
        h1: 'rgba(255, 107, 107, 0.8)',
        h2: 'rgba(255, 159, 67, 0.8)',
        h3: 'rgba(255, 220, 0, 0.8)',
        h4: 'rgba(72, 219, 251, 0.8)',
        h5: 'rgba(162, 155, 254, 0.8)',
        h6: 'rgba(200, 200, 200, 0.8)',
        query: 'rgba(100, 200, 255, 0.8)',
        response: 'rgba(180, 130, 255, 0.8)'
    };

    var config = {
        level: 2.5,
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

    // メインペイン検出
    function detectMainPane() {
        var hostname = win.location.hostname;
        var allScrollables = Array.from(doc.querySelectorAll('*')).filter(function (el) {
            var style = win.getComputedStyle(el);
            var isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll');
            var hasScroll = el.scrollHeight > el.clientHeight + 50;
            var isVisible = el.offsetParent !== null || el === doc.body;
            return isScrollable && hasScroll && isVisible;
        });
        allScrollables.sort(function (a, b) {
            return b.clientWidth - a.clientWidth;
        });
        var mainCandidates = allScrollables.filter(function (el) {
            return el.clientWidth > win.innerWidth * 0.4;
        });
        if (mainCandidates.length > 0) {
            return mainCandidates[0];
        }
        if (hostname.includes('gemini.google.com')) {
            return doc.querySelector('main[role="main"]') || allScrollables[0] || null;
        }
        if (hostname.includes('notebooklm.google.com')) {
            return doc.querySelector('main, [role="main"]') || allScrollables[0] || null;
        }
        return doc.querySelector('main, [role="main"], article') || allScrollables[0] || null;
    }

    // Gemini チャット検出
    function detectGeminiChatItems(mainPane) {
        var items = [];
        var hostname = win.location.hostname;
        if (!hostname.includes('gemini.google.com')) return items;

        var processedTexts = new Set();

        // ユーザークエリ (H2)
        var queryHeadings = doc.querySelectorAll('h2');
        queryHeadings.forEach(function (h2) {
            if (mainPane && !mainPane.contains(h2)) return;
            if (h2.closest('[data-message-author-role="model"]') ||
                h2.closest('.model-response') ||
                h2.closest('[class*="model-response"]')) return;
            var text = h2.textContent.trim();
            if (!text || text.length < 2 || processedTexts.has(text)) return;
            processedTexts.add(text);
            items.push({
                element: h2,
                text: text.substring(0, 100),
                level: 2,
                isQuery: true,
                isResponse: false,
                isNative: true,
                isInMainPane: true
            });
        });

        // モデル応答
        var modelResponses = doc.querySelectorAll('[data-message-author-role="model"], .model-response, [class*="model-response"]');
        var processedResps = new Set();
        modelResponses.forEach(function (resp) {
            if (mainPane && !mainPane.contains(resp)) return;
            var isNested = false;
            processedResps.forEach(function (pr) {
                if (pr.contains(resp) || resp.contains(pr)) isNested = true;
            });
            if (isNested) return;
            processedResps.add(resp);

            var firstPara = resp.querySelector('p, .markdown-content > *:first-child, [class*="response-text"] > *:first-child');
            if (!firstPara) {
                var walker = doc.createTreeWalker(resp, NodeFilter.SHOW_TEXT, null, false);
                var firstText = walker.nextNode();
                if (firstText && firstText.textContent.trim().length > 10) {
                    firstPara = firstText.parentElement;
                }
            }

            if (firstPara) {
                var text = firstPara.textContent.trim();
                var firstSentence = text.match(/^[^。.!?！？]+[。.!?！？]?/);
                if (firstSentence) {
                    text = firstSentence[0];
                }
                if (text.length > 100) {
                    text = text.substring(0, 97) + '...';
                }
                if (text && text.length > 5 && !processedTexts.has(text)) {
                    processedTexts.add(text);
                    items.push({
                        element: firstPara,
                        text: text,
                        level: 2.5,
                        isQuery: false,
                        isResponse: true,
                        isNative: false,
                        isInMainPane: true
                    });
                }
            }

            // 応答内の見出し
            var responseHeadings = resp.querySelectorAll('h1, h2, h3, h4, h5, h6');
            responseHeadings.forEach(function (h) {
                var text = h.textContent.trim();
                if (!text || text.length < 2 || processedTexts.has(text)) return;
                processedTexts.add(text);
                var originalLvl = parseInt(h.tagName.charAt(1));
                var effectiveLevel = 2.5 + (originalLvl / 10);
                items.push({
                    element: h,
                    text: text.substring(0, 100),
                    level: effectiveLevel,
                    originalLevel: originalLvl,
                    isQuery: false,
                    isResponse: false,
                    isInsideResponse: true,
                    isNative: true,
                    isInMainPane: true
                });
            });
        });

        return items;
    }

    function getScrollContainer() {
        var mainPane = detectMainPane();
        if (mainPane && mainPane.scrollHeight > mainPane.clientHeight) {
            return mainPane;
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
        var targetScrollPos = targetTopRel - 20;
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

    function isInMainPane(element, mainPane) {
        if (!mainPane) return false;
        return mainPane.contains(element);
    }

    // 全見出し検出
    function detectAllHeadings() {
        var mainPane = detectMainPane();
        var allHeadings = [];
        var hostname = win.location.hostname;
        var addedElements = new Set();

        if (hostname.includes('gemini.google.com')) {
            var chatItems = detectGeminiChatItems(mainPane);
            chatItems.forEach(function (item) {
                if (!addedElements.has(item.element)) {
                    addedElements.add(item.element);
                    allHeadings.push(item);
                }
            });
        }

        var nativeHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
        nativeHeadings.forEach(function (h) {
            if (addedElements.has(h)) return;
            var text = h.textContent.trim();
            if (!text || text.length < 2) return;
            var lvl = h.tagName.match(/^H([1-6])$/) ? parseInt(h.tagName.charAt(1)) : (parseInt(h.getAttribute('aria-level')) || 3);
            var inMain = isInMainPane(h, mainPane);
            addedElements.add(h);
            allHeadings.push({
                element: h,
                text: text.substring(0, 100),
                level: lvl,
                score: 100,
                isNative: true,
                isQuery: false,
                isResponse: false,
                isInMainPane: inMain
            });
        });

        // 非Geminiまたはmainペインなしの場合のスタイル解析
        if (!hostname.includes('gemini.google.com') || !mainPane) {
            var baseFontSize = parseFloat(win.getComputedStyle(doc.body).fontSize) || 16;
            var selectors = 'p, div, span, li, strong, b, em';
            var elements = doc.querySelectorAll(selectors);
            var candidates = [];

            elements.forEach(function (el) {
                if (addedElements.has(el)) return;
                if (el.offsetParent === null && el.tagName !== 'BODY') return;

                var insideHeading = false;
                nativeHeadings.forEach(function (h) {
                    if (h.contains(el)) insideHeading = true;
                });
                if (insideHeading) return;

                var style = win.getComputedStyle(el);
                var fontSize = parseFloat(style.fontSize);
                var fontWeight = parseInt(style.fontWeight) || 400;
                var text = el.textContent.trim();

                if (!text || text.length > 150 || text.length < 3) return;
                if (el.children.length > 5) return;

                var isBigger = fontSize >= baseFontSize * 1.15;
                var isBold = fontWeight >= 600;
                if (!isBigger && !isBold) return;

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
                if (['block', 'flex', 'grid'].includes(style.display)) score += 15;
                if (text.length <= 50) score += 10;

                if (score >= 40) {
                    candidates.push({
                        element: el,
                        text: text.substring(0, 100),
                        level: level,
                        score: score,
                        isNative: false,
                        isQuery: false,
                        isResponse: false,
                        isInMainPane: isInMainPane(el, mainPane)
                    });
                }
            });

            candidates.sort(function (a, b) {
                return b.score - a.score;
            });

            candidates.forEach(function (c) {
                var isDup = false;
                addedElements.forEach(function (added) {
                    if (added.contains(c.element) || c.element.contains(added)) {
                        isDup = true;
                    }
                });
                if (!isDup) {
                    addedElements.add(c.element);
                    allHeadings.push(c);
                }
            });
        }

        allHeadings.sort(function (a, b) {
            var pos = a.element.compareDocumentPosition(b.element);
            return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        return { headings: allHeadings, mainPane: mainPane };
    }

    // 検出実行
    var result = detectAllHeadings();
    var headings = result.headings;
    var mainPane = result.mainPane;

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
    var btnClose = createBtn('×', '閉じる', function () {
        container.remove();
    });

    ctrlGroup.appendChild(btnWrap);
    ctrlGroup.appendChild(btnDockLeft);
    ctrlGroup.appendChild(btnDockRight);
    ctrlGroup.appendChild(btnClose);
    topRow.appendChild(titleSpan);
    topRow.appendChild(ctrlGroup);
    header.appendChild(topRow);

    // 検索行
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

    // レベルボタン行
    var filterRow = createEl('div', 'display:flex;align-items:center;gap:6px;cursor:default;');
    filterRow.onmousedown = function (e) { e.stopPropagation(); };
    var lbl = createEl('span', 'font-size:11px;color:' + THEME.btnText + ';', 'Expand:');
    filterRow.appendChild(lbl);

    var levelBtns = [];
    var levelOptions = [1, 2, 2.5, 3, 4, 5, 6];

    function renderDepthBtns() {
        levelBtns.forEach(function (b) { b.remove(); });
        levelBtns = [];
        levelOptions.forEach(function (lvl) {
            var btn = document.createElement('button');
            btn.textContent = lvl === 2.5 ? 'A' : lvl;
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

    // カウント行
    var mainCount = headings.filter(function (h) { return h.isInMainPane; }).length;
    var queryCount = headings.filter(function (h) { return h.isQuery; }).length;
    var respCount = headings.filter(function (h) { return h.isResponse; }).length;
    var countRow = createEl('div', 'font-size:11px;color:' + THEME.btnText + ';', '🎯 メイン: ' + mainCount + ' 件 💬 Q: ' + queryCount + ' 💭 A: ' + respCount + ' 📌 全体: ' + headings.length + ' 件');
    header.appendChild(countRow);

    container.appendChild(header);

    // コンテンツ
    var content = createEl('div', 'flex-grow:1;overflow-y:auto;padding:12px;background:' + THEME.bg + ';');
    container.appendChild(content);

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
        if (heading.isQuery) return THEME.query;
        if (heading.isResponse) return THEME.response;
        var displayLevel = heading.originalLevel || Math.floor(heading.level);
        return THEME['h' + displayLevel] || THEME.h6;
    }

    function getBadgeText(heading) {
        if (heading.isQuery) return '💬Q';
        if (heading.isResponse) return '💭A';
        var displayLevel = heading.originalLevel || Math.floor(heading.level);
        return (heading.isNative ? '' : '✨') + 'H' + displayLevel;
    }

    function isInGeminiConversation(node) {
        var isConversationRoot = node.heading.text.includes('Gemini との会話') || node.heading.text.includes('Conversations with Gemini');
        return isConversationRoot || (node.heading.isInMainPane && (node.heading.isQuery || node.heading.isResponse || node.heading.isInsideResponse));
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

            var isCollapsed;
            if (inGemini) {
                if (node.heading.isInsideResponse && node.heading.originalLevel) {
                    isCollapsed = node.heading.originalLevel >= config.level;
                } else {
                    isCollapsed = node.level >= config.level;
                }
            } else {
                isCollapsed = true;
            }

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
        if (headings.length === 0) {
            content.appendChild(createEl('div', 'color:#888;text-align:center;padding:30px;', '見出しが見つかりませんでした'));
            return;
        }
        var tree = buildTree(headings);
        if (config.searchQuery) {
            markSearchMatches(tree, config.searchQuery);
        }
        var dom = createTreeDom(tree, 0, false);
        if (dom) content.appendChild(dom);
    }

    // ドラッグ
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
