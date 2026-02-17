/**
 * Heading Detector - Content Script
 * 
 * Chrome拡張機能として実行されるスクリプト
 * ブックマークレット版と機能を同期
 * Version 2.0 - Enhanced for Gemini/NotebookLM Chat Navigation
 */

(function () {
    'use strict';

    // API名前空間の抽象化（Firefox/Chrome両対応）
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // HeadingDetector がロードされていることを確認
    if (typeof window.HeadingDetector === 'undefined') {
        console.warn('HeadingDetector is not loaded. Content script cannot function.');
        return;
    }

    let detectTimeout = null;
    const DETECT_DEBOUNCE_TIME = 500; // ms

    // サイドパネルにDOM変更を通知する関数 (デバウンス付き)
    function notifyDomChangedDebounced() {
        if (detectTimeout) {
            clearTimeout(detectTimeout);
        }
        detectTimeout = setTimeout(async () => {
            try {
                // サイドパネルやポップアップが閉じている場合はエラーになるが、問題ない
                await api.runtime.sendMessage({ action: 'domChanged' });
            } catch (e) {
                // console.log("Could not send domChanged message:", e.message); // デバッグ用
            }
        }, DETECT_DEBOUNCE_TIME);
    }

    // MutationObserver の設定
    const observer = new MutationObserver((mutationsList, observer) => {
        let relevantChange = false;
        for (const mutation of mutationsList) {
            // 子ノードの追加/削除、テキストコンテンツの変更、または特定の属性（class, style）の変更を検出
            if (mutation.type === 'childList' || mutation.type === 'characterData' ||
                (mutation.type === 'attributes' && (mutation.attributeName === 'class' || mutation.attributeName === 'style'))) {
                relevantChange = true;
                break;
            }
        }
        if (relevantChange) {
            notifyDomChangedDebounced();
        }
    });

    // ページ全体のDOM変更を監視
    // 監視オプション:
    // childList: 子ノードの追加または削除を監視
    // subtree: descendant node の変更も監視
    // attributes: 属性の変更を監視
    // characterData: テキストコンテンツの変更を監視
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });


    // メッセージリスナー（ポップアップからの指示を受信）
    api.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping') {
            sendResponse({ success: true, ready: true });
            return true;
        }
        if (request.action === 'detect') {
            // ハイライト色を設定から取得して適用
            if (request.highlightColors) {
                window.HeadingDetector.config.highlightColors = request.highlightColors;
            }

            window.HeadingDetector.detect(); // Use global HeadingDetector

            // highlightEnabled が指定されている場合のみハイライト
            if (request.highlightEnabled) {
                window.HeadingDetector.highlight(window.HeadingDetector.headings);
            } else {
                window.HeadingDetector.clearHighlight();
            }

            // 要素を除いたデータを返す
            const result = window.HeadingDetector.headings.map((h, index) => ({
                index: index,
                text: h.text,
                level: h.level,
                originalLevel: h.originalLevel,
                score: h.score,
                isNative: h.isNative,
                isQuery: h.isQuery,
                isResponse: h.isResponse,
                isInsideResponse: h.isInsideResponse,
                isInMainPane: h.isInMainPane
            }));

            sendResponse({ success: true, headings: result });
        } else if (request.action === 'scrollTo') {
            const heading = window.HeadingDetector.headings[request.index];
            if (heading && heading.element) {
                window.HeadingDetector.scrollToHeading(heading.element);
                sendResponse({ success: true });
            } else {
                console.warn('Heading element not found for index:', request.index);
                sendResponse({ success: false, error: 'Heading element not found' });
            }
        } else if (request.action === 'clear') {
            window.HeadingDetector.clearHighlight();
            sendResponse({ success: true });
        } else if (request.action === 'enableHighlight') {
            window.HeadingDetector.highlight(window.HeadingDetector.headings);
            sendResponse({ success: true });
        } else if (request.action === 'disableHighlight') {
            window.HeadingDetector.clearHighlight();
            sendResponse({ success: true });
        } else if (request.action === 'updateHighlightColors') {
            if (request.highlightColors) {
                window.HeadingDetector.config.highlightColors = request.highlightColors;
            }
            // 再ハイライト
            window.HeadingDetector.highlight(window.HeadingDetector.headings);
            sendResponse({ success: true });
        }
        return true; // 非同期レスポンスのため
    });

    // Background へ初期化完了を通知（特にFirefox向け）
    setTimeout(() => {
        try {
            api.runtime.sendMessage({ action: 'contentScriptReady' })
                .catch(err => console.log('Content script ready notification (expected in some contexts):', err.message));
        } catch (e) {
            // ポップアップやサイドパネルのコンテキストでは失敗するが、問題ない
        }
    }, 50);

})();