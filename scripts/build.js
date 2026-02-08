/**
 * Build Script for Cross-Browser Extension
 * Generates Chrome and Firefox specific extensions from shared source
 * 
 * Usage: node scripts/build.js [chrome|firefox|all]
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'extension');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Files to copy (relative to extension/)
const SHARED_FILES = [
    'background.js',
    'content.js',
    'panel.js',
    'popup.html',
    'popup.js',
    'popup.css',
    'sidepanel.html',
    'sidepanel.js',
    'icons'
];

// Base manifest (shared properties)
const BASE_MANIFEST = {
    manifest_version: 3,
    name: "Heading Detector",
    version: "2.0.0",
    description: "スタイル解析による見出し検出 - 見出しタグがないページでも見出しを特定",
    action: {
        default_popup: "popup.html",
        default_icon: {
            "16": "icons/icon16.png",
            "48": "icons/icon48.png",
            "128": "icons/icon128.png"
        }
    },
    icons: {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png"
    }
};

// Chrome-specific manifest additions
const CHROME_MANIFEST = {
    ...BASE_MANIFEST,
    permissions: ["activeTab", "scripting", "sidePanel", "storage"],
    background: {
        service_worker: "background.js"
    },
    content_scripts: [{
        matches: ["<all_urls>"],
        js: ["heading-detector-core.js", "settings-core.js", "content.js", "panel.js"],
        run_at: "document_end"
    }],
    side_panel: {
        default_path: "sidepanel.html"
    }
};

// Firefox-specific manifest additions
const FIREFOX_MANIFEST = {
    ...BASE_MANIFEST,
    permissions: ["storage", "tabs"],
    background: {
        scripts: ["background.js"]
    },
    content_scripts: [{
        matches: ["<all_urls>"],
        js: ["heading-detector-core.js", "settings-core.js", "content.js", "panel.js"],
        run_at: "document_end"
    }],
    browser_specific_settings: {
        gecko: {
            id: "heading-detector@navilet.antig"
        }
    },
    sidebar_action: {
        default_panel: "sidepanel.html",
        default_icon: "icons/icon48.png",
        default_title: "Heading Detector"
    }
};

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyFileOrDir(src, dest) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
        ensureDir(dest);
        const files = fs.readdirSync(src);
        files.forEach(file => {
            copyFileOrDir(path.join(src, file), path.join(dest, file));
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

function cleanDir(dir) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true });
    }
    ensureDir(dir);
}

function build(browser) {
    const destDir = path.join(DIST_DIR, browser);
    console.log(`Building ${browser} extension...`);

    // Clean and create destination directory
    cleanDir(destDir);

    // Copy core heading detector file
    const coreSrc = path.join(ROOT_DIR, 'src', 'core', 'heading-detector.js');
    const coreDest = path.join(destDir, 'heading-detector-core.js');
    fs.copyFileSync(coreSrc, coreDest);
    console.log(`  Copied: src/core/heading-detector.js to heading-detector-core.js`);

    // Copy settings module
    const settingsSrc = path.join(ROOT_DIR, 'src', 'core', 'settings.js');
    const settingsDest = path.join(destDir, 'settings-core.js');
    fs.copyFileSync(settingsSrc, settingsDest);
    console.log(`  Copied: src/core/settings.js to settings-core.js`);

    // Copy shared files
    SHARED_FILES.forEach(file => {
        const src = path.join(SRC_DIR, file);
        const dest = path.join(destDir, file);
        if (fs.existsSync(src)) {
            copyFileOrDir(src, dest);
            console.log(`  Copied: ${file}`);
        } else {
            console.warn(`  Warning: ${file} not found`);
        }
    });

    // Write browser-specific manifest
    const manifest = browser === 'chrome' ? CHROME_MANIFEST : FIREFOX_MANIFEST;
    fs.writeFileSync(
        path.join(destDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
    );
    console.log(`  Generated: manifest.json`);

    console.log(`✓ ${browser} build complete: ${destDir}\n`);
}

function buildBookmarklet() {
    console.log('Building bookmarklet...');

    const bookmarkletDir = path.join(ROOT_DIR, 'dist', 'bookmarklet');
    ensureDir(bookmarkletDir);

    // Read source files
    const headingDetectorSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'core', 'heading-detector.js'), 'utf-8');
    const settingsSrc = fs.readFileSync(path.join(ROOT_DIR, 'src', 'core', 'settings.js'), 'utf-8');
    const bookmarkletSrc = fs.readFileSync(path.join(ROOT_DIR, 'bookmarklet', 'bookmarklet.js'), 'utf-8');

    // Combine: heading-detector + settings + bookmarklet main
    const combined = `// Heading Detector Bookmarklet (Combined)
// Generated: ${new Date().toISOString()}

${headingDetectorSrc}

${settingsSrc}

${bookmarkletSrc}
`;

    // Write combined file (for development/debugging)
    fs.writeFileSync(path.join(bookmarkletDir, 'bookmarklet-combined.js'), combined);
    console.log('  Generated: bookmarklet-combined.js');

    // Create minified bookmarklet URL (basic: just remove extra whitespace and newlines)
    const minified = combined
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
        .replace(/\/\/.*$/gm, '')          // Remove single-line comments
        .replace(/\s+/g, ' ')              // Collapse whitespace
        .trim();

    const bookmarkletUrl = 'javascript:' + encodeURIComponent('(function(){' + minified + '})()');

    // Write bookmarklet URL directly to dist/bookmarklet.txt (legacy format)
    fs.writeFileSync(path.join(DIST_DIR, 'bookmarklet.txt'), bookmarkletUrl);
    console.log('  Generated: dist/bookmarklet.txt');

    // Write HTML page with bookmarklet link
    const buildTime = new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
    const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <title>Heading Detector Bookmarklet</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
        h1 { color: #333; }
        .bookmarklet-link { display: inline-block; padding: 12px 24px; background: #0b57d0; color: white; 
                           text-decoration: none; border-radius: 8px; font-size: 16px; margin: 20px 0; }
        .bookmarklet-link:hover { background: #0842a0; }
        .instructions { background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0; }
        code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
        .build-info { font-size: 12px; color: #888; margin-top: 40px; }
    </style>
</head>
<body>
    <h1>🔍 Heading Detector Bookmarklet</h1>
    <p>ブックマークバーにドラッグ＆ドロップしてください:</p>
    <a class="bookmarklet-link" href="${bookmarkletUrl}">Heading Detector</a>
    <div class="instructions">
        <h3>使い方</h3>
        <ol>
            <li>上のリンクをブックマークバーにドラッグ＆ドロップ</li>
            <li>任意のWebページでブックマークをクリック</li>
            <li>見出し一覧パネルが表示されます</li>
        </ol>
    </div>
    <p class="build-info">ビルド時刻: ${buildTime}</p>
</body>
</html>`;

    fs.writeFileSync(path.join(bookmarkletDir, 'index.html'), htmlContent);
    console.log('  Generated: index.html');

    console.log(`✓ Bookmarklet build complete: ${bookmarkletDir}\n`);
}

// Main
const args = process.argv.slice(2);
const target = args[0] || 'all';

console.log('=== Extension Build Script ===\n');

if (target === 'chrome' || target === 'all') {
    build('chrome');
}
if (target === 'firefox' || target === 'all') {
    build('firefox');
}
if (target === 'bookmarklet' || target === 'all') {
    buildBookmarklet();
}

console.log('Done!');
