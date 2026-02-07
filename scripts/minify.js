const fs = require('fs');

let coreCode = fs.readFileSync('src/core/heading-detector.js', 'utf8');
let bookmarkletCode = fs.readFileSync('bookmarklet/bookmarklet.js', 'utf8');

// Combine core code and bookmarklet code
let code = coreCode + bookmarkletCode;

// Remove the initial 'javascript: ' prefix if present
code = code.replace(/^\s*javascript:\s*/i, '');

// Remove multi-line comments
code = code.replace(/\/\*[\s\S]*?\*\//g, '');

// Remove single-line comments
code = code.replace(/\/\/[^\r\n]*/g, '');

// Remove line breaks and collapse spaces
code = code.replace(/[\r\n]+/g, ' ');
code = code.replace(/\s+/g, ' ');
code = code.trim();

// Write with proper javascript: prefix (URI encoded)
const bookmarklet = 'javascript:' + encodeURIComponent(code);
fs.writeFileSync('dist/bookmarklet.txt', bookmarklet);

console.log('Bookmarklet regenerated');
console.log('Length:', bookmarklet.length);
