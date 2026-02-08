---
description: ビルドと基本テストの実行
---

# ビルドワークフロー

このワークフローは、拡張機能とブックマークレットのビルドを実行します。

## 手順

// turbo
1. ビルドスクリプトを実行
```bash
cd /Users/user/agy_project/geminavi_bmt_ext && node scripts/build.js
```

2. ビルド時刻を確認
```bash
grep "ビルド時刻" dist/bookmarklet/index.html
```

3. 生成されたファイルを確認
   - `dist/chrome/` - Chrome 拡張機能
   - `dist/firefox/` - Firefox 拡張機能
   - `dist/bookmarklet/index.html` - ブックマークレットページ
   - `dist/bookmarklet.txt` - ブックマークレット URL

## ビルド後の確認事項

- [ ] ビルド時刻が更新されているか
- [ ] エラーなく完了したか
- [ ] `dist/` 内のファイルが更新されているか

## 拡張機能の再読み込み

Chrome の場合:
1. `chrome://extensions` を開く
2. 「Heading Detector」の更新ボタンをクリック

## トラブルシューティング

### Node.js が見つからない場合
```bash
export PATH="/opt/homebrew/bin:$PATH"
node scripts/build.js
```

### ビルドエラーの場合
```bash
# 依存関係を確認
ls -la src/core/
ls -la bookmarklet/
ls -la extension/
```
