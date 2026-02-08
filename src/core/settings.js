/**
 * Heading Detector - Settings Module
 * カラー設定ダイアログを管理する共通モジュール
 */

(function () {
    'use strict';

    // 既に定義済みなら何もしない
    if (window.HDSettings) return;

    const api = typeof browser !== 'undefined' ? browser : chrome;

    // デフォルト色設定
    const DEFAULT_COLORS = {
        panelBg: '#000000',
        rowBg: '#000000',
        rowHoverBg: '#1a1a1a',
        mainPaneIndicator: '#ffffff',
        toggleBtn: '#888888',
        // 各レベルの設定
        h1Bg: '#000000', h1Text: '#666666', h1Border: '#000000', h1LinkText: '#a8c7fa',
        h2Bg: '#000000', h2Text: '#666666', h2Border: '#000000', h2LinkText: '#a8c7fa',
        h3Bg: '#000000', h3Text: '#666666', h3Border: '#000000', h3LinkText: '#a8c7fa',
        h4Bg: '#000000', h4Text: '#666666', h4Border: '#000000', h4LinkText: '#a8c7fa',
        h5Bg: '#000000', h5Text: '#666666', h5Border: '#000000', h5LinkText: '#a8c7fa',
        h6Bg: '#000000', h6Text: '#666666', h6Border: '#000000', h6LinkText: '#a8c7fa',
        queryBg: '#000000', queryText: '#666666', queryBorder: '#000000', queryLinkText: '#a8c7fa',
        responseBg: '#000000', responseText: '#666666', responseBorder: '#000000', responseLinkText: '#a8c7fa'
    };

    const HDSettings = {
        colors: { ...DEFAULT_COLORS },
        hBadgeDefault: false, // Hバッジ表示のデフォルト（オフ）
        dialog: null,
        isOpen: false,
        onChangeCallback: null,

        // 設定ダイアログのHTML生成
        createDialogHTML: function () {
            return `
                <div class="hd-settings-overlay" id="hd-settings-overlay">
                    <div class="hd-settings-dialog">
                        <div class="hd-settings-header">
                            <span class="hd-settings-title">⚙️ 色設定</span>
                            <button class="hd-settings-close" id="hd-settings-close">✕</button>
                        </div>
                        <div class="hd-settings-content">
                            <div class="hd-settings-section">
                                <h4>パネル背景</h4>
                                <div class="hd-color-row">
                                    <label>背景色</label>
                                    <input type="color" id="hd-color-panelBg" value="${this.colors.panelBg}">
                                </div>
                                <div class="hd-color-row">
                                    <label>見出し行背景</label>
                                    <input type="color" id="hd-color-rowBg" value="${this.colors.rowBg}">
                                </div>
                            </div>
                            <div class="hd-settings-section">
                                <h4>ツリー表示</h4>
                                <div class="hd-color-row">
                                    <label>
                                        <span class="hd-toggle-preview" id="hd-toggle-preview">▶</span>
                                        開閉ボタン
                                    </label>
                                    <input type="color" id="hd-color-toggleBtn" value="${this.colors.toggleBtn}">
                                </div>
                                <div class="hd-color-row">
                                    <label>
                                        <span class="hd-main-pane-preview" id="hd-main-pane-preview">◉</span>
                                        メインペーン枠
                                    </label>
                                    <input type="color" id="hd-color-mainPaneIndicator" value="${this.colors.mainPaneIndicator}">
                                </div>
                                <div class="hd-color-row">
                                    <label>
                                        <input type="checkbox" id="hd-hBadgeDefault" ${this.hBadgeDefault ? 'checked' : ''}>
                                        Hバッジ表示（デフォルト）
                                    </label>
                                </div>
                            </div>
                            <div class="hd-settings-section">
                                <h4>見出し行</h4>
                                ${this.createBadgeColorRows()}
                            </div>
                        </div>
                        <div class="hd-settings-footer">
                            <button class="hd-settings-btn hd-settings-reset" id="hd-settings-reset">リセット</button>
                            <button class="hd-settings-btn hd-settings-save" id="hd-settings-save">保存して閉じる</button>
                        </div>
                    </div>
                </div>
            `;
        },

        // バッジカラー行を生成（プレビュー付き）
        createBadgeColorRows: function () {
            const levels = [
                { key: 'h1', label: 'H1' },
                { key: 'h2', label: 'H2' },
                { key: 'h3', label: 'H3' },
                { key: 'h4', label: 'H4' },
                { key: 'h5', label: 'H5' },
                { key: 'h6', label: 'H6' },
                { key: 'query', label: '💬Q' },
                { key: 'response', label: '💭A' }
            ];
            return levels.map(l => `
                <div class="hd-badge-row">
                    <span class="hd-badge-preview" id="hd-badge-preview-${l.key}" 
                          style="background:${this.colors[l.key + 'Bg']};color:${this.colors[l.key + 'Text']};border:1px solid ${this.colors[l.key + 'Border']};">
                        ${l.label}
                    </span>
                    <div class="hd-badge-colors">
                        <div class="hd-color-item">
                            <span>背景</span>
                            <input type="color" id="hd-color-${l.key}Bg" value="${this.colors[l.key + 'Bg']}">
                        </div>
                        <div class="hd-color-item">
                            <span>文字</span>
                            <input type="color" id="hd-color-${l.key}Text" value="${this.colors[l.key + 'Text']}">
                        </div>
                        <div class="hd-color-item">
                            <span>枠</span>
                            <input type="color" id="hd-color-${l.key}Border" value="${this.colors[l.key + 'Border']}">
                        </div>
                        <div class="hd-color-item">
                            <span>見出し</span>
                            <input type="color" id="hd-color-${l.key}LinkText" value="${this.colors[l.key + 'LinkText']}">
                        </div>
                    </div>
                </div>
            `).join('');
        },

        // 設定ダイアログのCSS生成
        createDialogCSS: function () {
            return `
                .hd-settings-overlay {
                    position: fixed;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.7);
                    z-index: 2147483647;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .hd-settings-dialog {
                    background: #1a1a2e;
                    border-radius: 12px;
                    width: 380px;
                    max-height: 80vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
                    font-family: 'Segoe UI', Tahoma, sans-serif;
                    color: #eee;
                }
                .hd-settings-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border-bottom: 1px solid #0f3460;
                }
                .hd-settings-title {
                    font-size: 14px;
                    font-weight: 600;
                }
                .hd-settings-close {
                    background: transparent;
                    border: none;
                    color: #aaa;
                    font-size: 16px;
                    cursor: pointer;
                    padding: 4px 8px;
                    border-radius: 4px;
                }
                .hd-settings-close:hover {
                    background: #e94560;
                    color: #fff;
                }
                .hd-settings-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 12px 16px;
                }
                .hd-settings-section {
                    margin-bottom: 16px;
                }
                .hd-settings-section h4 {
                    font-size: 12px;
                    color: #aaa;
                    margin: 0 0 8px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .hd-color-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 6px 0;
                }
                .hd-color-row label {
                    font-size: 12px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .hd-color-row input[type="color"] {
                    width: 32px;
                    height: 24px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    background: transparent;
                }
                .hd-toggle-preview {
                    font-size: 10px;
                    width: 16px;
                    text-align: center;
                }
                .hd-main-pane-preview {
                    font-size: 12px;
                    width: 16px;
                    text-align: center;
                }
                .hd-badge-row {
                    display: flex;
                    align-items: center;
                    padding: 6px 0;
                    gap: 8px;
                }
                .hd-badge-preview {
                    font-size: 9px;
                    padding: 2px 6px;
                    border-radius: 4px;
                    font-weight: 600;
                    min-width: 32px;
                    text-align: center;
                }
                .hd-badge-colors {
                    display: flex;
                    gap: 6px;
                    flex: 1;
                }
                .hd-color-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 2px;
                }
                .hd-color-item span {
                    font-size: 9px;
                    color: #888;
                }
                .hd-color-item input[type="color"] {
                    width: 28px;
                    height: 20px;
                    border: none;
                    border-radius: 3px;
                    cursor: pointer;
                    background: transparent;
                }
                .hd-settings-footer {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 16px;
                    border-top: 1px solid #0f3460;
                    gap: 8px;
                }
                .hd-settings-btn {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.15s;
                }
                .hd-settings-reset {
                    background: #0f3460;
                    color: #aaa;
                }
                .hd-settings-reset:hover {
                    background: #16213e;
                    color: #fff;
                }
                .hd-settings-save {
                    background: #e94560;
                    color: #fff;
                    flex: 1;
                }
                .hd-settings-save:hover {
                    background: #ff6b6b;
                }
            `;
        },

        // ダイアログを開く
        open: function (onChange) {
            if (this.isOpen) return;
            this.onChangeCallback = onChange;

            // スタイル挿入
            if (!document.getElementById('hd-settings-styles')) {
                const style = document.createElement('style');
                style.id = 'hd-settings-styles';
                style.textContent = this.createDialogCSS();
                document.head.appendChild(style);
            }

            // ダイアログ挿入
            const container = document.createElement('div');
            container.id = 'hd-settings-container';
            container.innerHTML = this.createDialogHTML();
            document.body.appendChild(container);

            this.dialog = document.getElementById('hd-settings-overlay');
            this.isOpen = true;
            this.bindDialogEvents();
            this.updatePreviews();
        },

        // ダイアログを閉じる
        close: function () {
            if (!this.isOpen) return;
            const container = document.getElementById('hd-settings-container');
            if (container) container.remove();
            this.dialog = null;
            this.isOpen = false;
        },

        // プレビューを更新
        updatePreviews: function () {
            // バッジプレビュー
            const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'query', 'response'];
            levels.forEach(l => {
                const preview = document.getElementById('hd-badge-preview-' + l);
                if (preview) {
                    preview.style.background = this.colors[l + 'Bg'];
                    preview.style.color = this.colors[l + 'Text'];
                    preview.style.border = '1px solid ' + this.colors[l + 'Border'];
                }
            });
            // トグルボタンプレビュー
            const togglePreview = document.getElementById('hd-toggle-preview');
            if (togglePreview) {
                togglePreview.style.color = this.colors.toggleBtn;
            }
            // メインペーンプレビュー
            const mainPanePreview = document.getElementById('hd-main-pane-preview');
            if (mainPanePreview) {
                mainPanePreview.style.color = this.colors.mainPaneIndicator;
            }
        },

        // ダイアログイベントをバインド
        bindDialogEvents: function () {
            const self = this;

            // 閉じるボタン
            document.getElementById('hd-settings-close').addEventListener('click', () => self.close());

            // オーバーレイクリックで閉じる
            document.getElementById('hd-settings-overlay').addEventListener('click', (e) => {
                if (e.target.id === 'hd-settings-overlay') self.close();
            });

            // リセットボタン
            document.getElementById('hd-settings-reset').addEventListener('click', () => {
                self.colors = { ...DEFAULT_COLORS };
                self.hBadgeDefault = false;
                self.updateDialogInputs();
                self.updatePreviews();
                self.applyColors();
            });

            // 保存ボタン
            document.getElementById('hd-settings-save').addEventListener('click', () => {
                self.collectColors();
                self.collectSettings();
                self.saveColors();
                self.close();
            });

            // カラー入力のリアルタイム更新
            this.dialog.querySelectorAll('input[type="color"]').forEach(input => {
                input.addEventListener('input', () => {
                    self.collectColors();
                    self.updatePreviews();
                    self.applyColors();
                });
            });
        },

        // その他の設定を収集
        collectSettings: function () {
            const hBadgeCheckbox = document.getElementById('hd-hBadgeDefault');
            if (hBadgeCheckbox) {
                this.hBadgeDefault = hBadgeCheckbox.checked;
            }
        },

        // ダイアログの入力を更新
        updateDialogInputs: function () {
            Object.keys(this.colors).forEach(key => {
                const input = document.getElementById('hd-color-' + key);
                if (input) {
                    input.value = this.colors[key];
                }
            });
            // Hバッジチェックボックスも更新
            const hBadgeCheckbox = document.getElementById('hd-hBadgeDefault');
            if (hBadgeCheckbox) {
                hBadgeCheckbox.checked = this.hBadgeDefault;
            }
        },

        // 入力から色を収集
        collectColors: function () {
            Object.keys(this.colors).forEach(key => {
                const input = document.getElementById('hd-color-' + key);
                if (input) {
                    this.colors[key] = input.value;
                }
            });
        },

        // CSS変数を適用
        applyColors: function () {
            const root = document.documentElement;
            root.style.setProperty('--hd-panel-bg', this.colors.panelBg);
            root.style.setProperty('--hd-row-bg', this.colors.rowBg);
            root.style.setProperty('--hd-row-hover-bg', this.colors.rowHoverBg);
            root.style.setProperty('--hd-main-pane-indicator', this.colors.mainPaneIndicator);
            root.style.setProperty('--hd-toggle-btn', this.colors.toggleBtn);

            const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'query', 'response'];
            levels.forEach(l => {
                root.style.setProperty(`--hd-${l}-bg`, this.colors[l + 'Bg']);
                root.style.setProperty(`--hd-${l}-text`, this.colors[l + 'Text']);
                root.style.setProperty(`--hd-${l}-border`, this.colors[l + 'Border']);
                root.style.setProperty(`--hd-${l}-link-text`, this.colors[l + 'LinkText']);
            });

            if (this.onChangeCallback) {
                this.onChangeCallback(this.colors);
            }
        },

        // 設定を保存（拡張機能用）
        saveColors: async function () {
            try {
                if (api && api.runtime && api.runtime.sendMessage) {
                    await api.runtime.sendMessage({ action: 'saveColors', colors: this.colors });
                    await api.runtime.sendMessage({ action: 'saveHBadgeEnabled', enabled: this.hBadgeDefault });
                } else {
                    // ブックマークレット用: localStorage
                    localStorage.setItem('hdColors', JSON.stringify(this.colors));
                    localStorage.setItem('hdHBadgeDefault', JSON.stringify(this.hBadgeDefault));
                }
            } catch (e) {
                // ブックマークレット用: localStorage
                localStorage.setItem('hdColors', JSON.stringify(this.colors));
                localStorage.setItem('hdHBadgeDefault', JSON.stringify(this.hBadgeDefault));
            }
        },

        // 設定を読み込み（拡張機能用）
        loadColors: async function () {
            try {
                if (api && api.runtime && api.runtime.sendMessage) {
                    const config = await api.runtime.sendMessage({ action: 'getConfig' });
                    if (config) {
                        if (config.colors) {
                            this.colors = { ...DEFAULT_COLORS, ...config.colors };
                        }
                        if (config.hBadgeEnabled !== undefined) {
                            this.hBadgeDefault = config.hBadgeEnabled;
                        }
                    }
                } else {
                    // ブックマークレット用: localStorage
                    const savedColors = localStorage.getItem('hdColors');
                    if (savedColors) {
                        this.colors = { ...DEFAULT_COLORS, ...JSON.parse(savedColors) };
                    }
                    const savedHBadge = localStorage.getItem('hdHBadgeDefault');
                    if (savedHBadge) {
                        this.hBadgeDefault = JSON.parse(savedHBadge);
                    }
                }
            } catch (e) {
                // ブックマークレット用: localStorage
                const savedColors = localStorage.getItem('hdColors');
                if (savedColors) {
                    this.colors = { ...DEFAULT_COLORS, ...JSON.parse(savedColors) };
                }
                const savedHBadge = localStorage.getItem('hdHBadgeDefault');
                if (savedHBadge) {
                    this.hBadgeDefault = JSON.parse(savedHBadge);
                }
            }
            this.applyColors();
        },

        // デフォルト色を取得
        getDefaultColors: function () {
            return { ...DEFAULT_COLORS };
        }
    };

    window.HDSettings = HDSettings;
})();
