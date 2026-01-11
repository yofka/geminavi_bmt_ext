/**
 * Heading Detector - スタイル解析による見出し検出
 * 
 * 見出しタグがないページでも、CSSスタイルを解析して
 * 見出しらしい要素を特定するライブラリ
 */

(function(global) {
  'use strict';

  const HeadingDetector = {
    /**
     * デフォルト設定
     */
    config: {
      // 本文との比較でこの倍率以上なら見出し候補
      fontSizeRatio: 1.15,
      // この値以上なら太字と判定
      boldThreshold: 600,
      // 見出しの最大文字数
      maxTextLength: 150,
      // 検出する最大数
      maxHeadings: 100,
      // ハイライト色
      highlightColors: {
        h1: 'rgba(255, 107, 107, 0.3)',
        h2: 'rgba(255, 159, 67, 0.3)',
        h3: 'rgba(255, 220, 0, 0.3)',
        h4: 'rgba(72, 219, 251, 0.3)',
        h5: 'rgba(162, 155, 254, 0.3)',
        h6: 'rgba(200, 200, 200, 0.3)'
      }
    },

    /**
     * ページの基準フォントサイズを取得
     */
    getBaseFontSize: function() {
      const body = document.body;
      if (!body) return 16;
      
      const computed = window.getComputedStyle(body);
      const fontSize = parseFloat(computed.fontSize);
      return fontSize || 16;
    },

    /**
     * 要素が見出し候補かどうかを判定
     */
    isHeadingCandidate: function(element, baseFontSize) {
      // 非表示要素をスキップ
      if (element.offsetParent === null && element.tagName !== 'BODY') {
        return null;
      }

      const style = window.getComputedStyle(element);
      const fontSize = parseFloat(style.fontSize);
      const fontWeight = parseInt(style.fontWeight) || 400;
      const display = style.display;
      const text = element.textContent.trim();

      // 空テキストまたは長すぎるテキストをスキップ
      if (!text || text.length > this.config.maxTextLength || text.length < 2) {
        return null;
      }

      // 子要素が多すぎる場合はコンテナなのでスキップ
      if (element.children.length > 5) {
        return null;
      }

      // フォントサイズが基準より大きいか
      const isBigger = fontSize >= baseFontSize * this.config.fontSizeRatio;
      
      // 太字かどうか
      const isBold = fontWeight >= this.config.boldThreshold;

      // ブロック要素かどうか
      const isBlock = ['block', 'flex', 'grid', 'list-item'].includes(display) ||
                      display.startsWith('table');

      // スコア計算
      let score = 0;
      let level = 6;

      if (isBigger) {
        score += 30;
        // フォントサイズから推定レベルを計算
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

      if (isBlock) {
        score += 15;
      }

      // 上下のマージン/パディングがある場合
      const marginTop = parseFloat(style.marginTop) || 0;
      const marginBottom = parseFloat(style.marginBottom) || 0;
      const paddingTop = parseFloat(style.paddingTop) || 0;
      const paddingBottom = parseFloat(style.paddingBottom) || 0;
      
      if (marginTop > 10 || paddingTop > 10) score += 10;
      if (marginBottom > 5 || paddingBottom > 5) score += 5;

      // テキストが短めなら見出しらしさアップ
      if (text.length <= 50) score += 10;
      if (text.length <= 20) score += 5;

      // 特定のクラス名やID（ヒューリスティック）
      const classAndId = (element.className + ' ' + element.id).toLowerCase();
      if (/heading|title|header|section-title|headline/i.test(classAndId)) {
        score += 15;
      }

      // 最低スコアを満たさない場合はnull
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

    /**
     * 重複を除去（親子関係にある要素）
     */
    removeDuplicates: function(headings) {
      const result = [];
      const elements = headings.map(h => h.element);

      for (const heading of headings) {
        let isDuplicate = false;
        
        // この要素が他の要素の親または子かチェック
        for (const other of elements) {
          if (heading.element === other) continue;
          
          if (heading.element.contains(other) || other.contains(heading.element)) {
            // より具体的な（内側の）要素を優先、またはスコアが高い方
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

    /**
     * メイン検出関数
     */
    detect: function(options = {}) {
      const config = { ...this.config, ...options };
      const baseFontSize = this.getBaseFontSize();
      
      // 既存の見出しタグも含めて収集
      const existingHeadings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      const existingElements = new Set(existingHeadings);

      // 検出対象の要素を収集
      const candidates = [];
      const selectors = 'p, div, span, li, td, th, a, strong, b, em, article, section, header, footer, main, aside, nav, label';
      const elements = document.querySelectorAll(selectors);

      for (const element of elements) {
        // 既存の見出しタグ内の要素はスキップ
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

      // スコア順にソート
      candidates.sort((a, b) => b.score - a.score);

      // 上位のみ取得
      const topCandidates = candidates.slice(0, config.maxHeadings * 2);

      // 重複除去
      const filtered = this.removeDuplicates(topCandidates);

      // DOMの出現順にソート
      filtered.sort((a, b) => {
        const pos = a.element.compareDocumentPosition(b.element);
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      // 既存の見出しも追加
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

      // 検出した見出しを追加
      for (const heading of filtered.slice(0, config.maxHeadings)) {
        heading.isNative = false;
        allHeadings.push(heading);
      }

      // 再度DOMの出現順にソート
      allHeadings.sort((a, b) => {
        const pos = a.element.compareDocumentPosition(b.element);
        return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });

      return allHeadings;
    },

    /**
     * 検出した見出しをハイライト表示
     */
    highlight: function(headings) {
      // 既存のハイライトを削除
      this.clearHighlight();

      for (const heading of headings) {
        const el = heading.element;
        const level = 'h' + heading.level;
        const color = this.config.highlightColors[level] || this.config.highlightColors.h6;
        
        el.style.outline = '2px solid ' + color.replace('0.3', '0.8');
        el.style.backgroundColor = color;
        el.dataset.headingDetected = 'true';
        el.dataset.headingLevel = heading.level;
      }
    },

    /**
     * ハイライトをクリア
     */
    clearHighlight: function() {
      const highlighted = document.querySelectorAll('[data-heading-detected="true"]');
      for (const el of highlighted) {
        el.style.outline = '';
        el.style.backgroundColor = '';
        delete el.dataset.headingDetected;
        delete el.dataset.headingLevel;
      }
    },

    /**
     * 結果をコンソールに出力
     */
    logResults: function(headings) {
      console.group('🔍 Heading Detector - 検出結果');
      console.log(`検出数: ${headings.length}`);
      
      for (let i = 0; i < headings.length; i++) {
        const h = headings[i];
        const prefix = h.isNative ? '📌' : '✨';
        const levelStr = `H${h.level}`;
        console.log(
          `${prefix} [${levelStr}] "${h.text}" (スコア: ${h.score})`,
          h.element
        );
      }
      
      console.groupEnd();
    },

    /**
     * 全機能を実行
     */
    run: function(options = {}) {
      const headings = this.detect(options);
      this.highlight(headings);
      this.logResults(headings);
      return headings;
    }
  };

  // グローバルに公開
  global.HeadingDetector = HeadingDetector;

  // モジュール環境対応
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HeadingDetector;
  }

})(typeof window !== 'undefined' ? window : this);
