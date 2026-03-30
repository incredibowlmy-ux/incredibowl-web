import sharp from 'sharp';
import { readdir, stat, rename, unlink } from 'fs/promises';
import { join, extname, basename } from 'path';

const PUBLIC_DIR = './public';
const TARGET_SIZE_KB = 200;
const QUALITY_START = 80;

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];

async function getFileSizeKB(filePath) {
    const s = await stat(filePath);
    return s.size / 1024;
}

async function compressImage(filePath) {
    const ext = extname(filePath).toLowerCase();
    const nameWithoutExt = filePath.replace(ext, '');
    const outPath = nameWithoutExt + '.webp';
    const originalSizeKB = await getFileSizeKB(filePath);

    let quality = QUALITY_START;
    let success = false;

    while (quality >= 30) {
        await sharp(filePath)
            .webp({ quality, effort: 6 })
            .toFile(outPath + '.tmp');

        const newSizeKB = await getFileSizeKB(outPath + '.tmp');

        if (newSizeKB <= TARGET_SIZE_KB || quality === 30) {
            await rename(outPath + '.tmp', outPath);
            console.log(`✅ ${basename(filePath)}: ${originalSizeKB.toFixed(0)}KB → ${newSizeKB.toFixed(0)}KB (q${quality}) ${ext !== '.webp' ? '[converted to WebP]' : ''}`);
            // Delete original if it was PNG/JPG (keep original name reference handled by next.config)
            if (ext !== '.webp' && filePath !== outPath) {
                await unlink(filePath);
            }
            success = true;
            break;
        }
        quality -= 10;
    }

    if (!success) {
        try { await unlink(outPath + '.tmp'); } catch {}
        console.log(`⚠️  Skipped: ${basename(filePath)}`);
    }
}

async function main() {
    const files = await readdir(PUBLIC_DIR);
    const imageFiles = files.filter(f => IMAGE_EXTS.includes(extname(f).toLowerCase()));

    // Skip favicon and small logos (already small enough)
    const SKIP = ['favicon.png', 'fb-logo.png', 'xhs-logo.png', 'ig-logo.png', 'duitnow_qr.png'];

    console.log(`\n🗜️  Compressing ${imageFiles.length} images...\n`);

    for (const file of imageFiles) {
        if (SKIP.includes(file)) {
            console.log(`⏭️  Skipped (small file): ${file}`);
            continue;
        }
        await compressImage(join(PUBLIC_DIR, file));
    }

    console.log('\n✨ Done!');
}

main().catch(console.error);
