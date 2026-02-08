# Hバッジトグル機能 実装完了

## 実装した機能

### 1. 複数バッジ対応
- **Hバッジ オフ（デフォルト）**: `[💬Q]` / `[💭A]` のみ表示
- **Hバッジ オン**: `[H2][💬Q]` / `[✨H2][💭A]` のように両方表示

### 2. ARIA ヘッディング対応
Gemini が `<h2>` ではなく `<div role="heading" aria-level="2">` を使用していたため、セレクタを更新：
```javascript
h2, [role="heading"][aria-level="2"]
```

### 3. UI 変更
- ボタン「6」と「Wrap」の間に **Hバッジ** チェックボックス追加
- ⚙️設定ダイアログに「Hバッジ表示（デフォルト）」オプション追加

## 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| [heading-detector.js](file:///Users/user/agy_project/geminavi_bmt_ext/src/core/heading-detector.js) | ARIA ヘッディング検出、Shadow DOM 検索 |
| [sidepanel.js](file:///Users/user/agy_project/geminavi_bmt_ext/extension/sidepanel.js) | `getBadges()` 関数、Hバッジトグル |
| [popup.js](file:///Users/user/agy_project/geminavi_bmt_ext/extension/popup.js) | 同上 |
| [sidepanel.html](file:///Users/user/agy_project/geminavi_bmt_ext/extension/sidepanel.html) | Hバッジチェックボックス追加 |
| [popup.html](file:///Users/user/agy_project/geminavi_bmt_ext/extension/popup.html) | 同上 |
| [popup.css](file:///Users/user/agy_project/geminavi_bmt_ext/extension/popup.css) | badge-container スタイル |
| [background.js](file:///Users/user/agy_project/geminavi_bmt_ext/extension/background.js) | `saveHBadgeEnabled` アクション |
| [settings.js](file:///Users/user/agy_project/geminavi_bmt_ext/src/core/settings.js) | hBadgeDefault 設定 |

## 検証結果 ✅

- [x] Hバッジ オフで Q/A バッジのみ表示
- [x] Hバッジ オンで両方のバッジ表示
- [x] 設定保存・読み込み正常動作
- [x] ポップアップ・サイドパネル両方で動作確認
