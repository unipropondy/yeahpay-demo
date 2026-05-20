const crypto = require('crypto');
const rsaKeyUtil = require('./rsaKey');

class EncryptionUtil {
    constructor() {
        this.publicKey = rsaKeyUtil.getPublicKey();
        console.log('✅ Encryption util ready');
    }

    generateAesKey() {
        return crypto.randomBytes(16);
    }

    generateIv() {
        return crypto.randomBytes(16);
    }

    aesEncrypt(plaintext, aesKey, iv) {
        const cipher = crypto.createCipheriv('aes-128-cbc', aesKey, iv);
        let encrypted = cipher.update(plaintext, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return encrypted;
    }

    rsaEncrypt(data) {
        try {
            const encrypted = crypto.publicEncrypt({
                key: this.publicKey,
                padding: crypto.constants.RSA_PKCS1_PADDING
            }, data);
            return encrypted.toString('hex');
        } catch (error) {
            console.error('RSA Encrypt Error:', error.message);
            throw error;
        }
    }

    encryptRequest(plaintextBody) {
        const aesKey = this.generateAesKey();
        const iv = this.generateIv();
        const encryptedData = this.aesEncrypt(plaintextBody, aesKey, iv);
        const encryptedKey = this.rsaEncrypt(aesKey);
        
        console.log('✅ Encryption successful');
        console.log('  - AES Key:', aesKey.toString('hex').substring(0, 16) + '...');
        console.log('  - IV:', iv.toString('hex'));
        console.log('  - Encrypted Key length:', encryptedKey.length);
        console.log('  - Encrypted Data length:', encryptedData.length);
        
        return {
            key: encryptedKey,
            data: encryptedData,
            nonce: iv.toString('hex')
        };
    }
}

module.exports = new EncryptionUtil();