const fs = require('fs');

let code = fs.readFileSync('bookmarklet/bookmarklet.js', 'utf8');

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
