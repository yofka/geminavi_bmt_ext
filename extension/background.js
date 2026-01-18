/**
 * Heading Detector - Background Service Worker
 * Version 2.1 - Handles display mode switching (popup vs side panel)
 */

// デフォルト設定（サイドパネルをデフォルトに）
const DEFAULT_CONFIG = {
    displayMode: 'sidepanel', // 'popup' or 'sidepanel'
    expandLevel: 2.5,
    wrap: false
};

// 設定を読み込む
async function getConfig() {
    try {
        const result = await chrome.storage.local.get(['displayMode', 'expandLevel', 'wrap']);
        return {
            displayMode: result.displayMode || DEFAULT_CONFIG.displayMode,
            expandLevel: result.expandLevel !== undefined ? result.expandLevel : DEFAULT_CONFIG.expandLevel,
            wrap: result.wrap !== undefined ? result.wrap : DEFAULT_CONFIG.wrap
        };
    } catch (error) {
        console.error('Failed to load config:', error);
        return DEFAULT_CONFIG;
    }
}

// 設定を保存する
async function saveConfig(config) {
    try {
        await chrome.storage.local.set(config);
    } catch (error) {
        console.error('Failed to save config:', error);
    }
}

// サイドパネルの状態を更新
async function updateSidePanelBehavior(displayMode) {
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

// 初期化
chrome.runtime.onInstalled.addListener(async () => {
    const config = await getConfig();
    await updateSidePanelBehavior(config.displayMode);
});

// 起動時にも設定を適用
chrome.runtime.onStartup.addListener(async () => {
    const config = await getConfig();
    await updateSidePanelBehavior(config.displayMode);
});

// メッセージリスナー（ポップアップ/サイドパネルからの設定変更を受信）
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});
