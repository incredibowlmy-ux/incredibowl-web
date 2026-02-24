const fs = require('fs');

const pbFile = 'C:\\Users\\User\\.gemini\\antigravity\\conversations\\3a1755dc-ad75-4abb-9679-cec71a2ebe1e.pb';
const buf = fs.readFileSync(pbFile);
const text = buf.toString('utf8');

// Try to find large readable text blocks
// Look for sequences of printable characters (including CJK)
const matches = [];
const regex = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffefa-zA-Z0-9\s.,;:!?@#$%^&*()\-+=\[\]{}'"/\\|<>~`RM]{20,}/g;
let match;
while ((match = regex.exec(text)) !== null) {
    const cleaned = match[0].trim();
    if (cleaned.length > 20) {
        // Check if it contains relevant keywords
        if (cleaned.includes('成本') || cleaned.includes('利润') || cleaned.includes('售价') ||
            cleaned.includes('RM') || cleaned.includes('食材') || cleaned.includes('定价') ||
            cleaned.includes('鸡') || cleaned.includes('当归') || cleaned.includes('山药') ||
            cleaned.includes('纳豆') || cleaned.includes('五花') || cleaned.includes('价格') ||
            cleaned.includes('costing') || cleaned.includes('price') || cleaned.includes('profit') ||
            cleaned.includes('margin') || cleaned.includes('cost')) {
            matches.push(cleaned);
        }
    }
}

const unique = [...new Set(matches)];
fs.writeFileSync('costing_data.txt', unique.join('\n\n========\n\n'), 'utf8');
console.log(`Found ${unique.length} relevant text blocks`);
