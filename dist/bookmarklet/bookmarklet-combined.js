// Heading Detector Bookmarklet (Combined)
// Generated: 2026-02-14T12:41:01.649Z

/**
 * Heading Detector - スタイル解析による見出し検出
 * 
 * 見出しタグがないページでも、CSSスタイルを解析して
 * 見出しらしい要素を特定するライブラリ
 */

(function (global) {
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

      const processedTexts = new Set();  // テキストで重複チェック

      // Shadow DOM 内も含めて要素を検索する関数
      const querySelectorAllDeep = (selector, root = document) => {
        const results = [...root.querySelectorAll(selector)];
        // Shadow DOM を持つ要素を探す
        root.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            results.push(...querySelectorAllDeep(selector, el.shadowRoot));
          }
        });
        return results;
      };

      // ユーザーのクエリを検出 - H2タグまたは role="heading" aria-level="2" の要素
      const queryHeadings = querySelectorAllDeep('h2, [role="heading"][aria-level="2"]');

      queryHeadings.forEach((h2) => {
        const text = h2.textContent.trim();
        const inMainPane = this.mainPane ? this.mainPane.contains(h2) : true;
        const inModelResponse = h2.closest('[data-message-author-role="model"]') ||
          h2.closest('.model-response') ||
          h2.closest('[class*="model-response"]');



        if (this.mainPane && !inMainPane) return;
        // 回答コンテナ内のH2は除外（回答内見出しとして別途処理）
        if (inModelResponse) return;

        if (!text || text.length < 2) return;

        // テキストで重複チェック
        if (processedTexts.has(text)) return;
        processedTexts.add(text);

        items.push({
          element: h2,
          text: text.substring(0, 100),
          level: 2,
          isQuery: true,
          isResponse: false,
          isNative: true,
          isInMainPane: true
        });
      });

      // AIの回答（model-response）の冒頭部分を検出
      const modelResponses = document.querySelectorAll('[data-message-author-role="model"], .model-response, [class*="model-response"]');
      const processedResponses = new Set();

      modelResponses.forEach((resp) => {
        if (this.mainPane && !this.mainPane.contains(resp)) return;

        // 既に処理済みの応答コンテナはスキップ（親子関係の重複防止）
        let isChildOfProcessed = false;
        processedResponses.forEach((pr) => {
          if (pr.contains(resp) || resp.contains(pr)) isChildOfProcessed = true;
        });
        if (isChildOfProcessed) return;
        processedResponses.add(resp);

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

          if (text && text.length > 5 && !processedTexts.has(text)) {
            processedTexts.add(text);
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
          if (!text || text.length < 2) return;
          if (processedTexts.has(text)) return;
          processedTexts.add(text);

          const originalLvl = parseInt(h.tagName.charAt(1));
          // H1→2.51, H2→2.52, H3→2.53... として回答(2.5)の子に配置
          const effectiveLevel = 2.5 + (originalLvl / 10);
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
        });
      });

      return items;
    },

    /**
     * ページの基準フォントサイズを取得
     */
    getBaseFontSize: function () {
      const body = document.body;
      if (!body) return 16;

      const computed = window.getComputedStyle(body);
      const fontSize = parseFloat(computed.fontSize);
      return fontSize || 16;
    },

    /**
     * 要素が見出し候補かどうかを判定
     */
    isHeadingCandidate: function (element, baseFontSize) {
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
     * ページのスクロールコンテナを特定
     */
    getScrollContainer: function () {
      if (this.mainPane && this.mainPane.scrollHeight > this.mainPane.clientHeight) {
        return this.mainPane;
      }
      return window;
    },

    /**
     * ページを特定の見出し要素までスクロール
     */
    scrollToHeading: function (targetEl) {
      const container = this.getScrollContainer();
      const isWindow = (container === window);
      const currentScroll = isWindow ? window.scrollY : container.scrollTop;
      const rect = targetEl.getBoundingClientRect();
      const containerTop = isWindow ? 0 : container.getBoundingClientRect().top;
      const targetTopRel = currentScroll + rect.top - containerTop;
      // 見出しを画面上部に表示（20pxのマージン）
      const targetScrollPos = targetTopRel - 20;

      if (isWindow) window.scrollTo({ top: targetScrollPos, behavior: 'smooth' });
      else container.scrollTo({ top: targetScrollPos, behavior: 'smooth' });

      // Highlight using the core HeadingDetector's highlight function
      this.highlight([{ element: targetEl }]);
    },

    /**
     * 重複を除去（親子関係にある要素）
     */
    removeDuplicates: function (headings) {
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
    detect: function (options = {}) {
      const config = { ...this.config, ...options };
      this.mainPane = this.detectMainPane(); // Set mainPane for the current detection run
      const baseFontSize = this.getBaseFontSize();

      const allHeadings = [];
      const addedElements = new Set();
      const hostname = window.location.hostname;

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
        if (addedElements.has(h)) return; // 既に追加済みならスキップ

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
      // またはGeminiページでも、メインペイン外の一般見出しを拾う
      if (!hostname.includes('gemini.google.com') || !this.mainPane) { // この条件は少し調整が必要かもしれません。
        const selectors = 'p, div, span, li, strong, b, em, article, section, header, footer, main, aside, nav, label';
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
            result.isInMainPane = this.isInMainPane(el); // isInMainPaneを正しく設定
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

      // 最大検出数で切り詰める
      // 検出した見出しを this.headings に代入する
      this.headings = allHeadings.slice(0, config.maxHeadings);
      return this.headings;
    },

    /**
     * 検出した見出しをハイライト表示
     */
    highlight: function (headings) {
      // 既存のハイライトを削除
      this.clearHighlight();

      for (const heading of headings) {
        const el = heading.element;
        let colorKey = 'h' + heading.level;
        if (heading.isQuery) colorKey = 'query';
        if (heading.isResponse) colorKey = 'response';

        const color = this.config.highlightColors[colorKey] || this.config.highlightColors.h6;

        el.style.outline = '2px solid ' + color.replace('0.3', '0.8');
        el.style.backgroundColor = color;
        el.dataset.headingDetected = 'true';
        el.dataset.headingLevel = heading.level;
      }
    },

    /**
     * ハイライトをクリア
     */
    clearHighlight: function () {
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
    logResults: function (headings) {
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
    run: function (options = {}) {
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
        h1Bg: '#000000', h1Text: '#666666', h1Border: '#000000', h1LinkText: '#a8c7fa', h1Highlight: 'rgba(255, 107, 107, 0.3)',
        h2Bg: '#000000', h2Text: '#666666', h2Border: '#000000', h2LinkText: '#a8c7fa', h2Highlight: 'rgba(255, 159, 67, 0.3)',
        h3Bg: '#000000', h3Text: '#666666', h3Border: '#000000', h3LinkText: '#a8c7fa', h3Highlight: 'rgba(255, 220, 0, 0.3)',
        h4Bg: '#000000', h4Text: '#666666', h4Border: '#000000', h4LinkText: '#a8c7fa', h4Highlight: 'rgba(72, 219, 251, 0.3)',
        h5Bg: '#000000', h5Text: '#666666', h5Border: '#000000', h5LinkText: '#a8c7fa', h5Highlight: 'rgba(162, 155, 254, 0.3)',
        h6Bg: '#000000', h6Text: '#666666', h6Border: '#000000', h6LinkText: '#a8c7fa', h6Highlight: 'rgba(200, 200, 200, 0.3)',
        queryBg: '#000000', queryText: '#666666', queryBorder: '#000000', queryLinkText: '#a8c7fa', queryHighlight: 'rgba(100, 200, 255, 0.3)',
        responseBg: '#000000', responseText: '#666666', responseBorder: '#000000', responseLinkText: '#a8c7fa', responseHighlight: 'rgba(180, 130, 255, 0.3)'
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
            return levels.map(l => {
                // rgba色からhex色とアルファを抽出するヘルパー
                const highlightColor = this.colors[l.key + 'Highlight'] || 'rgba(200, 200, 200, 0.3)';
                const hexColor = this.rgbaToHex(highlightColor);
                return `
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
                        <div class="hd-color-item">
                            <span class="hd-highlight-preview" style="background:${highlightColor};">HL</span>
                            <input type="color" id="hd-color-${l.key}Highlight" value="${hexColor}">
                        </div>
                    </div>
                </div>
            `}).join('');
        },

        // rgba色からhex色を抽出
        rgbaToHex: function (rgba) {
            const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
            if (match) {
                const r = parseInt(match[1]).toString(16).padStart(2, '0');
                const g = parseInt(match[2]).toString(16).padStart(2, '0');
                const b = parseInt(match[3]).toString(16).padStart(2, '0');
                return '#' + r + g + b;
            }
            return '#cccccc';
        },

        // hex色をrgba色に変換（透明度0.3固定）
        hexToRgba: function (hex) {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, 0.3)`;
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
                    // Highlight色はrgbaからhexに変換
                    if (key.endsWith('Highlight')) {
                        input.value = this.rgbaToHex(this.colors[key]);
                    } else {
                        input.value = this.colors[key];
                    }
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
                    // Highlight色はhexからrgbaに変換
                    if (key.endsWith('Highlight')) {
                        this.colors[key] = this.hexToRgba(input.value);
                    } else {
                        this.colors[key] = input.value;
                    }
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


/**
 * Heading Detector Bookmarklet - Self-contained version
 * Based on working original version
 */

javascript: (function () {
    var WIDGET_ID = 'heading-detector-widget';
    var doc = document, win = window;

    var THEME = {
        bg: '#1e1e1e',
        text: '#e3e3e3',
        border: '#444746',
        headerBg: '#2f3136',
        link: '#a8c7fa',
        hover: '#3c4043',
        highlight: 'rgba(255, 235, 59, 0.4)',
        searchHighlight: 'rgba(255, 107, 107, 0.6)',
        btnText: '#c4c7c5',
        btnHover: '#4f545c',
        activeBtnBg: '#0b57d0',
        activeBtnText: '#ffffff',
        h1: 'rgba(255, 107, 107, 0.8)',
        h2: 'rgba(255, 159, 67, 0.8)',
        h3: 'rgba(255, 220, 0, 0.8)',
        h4: 'rgba(72, 219, 251, 0.8)',
        h5: 'rgba(162, 155, 254, 0.8)',
        h6: 'rgba(200, 200, 200, 0.8)',
        query: 'rgba(100, 200, 255, 0.8)',
        response: 'rgba(180, 130, 255, 0.8)'
    };

    var config = {
        level: 2.5,
        x: 20,
        y: 60,
        width: 380,
        dock: 'none',
        wrap: false,
        searchQuery: ''
    };

    var existing = document.getElementById(WIDGET_ID);
    if (existing) existing.remove();

    function createEl(tag, styles, text) {
        var el = document.createElement(tag);
        if (styles) el.style.cssText = styles;
        if (text) el.textContent = text;
        return el;
    }

    // メインペイン検出
    function detectMainPane() {
        var hostname = win.location.hostname;
        var allScrollables = Array.from(doc.querySelectorAll('*')).filter(function (el) {
            var style = win.getComputedStyle(el);
            var isScrollable = (style.overflowY === 'auto' || style.overflowY === 'scroll');
            var hasScroll = el.scrollHeight > el.clientHeight + 50;
            var isVisible = el.offsetParent !== null || el === doc.body;
            return isScrollable && hasScroll && isVisible;
        });
        allScrollables.sort(function (a, b) {
            return b.clientWidth - a.clientWidth;
        });
        var mainCandidates = allScrollables.filter(function (el) {
            return el.clientWidth > win.innerWidth * 0.4;
        });
        if (mainCandidates.length > 0) {
            return mainCandidates[0];
        }
        if (hostname.includes('gemini.google.com')) {
            return doc.querySelector('main[role="main"]') || allScrollables[0] || null;
        }
        if (hostname.includes('notebooklm.google.com')) {
            return doc.querySelector('main, [role="main"]') || allScrollables[0] || null;
        }
        return doc.querySelector('main, [role="main"], article') || allScrollables[0] || null;
    }

    // Gemini チャット検出
    function detectGeminiChatItems(mainPane) {
        var items = [];
        var hostname = win.location.hostname;
        if (!hostname.includes('gemini.google.com')) return items;

        var processedTexts = new Set();

        // ユーザークエリ (H2)
        var queryHeadings = doc.querySelectorAll('h2');
        queryHeadings.forEach(function (h2) {
            if (mainPane && !mainPane.contains(h2)) return;
            if (h2.closest('[data-message-author-role="model"]') ||
                h2.closest('.model-response') ||
                h2.closest('[class*="model-response"]')) return;
            var text = h2.textContent.trim();
            if (!text || text.length < 2 || processedTexts.has(text)) return;
            processedTexts.add(text);
            items.push({
                element: h2,
                text: text.substring(0, 100),
                level: 2,
                isQuery: true,
                isResponse: false,
                isNative: true,
                isInMainPane: true
            });
        });

        // モデル応答
        var modelResponses = doc.querySelectorAll('[data-message-author-role="model"], .model-response, [class*="model-response"]');
        var processedResps = new Set();
        modelResponses.forEach(function (resp) {
            if (mainPane && !mainPane.contains(resp)) return;
            var isNested = false;
            processedResps.forEach(function (pr) {
                if (pr.contains(resp) || resp.contains(pr)) isNested = true;
            });
            if (isNested) return;
            processedResps.add(resp);

            var firstPara = resp.querySelector('p, .markdown-content > *:first-child, [class*="response-text"] > *:first-child');
            if (!firstPara) {
                var walker = doc.createTreeWalker(resp, NodeFilter.SHOW_TEXT, null, false);
                var firstText = walker.nextNode();
                if (firstText && firstText.textContent.trim().length > 10) {
                    firstPara = firstText.parentElement;
                }
            }

            if (firstPara) {
                var text = firstPara.textContent.trim();
                var firstSentence = text.match(/^[^。.!?！？]+[。.!?！？]?/);
                if (firstSentence) {
                    text = firstSentence[0];
                }
                if (text.length > 100) {
                    text = text.substring(0, 97) + '...';
                }
                if (text && text.length > 5 && !processedTexts.has(text)) {
                    processedTexts.add(text);
                    items.push({
                        element: firstPara,
                        text: text,
                        level: 2.5,
                        isQuery: false,
                        isResponse: true,
                        isNative: false,
                        isInMainPane: true
                    });
                }
            }

            // 応答内の見出し
            var responseHeadings = resp.querySelectorAll('h1, h2, h3, h4, h5, h6');
            responseHeadings.forEach(function (h) {
                var text = h.textContent.trim();
                if (!text || text.length < 2 || processedTexts.has(text)) return;
                processedTexts.add(text);
                var originalLvl = parseInt(h.tagName.charAt(1));
                var effectiveLevel = 2.5 + (originalLvl / 10);
                items.push({
                    element: h,
                    text: text.substring(0, 100),
                    level: effectiveLevel,
                    originalLevel: originalLvl,
                    isQuery: false,
                    isResponse: false,
                    isInsideResponse: true,
                    isNative: true,
                    isInMainPane: true
                });
            });
        });

        return items;
    }

    function getScrollContainer() {
        var mainPane = detectMainPane();
        if (mainPane && mainPane.scrollHeight > mainPane.clientHeight) {
            return mainPane;
        }
        return win;
    }

    function smartScrollTo(targetEl) {
        var container = getScrollContainer();
        var isWindow = (container === win);
        var currentScroll = isWindow ? win.scrollY : container.scrollTop;
        var rect = targetEl.getBoundingClientRect();
        var containerTop = isWindow ? 0 : container.getBoundingClientRect().top;
        var targetTopRel = currentScroll + rect.top - containerTop;
        var targetScrollPos = targetTopRel - 20;
        if (isWindow) win.scrollTo({ top: targetScrollPos, behavior: 'smooth' });
        else container.scrollTo({ top: targetScrollPos, behavior: 'smooth' });
        highlightElement(targetEl);
    }

    function highlightElement(el) {
        var originalBg = el.style.backgroundColor;
        el.style.transition = 'background 0.3s ease-out';
        el.style.backgroundColor = THEME.highlight;
        setTimeout(function () {
            el.style.backgroundColor = originalBg;
            setTimeout(function () { el.style.transition = ''; }, 300);
        }, 1500);
    }

    function isInMainPane(element, mainPane) {
        if (!mainPane) return false;
        return mainPane.contains(element);
    }

    // 全見出し検出
    function detectAllHeadings() {
        var mainPane = detectMainPane();
        var allHeadings = [];
        var hostname = win.location.hostname;
        var addedElements = new Set();

        if (hostname.includes('gemini.google.com')) {
            var chatItems = detectGeminiChatItems(mainPane);
            chatItems.forEach(function (item) {
                if (!addedElements.has(item.element)) {
                    addedElements.add(item.element);
                    allHeadings.push(item);
                }
            });
        }

        var nativeHeadings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
        nativeHeadings.forEach(function (h) {
            if (addedElements.has(h)) return;
            var text = h.textContent.trim();
            if (!text || text.length < 2) return;
            var lvl = h.tagName.match(/^H([1-6])$/) ? parseInt(h.tagName.charAt(1)) : (parseInt(h.getAttribute('aria-level')) || 3);
            var inMain = isInMainPane(h, mainPane);
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

        // 非Geminiまたはmainペインなしの場合のスタイル解析
        if (!hostname.includes('gemini.google.com') || !mainPane) {
            var baseFontSize = parseFloat(win.getComputedStyle(doc.body).fontSize) || 16;
            var selectors = 'p, div, span, li, strong, b, em';
            var elements = doc.querySelectorAll(selectors);
            var candidates = [];

            elements.forEach(function (el) {
                if (addedElements.has(el)) return;
                if (el.offsetParent === null && el.tagName !== 'BODY') return;

                var insideHeading = false;
                nativeHeadings.forEach(function (h) {
                    if (h.contains(el)) insideHeading = true;
                });
                if (insideHeading) return;

                var style = win.getComputedStyle(el);
                var fontSize = parseFloat(style.fontSize);
                var fontWeight = parseInt(style.fontWeight) || 400;
                var text = el.textContent.trim();

                if (!text || text.length > 150 || text.length < 3) return;
                if (el.children.length > 5) return;

                var isBigger = fontSize >= baseFontSize * 1.15;
                var isBold = fontWeight >= 600;
                if (!isBigger && !isBold) return;

                var score = 0;
                var level = 6;
                if (isBigger) {
                    score += 30;
                    var ratio = fontSize / baseFontSize;
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

                if (score >= 40) {
                    candidates.push({
                        element: el,
                        text: text.substring(0, 100),
                        level: level,
                        score: score,
                        isNative: false,
                        isQuery: false,
                        isResponse: false,
                        isInMainPane: isInMainPane(el, mainPane)
                    });
                }
            });

            candidates.sort(function (a, b) {
                return b.score - a.score;
            });

            candidates.forEach(function (c) {
                var isDup = false;
                addedElements.forEach(function (added) {
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

        allHeadings.sort(function (a, b) {
            var pos = a.element.compareDocumentPosition(b.element);
            return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
        });

        return { headings: allHeadings, mainPane: mainPane };
    }

    // 検出実行
    var result = detectAllHeadings();
    var headings = result.headings;
    var mainPane = result.mainPane;

    // ウィジェット作成
    var container = createEl('div', '');
    container.id = WIDGET_ID;

    function updateContainerStyle() {
        var baseStyle = 'position:fixed;z-index:999999;background:' + THEME.bg + ';border:1px solid ' + THEME.border + ';display:flex;flex-direction:column;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:12px;color:' + THEME.text + ';box-sizing:border-box;';
        if (config.dock === 'left') {
            container.style.cssText = baseStyle + 'top:0;left:0;bottom:0;width:' + config.width + 'px;border-radius:0;box-shadow:2px 0 5px rgba(0,0,0,0.3);max-height:100vh;';
        } else if (config.dock === 'right') {
            container.style.cssText = baseStyle + 'top:0;right:0;bottom:0;width:' + config.width + 'px;border-radius:0;box-shadow:-2px 0 5px rgba(0,0,0,0.3);max-height:100vh;';
        } else {
            container.style.cssText = baseStyle + 'top:' + config.y + 'px;left:' + config.x + 'px;width:' + config.width + 'px;max-height:85vh;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,0.5);';
        }
    }
    updateContainerStyle();

    // ヘッダー
    var header = createEl('div', 'padding:10px 12px;background:' + THEME.headerBg + ';border-bottom:1px solid ' + THEME.border + ';display:flex;flex-direction:column;gap:8px;flex-shrink:0;user-select:none;cursor:move;border-radius:8px 8px 0 0;');
    var topRow = createEl('div', 'display:flex;justify-content:space-between;align-items:center;');
    var titleSpan = createEl('span', 'font-weight:bold;font-size:14px;', '🔍 Heading Detector');
    var ctrlGroup = createEl('div', 'display:flex;gap:6px;align-items:center;');

    function createBtn(text, title, onClick) {
        var b = document.createElement('button');
        b.textContent = text;
        b.title = title;
        b.style.cssText = 'border:1px solid ' + THEME.border + ';background:transparent;cursor:pointer;border-radius:4px;padding:4px 8px;font-size:11px;color:' + THEME.btnText + ';';
        b.onmouseover = function () { if (!b.classList.contains('active')) b.style.background = THEME.btnHover; };
        b.onmouseout = function () { if (!b.classList.contains('active')) b.style.background = 'transparent'; };
        b.onclick = onClick;
        b.onmousedown = function (e) { e.stopPropagation(); };
        return b;
    }

    var btnWrap = createBtn('Wrap', '折り返し On/Off', function () {
        config.wrap = !config.wrap;
        updateWrapBtn();
        renderTree();
    });

    function updateWrapBtn() {
        if (config.wrap) {
            btnWrap.style.background = THEME.activeBtnBg;
            btnWrap.style.color = THEME.activeBtnText;
            btnWrap.classList.add('active');
        } else {
            btnWrap.style.background = 'transparent';
            btnWrap.style.color = THEME.btnText;
            btnWrap.classList.remove('active');
        }
    }
    updateWrapBtn();

    var btnDockLeft = createBtn('⇦', '左ドック', function () {
        config.dock = (config.dock === 'left') ? 'none' : 'left';
        updateContainerStyle();
    });
    var btnDockRight = createBtn('⇨', '右ドック', function () {
        config.dock = (config.dock === 'right') ? 'none' : 'right';
        updateContainerStyle();
    });
    var btnClose = createBtn('×', '閉じる', function () {
        container.remove();
    });

    ctrlGroup.appendChild(btnWrap);
    ctrlGroup.appendChild(btnDockLeft);
    ctrlGroup.appendChild(btnDockRight);
    ctrlGroup.appendChild(btnClose);
    topRow.appendChild(titleSpan);
    topRow.appendChild(ctrlGroup);
    header.appendChild(topRow);

    // 検索行
    var searchRow = createEl('div', 'display:flex;gap:6px;align-items:center;');
    searchRow.onmousedown = function (e) { e.stopPropagation(); };
    var searchInput = createEl('input', 'flex:1;padding:6px 10px;border:1px solid ' + THEME.border + ';border-radius:4px;background:#2a2a2a;color:' + THEME.text + ';font-size:12px;outline:none;');
    searchInput.type = 'text';
    searchInput.placeholder = '🔎 見出しを検索...';
    searchInput.oninput = function () {
        config.searchQuery = this.value.trim().toLowerCase();
        renderTree();
    };
    var searchClear = createBtn('✕', 'クリア', function () {
        searchInput.value = '';
        config.searchQuery = '';
        renderTree();
    });
    searchRow.appendChild(searchInput);
    searchRow.appendChild(searchClear);
    header.appendChild(searchRow);

    // レベルボタン行
    var filterRow = createEl('div', 'display:flex;align-items:center;gap:6px;cursor:default;');
    filterRow.onmousedown = function (e) { e.stopPropagation(); };
    var lbl = createEl('span', 'font-size:11px;color:' + THEME.btnText + ';', 'Expand:');
    filterRow.appendChild(lbl);

    var levelBtns = [];
    var levelOptions = [1, 2, 2.5, 3, 4, 5, 6];

    function renderDepthBtns() {
        levelBtns.forEach(function (b) { b.remove(); });
        levelBtns = [];
        levelOptions.forEach(function (lvl) {
            var btn = document.createElement('button');
            btn.textContent = lvl === 2.5 ? 'A' : lvl;
            btn.title = lvl === 2.5 ? '回答まで表示' : 'H' + lvl + 'まで表示';
            var baseStyle = 'border:1px solid ' + THEME.border + ';cursor:pointer;border-radius:4px;width:26px;height:26px;font-size:11px;padding:0;text-align:center;color:' + THEME.text + ';';
            if (lvl === config.level) {
                btn.style.cssText = baseStyle + 'background:' + THEME.activeBtnBg + ';color:' + THEME.activeBtnText + ';font-weight:bold;border-color:' + THEME.activeBtnBg + ';';
            } else {
                btn.style.cssText = baseStyle + 'background:transparent;';
                btn.onmouseover = function () { this.style.background = THEME.btnHover; };
                btn.onmouseout = function () { this.style.background = 'transparent'; };
            }
            btn.onclick = function () {
                config.level = lvl;
                renderDepthBtns();
                renderTree();
            };
            filterRow.appendChild(btn);
            levelBtns.push(btn);
        });
    }
    renderDepthBtns();
    header.appendChild(filterRow);

    // カウント行
    var mainCount = headings.filter(function (h) { return h.isInMainPane; }).length;
    var queryCount = headings.filter(function (h) { return h.isQuery; }).length;
    var respCount = headings.filter(function (h) { return h.isResponse; }).length;
    var countRow = createEl('div', 'font-size:11px;color:' + THEME.btnText + ';', '🎯 メイン: ' + mainCount + ' 件 💬 Q: ' + queryCount + ' 💭 A: ' + respCount + ' 📌 全体: ' + headings.length + ' 件');
    header.appendChild(countRow);

    container.appendChild(header);

    // コンテンツ
    var content = createEl('div', 'flex-grow:1;overflow-y:auto;padding:12px;background:' + THEME.bg + ';');
    container.appendChild(content);

    function markSearchMatches(nodes, query) {
        if (!query) return false;
        var hasMatch = false;
        nodes.forEach(function (node) {
            var textMatch = node.heading.text.toLowerCase().includes(query);
            var childMatch = node.children.length > 0 ? markSearchMatches(node.children, query) : false;
            node.searchMatch = textMatch;
            node.hasMatchInChildren = childMatch;
            if (textMatch || childMatch) hasMatch = true;
        });
        return hasMatch;
    }

    function buildTree(elements) {
        var root = { children: [] };
        var stack = [{ level: 0, node: root }];
        elements.forEach(function (el) {
            var node = { heading: el, level: el.level, children: [], searchMatch: false, hasMatchInChildren: false };
            while (stack.length > 1 && stack[stack.length - 1].level >= el.level) stack.pop();
            stack[stack.length - 1].node.children.push(node);
            stack.push({ level: el.level, node: node });
        });
        return root.children;
    }

    function getLevelColor(heading) {
        if (heading.isQuery) return THEME.query;
        if (heading.isResponse) return THEME.response;
        var displayLevel = heading.originalLevel || Math.floor(heading.level);
        return THEME['h' + displayLevel] || THEME.h6;
    }

    function getBadgeText(heading) {
        if (heading.isQuery) return '💬Q';
        if (heading.isResponse) return '💭A';
        var displayLevel = heading.originalLevel || Math.floor(heading.level);
        return (heading.isNative ? '' : '✨') + 'H' + displayLevel;
    }

    function isInGeminiConversation(node) {
        var isConversationRoot = node.heading.text.includes('Gemini との会話') || node.heading.text.includes('Conversations with Gemini');
        return isConversationRoot || (node.heading.isInMainPane && (node.heading.isQuery || node.heading.isResponse || node.heading.isInsideResponse));
    }

    function createTreeDom(nodes, depth, parentInGemini) {
        if (nodes.length === 0) return null;
        var ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none;padding-left:' + (depth === 0 ? '0' : '18px') + ';margin:0;';

        nodes.forEach(function (node) {
            var li = document.createElement('li');
            li.style.cssText = 'margin-bottom:6px;line-height:1.5;';
            var row = document.createElement('div');
            row.style.cssText = 'display:flex;align-items:flex-start;gap:6px;';

            var hasChildren = node.children.length > 0;
            var isMain = node.heading.isInMainPane;
            var inGemini = parentInGemini || isInGeminiConversation(node);

            var isCollapsed;
            if (inGemini) {
                if (node.heading.isInsideResponse && node.heading.originalLevel) {
                    isCollapsed = node.heading.originalLevel >= config.level;
                } else {
                    isCollapsed = node.level >= config.level;
                }
            } else {
                isCollapsed = true;
            }

            if (config.searchQuery && (node.searchMatch || node.hasMatchInChildren)) {
                isCollapsed = false;
            }

            var toggle = document.createElement('span');
            toggle.textContent = hasChildren ? (isCollapsed ? '▶' : '▼') : '•';
            toggle.style.cssText = 'cursor:' + (hasChildren ? 'pointer' : 'default') + ';color:' + (hasChildren ? THEME.btnText : '#555') + ';font-size:10px;margin-top:3px;width:12px;flex-shrink:0;user-select:none;';

            var levelBadge = document.createElement('span');
            levelBadge.textContent = getBadgeText(node.heading);
            levelBadge.style.cssText = 'flex-shrink:0;font-size:9px;padding:2px 5px;border-radius:3px;background:' + getLevelColor(node.heading) + ';color:#fff;font-weight:bold;';
            if (isMain) {
                levelBadge.style.boxShadow = '0 0 0 2px rgba(100, 255, 100, 0.5)';
            }

            var link = document.createElement('a');
            link.textContent = node.heading.text.replace(/\s+/g, ' ');
            link.style.cssText = 'color:' + THEME.link + ';text-decoration:none;cursor:pointer;word-break:break-all;';
            if (!config.wrap) {
                link.style.whiteSpace = 'nowrap';
                link.style.overflow = 'hidden';
                link.style.textOverflow = 'ellipsis';
                link.style.display = 'block';
                link.style.maxWidth = '220px';
            }

            if (config.searchQuery) {
                if (node.searchMatch) {
                    row.style.background = THEME.searchHighlight;
                    row.style.borderRadius = '4px';
                    row.style.padding = '2px 4px';
                    row.style.margin = '-2px -4px';
                } else if (node.hasMatchInChildren && isCollapsed) {
                    row.style.background = 'rgba(255, 107, 107, 0.3)';
                    row.style.borderRadius = '4px';
                    row.style.padding = '2px 4px';
                    row.style.margin = '-2px -4px';
                }
            }

            link.onclick = function (e) {
                e.preventDefault();
                smartScrollTo(node.heading.element);
            };
            link.onmouseover = function () { this.style.textDecoration = 'underline'; };
            link.onmouseout = function () { this.style.textDecoration = 'none'; };

            var childContainer = null;
            if (hasChildren) {
                childContainer = createTreeDom(node.children, depth + 1, inGemini);
                childContainer.style.display = isCollapsed ? 'none' : 'block';
                childContainer.style.marginTop = '6px';

                var rowRef = row;
                var nodeRef = node;
                toggle.onclick = function (e) {
                    e.stopPropagation();
                    var hidden = childContainer.style.display === 'none';
                    childContainer.style.display = hidden ? 'block' : 'none';
                    toggle.textContent = hidden ? '▼' : '▶';
                    if (childContainer.style.display === 'block') {
                        if (nodeRef.hasMatchInChildren && !nodeRef.searchMatch) {
                            rowRef.style.background = '';
                            rowRef.style.padding = '';
                            rowRef.style.margin = '';
                        }
                    } else {
                        if (nodeRef.hasMatchInChildren && !nodeRef.searchMatch && config.searchQuery) {
                            rowRef.style.background = 'rgba(255, 107, 107, 0.3)';
                            rowRef.style.borderRadius = '4px';
                            rowRef.style.padding = '2px 4px';
                            rowRef.style.margin = '-2px -4px';
                        }
                    }
                };
            }

            row.appendChild(toggle);
            row.appendChild(levelBadge);
            row.appendChild(link);
            li.appendChild(row);
            if (childContainer) li.appendChild(childContainer);
            ul.appendChild(li);
        });

        return ul;
    }

    function renderTree() {
        content.textContent = '';
        if (headings.length === 0) {
            content.appendChild(createEl('div', 'color:#888;text-align:center;padding:30px;', '見出しが見つかりませんでした'));
            return;
        }
        var tree = buildTree(headings);
        if (config.searchQuery) {
            markSearchMatches(tree, config.searchQuery);
        }
        var dom = createTreeDom(tree, 0, false);
        if (dom) content.appendChild(dom);
    }

    // ドラッグ
    var isDrag = false, startX, startY, initLeft, initTop;
    header.onmousedown = function (e) {
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        isDrag = true;
        startX = e.clientX;
        startY = e.clientY;
        var rect = container.getBoundingClientRect();
        initLeft = rect.left;
        initTop = rect.top;
    };
    win.addEventListener('mousemove', function (e) {
        if (!isDrag) return;
        e.preventDefault();
        if (config.dock !== 'none') {
            config.dock = 'none';
            updateContainerStyle();
            initLeft = e.clientX - 100;
            initTop = e.clientY - 20;
        }
        container.style.left = (initLeft + (e.clientX - startX)) + 'px';
        container.style.top = (initTop + (e.clientY - startY)) + 'px';
        container.style.right = '';
    });
    win.addEventListener('mouseup', function () {
        if (isDrag) {
            isDrag = false;
            if (config.dock === 'none') {
                var rect = container.getBoundingClientRect();
                config.x = rect.left;
                config.y = rect.top;
            }
        }
    });

    document.body.appendChild(container);
    renderTree();
})();

