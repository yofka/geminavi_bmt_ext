/**
 * Heading Detector - Content Script
 * 
 * Chrome拡張機能として実行されるスクリプト
 * CSP制限のあるページでも動作するように設計
 */

(function () {
    'use strict';

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
                h6: 'rgba(200, 200, 200, 0.3)'
            }
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
            const display = style.display;
            const text = element.textContent.trim();

            if (!text || text.length > this.config.maxTextLength || text.length < 2) {
                return null;
            }

            if (element.children.length > 5) {
                return null;
            }

            const isBigger = fontSize >= baseFontSize * this.config.fontSizeRatio;
            const isBold = fontWeight >= this.config.boldThreshold;
            const isBlock = ['block', 'flex', 'grid', 'list-item'].includes(display) ||
                display.startsWith('table');

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

            if (isBlock) score += 15;

            const marginTop = parseFloat(style.marginTop) || 0;
            const marginBottom = parseFloat(style.marginBottom) || 0;
            const paddingTop = parseFloat(style.paddingTop) || 0;
            const paddingBottom = parseFloat(style.paddingBottom) || 0;

            if (marginTop > 10 || paddingTop > 10) score += 10;
            if (marginBottom > 5 || paddingBottom > 5) score += 5;

            if (text.length <= 50) score += 10;
            if (text.length <= 20) score += 5;

            const classAndId = (element.className + ' ' + element.id).toLowerCase();
            if (/heading|title|header|section-title|headline/i.test(classAndId)) {
                score += 15;
            }

            if (score < 40) {
                return null;
            }

            return {
                element: element,
                text: text.substring(0, 100),
                level: level,
                score: score,
                fontSize: fontSize,
                fontWeight: fontWeight
            };
        },

        removeDuplicates: function (headings) {
            const result = [];
            const elements = headings.map(h => h.element);

            for (const heading of headings) {
                let isDuplicate = false;

                for (const other of elements) {
                    if (heading.element === other) continue;

                    if (heading.element.contains(other) || other.contains(heading.element)) {
                        const otherHeading = headings.find(h => h.element === other);
                        if (other.contains(heading.element) && otherHeading.score >= heading.score) {
                            isDuplicate = true;
                            break;
                        }
                    }
                }

                if (!isDuplicate) {
                    result.push(heading);
                }
            }

            return result;
        },

        detect: function (options = {}) {
            const config = { ...this.config, ...options };
            const baseFontSize = this.getBaseFontSize();

            const existingHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            const candidates = [];
            const selectors = 'p, div, span, li, td, th, a, strong, b, em, article, section, header, footer, main, aside, nav, label';
            const elements = document.querySelectorAll(selectors);

            for (const element of elements) {
                let isInsideHeading = false;
                for (const h of existingHeadings) {
                    if (h.contains(element)) {
                        isInsideHeading = true;
                        break;
                    }
                }
                if (isInsideHeading) continue;

                const result = this.isHeadingCandidate(element, baseFontSize);
                if (result) {
                    candidates.push(result);
                }
            }

            candidates.sort((a, b) => b.score - a.score);
            const topCandidates = candidates.slice(0, config.maxHeadings * 2);
            const filtered = this.removeDuplicates(topCandidates);

            filtered.sort((a, b) => {
                const pos = a.element.compareDocumentPosition(b.element);
                return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });

            const allHeadings = [];

            for (const h of existingHeadings) {
                const text = h.textContent.trim();
                if (text) {
                    allHeadings.push({
                        element: h,
                        text: text.substring(0, 100),
                        level: parseInt(h.tagName.charAt(1)),
                        score: 100,
                        isNative: true
                    });
                }
            }

            for (const heading of filtered.slice(0, config.maxHeadings)) {
                heading.isNative = false;
                allHeadings.push(heading);
            }

            allHeadings.sort((a, b) => {
                const pos = a.element.compareDocumentPosition(b.element);
                return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
            });

            return allHeadings;
        },

        highlight: function (headings) {
            this.clearHighlight();

            for (const heading of headings) {
                const el = heading.element;
                const level = 'h' + heading.level;
                const color = this.config.highlightColors[level] || this.config.highlightColors.h6;

                el.style.outline = '2px solid ' + color.replace('0.3', '0.8');
                el.style.backgroundColor = color;
                el.dataset.headingDetected = 'true';
                el.dataset.headingLevel = heading.level;
                el.dataset.headingIndex = headings.indexOf(heading);
            }
        },

        clearHighlight: function () {
            const highlighted = document.querySelectorAll('[data-heading-detected="true"]');
            for (const el of highlighted) {
                el.style.outline = '';
                el.style.backgroundColor = '';
                delete el.dataset.headingDetected;
                delete el.dataset.headingLevel;
                delete el.dataset.headingIndex;
            }
        },

        scrollToHeading: function (index) {
            const el = document.querySelector(`[data-heading-index="${index}"]`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // 一時的にハイライトを強調
                const originalOutline = el.style.outline;
                el.style.outline = '4px solid #ff6b6b';
                setTimeout(() => {
                    el.style.outline = originalOutline;
                }, 1500);
            }
        }
    };

    // グローバルに公開
    window.HeadingDetector = HeadingDetector;

    // メッセージリスナー（ポップアップからの指示を受信）
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'detect') {
            const headings = HeadingDetector.detect();
            HeadingDetector.highlight(headings);

            // 要素を除いたデータを返す
            const result = headings.map((h, index) => ({
                index: index,
                text: h.text,
                level: h.level,
                score: h.score,
                isNative: h.isNative
            }));

            sendResponse({ success: true, headings: result });
        } else if (request.action === 'scrollTo') {
            HeadingDetector.scrollToHeading(request.index);
            sendResponse({ success: true });
        } else if (request.action === 'clear') {
            HeadingDetector.clearHighlight();
            sendResponse({ success: true });
        }
        return true; // 非同期レスポンスのため
    });

})();
