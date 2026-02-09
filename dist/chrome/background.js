/**
 * Heading Detector - Background Service Worker
 * Version 2.1 - Handles display mode switching (popup vs side panel)
 */

// デフォルト設定（サイドパネルをデフォルトに）
const DEFAULT_CONFIG = {
    displayMode: 'sidepanel', // 'popup' or 'sidepanel'
    expandLevel: 2.5,
    wrap: false,
    colors: null // カスタム色設定（nullの場合はデフォルトを使用）
};

// API名前空間の抽象化（Firefox/Chrome両対応）
const api = typeof browser !== 'undefined' ? browser : chrome;

// 設定を読み込む
async function getConfig() {
    try {
        const result = await api.storage.local.get(['displayMode', 'expandLevel', 'wrap', 'colors']);
        return {
            displayMode: result.displayMode || DEFAULT_CONFIG.displayMode,
            expandLevel: result.expandLevel !== undefined ? result.expandLevel : DEFAULT_CONFIG.expandLevel,
            wrap: result.wrap !== undefined ? result.wrap : DEFAULT_CONFIG.wrap,
            colors: result.colors || DEFAULT_CONFIG.colors
        };
    } catch (error) {
        console.error('Failed to load config:', error);
        return DEFAULT_CONFIG;
    }
}

// 設定を保存する
async function saveConfig(config) {
    try {
        await api.storage.local.set(config);
    } catch (error) {
        console.error('Failed to save config:', error);
    }
}

// サイドパネルの状態を更新
async function updateSidePanelBehavior(displayMode) {
    // Firefoxでは chrome.sidePanel が存在しないためチェック
    if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
        try {
            if (displayMode === 'sidepanel') {
                // サイドパネルモード: アイコンクリックでサイドパネルを開く
                await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
            } else {
                // ポップアップモード: アイコンクリックでポップアップを開く（デフォルト動作）
                await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
            }
        } catch (error) {
            console.error('Failed to set side panel behavior:', error);
        }
    }
}

// 初期化
api.runtime.onInstalled.addListener(async () => {
    const config = await getConfig();
    await updateSidePanelBehavior(config.displayMode);
});

// 起動時にも設定を適用
api.runtime.onStartup.addListener(async () => {
    const config = await getConfig();
    await updateSidePanelBehavior(config.displayMode);
});

// メッセージリスナー（ポップアップ/サイドパネルからの設定変更を受信）
api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Content script が準備完了したことを記録
    if (request.action === 'contentScriptReady') {
        console.log('Content script is ready in tab:', sender.tab?.id);
        sendResponse({ success: true });
        return true;
    }

    if (request.action === 'setDisplayMode') {
        (async () => {
            await saveConfig({ displayMode: request.mode });
            await updateSidePanelBehavior(request.mode);
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'getConfig') {
        (async () => {
            const config = await getConfig();
            sendResponse(config);
        })();
        return true;
    }

    if (request.action === 'saveExpandLevel') {
        (async () => {
            await saveConfig({ expandLevel: request.level });
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'saveWrap') {
        (async () => {
            await saveConfig({ wrap: request.wrap });
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'saveColors') {
        (async () => {
            await saveConfig({ colors: request.colors });
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'saveHBadgeEnabled') {
        (async () => {
            await saveConfig({ hBadgeEnabled: request.enabled });
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'saveHighlightEnabled') {
        (async () => {
            await saveConfig({ highlightEnabled: request.enabled });
            sendResponse({ success: true });
        })();
        return true;
    }

    if (request.action === 'saveHighlightColors') {
        (async () => {
            await saveConfig({ highlightColors: request.colors });
            sendResponse({ success: true });
        })();
        return true;
    }

    // インページパネルのトグル
    if (request.action === 'togglePanel') {
        (async () => {
            try {
                const [tab] = await api.tabs.query({ active: true, currentWindow: true });

                // Chrome/Edge の場合はスクリプトを注入
                if (api.scripting && api.scripting.executeScript) {
                    try {
                        await api.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['heading-detector-core.js', 'content.js']
                        });
                        await api.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['panel.js']
                        });
                    } catch (e) {
                        console.log('Script injection error (may already be injected):', e.message);
                    }
                }

                // パネルトグルメッセージを送信
                const response = await api.tabs.sendMessage(tab.id, { action: 'togglePanel' });
                sendResponse(response);
            } catch (error) {
                console.error('Toggle panel error:', error);
                sendResponse({ success: false, error: error.message });
            }
        })();
        return true;
    }
});
