const sharp = require('sharp');
const fs = require('fs');
async function optimizeImages() {
    try {
        await sharp('public/chinese_yam_black_fungus_v3.jpg')
            .resize({ width: 800 })
            .jpeg({ quality: 80 })
            .toFile('public/chinese_yam_black_fungus_v3_opt.jpg');
        fs.renameSync('public/chinese_yam_black_fungus_v3_opt.jpg', 'public/chinese_yam_black_fungus_v3.jpg');
        console.log('Yam image optimized');

        await sharp('public/logo.png')
            .resize({ width: 800 })
            .png({ quality: 80 })
            .toFile('public/logo_opt.png');
        fs.renameSync('public/logo_opt.png', 'public/logo.png');
        console.log('Logo optimized');
    } catch (err) {
        console.error('Error optimizing images:', err);
    }
}
optimizeImages();
