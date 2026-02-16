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
    detectGeminiChatItems: function (addedElements) {
      const items = [];
      const hostname = window.location.hostname;

      if (!hostname.includes('gemini.google.com')) return items;

      const processedTexts = new Set();  // テキストで重複チェック

      // Shadow DOM 内も含めて要素を検索する関数
      const querySelectorAllDeep = (selector, root = document) => {
        let results = [...root.querySelectorAll(selector)];
        // Shadow DOM を持つ要素を探す
        root.querySelectorAll('*').forEach(el => {
          if (el.shadowRoot) {
            results.push(...querySelectorAllDeep(selector, el.shadowRoot));
          }
        });
        return results;
      };

      // ユーザーのクエリを検出
      // 最近のGeminiは H5 または aria-level="5" を使用しているため、セレクタを拡張
      // また、class="query-text" や .user-query-bubble-with-background を優先的に探索
      // クラス名の揺れ（collapsed等）に対応するため、属性セレクタを使用
      const queryCandidates = querySelectorAllDeep('h2, h5, [class*="query-text"], .user-query-bubble-with-background, [role="heading"][aria-level="2"], [role="heading"][aria-level="5"], [data-message-author-role="user"]');

      queryCandidates.forEach((el) => {
        // Geminiチャット項目については、常にメインペイン内として扱う
        // const inMainPane = this.mainPane ? this.mainPane.contains(el) : true;
        // if (this.mainPane && !inMainPane) return;

        // クエリ（ユーザーメッセージ）かどうかの判定
        const isUserMsg = el.className.includes('query-text') ||
          el.closest('.user-query-bubble-with-background') ||
          el.getAttribute('data-message-author-role') === 'user' ||
          el.closest('[data-message-author-role="user"]');

        if (!isUserMsg) return;

        // すでに処理済みの要素の子要素ならスキップ（重複検出防止）
        let isDescendantOfAdded = false;
        addedElements.forEach(added => {
          if (added !== el && added.contains(el)) isDescendantOfAdded = true;
        });
        if (isDescendantOfAdded) return;

        // テキストの取得（cdk-visually-hidden要素を除外）
        let text = "";
        const clone = el.cloneNode(true);
        // cdk-visually-hidden または hidden 属性、または特定のクラスを除去
        clone.querySelectorAll('.cdk-visually-hidden, [class*="visually-hidden"], .cdk-visually-hidden-host').forEach(hidden => hidden.remove());
        text = clone.textContent.trim();

        // 不要な接頭辞の削除
        text = text.replace(/^\s*(You said|君が言った|あなたが言った|質問者|User says|You|あなた)\b\s*/i, '');

        if (!text || text.length < 2) return;

        // 要素を登録（同じ要素を複数回追加しない）
        if (addedElements.has(el)) return;
        addedElements.add(el);

        items.push({
          element: el,
          text: text.substring(0, 100),
          level: 2, // クエリは常にレベル2（Q）として扱う
          isQuery: true,
          isResponse: false,
          isNative: el.tagName.startsWith('H') || el.getAttribute('role') === 'heading',
          isInMainPane: true
        });
      });

      // AIの回答（model-response）の冒頭部分を検出
      // 回答も Shadow DOM 内にある可能性があるため querySelectorAllDeep を使用
      const modelResponses = querySelectorAllDeep('[data-message-author-role="model"], .model-response, [class*="model-response"]');
      const processedResponses = new Set();

      modelResponses.forEach((resp) => {
        // 既に処理済みの応答コンテナはスキップ（親子関係の重複防止）
        let isChildOfProcessed = false;
        processedResponses.forEach((pr) => {
          if (pr.contains(resp) || resp.contains(pr)) isChildOfProcessed = true;
        });
        if (isChildOfProcessed) return;
        processedResponses.add(resp);

        // 回答内の最初の段落またはテキストブロックを取得
        // より広いセレクタで試行
        let firstPara = resp.querySelector('p, .markdown-content > *:first-child, [class*="response-text"] *:first-child, .model-response-text *:first-child');
        if (!firstPara) {
          // Shadow DOM内も探す
          if (resp.shadowRoot) {
            firstPara = resp.shadowRoot.querySelector('p, .markdown-content > *:first-child');
          }
        }
        if (!firstPara) {
          // フォールバック: 直接のテキストノードを探す
          const walker = document.createTreeWalker(resp, NodeFilter.SHOW_TEXT, null, false);
          let firstText;
          while (firstText = walker.nextNode()) {
            if (firstText.textContent.trim().length > 10) {
              firstPara = firstText.parentElement;
              break;
            }
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
        // 回答内見出しも Shadow DOM 内にある可能性がある。
        const responseHeadings = resp.shadowRoot ?
          [...resp.querySelectorAll('h1, h2, h3, h4, h5, h6'), ...resp.shadowRoot.querySelectorAll('h1, h2, h3, h4, h5, h6')] :
          resp.querySelectorAll('h1, h2, h3, h4, h5, h6');

        responseHeadings.forEach((h) => {
          // 回答内の見出しでも、classにquery-textが含まれる場合はクエリ(Q)として扱う
          const isActuallyQuery = h.className.includes('query-text') || h.closest('[class*="query-text"]');
          if (isActuallyQuery) return; // queryCandidatesのループで処理されるのを待つか、ここでQとして追加

          const text = h.textContent.trim();
          if (!text || text.length < 2) return;
          if (processedTexts.has(text)) return;
          processedTexts.add(text);

          const originalLvl = parseInt(h.tagName.charAt(1));
          // H1→2.51, H2→2.52, H3→2.53... として回答(2.5)の子に配置
          const effectiveLevel = 2.5 + (originalLvl / 10);

          // "Gemini said", "You said" 等の見出し項目をクリーンアップ
          let cleanText = text.replace(/^\s*(Gemini said|You said|君が言った|あなたが言った|質問者|User says|You|あなた)\b\s*/i, '');
          if (!cleanText || cleanText.length < 2) return;

          items.push({
            element: h,
            text: cleanText.substring(0, 100),
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
        const chatItems = this.detectGeminiChatItems(addedElements);
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

        let text = h.textContent.trim();
        if (!text || text.length < 2) return;

        // "Gemini said" 等のレスポンスラベルは目次から除外
        if (/^(Gemini said|Geminiが言いました|Gemini の回答)$/i.test(text)) return;

        // ★ query-text クラスを含む要素は、H5等であっても常にクエリ（Q, level 2）として強制扱い
        const isQueryTextElement = h.className && h.className.includes('query-text');
        if (isQueryTextElement) {
          // cdk-visually-hidden 等を除去してクリーンなテキストを取得
          const clone = h.cloneNode(true);
          clone.querySelectorAll('.cdk-visually-hidden, [class*="visually-hidden"]').forEach(hidden => hidden.remove());
          text = clone.textContent.trim();
          text = text.replace(/^\s*(You said|Gemini said|君が言った|あなたが言った|質問者|User says|You|あなた)\b\s*/i, '');
          if (!text || text.length < 2) return;

          addedElements.add(h);
          allHeadings.push({
            element: h,
            text: text.substring(0, 100),
            level: 2,       // H1直下にぶら下がるようレベル2
            score: 100,
            isNative: true,
            isQuery: true,   // Q バッジ
            isResponse: false,
            isInMainPane: true
          });
          return; // この要素は Q として処理済み、通常の H5 としては追加しない
        }

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
