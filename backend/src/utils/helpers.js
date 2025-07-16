const crypto = require('crypto');

const helpers = {
    generateId() {
        return crypto.randomUUID();
    },
    
    formatFileSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },
    
    parseFileSize(sizeString) {
        const units = {
            'B': 1,
            'KB': 1024,
            'MB': 1024 * 1024,
            'GB': 1024 * 1024 * 1024,
            'TB': 1024 * 1024 * 1024 * 1024
        };
        
        const match = sizeString.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
        if (!match) return 0;
        
        const value = parseFloat(match[1]);
        const unit = match[2].toUpperCase();
        
        return value * (units[unit] || 1);
    },
    
    extractQualityInfo(filename) {
        const qualities = {
            '4K': ['4K', '2160p', 'UHD'],
            '1080p': ['1080p', 'FHD', 'FullHD'],
            '720p': ['720p', 'HD'],
            '480p': ['480p', 'SD'],
            'HDR': ['HDR', 'HDR10', 'HDR10+'],
            'DolbyVision': ['Dolby Vision', 'DV'],
            'DolbyAtmos': ['Atmos', 'Dolby Atmos'],
            'DTS': ['DTS', 'DTS-HD', 'DTS-X']
        };
        
        const detected = [];
        
        for (const [quality, patterns] of Object.entries(qualities)) {
            for (const pattern of patterns) {
                if (filename.toUpperCase().includes(pattern.toUpperCase())) {
                    detected.push(quality);
                    break;
                }
            }
        }
        
        return detected;
    },
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    retry(fn, retries = 3, delay = 1000) {
        return async (...args) => {
            for (let i = 0; i < retries; i++) {
                try {
                    return await fn(...args);
                } catch (error) {
                    if (i === retries - 1) throw error;
                    await this.sleep(delay * Math.pow(2, i)); // Exponential backoff
                }
            }
        };
    }
};

module.exports = helpers;