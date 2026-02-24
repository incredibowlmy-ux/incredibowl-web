const fs = require('fs');

const pbFile = 'C:\\Users\\User\\.gemini\\antigravity\\conversations\\3a1755dc-ad75-4abb-9679-cec71a2ebe1e.pb';
const buf = fs.readFileSync(pbFile);

// Just dump all byte sequences that decode as valid, long UTF-8 strings
const results = [];
let start = 0;
let currentStr = '';

for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    // Check if byte is part of printable ASCII or valid UTF-8 multi-byte start
    const isPrintableAscii = (b >= 0x20 && b <= 0x7E) || b === 0x0A || b === 0x0D || b === 0x09;
    const isUtf8Start = (b >= 0xC0 && b <= 0xF7);
    const isUtf8Cont = (b >= 0x80 && b <= 0xBF);

    if (isPrintableAscii || isUtf8Start || isUtf8Cont) {
        // continue accumulating
    } else {
        if (currentStr.length > 0) {
            try {
                const decoded = buf.slice(start, i).toString('utf8');
                if (decoded.length > 30) {
                    results.push(decoded);
                }
            } catch (e) { }
        }
        currentStr = '';
        start = i + 1;
    }
    currentStr += String.fromCharCode(b);
}

// Filter for relevant content
const keywords = ['成本', '利润', '售价', 'RM ', '食材', '价格', '鸡', '当归', '山药', '纳豆', '五花', '定价', '菜品', '卖价', '毛利', 'cost', 'price', 'profit', 'margin', 'selling'];

const relevant = results.filter(r => keywords.some(k => r.includes(k)));
const unique = [...new Set(relevant)];

fs.writeFileSync('costing_final.txt', unique.join('\n\n========\n\n'), 'utf8');
console.log(`Found ${unique.length} relevant text blocks out of ${results.length} total`);
console.log('\nFirst 5 blocks preview:');
unique.slice(0, 5).forEach((b, i) => console.log(`\n--- Block ${i} ---\n${b.substring(0, 300)}`));
