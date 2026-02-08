/**
 * Heading Detector - In-Page Panel
 * 
 * ドラッグ、リサイズ、ドッキング機能を持つインページパネル
 */

(function () {
    'use strict';

    const api = typeof browser !== 'undefined' ? browser : chrome;

    // パネルが既に存在する場合は何もしない
    if (window.HeadingDetectorPanel) return;

    const Panel = {
        panel: null,
        isVisible: false,
        isDragging: false,
        isResizing: false,
        resizeDir: null,
        dockMode: null, // 'left', 'right', or null
        dragOffset: { x: 0, y: 0 },
        position: { x: 50, y: 50 },
        size: { width: 380, height: 500 },
        headings: [],
        expandLevel: 2.5,
        wrapText: true,
        highlightEnabled: true,
        searchQuery: '',
        // 自動更新機能
        autoRefreshEnabled: true,
        autoRefreshDelay: 1500, // ミリ秒
        observer: null,
        debounceTimer: null,
        lastUpdateTime: null,
        pendingUpdate: false,

        // パネルHTML生成
        createPanelHTML: function () {
            return `
                <div id="hd-panel" class="hd-panel">
                    <div class="hd-panel-header" id="hd-panel-header">
                        <div class="hd-header-actions">
                            <button class="hd-btn-action" id="hd-settings" title="色設定">⚙️</button>
                            <button class="hd-btn-dock" id="hd-dock-left" title="左にドッキング">⇦</button>
                            <button class="hd-btn-dock" id="hd-dock-right" title="右にドッキング">⇨</button>
                            <button class="hd-btn-close" id="hd-close" title="閉じる">✕</button>
                        </div>
                    </div>
                    <div class="hd-panel-content">
                        <div class="hd-header-info">
                            <span class="hd-result-count" id="hd-result-count">0 件の見出しを検出</span>
                            <span class="hd-stats" id="hd-stats"></span>
                        </div>
                        <div class="hd-search-row">
                            <input type="text" class="hd-search-input" id="hd-search" placeholder="🔍 見出しを検索...">
                            <button class="hd-btn-clear-search" id="hd-clear-search">✕</button>
                        </div>
                        <div class="hd-button-row">
                            <div class="hd-expand-btns">
                                <button class="hd-btn-expand" data-level="1">1</button>
                                <button class="hd-btn-expand" data-level="2">2</button>
                                <button class="hd-btn-expand active" data-level="2.5">A</button>
                                <button class="hd-btn-expand" data-level="3">3</button>
                                <button class="hd-btn-expand" data-level="4">4</button>
                                <button class="hd-btn-expand" data-level="5">5</button>
                                <button class="hd-btn-expand" data-level="6">6</button>
                            </div>
                            <button class="hd-btn-action active" id="hd-color-toggle" title="本文の色分けハイライト">Color</button>
                            <button class="hd-btn-action active" id="hd-wrap-toggle">Wrap</button>
                        </div>
                        <div class="hd-heading-list" id="hd-heading-list">
                            <ul class="hd-heading-tree" id="hd-tree"></ul>
                        </div>
                        <div class="hd-footer">
                            <div class="hd-auto-refresh-row">
                                <button class="hd-btn-refresh" id="hd-manual-refresh" title="手動更新">🔃</button>
                                <button class="hd-btn-action active" id="hd-auto-toggle" title="DOM変更の自動追従">Auto</button>
                                <div class="hd-delay-controls">
                                    <button class="hd-btn-delay" id="hd-delay-down" title="遅延時間を減らす">−</button>
                                    <span class="hd-delay-value" id="hd-delay-value">1.5s</span>
                                    <button class="hd-btn-delay" id="hd-delay-up" title="遅延時間を増やす">+</button>
                                </div>
                                <span class="hd-status" id="hd-status">Ready</span>
                            </div>
                            <div class="hd-legend">
                                <span class="hd-badge native">✨ ネイティブ</span>
                                <span class="hd-badge detected">✨ 検出</span>
                                <span class="hd-badge query">● クエリ</span>
                                <span class="hd-badge response">● 回答</span>
                            </div>
                        </div>
                    </div>
                    <div class="hd-resize hd-resize-n" data-dir="n"></div>
                    <div class="hd-resize hd-resize-s" data-dir="s"></div>
                    <div class="hd-resize hd-resize-e" data-dir="e"></div>
                    <div class="hd-resize hd-resize-w" data-dir="w"></div>
                    <div class="hd-resize hd-resize-ne" data-dir="ne"></div>
                    <div class="hd-resize hd-resize-nw" data-dir="nw"></div>
                    <div class="hd-resize hd-resize-se" data-dir="se"></div>
                    <div class="hd-resize hd-resize-sw" data-dir="sw"></div>
                </div>
            `;
        },

        // CSS生成
        createPanelCSS: function () {
            return `
                .hd-panel {
                    position: fixed;
                    z-index: 2147483647;
                    background: #1a1a2e;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    color: #eee;
                    display: flex;
                    flex-direction: column;
                    min-width: 300px;
                    min-height: 200px;
                }
                .hd-panel.docked-left {
                    left: 0 !important;
                    top: 0 !important;
                    height: 100vh !important;
                    border-radius: 0 8px 8px 0;
                }
                .hd-panel.docked-right {
                    right: 0 !important;
                    left: auto !important;
                    top: 0 !important;
                    height: 100vh !important;
                    border-radius: 8px 0 0 8px;
                }
                .hd-panel-header {
                    background: #16213e;
                    padding: 6px 10px;
                    cursor: move;
                    border-radius: 8px 8px 0 0;
                    display: flex;
                    justify-content: flex-end;
                    user-select: none;
                }
                .hd-header-actions {
                    display: flex;
                    gap: 6px;
                }
                .hd-btn-dock, .hd-btn-close {
                    width: 28px;
                    height: 28px;
                    border: none;
                    background: transparent;
                    color: #aaa;
                    font-size: 14px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: all 0.15s;
                }
                .hd-btn-dock:hover, .hd-btn-close:hover {
                    background: #0f3460;
                    color: #fff;
                }
                .hd-btn-dock.active {
                    background: #e94560;
                    color: #fff;
                }
                .hd-btn-close:hover {
                    background: #e94560;
                }
                .hd-panel-content {
                    padding: 12px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    flex: 1;
                    overflow: hidden;
                }
                .hd-header-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 10px;
                    background: #16213e;
                    border-radius: 8px;
                }
                .hd-result-count {
                    font-size: 13px;
                    font-weight: 600;
                }
                .hd-stats {
                    font-size: 11px;
                    color: #aaa;
                }
                .hd-search-row {
                    display: flex;
                    gap: 8px;
                }
                .hd-search-input {
                    flex: 1;
                    padding: 8px 12px;
                    border: 1px solid #0f3460;
                    border-radius: 8px;
                    background: #16213e;
                    color: #eee;
                    font-size: 12px;
                    outline: none;
                }
                .hd-search-input:focus {
                    border-color: #e94560;
                }
                .hd-btn-clear-search {
                    width: 32px;
                    border: 1px solid #0f3460;
                    border-radius: 8px;
                    background: transparent;
                    color: #aaa;
                    cursor: pointer;
                }
                .hd-btn-clear-search:hover {
                    background: #0f3460;
                    color: #fff;
                }
                .hd-button-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 10px;
                    background: #16213e;
                    border-radius: 8px;
                }
                .hd-expand-btns {
                    display: flex;
                    gap: 4px;
                }
                .hd-btn-expand {
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    font-size: 11px;
                    font-weight: 500;
                    border: 1px solid #0f3460;
                    background: transparent;
                    color: #eee;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .hd-btn-expand:hover {
                    background: #0f3460;
                }
                .hd-btn-expand.active {
                    background: #e94560;
                    color: white;
                    border-color: #e94560;
                    font-weight: 600;
                }
                .hd-btn-action {
                    padding: 6px 10px;
                    font-size: 11px;
                    font-weight: 500;
                    border: 1px solid #0f3460;
                    background: transparent;
                    color: #aaa;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .hd-btn-action:first-of-type {
                    margin-left: auto;
                }
                .hd-btn-action:hover {
                    background: #0f3460;
                }
                .hd-btn-action.active {
                    background: #e94560;
                    color: white;
                    border-color: #e94560;
                }
                .hd-heading-list {
                    flex: 1;
                    overflow-y: auto;
                }
                .hd-heading-list::-webkit-scrollbar {
                    width: 6px;
                }
                .hd-heading-list::-webkit-scrollbar-track {
                    background: #16213e;
                    border-radius: 3px;
                }
                .hd-heading-list::-webkit-scrollbar-thumb {
                    background: #0f3460;
                    border-radius: 3px;
                }
                .hd-heading-tree {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                }
                .hd-tree-item {
                    margin-bottom: 4px;
                }
                .hd-tree-row {
                    display: flex;
                    align-items: flex-start;
                    gap: 6px;
                    padding: 6px 8px;
                    background: #16213e;
                    border-radius: 6px;
                    transition: all 0.15s;
                }
                .hd-tree-row:hover {
                    background: #0f3460;
                }
                .hd-tree-row.search-match {
                    background: rgba(255, 107, 107, 0.4);
                }
                .hd-tree-row.has-match {
                    background: rgba(255, 107, 107, 0.2);
                }
                .hd-toggle {
                    flex-shrink: 0;
                    width: 14px;
                    font-size: 10px;
                    color: var(--hd-toggle-btn, #888);
                    cursor: pointer;
                    user-select: none;
                    margin-top: 2px;
                }
                .hd-toggle.no-children {
                    color: #555;
                    cursor: default;
                }
                .hd-level-badge {
                    flex-shrink: 0;
                    font-size: 9px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: #fff;
                    font-weight: 600;
                }
                .hd-level-badge.main-pane {
                    box-shadow: 0 0 0 2px var(--hd-main-pane-indicator, #fff);
                }
                .hd-badge-h1 { background: var(--hd-h1-bg, #000); color: var(--hd-h1-text, #666); border: 1px solid var(--hd-h1-border, #000); }
                .hd-badge-h2 { background: var(--hd-h2-bg, #000); color: var(--hd-h2-text, #666); border: 1px solid var(--hd-h2-border, #000); }
                .hd-badge-h3 { background: var(--hd-h3-bg, #000); color: var(--hd-h3-text, #666); border: 1px solid var(--hd-h3-border, #000); }
                .hd-badge-h4 { background: var(--hd-h4-bg, #000); color: var(--hd-h4-text, #666); border: 1px solid var(--hd-h4-border, #000); }
                .hd-badge-h5 { background: var(--hd-h5-bg, #000); color: var(--hd-h5-text, #666); border: 1px solid var(--hd-h5-border, #000); }
                .hd-badge-h6 { background: var(--hd-h6-bg, #000); color: var(--hd-h6-text, #666); border: 1px solid var(--hd-h6-border, #000); }
                .hd-badge-query { background: var(--hd-query-bg, #000); color: var(--hd-query-text, #666); border: 1px solid var(--hd-query-border, #000); }
                .hd-badge-response { background: var(--hd-response-bg, #000); color: var(--hd-response-text, #666); border: 1px solid var(--hd-response-border, #000); }
                .hd-heading-link {
                    flex: 1;
                    font-size: 12px;
                    color: var(--hd-h1-link-text, #a8c7fa);
                    text-decoration: none;
                    cursor: pointer;
                    word-break: break-word;
                    line-height: 1.4;
                }
                .hd-heading-link:hover {
                    text-decoration: underline;
                }
                .hd-heading-link.no-wrap {
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                /* 各レベルの見出しリンク色 */
                .hd-tree-row[data-level="1"] .hd-heading-link { color: var(--hd-h1-link-text, #a8c7fa); }
                .hd-tree-row[data-level="2"] .hd-heading-link { color: var(--hd-h2-link-text, #a8c7fa); }
                .hd-tree-row[data-level="3"] .hd-heading-link { color: var(--hd-h3-link-text, #a8c7fa); }
                .hd-tree-row[data-level="4"] .hd-heading-link { color: var(--hd-h4-link-text, #a8c7fa); }
                .hd-tree-row[data-level="5"] .hd-heading-link { color: var(--hd-h5-link-text, #a8c7fa); }
                .hd-tree-row[data-level="6"] .hd-heading-link { color: var(--hd-h6-link-text, #a8c7fa); }
                .hd-tree-row[data-level="query"] .hd-heading-link { color: var(--hd-query-link-text, #a8c7fa); }
                .hd-tree-row[data-level="response"] .hd-heading-link { color: var(--hd-response-link-text, #a8c7fa); }
                .hd-footer {
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid #0f3460;
                    text-align: center;
                }
                .hd-legend {
                    display: flex;
                    justify-content: center;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .hd-badge {
                    font-size: 10px;
                    color: #aaa;
                }
                .hd-badge.native { color: #ffd93d; }
                .hd-badge.detected { color: #00d9a0; }
                .hd-badge.query { color: #64c8ff; }
                .hd-badge.response { color: #b482ff; }
                /* リサイズハンドル */
                .hd-resize {
                    position: absolute;
                }
                .hd-resize-n, .hd-resize-s {
                    left: 10px;
                    right: 10px;
                    height: 6px;
                    cursor: ns-resize;
                }
                .hd-resize-n { top: -3px; }
                .hd-resize-s { bottom: -3px; }
                .hd-resize-e, .hd-resize-w {
                    top: 10px;
                    bottom: 10px;
                    width: 6px;
                    cursor: ew-resize;
                }
                .hd-resize-e { right: -3px; }
                .hd-resize-w { left: -3px; }
                .hd-resize-ne, .hd-resize-nw, .hd-resize-se, .hd-resize-sw {
                    width: 12px;
                    height: 12px;
                }
                .hd-resize-ne { top: -3px; right: -3px; cursor: nesw-resize; }
                .hd-resize-nw { top: -3px; left: -3px; cursor: nwse-resize; }
                .hd-resize-se { bottom: -3px; right: -3px; cursor: nwse-resize; }
                .hd-resize-sw { bottom: -3px; left: -3px; cursor: nesw-resize; }
                .hd-children {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    margin-left: 10px;
                    margin-top: 2px;
                    padding-left: 4px;
                    border-left: 1px solid #0f3460;
                }
                .hd-children.collapsed {
                    display: none;
                }
                /* 自動更新コントロール */
                .hd-auto-refresh-row {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 8px;
                    background: #16213e;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    flex-wrap: wrap;
                }
                .hd-btn-refresh {
                    width: 28px;
                    height: 28px;
                    padding: 0;
                    font-size: 14px;
                    border: 1px solid #0f3460;
                    background: transparent;
                    color: #eee;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .hd-btn-refresh:hover {
                    background: #0f3460;
                }
                .hd-btn-refresh:active {
                    transform: rotate(180deg);
                }
                .hd-delay-controls {
                    display: flex;
                    align-items: center;
                    gap: 2px;
                    background: #0f3460;
                    border-radius: 4px;
                    padding: 2px;
                }
                .hd-btn-delay {
                    width: 22px;
                    height: 22px;
                    padding: 0;
                    font-size: 12px;
                    font-weight: bold;
                    border: none;
                    background: transparent;
                    color: #aaa;
                    border-radius: 3px;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .hd-btn-delay:hover {
                    background: #1a1a2e;
                    color: #fff;
                }
                .hd-delay-value {
                    font-size: 10px;
                    color: #8ec6ff;
                    min-width: 28px;
                    text-align: center;
                    font-family: monospace;
                }
                .hd-status {
                    flex: 1;
                    font-size: 10px;
                    color: #888;
                    text-align: right;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .hd-status.pending {
                    color: #ffd93d;
                }
                .hd-status.updated {
                    color: #00d9a0;
                }
            `;
        },

        // パネル初期化
        init: function () {
            // スタイル挿入
            const style = document.createElement('style');
            style.id = 'hd-panel-styles';
            style.textContent = this.createPanelCSS();
            document.head.appendChild(style);

            // パネル挿入
            const container = document.createElement('div');
            container.id = 'hd-panel-container';
            container.innerHTML = this.createPanelHTML();
            document.body.appendChild(container);

            this.panel = document.getElementById('hd-panel');
            this.updatePanelPosition();
            this.updatePanelSize();
            this.bindEvents();
        },

        // イベントバインド
        bindEvents: function () {
            const self = this;
            const header = document.getElementById('hd-panel-header');

            // ドラッグ
            header.addEventListener('mousedown', function (e) {
                if (self.dockMode) return;
                if (e.target.closest('.hd-btn-dock, .hd-btn-close')) return;
                self.isDragging = true;
                self.dragOffset.x = e.clientX - self.position.x;
                self.dragOffset.y = e.clientY - self.position.y;
                e.preventDefault();
            });

            // リサイズ
            this.panel.querySelectorAll('.hd-resize').forEach(function (el) {
                el.addEventListener('mousedown', function (e) {
                    if (self.dockMode) return;
                    self.isResizing = true;
                    self.resizeDir = el.dataset.dir;
                    self.resizeStart = {
                        x: e.clientX,
                        y: e.clientY,
                        width: self.size.width,
                        height: self.size.height,
                        posX: self.position.x,
                        posY: self.position.y
                    };
                    e.preventDefault();
                });
            });

            document.addEventListener('mousemove', function (e) {
                if (self.isDragging) {
                    self.position.x = e.clientX - self.dragOffset.x;
                    self.position.y = e.clientY - self.dragOffset.y;
                    self.updatePanelPosition();
                }
                if (self.isResizing) {
                    self.handleResize(e);
                }
            });

            document.addEventListener('mouseup', function () {
                self.isDragging = false;
                self.isResizing = false;
                self.resizeDir = null;
            });

            // 閉じるボタン
            document.getElementById('hd-close').addEventListener('click', function () {
                self.hide();
            });

            // ドッキングボタン
            document.getElementById('hd-dock-left').addEventListener('click', function () {
                self.dock('left');
            });
            document.getElementById('hd-dock-right').addEventListener('click', function () {
                self.dock('right');
            });

            // 設定ボタン
            document.getElementById('hd-settings').addEventListener('click', function () {
                if (window.HDSettings) {
                    window.HDSettings.loadColors().then(function () {
                        window.HDSettings.open();
                    });
                }
            });

            // 展開レベルボタン
            this.panel.querySelectorAll('.hd-btn-expand').forEach(function (btn) {
                btn.addEventListener('click', function () {
                    self.panel.querySelectorAll('.hd-btn-expand').forEach(function (b) {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                    self.expandLevel = parseFloat(btn.dataset.level);
                    self.renderTree();
                });
            });

            // Wrapボタン
            document.getElementById('hd-wrap-toggle').addEventListener('click', function () {
                self.wrapText = !self.wrapText;
                this.classList.toggle('active', self.wrapText);
                self.renderTree();
            });

            // Colorボタン（ハイライトトグル）
            document.getElementById('hd-color-toggle').addEventListener('click', function () {
                self.highlightEnabled = !self.highlightEnabled;
                this.classList.toggle('active', self.highlightEnabled);
                if (window.HeadingDetector) {
                    if (self.highlightEnabled) {
                        window.HeadingDetector.highlight(self.headings);
                    } else {
                        window.HeadingDetector.clearHighlight();
                    }
                }
            });

            // 検索
            document.getElementById('hd-search').addEventListener('input', function () {
                self.searchQuery = this.value.toLowerCase();
                self.renderTree();
            });

            document.getElementById('hd-clear-search').addEventListener('click', function () {
                document.getElementById('hd-search').value = '';
                self.searchQuery = '';
                self.renderTree();
            });

            // 手動更新ボタン
            document.getElementById('hd-manual-refresh').addEventListener('click', function () {
                self.detect();
                self.updateStatus('手動更新: ' + new Date().toLocaleTimeString(), 'updated');
            });

            // 自動更新トグル
            document.getElementById('hd-auto-toggle').addEventListener('click', function () {
                self.autoRefreshEnabled = !self.autoRefreshEnabled;
                this.classList.toggle('active', self.autoRefreshEnabled);
                if (self.autoRefreshEnabled) {
                    self.setupAutoRefresh();
                    self.updateStatus('自動更新: ON', 'updated');
                } else {
                    self.stopAutoRefresh();
                    self.updateStatus('自動更新: OFF', '');
                }
            });

            // 遅延時間調整
            document.getElementById('hd-delay-down').addEventListener('click', function () {
                self.autoRefreshDelay = Math.max(500, self.autoRefreshDelay - 500);
                self.updateDelayDisplay();
            });

            document.getElementById('hd-delay-up').addEventListener('click', function () {
                self.autoRefreshDelay = Math.min(5000, self.autoRefreshDelay + 500);
                self.updateDelayDisplay();
            });
        },

        // リサイズ処理
        handleResize: function (e) {
            const dir = this.resizeDir;
            const start = this.resizeStart;
            const dx = e.clientX - start.x;
            const dy = e.clientY - start.y;

            if (dir.includes('e')) {
                this.size.width = Math.max(300, start.width + dx);
            }
            if (dir.includes('w')) {
                const newWidth = Math.max(300, start.width - dx);
                this.position.x = start.posX + (start.width - newWidth);
                this.size.width = newWidth;
            }
            if (dir.includes('s')) {
                this.size.height = Math.max(200, start.height + dy);
            }
            if (dir.includes('n')) {
                const newHeight = Math.max(200, start.height - dy);
                this.position.y = start.posY + (start.height - newHeight);
                this.size.height = newHeight;
            }

            this.updatePanelSize();
            this.updatePanelPosition();
        },

        // ドッキング
        dock: function (side) {
            const leftBtn = document.getElementById('hd-dock-left');
            const rightBtn = document.getElementById('hd-dock-right');

            if (this.dockMode === side) {
                // アンドック
                this.dockMode = null;
                this.panel.classList.remove('docked-left', 'docked-right');
                document.body.style.marginLeft = '';
                document.body.style.marginRight = '';
                leftBtn.classList.remove('active');
                rightBtn.classList.remove('active');
                this.updatePanelPosition();
                this.updatePanelSize();
            } else {
                this.dockMode = side;
                this.panel.classList.remove('docked-left', 'docked-right');
                document.body.style.marginLeft = '';
                document.body.style.marginRight = '';
                leftBtn.classList.remove('active');
                rightBtn.classList.remove('active');

                if (side === 'left') {
                    this.panel.classList.add('docked-left');
                    document.body.style.marginLeft = this.size.width + 'px';
                    leftBtn.classList.add('active');
                } else {
                    this.panel.classList.add('docked-right');
                    document.body.style.marginRight = this.size.width + 'px';
                    rightBtn.classList.add('active');
                }
                this.panel.style.width = this.size.width + 'px';
            }
        },

        // 位置更新
        updatePanelPosition: function () {
            if (!this.dockMode) {
                this.panel.style.left = this.position.x + 'px';
                this.panel.style.top = this.position.y + 'px';
            }
        },

        // サイズ更新
        updatePanelSize: function () {
            this.panel.style.width = this.size.width + 'px';
            this.panel.style.height = this.size.height + 'px';
        },

        // 表示
        show: function () {
            const isFirstShow = !this.panel;
            if (!this.panel) {
                this.init();
            }
            this.panel.style.display = 'flex';
            this.isVisible = true;

            // 初回表示時は右ドッキング
            if (isFirstShow && !this.dockMode) {
                this.dock('right');
            }

            this.detect();
            this.updateDelayDisplay();

            // 自動更新開始
            if (this.autoRefreshEnabled) {
                this.setupAutoRefresh();
            }
        },

        // 非表示
        hide: function () {
            if (this.panel) {
                this.panel.style.display = 'none';
            }
            this.isVisible = false;
            // ドック解除
            if (this.dockMode) {
                document.body.style.marginLeft = '';
                document.body.style.marginRight = '';
            }
            // 自動更新停止
            this.stopAutoRefresh();
        },

        // トグル
        toggle: function () {
            if (this.isVisible) {
                this.hide();
            } else {
                this.show();
            }
        },

        // 見出し検出
        detect: function () {
            if (!window.HeadingDetector) return;
            this.headings = window.HeadingDetector.detect();
            window.HeadingDetector.highlight(this.headings);

            // 結果を加工
            this.headings = this.headings.map(function (h, i) {
                return {
                    index: i,
                    text: h.text,
                    level: h.level,
                    originalLevel: h.originalLevel,
                    isNative: h.isNative,
                    isQuery: h.isQuery,
                    isResponse: h.isResponse,
                    isInsideResponse: h.isInsideResponse,
                    isInMainPane: h.isInMainPane
                };
            });

            this.updateStats();
            this.renderTree();
        },

        // 統計更新
        updateStats: function () {
            const count = this.headings.length;
            document.getElementById('hd-result-count').textContent = count + ' 件の見出しを検出';

            const mainCount = this.headings.filter(function (h) { return h.isInMainPane; }).length;
            const queryCount = this.headings.filter(function (h) { return h.isQuery; }).length;
            const responseCount = this.headings.filter(function (h) { return h.isResponse; }).length;

            let statsText = 'メイン:' + mainCount + '件';
            if (queryCount > 0) statsText += ' ●Q:' + queryCount;
            if (responseCount > 0) statsText += ' ●A:' + responseCount;
            document.getElementById('hd-stats').textContent = statsText;
        },

        // ツリービルド
        buildTree: function () {
            const root = { children: [] };
            const stack = [{ level: 0, node: root }];

            this.headings.forEach(function (heading) {
                const node = {
                    heading: heading,
                    level: heading.level,
                    children: [],
                    searchMatch: false,
                    hasMatchingDescendant: false
                };

                while (stack.length > 1 && stack[stack.length - 1].level >= heading.level) {
                    stack.pop();
                }

                stack[stack.length - 1].node.children.push(node);
                stack.push({ level: heading.level, node: node });
            });

            return root.children;
        },

        // 検索マーク
        markSearchMatches: function (nodes) {
            const self = this;
            let hasMatch = false;

            nodes.forEach(function (node) {
                const textMatch = self.searchQuery &&
                    node.heading.text.toLowerCase().includes(self.searchQuery);
                node.searchMatch = textMatch;

                const childMatch = self.markSearchMatches(node.children);
                node.hasMatchingDescendant = childMatch;

                if (textMatch || childMatch) hasMatch = true;
            });

            return hasMatch;
        },

        // ツリーレンダリング
        renderTree: function () {
            const tree = this.buildTree();
            if (this.searchQuery) {
                this.markSearchMatches(tree);
            }
            const container = document.getElementById('hd-tree');
            container.innerHTML = this.renderNodes(tree, 0);
            this.bindTreeEvents();
        },

        // ノードレンダリング
        renderNodes: function (nodes, depth) {
            const self = this;
            let html = '';

            nodes.forEach(function (node) {
                const h = node.heading;
                const hasChildren = node.children.length > 0;
                const shouldExpand = self.searchQuery ?
                    (node.searchMatch || node.hasMatchingDescendant) :
                    (h.level <= self.expandLevel);

                let badgeClass = 'hd-level-badge ';
                let badgeText = '';
                if (h.isQuery) {
                    badgeClass += 'hd-badge-query';
                    badgeText = 'Q';
                } else if (h.isResponse) {
                    badgeClass += 'hd-badge-response';
                    badgeText = 'A';
                } else {
                    const displayLevel = h.originalLevel || Math.floor(h.level);
                    badgeClass += 'hd-badge-h' + displayLevel;
                    badgeText = 'H' + displayLevel;
                }
                if (h.isInMainPane) badgeClass += ' main-pane';

                const rowClass = 'hd-tree-row' +
                    (node.searchMatch ? ' search-match' : '') +
                    (node.hasMatchingDescendant ? ' has-match' : '');

                // レベルを data 属性として設定（CSS セレクタ用）
                const levelKey = h.isQuery ? 'query' : h.isResponse ? 'response' : Math.floor(h.level);

                const linkClass = 'hd-heading-link' + (self.wrapText ? '' : ' no-wrap');

                html += '<li class="hd-tree-item">';
                html += '<div class="' + rowClass + '" data-level="' + levelKey + '">';
                html += '<span class="hd-toggle ' + (hasChildren ? '' : 'no-children') + '">' +
                    (hasChildren ? (shouldExpand ? '▼' : '▶') : '') + '</span>';
                html += '<span class="' + badgeClass + '">' + badgeText + '</span>';
                html += '<a class="' + linkClass + '" data-index="' + h.index + '">' +
                    self.escapeHtml(h.text) + '</a>';
                html += '</div>';

                if (hasChildren) {
                    html += '<ul class="hd-children' + (shouldExpand ? '' : ' collapsed') + '">';
                    html += self.renderNodes(node.children, depth + 1);
                    html += '</ul>';
                }
                html += '</li>';
            });

            return html;
        },

        // ツリーイベント
        bindTreeEvents: function () {
            const self = this;

            // トグル
            this.panel.querySelectorAll('.hd-toggle').forEach(function (toggle) {
                toggle.addEventListener('click', function () {
                    if (toggle.classList.contains('no-children')) return;
                    const item = toggle.closest('.hd-tree-item');
                    const children = item.querySelector('.hd-children');
                    if (children) {
                        children.classList.toggle('collapsed');
                        toggle.textContent = children.classList.contains('collapsed') ? '▶' : '▼';
                    }
                });
            });

            // リンククリック
            this.panel.querySelectorAll('.hd-heading-link').forEach(function (link) {
                link.addEventListener('click', function () {
                    const index = parseInt(link.dataset.index);
                    if (window.HeadingDetector) {
                        window.HeadingDetector.scrollToHeading(index);
                    }
                });
            });
        },

        // 自動更新セットアップ
        setupAutoRefresh: function () {
            const self = this;

            // 既存のオブザーバーを停止
            this.stopAutoRefresh();

            // メインコンテナを特定（Gemini/NotebookLM等）
            const target = document.querySelector('main, [role="main"], .infinite-scroller')
                || document.body;

            this.observer = new MutationObserver(function (mutations) {
                // パネル自体の変更は無視（自己除外）
                if (mutations.every(function (m) {
                    return self.panel && self.panel.contains(m.target);
                })) {
                    return;
                }

                // デバウンス処理
                if (self.debounceTimer) {
                    clearTimeout(self.debounceTimer);
                }

                self.pendingUpdate = true;
                self.updateStatus('変更検出中...', 'pending');

                self.debounceTimer = setTimeout(function () {
                    if (self.isVisible && self.autoRefreshEnabled) {
                        self.detect();
                        self.lastUpdateTime = new Date();
                        self.updateStatus('自動更新: ' + self.lastUpdateTime.toLocaleTimeString(), 'updated');
                    }
                    self.pendingUpdate = false;
                }, self.autoRefreshDelay);
            });

            this.observer.observe(target, {
                childList: true,
                subtree: true,
                characterData: false,  // テキスト変更は無視
                attributes: false      // 属性変更は無視
            });

            this.updateStatus('自動更新: ON', '');
        },

        // 自動更新停止
        stopAutoRefresh: function () {
            if (this.observer) {
                this.observer.disconnect();
                this.observer = null;
            }
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
                this.debounceTimer = null;
            }
            this.pendingUpdate = false;
        },

        // ステータス更新
        updateStatus: function (text, statusClass) {
            const statusEl = document.getElementById('hd-status');
            if (statusEl) {
                statusEl.textContent = text;
                statusEl.className = 'hd-status';
                if (statusClass) {
                    statusEl.classList.add(statusClass);
                }
            }
        },

        // 遅延時間表示更新
        updateDelayDisplay: function () {
            const delayEl = document.getElementById('hd-delay-value');
            if (delayEl) {
                delayEl.textContent = (this.autoRefreshDelay / 1000).toFixed(1) + 's';
            }
        },

        escapeHtml: function (str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    };

    window.HeadingDetectorPanel = Panel;

    // メッセージリスナー
    api.runtime.onMessage.addListener(function (request, sender, sendResponse) {
        if (request.action === 'togglePanel') {
            Panel.toggle();
            sendResponse({ success: true, visible: Panel.isVisible });
        }
        return true;
    });

})();
