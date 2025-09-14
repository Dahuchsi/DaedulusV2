// backend/scripts/backfillSizes.js
const { Download } = require('../models'); // adjust path if needed
const sequelize = require('../models').sequelize;

// Reuse the improved parser
const parseSizeInBytes = (sizeString) => {
    if (!sizeString || typeof sizeString !== 'string') return 0;

    let size = sizeString.replace(/\u00A0/g, ' ') // &nbsp;
                         .replace(/,/g, '.')      // European decimal
                         .trim()
                         .toUpperCase();

    size = size.replace(/MIB/g, 'MB')
               .replace(/GIB/g, 'GB')
               .replace(/TIB/g, 'TB')
               .replace(/KIB/g, 'KB');

    const match = size.match(/([\d.]+)\s*([KMGT]?B)/i);
    if (!match) return 0;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const units = {
        'B': 1,
        'KB': 1024,
        'MB': 1024 * 1024,
        'GB': 1024 * 1024 * 1024,
        'TB': 1024 * 1024 * 1024 * 1024
    };

    return Math.round(value * (units[unit] || 1));
};

(async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB ✅');

        const downloads = await Download.findAll();
        console.log(`Found ${downloads.length} downloads to check...`);

        for (const dl of downloads) {
            const label = dl.size_label || null;
            const parsed = parseSizeInBytes(label);

            // Only update if missing or invalid
            if (!dl.file_size || dl.file_size === 0 || dl.size_label === 'Unknown') {
                await dl.update({
                    file_size: parsed,
                    size_label: label || (parsed ? `${(parsed/1024/1024).toFixed(1)} MB` : 'Unknown')
                });
                console.log(`✔ Updated ${dl.id} → ${dl.size_label}, ${dl.file_size} bytes`);
            }
        }

        console.log('Backfill complete! 🎉');
        process.exit(0);

    } catch (err) {
        console.error('❌ Error during backfill:', err);
        process.exit(1);
    }
})();