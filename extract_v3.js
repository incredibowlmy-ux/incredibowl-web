const fs = require('fs');

const pbFile = 'C:\\Users\\User\\.gemini\\antigravity\\conversations\\3a1755dc-ad75-4abb-9679-cec71a2ebe1e.pb';
const buf = fs.readFileSync(pbFile);

// Protobuf stores strings with a length prefix
// Let's try to extract all embedded strings
const results = [];

for (let i = 0; i < buf.length - 2; i++) {
    // Check for protobuf string wire type (field tag with wire type 2)
    const byte = buf[i];
    const wireType = byte & 0x07;

    if (wireType === 2) { // length-delimited
        // Try to read varint length at i+1
        let len = 0;
        let shift = 0;
        let j = i + 1;
        let valid = true;

        while (j < buf.length && j < i + 6) {
            const b = buf[j];
            len |= (b & 0x7f) << shift;
            shift += 7;
            j++;
            if ((b & 0x80) === 0) break;
        }

        if (len > 10 && len < 50000 && j + len <= buf.length) {
            const strBuf = buf.slice(j, j + len);
            try {
                const str = strBuf.toString('utf8');
                // Check if it's actually readable text
                const printable = str.replace(/[^\x20-\x7EÀ-ÖØ-öø-ÿ\u4e00-\u9fff\u3000-\u303f\uff00-\uffef\n\r\t]/g, '');
                if (printable.length > str.length * 0.7 && printable.length > 20) {
                    if (str.includes('成本') || str.includes('利润') || str.includes('售价') ||
                        str.includes('RM') || str.includes('食材') || str.includes('价格') ||
                        str.includes('鸡') || str.includes('当归') || str.includes('山药') ||
                        str.includes('纳豆') || str.includes('五花') || str.includes('costing') ||
                        str.includes('price') || str.includes('profit') || str.includes('margin') ||
                        str.includes('cost') || str.includes('定价') || str.includes('菜品')) {
                        results.push({ offset: i, len, text: str.substring(0, 2000) });
                    }
                }
            } catch (e) { }
        }
    }
}

console.log(`Found ${results.length} text blocks`);
results.forEach((r, idx) => {
    console.log(`\n\n===== Block ${idx} (offset: ${r.offset}, len: ${r.len}) =====`);
    console.log(r.text);
});
