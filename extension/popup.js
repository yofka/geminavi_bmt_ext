/**
 * Heading Detector - Popup Script
 * Version 2.0 - Synced with bookmarklet features
 */

document.addEventListener('DOMContentLoaded', () => {
    const detectBtn = document.getElementById('detectBtn');
    const clearBtn = document.getElementById('clearBtn');
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');
    const status = document.getElementById('status');
    const results = document.getElementById('results');
    const resultCount = document.getElementById('resultCount');
    const headingList = document.getElementById('headingList');
    const statsInfo = document.getElementById('statsInfo');

    let currentHeadings = [];
    let searchQuery = '';

    // 検出ボタン
    detectBtn.addEventListener('click', async () => {
        status.textContent = '検出中...';
        status.className = 'status';
        detectBtn.disabled = true;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // コンテンツスクリプトを注入
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            });

            // 検出を実行
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'detect' });

            if (response && response.success) {
                currentHeadings = response.headings;
                renderHeadings(currentHeadings);
                status.textContent = '検出完了！';
                status.className = 'status success';
                clearBtn.disabled = false;
            } else {
                throw new Error('検出に失敗しました');
            }
        } catch (error) {
            console.error('Detection error:', error);
            status.textContent = 'エラー: ' + error.message;
            status.className = 'status error';
        } finally {
            detectBtn.disabled = false;
        }
    });

    // クリアボタン
    clearBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.tabs.sendMessage(tab.id, { action: 'clear' });

            currentHeadings = [];
            headingList.innerHTML = '';
            results.style.display = 'none';
            statsInfo.style.display = 'none';
            status.textContent = 'ハイライトをクリアしました';
            status.className = 'status';
            clearBtn.disabled = true;
        } catch (error) {
            console.error('Clear error:', error);
        }
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
        return (heading.isNative ? '' : '✨') + 'H' + heading.level;
    }

    // バッジクラスを取得
    function getBadgeClass(heading) {
        if (heading.isQuery) return 'badge-query';
        if (heading.isResponse) return 'badge-response';
        return 'badge-h' + heading.level;
    }

    // ツリーDOMを作成
    function createTreeDom(nodes, depth) {
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
            const isMain = node.heading.isInMainPane;

            // メインペイン: H3まで展開、それ以外: 折りたたみ
            const collapseLevel = isMain ? 4 : 1;
            let isCollapsed = !isMain || (node.level >= collapseLevel);

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
            if (isMain) badge.classList.add('main-pane');

            // リンク
            const link = document.createElement('a');
            link.className = 'heading-link';
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
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    await chrome.tabs.sendMessage(tab.id, { action: 'scrollTo', index: node.heading.index });
                } catch (error) {
                    console.error('Scroll error:', error);
                }
            });

            let childContainer = null;
            if (hasChildren) {
                childContainer = createTreeDom(node.children, depth + 1);
                childContainer.style.display = isCollapsed ? 'none' : 'block';

                toggle.addEventListener('click', () => {
                    const hidden = childContainer.style.display === 'none';
                    childContainer.style.display = hidden ? 'block' : 'none';
                    toggle.textContent = hidden ? '▼' : '▶';

                    // ハイライト更新
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
            results.style.display = 'none';
            statsInfo.style.display = 'none';
            status.textContent = '見出しが見つかりませんでした';
            return;
        }

        results.style.display = 'block';

        // 統計情報
        const mainCount = headings.filter(h => h.isInMainPane).length;
        const queryCount = headings.filter(h => h.isQuery).length;
        const respCount = headings.filter(h => h.isResponse).length;

        statsInfo.style.display = 'block';
        statsInfo.innerHTML = `🎯 メイン: ${mainCount} 件 &nbsp; 💬 Q: ${queryCount} &nbsp; 💭 A: ${respCount}`;

        // ツリー構築
        const tree = buildTree(headings);

        if (searchQuery) {
            markSearchMatches(tree, searchQuery);
        }

        const dom = createTreeDom(tree, 0);
        if (dom) headingList.appendChild(dom);
    }
});
