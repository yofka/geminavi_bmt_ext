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
        js: ["content.js", "panel.js"],
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
        js: ["content.js", "panel.js"],
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

console.log('Done!');
