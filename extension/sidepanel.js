/**
 * Heading Detector - Side Panel Script
 * Version 2.1 - Simplified UI
 */

// API名前空間の抽象化（Firefox/Chrome両対応）
const api = typeof browser !== 'undefined' ? browser : chrome;

document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const expandBtns = document.getElementById('expandBtns');
    const wrapBtn = document.getElementById('wrapBtn');
    const modeToggle = document.getElementById('modeToggle');
    const resultCount = document.getElementById('resultCount');
    const statsCompact = document.getElementById('statsCompact');
    const headingList = document.getElementById('headingList');
    const toast = document.getElementById('toast');

    let currentHeadings = [];
    let searchQuery = '';
    let expandLevel = 2.5;
    let wrapEnabled = false;
    let currentMode = 'sidepanel';

    // 展開レベルオプション
    const levelOptions = [1, 2, 2.5, 3, 4, 5, 6];

    // トースト通知
    function showToast(message, type = 'error') {
        toast.textContent = message;
        toast.className = 'toast ' + type + ' show';
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // 設定を読み込む
    async function loadConfig() {
        try {
            const config = await api.runtime.sendMessage({ action: 'getConfig' });
            if (config) {
                expandLevel = config.expandLevel !== undefined ? config.expandLevel : 2.5;
                currentMode = config.displayMode || 'sidepanel';
                wrapEnabled = config.wrap || false;
                updateExpandBtns();
                updateWrapBtn();
                updateModeToggle();
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }

    // 展開レベルボタンをレンダリング
    function renderExpandBtns() {
        expandBtns.innerHTML = '';
        levelOptions.forEach(lvl => {
            const btn = document.createElement('button');
            btn.className = 'btn-expand' + (lvl === expandLevel ? ' active' : '');
            btn.textContent = lvl === 2.5 ? 'A' : lvl;
            btn.title = lvl === 2.5 ? '回答まで表示' : 'H' + lvl + 'まで表示';
            btn.addEventListener('click', async () => {
                expandLevel = lvl;
                updateExpandBtns();
                renderHeadings(currentHeadings);
                await api.runtime.sendMessage({ action: 'saveExpandLevel', level: lvl });
            });
            expandBtns.appendChild(btn);
        });
    }

    function updateExpandBtns() {
        const btns = expandBtns.querySelectorAll('.btn-expand');
        btns.forEach(btn => {
            const btnLevel = btn.textContent === 'A' ? 2.5 : parseFloat(btn.textContent);
            btn.classList.toggle('active', btnLevel === expandLevel);
        });
    }

    // Wrap ボタン
    function updateWrapBtn() {
        wrapBtn.classList.toggle('active', wrapEnabled);
    }

    wrapBtn.addEventListener('click', async () => {
        wrapEnabled = !wrapEnabled;
        updateWrapBtn();
        renderHeadings(currentHeadings);
        await api.runtime.sendMessage({ action: 'saveWrap', wrap: wrapEnabled });
    });

    // モード切替ボタン
    function updateModeToggle() {
        modeToggle.textContent = currentMode === 'sidepanel' ? 'Popup' : 'Side Panel';
    }

    modeToggle.addEventListener('click', async () => {
        const newMode = currentMode === 'sidepanel' ? 'popup' : 'sidepanel';
        await api.runtime.sendMessage({ action: 'setDisplayMode', mode: newMode });
        currentMode = newMode;
        updateModeToggle();
    });

    // 検索機能
    searchInput.addEventListener('input', () => {
        searchQuery = searchInput.value.trim().toLowerCase();
        if (currentHeadings.length > 0) {
            renderHeadings(currentHeadings);
        }
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        if (currentHeadings.length > 0) {
            renderHeadings(currentHeadings);
        }
    });

    // 自動検出を実行
    async function autoDetect() {
        try {
            const [tab] = await api.tabs.query({ active: true, currentWindow: true });

            // 検出を実行（リトライ付き）
            let response = null;
            let lastError = null;
            for (let attempt = 0; attempt < 5; attempt++) {
                try {
                    // Chrome/Edge の場合は毎回 scripting.executeScript を試みる
                    // Firefox は content_scripts で自動注入されるため不要
                    if (api.scripting && api.scripting.executeScript) {
                        try {
                            await api.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ['content.js']
                            });
                            // スクリプト注入後、少し待機
                            await new Promise(resolve => setTimeout(resolve, 100));
                        } catch (e) {
                            console.log('Script injection error (may already be injected):', e.message);
                        }
                    }

                    response = await api.tabs.sendMessage(tab.id, { action: 'detect' });
                    if (response && response.success) {
                        break;
                    }
                } catch (e) {
                    lastError = e;
                    // コンテンツスクリプトがまだ準備できていない可能性がある
                    console.log(`Attempt ${attempt + 1} failed, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (response && response.success) {
                currentHeadings = response.headings;
                renderHeadings(currentHeadings);
            } else {
                throw lastError || new Error('検出に失敗しました');
            }
        } catch (error) {
            console.error('Detection error:', error);
            showToast('エラー: ' + error.message, 'error');
        }
    }

    // ツリー構造を構築
    function buildTree(headings) {
        const root = { children: [] };
        const stack = [{ level: 0, node: root }];

        headings.forEach((heading) => {
            const node = {
                heading: heading,
                level: heading.level,
                children: [],
                searchMatch: false,
                hasMatchInChildren: false
            };

            while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
                stack.pop();
            }
            stack[stack.length - 1].node.children.push(node);
            stack.push({ level: heading.level, node: node });
        });

        return root.children;
    }

    // 検索マッチをマーク
    function markSearchMatches(nodes, query) {
        if (!query) return false;
        let hasMatch = false;

        nodes.forEach((node) => {
            const textMatch = node.heading.text.toLowerCase().includes(query);
            const childMatch = node.children.length > 0 ? markSearchMatches(node.children, query) : false;
            node.searchMatch = textMatch;
            node.hasMatchInChildren = childMatch;
            if (textMatch || childMatch) hasMatch = true;
        });

        return hasMatch;
    }

    // バッジテキストを取得
    function getBadgeText(heading) {
        if (heading.isQuery) return '💬Q';
        if (heading.isResponse) return '💭A';
        const displayLevel = heading.originalLevel || Math.floor(heading.level);
        return (heading.isNative ? '' : '✨') + 'H' + displayLevel;
    }

    // バッジクラスを取得
    function getBadgeClass(heading) {
        if (heading.isQuery) return 'badge-query';
        if (heading.isResponse) return 'badge-response';
        const displayLevel = heading.originalLevel || Math.floor(heading.level);
        return 'badge-h' + displayLevel;
    }

    // ノードがGemini会話内かどうか判定
    function isInGeminiConversation(node) {
        const isConversationRoot = node.heading.text.includes('Gemini との会話') ||
            node.heading.text.includes('Conversations with Gemini');
        return isConversationRoot ||
            (node.heading.isInMainPane &&
                (node.heading.isQuery || node.heading.isResponse || node.heading.isInsideResponse));
    }

    // ツリーDOMを作成
    function createTreeDom(nodes, depth, parentInGemini = false) {
        if (nodes.length === 0) return null;

        const ul = document.createElement('ul');
        ul.className = 'heading-tree';
        if (depth > 0) ul.style.paddingLeft = '18px';

        nodes.forEach((node) => {
            const li = document.createElement('li');
            li.className = 'tree-item';

            const row = document.createElement('div');
            row.className = 'tree-row';

            const hasChildren = node.children.length > 0;
            const inGemini = parentInGemini || isInGeminiConversation(node);

            // 展開判定: Gemini会話内のみ展開レベルを適用
            let isCollapsed;
            if (inGemini) {
                if (node.heading.isInsideResponse && node.heading.originalLevel) {
                    // 回答内の見出し: originalLevelを使用
                    isCollapsed = node.heading.originalLevel >= expandLevel;
                } else {
                    // 回答外の見出し: node.levelを使用
                    isCollapsed = node.level >= expandLevel;
                }
            } else {
                isCollapsed = true;
            }

            // 検索でマッチした場合は展開
            if (searchQuery && (node.searchMatch || node.hasMatchInChildren)) {
                isCollapsed = false;
            }

            // トグルボタン
            const toggle = document.createElement('span');
            toggle.className = 'toggle';
            toggle.textContent = hasChildren ? (isCollapsed ? '▶' : '▼') : '•';
            if (!hasChildren) toggle.classList.add('no-children');

            // レベルバッジ
            const badge = document.createElement('span');
            badge.className = 'level-badge ' + getBadgeClass(node.heading);
            badge.textContent = getBadgeText(node.heading);
            if (node.heading.isInMainPane) badge.classList.add('main-pane');

            // リンク
            const link = document.createElement('a');
            link.className = 'heading-link';
            if (!wrapEnabled) link.classList.add('no-wrap');
            link.textContent = node.heading.text;
            link.href = '#';

            // 検索ハイライト
            if (searchQuery) {
                if (node.searchMatch) {
                    row.classList.add('search-match');
                } else if (node.hasMatchInChildren && isCollapsed) {
                    row.classList.add('has-match');
                }
            }

            link.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
                    await api.tabs.sendMessage(tab.id, { action: 'scrollTo', index: node.heading.index });
                } catch (error) {
                    console.error('Scroll error:', error);
                }
            });

            let childContainer = null;
            if (hasChildren) {
                childContainer = createTreeDom(node.children, depth + 1, inGemini);
                childContainer.style.display = isCollapsed ? 'none' : 'block';

                toggle.addEventListener('click', () => {
                    const hidden = childContainer.style.display === 'none';
                    childContainer.style.display = hidden ? 'block' : 'none';
                    toggle.textContent = hidden ? '▼' : '▶';

                    if (hidden) {
                        row.classList.remove('has-match');
                    } else if (node.hasMatchInChildren && !node.searchMatch && searchQuery) {
                        row.classList.add('has-match');
                    }
                });
            }

            row.appendChild(toggle);
            row.appendChild(badge);
            row.appendChild(link);
            li.appendChild(row);
            if (childContainer) li.appendChild(childContainer);
            ul.appendChild(li);
        });

        return ul;
    }

    // 見出しリストをレンダリング
    function renderHeadings(headings) {
        headingList.innerHTML = '';
        resultCount.textContent = headings.length;

        if (headings.length === 0) {
            statsCompact.textContent = '';
            return;
        }

        // 統計情報
        const mainCount = headings.filter(h => h.isInMainPane).length;
        const queryCount = headings.filter(h => h.isQuery).length;
        const respCount = headings.filter(h => h.isResponse).length;

        statsCompact.innerHTML = `🎯 メイン: ${mainCount} 件 &nbsp; 💬 Q: ${queryCount} &nbsp; 💭 A: ${respCount}`;

        // ツリー構築
        const tree = buildTree(headings);

        if (searchQuery) {
            markSearchMatches(tree, searchQuery);
        }

        const dom = createTreeDom(tree, 0, false);
        if (dom) headingList.appendChild(dom);
    }

    // 初期化
    renderExpandBtns();
    await loadConfig();
    await autoDetect();
});
