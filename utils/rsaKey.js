const crypto = require('crypto');

class RSAKeyUtil {
    constructor() {
        this.publicKeyPem = this.getPublicKeyPem();
    }

    getPublicKeyPem() {
        // RSA public key components from PDF
        // Modulus (n) in hex
        const nHex = "c9402878d233f452f450a85db190a6c6072accac8c754fccca4fcbb7e872b2e309207b4b54567a8e26cefeeae909a84fdade4e8a8653826da18368d25c251753dd13ce034fce55911c3c664b1d3299ab91f09978a1e822218987202abac68c6f4258efbaa0e12ed244092df28d4c8c7c2cd9a8ae54a5429097736d1cf85955713b883de24d97c8c93952169f2b35556a5dfd8bf48d76c0b7d6efbb200864099c390de189e298173b3b1594b9e988fc9af428ad0141644fed1944450250d99172086f0c08108d1c1265b8abd5c379adf02136f3b339ffc981c13cd3720074369bcf85d10e0709d41cec67e44951345fc84312e5160932092cb1838b2e905603";
        
        // Exponent (e) = 65537
        const eHex = "010001";
        
        const n = Buffer.from(nHex, 'hex');
        const e = Buffer.from(eHex, 'hex');
        
        // Build DER encoded public key
        // PKCS#1 RSAPublicKey structure: SEQUENCE { modulus INTEGER, publicExponent INTEGER }
        
        const der = this.encodeSequence([
            this.encodeInteger(n),
            this.encodeInteger(e)
        ]);
        
        // Convert to PEM
        const base64 = der.toString('base64');
        const pem = `-----BEGIN RSA PUBLIC KEY-----\n${base64.match(/.{1,64}/g).join('\n')}\n-----END RSA PUBLIC KEY-----`;
        
        console.log('✅ RSA Public Key generated');
        return pem;
    }

    encodeLength(len) {
        if (len < 128) {
            return Buffer.from([len]);
        }
        const bytes = [];
        while (len > 0) {
            bytes.unshift(len & 0xFF);
            len >>= 8;
        }
        return Buffer.from([0x80 | bytes.length, ...bytes]);
    }

    encodeInteger(buffer) {
        // INTEGER tag is 0x02
        let data = buffer;
        if (buffer[0] & 0x80) {
            data = Buffer.concat([Buffer.from([0x00]), buffer]);
        }
        return Buffer.concat([
            Buffer.from([0x02]),
            this.encodeLength(data.length),
            data
        ]);
    }

    encodeSequence(parts) {
        const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
        return Buffer.concat([
            Buffer.from([0x30]),
            this.encodeLength(totalLength),
            ...parts
        ]);
    }

    getPublicKey() {
        return this.publicKeyPem;
    }
}

module.exports = new RSAKeyUtil();