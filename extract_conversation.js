const fs = require('fs');

const pbFile = 'C:\\Users\\User\\.gemini\\antigravity\\conversations\\3a1755dc-ad75-4abb-9679-cec71a2ebe1e.pb';
const buf = fs.readFileSync(pbFile);

// Extract all UTF-8 strings from the binary (looking for Chinese and English text)
const text = buf.toString('utf8');

// Find sections that contain costing-related keywords
const lines = text.split(/[\x00-\x08\x0e-\x1f]/);
const relevant = lines.filter(line => {
    const l = line.trim();
    if (l.length < 5) return false;
    // Look for costing, pricing, profit, RM, 成本, 利润, 售价, 菜品 related content
    return l.includes('成本') || l.includes('利润') || l.includes('售价') ||
        l.includes('selling') || l.includes('profit') || l.includes('margin') ||
        l.includes('RM') || l.includes('食材') || l.includes('定价') ||
        l.includes('鸡扒') || l.includes('当归') || l.includes('山药') ||
        l.includes('纳豆') || l.includes('五花') || l.includes('鸡腿汤') ||
        l.includes('costing') || l.includes('price');
});

// Deduplicate and output
const unique = [...new Set(relevant)];
fs.writeFileSync('costing_conversation.txt', unique.join('\n---\n'), 'utf8');
console.log(`Found ${unique.length} relevant sections`);
