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

    const HeadingDetector = {
        config: {
            fontSizeRatio: 1.15,
            boldThreshold: 600,
            maxTextLength: 150,
            maxHeadings: 100,
            highlightColors: {
                h1: 'rgba(255, 107, 107, 0.3)',
                h2: 'rgba(255, 159, 67, 0.3)',
                h3: 'rgba(255, 220, 0, 0.3)',
                h4: 'rgba(72, 219, 251, 0.3)',
                h5: 'rgba(162, 155, 254, 0.3)',
                h6: 'rgba(200, 200, 200, 0.3)',
                query: 'rgba(100, 200, 255, 0.3)',
                response: 'rgba(180, 130, 255, 0.3)'
            }
        },

        mainPane: null,

        // メインコンテンツペインの検出（幅が最も広いスクロール可能ペイン）
        detectMainPane: function () {
            const hostname = window.location.hostname;

            // すべてのスクロール可能要素を収集
            const allScrollables = Array.from(document.querySelectorAll('*')).filter(function (el) {
                const style = window.getComputedStyle(el);
                const isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll');
                const hasScroll = el.scrollHeight > el.clientHeight + 50;
                const isVisible = el.offsetParent !== null || el === document.body;
                return isScrollable && hasScroll && isVisible;
            });

            // 幅でソート（最も広いものを優先）
            allScrollables.sort(function (a, b) {
                return b.clientWidth - a.clientWidth;
            });

            // 幅が画面の40%以上のものを優先
            const mainCandidates = allScrollables.filter(function (el) {
                return el.clientWidth > window.innerWidth * 0.4;
            });

            if (mainCandidates.length > 0) {
                return mainCandidates[0];
            }

            // フォールバック: 一般的なセレクタ
            if (hostname.includes('gemini.google.com')) {
                return document.querySelector('main[role="main"]') || allScrollables[0] || null;
            }
            if (hostname.includes('notebooklm.google.com')) {
                return document.querySelector('main, [role="main"]') || allScrollables[0] || null;
            }

            return document.querySelector('main, [role="main"], article') || allScrollables[0] || null;
        },

        // 要素がメインペイン内にあるかチェック
        isInMainPane: function (element) {
            if (!this.mainPane) return false;
            return this.mainPane.contains(element);
        },

        // Geminiのチャット要素を検出
        detectGeminiChatItems: function () {
            const items = [];
            const hostname = window.location.hostname;

            if (!hostname.includes('gemini.google.com')) return items;

            // ユーザーのクエリ（H2タグ）を検出
            const queryHeadings = document.querySelectorAll('h2');
            queryHeadings.forEach((h2) => {
                if (this.mainPane && !this.mainPane.contains(h2)) return;
                // 回答コンテナ内のH2は除外（回答内見出しとして別途処理）
                if (h2.closest('[data-message-author-role="model"]') ||
                    h2.closest('.model-response') ||
                    h2.closest('[class*="model-response"]')) return;

                const text = h2.textContent.trim();
                if (text && text.length > 2) {
                    items.push({
                        element: h2,
                        text: text.substring(0, 100),
                        level: 2,
                        isQuery: true,
                        isResponse: false,
                        isNative: true,
                        isInMainPane: true
                    });
                }
            });

            // AIの回答（model-response）の冒頭部分を検出
            const modelResponses = document.querySelectorAll('[data-message-author-role="model"], .model-response, [class*="model-response"]');
            modelResponses.forEach((resp) => {
                if (this.mainPane && !this.mainPane.contains(resp)) return;

                // 回答内の最初の段落またはテキストブロックを取得
                let firstPara = resp.querySelector('p, .markdown-content > *:first-child, [class*="response-text"] > *:first-child');
                if (!firstPara) {
                    // フォールバック: 直接のテキストノードを探す
                    const walker = document.createTreeWalker(resp, NodeFilter.SHOW_TEXT, null, false);
                    const firstText = walker.nextNode();
                    if (firstText && firstText.textContent.trim().length > 10) {
                        firstPara = firstText.parentElement;
                    }
                }

                if (firstPara) {
                    let text = firstPara.textContent.trim();
                    // 最初の一文を抽出（。や.で終わる最初の文）
                    const firstSentence = text.match(/^[^。.!?！？]+[。.!?！？]?/);
                    if (firstSentence) {
                        text = firstSentence[0];
                    }
                    if (text.length > 100) {
                        text = text.substring(0, 97) + '...';
                    }

                    if (text && text.length > 5) {
                        items.push({
                            element: firstPara,
                            text: text,
                            level: 2.5,  // H2とH3の間（応答内のH3〜H6がこの下にぶら下がる）
                            isQuery: false,
                            isResponse: true,
                            isNative: false,
                            isInMainPane: true
                        });
                    }
                }

                // 回答内のHタグも見出しとして抽出
                // レベルを 2.5 + (元レベル/10) にして、必ず回答の子要素になるようにする
                const responseHeadings = resp.querySelectorAll('h1, h2, h3, h4, h5, h6');
                responseHeadings.forEach((h) => {
                    const text = h.textContent.trim();
                    const originalLvl = parseInt(h.tagName.charAt(1));
                    // H1→2.51, H2→2.52, H3→2.53... として回答(2.5)の子に配置
                    const effectiveLevel = 2.5 + (originalLvl / 10);
                    if (text && text.length > 2) {
                        items.push({
                            element: h,
                            text: text.substring(0, 100),
                            level: effectiveLevel,
                            originalLevel: originalLvl,  // 表示用に元のレベルを保持
                            isQuery: false,
                            isResponse: false,
                            isInsideResponse: true,  // 回答内フラグ
                            isNative: true,
                            isInMainPane: true
                        });
                    }
                });
            });

            return items;
        },

        getBaseFontSize: function () {
            const body = document.body;
            if (!body) return 16;
            const computed = window.getComputedStyle(body);
            return parseFloat(computed.fontSize) || 16;
        },

        isHeadingCandidate: function (element, baseFontSize) {
            if (element.offsetParent === null && element.tagName !== 'BODY') {
                return null;
            }

            const style = window.getComputedStyle(element);
            const fontSize = parseFloat(style.fontSize);
            const fontWeight = parseInt(style.fontWeight) || 400;
            const text = element.textContent.trim();

            if (!text || text.length > this.config.maxTextLength || text.length < 3) {
                return null;
            }

            if (element.children.length > 5) {
                return null;
            }

            const isBigger = fontSize >= baseFontSize * this.config.fontSizeRatio;
            const isBold = fontWeight >= this.config.boldThreshold;

            if (!isBigger && !isBold) return null;

            let score = 0;
            let level = 6;

            if (isBigger) {
                score += 30;
                const ratio = fontSize / baseFontSize;
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

            if (score < 40) {
                return null;
            }

            return {
                element: element,
                text: text.substring(0, 100),
                level: level,
                score: score,
                isNative: false,
                isQuery: false,
                isResponse: false,
                isInMainPane: this.isInMainPane(element)
            };
        },

        detect: function () {
            // メインペインを検出
            this.mainPane = this.detectMainPane();

            const allHeadings = [];
            const hostname = window.location.hostname;
            const addedElements = new Set();

            // Gemini専用のチャット検出
            if (hostname.includes('gemini.google.com')) {
                const chatItems = this.detectGeminiChatItems();
                chatItems.forEach((item) => {
                    if (!addedElements.has(item.element)) {
                        addedElements.add(item.element);
                        allHeadings.push(item);
                    }
                });
            }

            // ネイティブ見出し（H1-H6）を検出
            const nativeHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
            nativeHeadings.forEach((h) => {
                if (addedElements.has(h)) return;

                const text = h.textContent.trim();
                if (!text || text.length < 2) return;

                const lvl = h.tagName.match(/^H([1-6])$/) ? parseInt(h.tagName.charAt(1)) : (parseInt(h.getAttribute('aria-level')) || 3);
                const inMain = this.isInMainPane(h);

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

            // スタイル解析による見出し検出（Gemini以外、またはメインペインがない場合）
            if (!hostname.includes('gemini.google.com') || !this.mainPane) {
                const baseFontSize = this.getBaseFontSize();
                const selectors = 'p, div, span, li, strong, b, em';
                const elements = document.querySelectorAll(selectors);

                const candidates = [];
                elements.forEach((el) => {
                    if (addedElements.has(el)) return;

                    // 見出しタグ内の要素はスキップ
                    let insideHeading = false;
                    nativeHeadings.forEach((h) => {
                        if (h.contains(el)) insideHeading = true;
                    });
                    if (insideHeading) return;

                    const result = this.isHeadingCandidate(el, baseFontSize);
                    if (result) {
                        candidates.push(result);
                    }
                });

                // スコア順にソート
                candidates.sort((a, b) => b.score - a.score);

                // 重複削除して追加
                candidates.forEach((c) => {
                    let isDup = false;
                    addedElements.forEach((added) => {
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

            // DOMの出現順にソート
            allHeadings.sort((a, b) => {
                const pos = a.element.compareDocumentPosition(b.element);
                return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });

            return allHeadings;
        },

        highlight: function (headings) {
            this.clearHighlight();

            headings.forEach((heading, index) => {
                const el = heading.element;
                let colorKey = 'h' + heading.level;
                if (heading.isQuery) colorKey = 'query';
                if (heading.isResponse) colorKey = 'response';

                const color = this.config.highlightColors[colorKey] || this.config.highlightColors.h6;

                el.style.outline = '2px solid ' + color.replace('0.3', '0.8');
                el.style.backgroundColor = color;
                el.dataset.headingDetected = 'true';
                el.dataset.headingLevel = heading.level;
                el.dataset.headingIndex = index;
            });
        },

        clearHighlight: function () {
            const highlighted = document.querySelectorAll('[data-heading-detected="true"]');
            highlighted.forEach((el) => {
                el.style.outline = '';
                el.style.backgroundColor = '';
                delete el.dataset.headingDetected;
                delete el.dataset.headingLevel;
                delete el.dataset.headingIndex;
            });
        },

        getScrollContainer: function () {
            if (this.mainPane && this.mainPane.scrollHeight > this.mainPane.clientHeight) {
                return this.mainPane;
            }
            return window;
        },

        scrollToHeading: function (index) {
            const el = document.querySelector(`[data-heading-index="${index}"]`);
            if (el) {
                const container = this.getScrollContainer();
                const isWindow = (container === window);
                const currentScroll = isWindow ? window.scrollY : container.scrollTop;
                const rect = el.getBoundingClientRect();
                const containerTop = isWindow ? 0 : container.getBoundingClientRect().top;
                const targetTopRel = currentScroll + rect.top - containerTop;
                // 見出しを画面上部に表示（20pxのマージン）
                const targetScrollPos = targetTopRel - 20;

                if (isWindow) {
                    window.scrollTo({ top: targetScrollPos, behavior: 'smooth' });
                } else {
                    container.scrollTo({ top: targetScrollPos, behavior: 'smooth' });
                }

                // 一時的にハイライトを強調
                const originalBg = el.style.backgroundColor;
                el.style.transition = 'background 0.3s ease-out';
                el.style.backgroundColor = 'rgba(255, 235, 59, 0.4)';
                setTimeout(() => {
                    el.style.backgroundColor = originalBg;
                    setTimeout(() => {
                        el.style.transition = '';
                    }, 300);
                }, 1500);
            }
        }
    };

    // グローバルに公開
    window.HeadingDetector = HeadingDetector;

    // 変更検出用の状態
    let lastHeadingCount = 0;
    let lastHeadingHash = '';

    // 見出しのハッシュを計算（簡易的な変更検出）
    function computeHeadingHash(headings) {
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
            const headings = HeadingDetector.detect();
            HeadingDetector.highlight(headings);

            // 変更検出用に現在の状態を保存
            lastHeadingCount = headings.length;
            lastHeadingHash = computeHeadingHash(headings);

            // 要素を除いたデータを返す
            const result = headings.map((h, index) => ({
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
            const headings = HeadingDetector.detect();
            const currentHash = computeHeadingHash(headings);
            const hasChanges = (headings.length !== lastHeadingCount) || (currentHash !== lastHeadingHash);

            sendResponse({ success: true, hasChanges: hasChanges });
        } else if (request.action === 'scrollTo') {
            HeadingDetector.scrollToHeading(request.index);
            sendResponse({ success: true });
        } else if (request.action === 'clear') {
            HeadingDetector.clearHighlight();
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
