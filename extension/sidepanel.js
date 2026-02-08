/**
 * Heading Detector - Side Panel Script
 * Version 2.1 - Simplified UI
 */

// API名前空間の抽象化（Firefox/Chrome両対応）
const api = typeof browser !== 'undefined' ? browser : chrome;

console.log('sidepanel.js loaded (top of file)'); // 追加

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded fired.'); // 追加
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
    let hBadgeEnabled = false; // Hバッジ表示のデフォルトはオフ
    let currentMode = 'sidepanel';

    // Hバッジトグル
    const hBadgeToggle = document.getElementById('hBadgeToggle');

    // 自動更新機能
    let autoRefreshEnabled = true;
    let autoRefreshDelay = 1500; // ミリ秒
    let autoRefreshInterval = null;
    let pendingUpdate = false;

    // 自動更新UI要素
    const manualRefresh = document.getElementById('manualRefresh');
    const autoToggle = document.getElementById('autoToggle');
    const delayDown = document.getElementById('delayDown');
    const delayUp = document.getElementById('delayUp');
    const delayValue = document.getElementById('delayValue');
    const autoStatus = document.getElementById('autoStatus');

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
                hBadgeEnabled = config.hBadgeEnabled || false;
                updateExpandBtns();
                updateWrapBtn();
                updateHBadgeToggle();
                updateModeToggle();
                // 色設定を適用
                if (window.HDSettings) {
                    if (config.colors) {
                        window.HDSettings.colors = { ...window.HDSettings.getDefaultColors(), ...config.colors };
                    }
                    window.HDSettings.applyColors();
                }
            }
        } catch (error) {
            console.error('Failed to load config:', error);
        }
    }

    // Hバッジトグルを更新
    function updateHBadgeToggle() {
        if (hBadgeToggle) {
            hBadgeToggle.checked = hBadgeEnabled;
        }
    }

    // Hバッジトグルイベント
    if (hBadgeToggle) {
        hBadgeToggle.addEventListener('change', async () => {
            hBadgeEnabled = hBadgeToggle.checked;
            renderHeadings(currentHeadings);
            await api.runtime.sendMessage({ action: 'saveHBadgeEnabled', enabled: hBadgeEnabled });
        });
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

    // 設定ボタン
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn && window.HDSettings) {
        settingsBtn.addEventListener('click', () => {
            window.HDSettings.open(() => {
                // 色が変更されたときにUIを更新
            });
        });
    }

    // Color ボタン（本文の色分けトグル）
    let highlightEnabled = true;
    const colorBtn = document.getElementById('colorBtn');
    if (colorBtn) {
        colorBtn.addEventListener('click', async () => {
            highlightEnabled = !highlightEnabled;
            colorBtn.classList.toggle('active', highlightEnabled);
            try {
                const [tab] = await api.tabs.query({ active: true, currentWindow: true });
                if (tab && tab.id) {
                    await api.tabs.sendMessage(tab.id, {
                        action: highlightEnabled ? 'enableHighlight' : 'disableHighlight'
                    });
                }
            } catch (error) {
                console.error('Highlight toggle error:', error);
            }
        });
    }

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

    // 自動更新コントロール
    function updateStatus(text, statusClass = '') {
        if (autoStatus) {
            autoStatus.textContent = text;
            autoStatus.className = 'auto-status';
            if (statusClass) {
                autoStatus.classList.add(statusClass);
            }
        }
    }

    function updateDelayDisplay() {
        if (delayValue) {
            delayValue.textContent = (autoRefreshDelay / 1000).toFixed(1) + 's';
        }
    }

    function startAutoRefresh() {
        stopAutoRefresh();
        if (!autoRefreshEnabled) return;

        autoRefreshInterval = setInterval(async () => {
            if (pendingUpdate) return;

            try {
                const [tab] = await api.tabs.query({ active: true, currentWindow: true });

                // コンテンツスクリプトに変更があるか確認
                const response = await api.tabs.sendMessage(tab.id, { action: 'checkForChanges' });

                if (response && response.hasChanges) {
                    pendingUpdate = true;
                    updateStatus('変更検出中...', 'pending');

                    // デバウンス後に再検出
                    setTimeout(async () => {
                        await autoDetect();
                        updateStatus('自動更新: ' + new Date().toLocaleTimeString(), 'updated');
                        pendingUpdate = false;
                    }, autoRefreshDelay);
                }
            } catch (e) {
                // エラーは無視（タブが閉じられた等）
            }
        }, 1000); // 1秒毎にチェック

        updateStatus('自動更新: ON', '');
    }

    function stopAutoRefresh() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        pendingUpdate = false;
    }

    // 手動更新ボタン
    manualRefresh.addEventListener('click', async () => {
        await autoDetect();
        updateStatus('手動更新: ' + new Date().toLocaleTimeString(), 'updated');
    });

    // 自動更新トグル
    autoToggle.addEventListener('click', () => {
        autoRefreshEnabled = !autoRefreshEnabled;
        autoToggle.classList.toggle('active', autoRefreshEnabled);
        if (autoRefreshEnabled) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
            updateStatus('自動更新: OFF', '');
        }
    });

    // 遅延時間調整
    delayDown.addEventListener('click', () => {
        autoRefreshDelay = Math.max(500, autoRefreshDelay - 500);
        updateDelayDisplay();
    });

    delayUp.addEventListener('click', () => {
        autoRefreshDelay = Math.min(5000, autoRefreshDelay + 500);
        updateDelayDisplay();
    });

    // 自動検出を実行
    async function autoDetect() {
        console.log('autoDetect() called.'); // 追加
        try {
            const [tab] = await api.tabs.query({ active: true, currentWindow: true });

            if (!tab || !tab.id) {
                console.log('No active tab found');
                showToast('アクティブなタブが見つかりません', 'error');
                return;
            }

            // 特殊なページ（chrome://, about:, etc.）はスキップ
            // 注意: サイドパネルでは activeTab 権限がないため tab.url が undefined の場合がある
            // その場合は URL チェックをスキップして処理を続行する
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('about:') || tab.url.startsWith('edge://') || tab.url.startsWith('moz-extension://') || tab.url.startsWith('chrome-extension://'))) {
                showToast('このページでは実行できません', 'error');
                return;
            }

            // Chrome/Edge の場合は scripting.executeScript を試みる
            if (api.scripting && api.scripting.executeScript) {
                try {
                    await api.scripting.executeScript({
                        target: { tabId: tab.id },
                        files: ['heading-detector-core.js', 'content.js']
                    });
                    // スクリプト注入後、初回は長めに待機（サイドパネル最初起動時用）
                    await new Promise(resolve => setTimeout(resolve, 300));
                } catch (e) {
                    // 既に注入済みの場合はエラーになるが問題ない
                    console.log('Script injection note:', e.message);
                }
            } else {
                // Firefox の場合: content_scripts が自動注入されるまで待機
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // まず ping でコンテンツスクリプトの準備を確認
            const maxPingAttempts = 15;  // 増加
            let contentScriptReady = false;

            for (let attempt = 0; attempt < maxPingAttempts; attempt++) {
                try {
                    const pingResponse = await api.tabs.sendMessage(tab.id, { action: 'ping' });
                    if (pingResponse && pingResponse.ready) {
                        contentScriptReady = true;
                        console.log('Content script ready after', attempt + 1, 'ping attempts');
                        break;
                    }
                } catch (e) {
                    console.log(`Ping attempt ${attempt + 1}/${maxPingAttempts} failed:`, e.message);
                    // 指数バックオフ: 150, 200, 250, ... ms （サイドパネル用に増加）
                    await new Promise(resolve => setTimeout(resolve, 150 + 50 * attempt));
                }
            }

            if (!contentScriptReady) {
                showToast('ページを再読み込みしてください', 'error');
                return;
            }

            // 検出を実行
            let response = null;
            let lastError = null;
            const maxAttempts = 3;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                try {
                    response = await api.tabs.sendMessage(tab.id, { action: 'detect' });
                    if (response && response.success) {
                        break;
                    }
                } catch (e) {
                    lastError = e;
                    console.log(`Detect attempt ${attempt + 1}/${maxAttempts} failed:`, e.message);
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            if (response && response.success) {
                console.log('autoDetect: Headings detected successfully. Count:', response.headings.length); // 追加
                currentHeadings = response.headings;
                renderHeadings(currentHeadings);
            } else {
                const errorMsg = lastError?.message || '検出に失敗しました';
                showToast('エラー: ' + errorMsg, 'error');
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

    // バッジ情報を取得（複数バッジ対応）
    function getBadges(heading) {
        const badges = [];
        const displayLevel = heading.originalLevel || Math.floor(heading.level);

        // Hバッジ（hBadgeEnabled時のみ表示）
        if (hBadgeEnabled && displayLevel >= 1 && displayLevel <= 6) {
            badges.push({
                text: (heading.isNative ? '' : '✨') + 'H' + displayLevel,
                className: 'badge-h' + displayLevel
            });
        }

        // Q/Aバッジ
        if (heading.isQuery) {
            badges.push({ text: '💬Q', className: 'badge-query' });
        }
        if (heading.isResponse) {
            badges.push({ text: '💭A', className: 'badge-response' });
        }

        // Hバッジオフかつ非Q/A の場合はHバッジのみ表示
        if (badges.length === 0 && displayLevel >= 1 && displayLevel <= 6) {
            badges.push({
                text: (heading.isNative ? '' : '✨') + 'H' + displayLevel,
                className: 'badge-h' + displayLevel
            });
        }

        return badges;
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
            toggle.textContent = hasChildren ? (isCollapsed ? '▶' : '▼') : '';
            if (!hasChildren) toggle.classList.add('no-children');

            // レベルバッジ（複数対応）
            const badges = getBadges(node.heading);
            const badgeContainer = document.createElement('span');
            badgeContainer.className = 'badge-container';
            badges.forEach(b => {
                const badge = document.createElement('span');
                badge.className = 'level-badge ' + b.className;
                badge.textContent = b.text;
                if (node.heading.isInMainPane) badge.classList.add('main-pane');
                badgeContainer.appendChild(badge);
            });

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
            row.appendChild(badgeContainer);
            row.appendChild(link);
            li.appendChild(row);
            if (childContainer) li.appendChild(childContainer);
            ul.appendChild(li);
        });

        return ul;
    }

    // 見出しリストをレンダリング
    function renderHeadings(headings) {
        console.log('renderHeadings() called. Headings count:', headings.length, 'Headings:', headings); // 追加
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
    updateDelayDisplay();
    await loadConfig();
    await autoDetect();

    // 自動更新開始
    if (autoRefreshEnabled) {
        startAutoRefresh();
    }
});

console.log('DOMContentLoaded listener registered.'); // 追加

