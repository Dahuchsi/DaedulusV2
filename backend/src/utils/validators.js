const validators = {
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    isValidUsername(username) {
        // 3-20 characters, alphanumeric and underscores only
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        return usernameRegex.test(username);
    },
    
    isValidPassword(password) {
        // At least 8 characters
        return password && password.length >= 8;
    },
    
    isValidMagnetLink(link) {
        return link && link.startsWith('magnet:?xt=urn:');
    },
    
    isValidTorrentUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    },
    
    sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        return input.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
};

module.exports = validators;