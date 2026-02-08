# Heading Detector - 開発ガイドライン

## 概要

このドキュメントは、拡張機能とブックマークレットの目次表示機能を壊さないための重要なルールをまとめています。

---

## 🔖 ブックマークレット (`bookmarklet/bookmarklet.js`)

### 重要なルール

1. **自己完結型であること**
   - ブックマークレットは外部モジュール（`HeadingDetector`など）に依存してはいけない
   - すべての検出ロジックを内部に持つ必要がある
   - 理由: ブックマークレットはURLエンコードされて1つのJavaScript文字列として実行されるため、外部依存があると動作しない

2. **必須の内部関数**
   ```
   - detectMainPane()        // メインペイン検出
   - detectGeminiChatItems() // Gemini会話検出  
   - detectAllHeadings()     // 全見出し検出
   - getScrollContainer()    // スクロールコンテナ取得
   - smartScrollTo()         // スマートスクロール
   ```

3. **Gemini検出のセレクタ**
   - ユーザークエリ: `h2` タグ（モデル応答内は除外）
   - モデル応答: `[data-message-author-role="model"]`, `.model-response`, `[class*="model-response"]`
   - 重複防止: テキストベースの `Set` で同じテキストの重複を防ぐ

4. **ビルドプロセス**
   - `scripts/build.js` の `buildBookmarklet()` がソースを結合
   - 結合順序: `heading-detector.js` → `settings.js` → `bookmarklet.js`
   - ⚠️ 重要: bookmarklet.js 自体は HeadingDetector を使わない自己完結型

### 変更時のチェックリスト

- [ ] 外部モジュールへの依存を追加していないか？
- [ ] `detectMainPane()`, `detectGeminiChatItems()`, `detectAllHeadings()` が内部に存在するか？
- [ ] ビルド後に `dist/bookmarklet/index.html` でテスト

---

## 🧩 拡張機能サイドパネル (`extension/sidepanel.js`)

### 重要なルール

1. **スクリプト注入タイミング**
   - サイドパネルは最初に開いた時、コンテンツスクリプトがまだ準備できていない可能性がある
   - `scripting.executeScript()` 後に十分な待機時間が必要
   - 現在の設定: Chrome 300ms, Firefox 500ms

2. **Ping リトライ**
   - コンテンツスクリプトの準備確認に `ping` アクションを使用
   - 15回リトライ、指数バックオフ（150ms + 50ms * attempt）
   - すべて失敗した場合のみエラー表示

3. **autoDetect() の流れ**
   ```
   1. アクティブタブ取得
   2. 特殊ページチェック（chrome://, about:// など）
   3. スクリプト注入（未注入の場合）
   4. Ping でコンテンツスクリプト準備確認
   5. detect アクションで見出し検出
   6. renderHeadings() で表示
   ```

4. **コンテンツスクリプト (`content.js`)**
   - `HeadingDetector.detect()` を呼び出す
   - 結果から `element` を除外してシリアライズ可能な形で返す
   - `checkForChanges` アクションで差分検出（自動更新用）

### 変更時のチェックリスト

- [ ] 待機時間を短くしていないか？
- [ ] ping リトライ回数を減らしていないか？
- [ ] `tab.id` の null チェックが存在するか？
- [ ] `scripting.executeScript` のエラーハンドリングがあるか？

---

## 🔍 見出し検出コア (`src/core/heading-detector.js`)

### Gemini 専用の検出ルール

1. **ユーザークエリ検出**
   - `h2` タグのみを対象
   - モデル応答コンテナ内の h2 は除外
   - セレクタ: `h2` で取得後、`.closest('[data-message-author-role="model"]')` で除外判定

2. **モデル応答検出**
   - セレクタ: `[data-message-author-role="model"]`, `.model-response`, `[class*="model-response"]`
   - 親子関係の重複防止が必要
   - 応答内の最初の段落を抽出（レベル 2.5 として扱う）
   - 応答内の h1-h6 は `2.5 + (レベル/10)` で子要素化

3. **重複防止**
   - テキストベースの重複チェック（`processedTexts` Set）
   - 要素ベースの重複チェック（`addedElements` Set）
   - 親子関係の重複チェック（ネストしたコンテナ）

### 変更時のチェックリスト

- [ ] セレクタを変更する場合、Geminiの実際のDOMを確認したか？
- [ ] 重複チェックのロジックを維持しているか？
- [ ] `isQuery`, `isResponse`, `isInsideResponse` フラグを正しく設定しているか？

---

## 🚫 やってはいけないこと

1. **ブックマークレットで外部依存を追加する**
   - ❌ `HeadingDetector.detect()` を呼び出す
   - ❌ `window.HDSettings` に依存する UI 機能
   - ✅ すべてのロジックを bookmarklet.js 内に持つ

2. **サイドパネルの待機時間を短縮する**
   - ❌ スクリプト注入後の待機を削除/短縮
   - ❌ ping リトライを減らす
   - ✅ 初回起動を考慮した十分な待機時間

3. **複数セレクタで同じ要素を複数回検出する**
   - ❌ `[data-message-author-role="user"]`, `.user-query-content`, `h2` を順番に試して重複
   - ✅ シンプルに `h2` のみ、またはテキストベースの重複防止

---

## 📝 テスト手順

### ブックマークレット

1. `node scripts/build.js` でビルド
2. `dist/bookmarklet/index.html` をブラウザで開く
3. 「ビルド時刻」が更新されていることを確認
4. Gemini で会話があるページでブックマークレットを実行
5. 目次ウィジェットに Q/A が表示されることを確認

### 拡張機能サイドパネル

1. `chrome://extensions` で拡張機能を再読み込み
2. **新しいタブで** Gemini を開く（既存タブではなく）
3. サイドパネルを開く（最初の操作として）
4. 目次が表示されることを確認
5. ポップアップも開いて両方に表示されることを確認

---

*最終更新: 2026-02-08*
