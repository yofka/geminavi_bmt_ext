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



    // 変更検出用の状態
    let lastDetectedHeadingCount = 0;
    let lastDetectedHeadingHash = '';

    // 見出しのハッシュを計算（簡易的な変更検出）
    function computeLocalHash(headings) {
        return headings.map(h => h.text.substring(0, 20) + h.level).join('|');
    }

    // メッセージリスナー（ポップアップからの指示を受信）
    api.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'ping') {
            // コンテンツスクリプトが準備完了しているか確認用
            sendResponse({ success: true, ready: true });
            return true;
        }
        if (request.action === 'detect') {
            window.HeadingDetector.detect(); // Use global HeadingDetector

            // highlightEnabled が指定されている場合のみハイライト
            if (request.highlightEnabled) {
                window.HeadingDetector.highlight(window.HeadingDetector.headings);
            } else {
                window.HeadingDetector.clearHighlight();
            }

            // 変更検出用に現在の状態を保存
            lastDetectedHeadingCount = window.HeadingDetector.headings.length;
            lastDetectedHeadingHash = computeLocalHash(window.HeadingDetector.headings);

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
        } else if (request.action === 'checkForChanges') {
            // DOM変更を検出（軽量チェック）
            window.HeadingDetector.detect(); // Re-detect to get latest state
            const currentDetectedHeadingCount = window.HeadingDetector.headings.length;
            const currentDetectedHeadingHash = computeLocalHash(window.HeadingDetector.headings);
            const hasChanges = (currentDetectedHeadingCount !== lastDetectedHeadingCount) || (currentDetectedHeadingHash !== lastDetectedHeadingHash);

            // Update for next check
            if (hasChanges) {
                lastDetectedHeadingCount = currentDetectedHeadingCount;
                lastDetectedHeadingHash = currentDetectedHeadingHash;
            }

            sendResponse({ success: true, hasChanges: hasChanges });
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