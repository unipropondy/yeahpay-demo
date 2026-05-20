const crypto = require('crypto');

class SignatureUtil {
    constructor() {
        this.salt = process.env.API_KEY; // Salt from YeahPay
    }

    /**
     * Sort JSON keys alphabetically (ASCII order)
     * PDF Page 10-11: "Sort the keys in the JSON request body from small to large 
     * (lexicographic order) according to the ASCII code"
     */
    sortJsonKeys(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.sortJsonKeys(item));
        }
        
        const sorted = {};
        Object.keys(obj).sort().forEach(key => {
            if (obj[key] !== null && obj[key] !== undefined) {
                sorted[key] = this.sortJsonKeys(obj[key]);
            }
        });
        return sorted;
    }

    /**
     * Generate SHA-256 signature
     * PDF Page 11: "Add salt to the sorted JSON string for SHA-256 digest calculation"
     */
    generateSign(sortedJsonString) {
        const signString = sortedJsonString + this.salt;
        return crypto.createHash('sha256').update(signString, 'utf8').digest('hex');
    }

    /**
     * Create full signature for request
     */
    createSignature(plaintextBody) {
        // Step 1: Parse and sort keys alphabetically
        const bodyObj = JSON.parse(plaintextBody);
        const sortedBody = this.sortJsonKeys(bodyObj);
        
        // Step 2: Convert to JSON string without spaces
        const sortedJsonString = JSON.stringify(sortedBody);
        
        // Step 3: Generate SHA-256 with salt
        const signature = this.generateSign(sortedJsonString);
        
        console.log('📝 Sorted JSON for signature:', sortedJsonString);
        console.log('🔐 Generated signature:', signature);
        
        return signature;
    }
}

module.exports = new SignatureUtil();