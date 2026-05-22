const axios = require('axios');
const crypto = require('crypto');

class YeahPayService {
    constructor() {
        this.mockMode = process.env.MOCK_MODE === 'true';
        this.baseURL = process.env.API_URL;
        this.merchantId = process.env.MERCHANT_ID;
        this.appId = process.env.APP_ID;
        this.apiKey = process.env.API_KEY;
        
        console.log(`🚀 Running in ${this.mockMode ? 'MOCK' : 'REAL ONLINE API'} mode`);
        if (!this.mockMode) {
            console.log(`📍 API URL: ${this.baseURL}`);
            console.log(`🆔 App ID: ${this.appId}`);
            console.log(`🆔 Merchant ID: ${this.merchantId}`);
        }
    }

    generateNonce(length = 16) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    generateSignature(urlPath, appId, timestamp, version, nonce, body, apiKey) {
        const signString = `${urlPath}\n${appId}\n${timestamp}\n${version}\n${nonce}\n${body}\n${apiKey}`;
        console.log('📝 Sign String (first 200 chars):', signString.substring(0, 200) + '...');
        const signature = crypto.createHash('sha512').update(signString, 'utf8').digest('base64');
        console.log('🔐 Signature:', signature);
        return signature;
    }

   async createMasterScanQR(orderId, amount, payWay, notifyUrl = null) {
    if (this.mockMode) {
        return this.mockResponse(orderId, amount);
    }

    const urlPath = '/acceptance-open-api/order/unifiedOrder';
    const apiEndpoint = '/order/unifiedOrder';
    const fullUrl = this.baseURL.replace(/\/$/, '') + apiEndpoint;
    const amountInCents = Math.round(parseFloat(amount) * 100);
    const requestBody = {
        payWay: payWay,
        merchantId: this.merchantId,
        thirdOrderId: orderId,
       amount: amountInCents.toString(),
        currency: 'SGD',
        jspayFlag: 'NATIVE'
    };
    
    // Generate fresh values for EACH request
    const timestamp = Date.now().toString();
    const version = '1.0';
    const nonce = this.generateNonce(16);
    
    // Generate signature with these values
    const signature = this.generateSignature(
        urlPath,
        this.appId,
        timestamp,
        version,
        nonce,
        JSON.stringify(requestBody),
        this.apiKey
    );

    // Use SAME values in headers
    const headers = {
        'Content-Type': 'application/json',
        'version': version,
        'timestamp': timestamp,
        'algorithm': 'SHA-512',
        'signature': signature,
        'appId': this.appId,
        'nonce': nonce
    };

    console.log('📤 Request URL:', fullUrl);
    console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));
    console.log('📋 Headers:', JSON.stringify(headers, null, 2));

    try {
        const response = await axios.post(fullUrl, requestBody, { headers });
        console.log('✅ Response:', JSON.stringify(response.data, null, 2));
        
        if (response.data.code === 0 || response.data.code === '0') {
            return {
                code: '0',
                msg: 'success',
                data: {
                    qrCode: response.data.data?.tdCode || response.data.data?.code,
                    orderId: response.data.data?.leshuaOrderId
                }
            };
        }
        return response.data;
    } catch (error) {
        console.error('❌ API Error:', error.response?.data || error.message);
        return { code: '500', msg: error.message };
    }
}
    

    async queryOrder(thirdOrderId) {
    if (this.mockMode) {
        return {
            code: '0',
            msg: 'success',
            data: { status: 2 }
        };
    }

    const urlPath = '/acceptance-open-api/order/queryOrder';
    const apiEndpoint = '/order/queryOrder';
    const fullUrl = this.baseURL.replace(/\/$/, '') + apiEndpoint;
    
    const requestBody = {
        merchantId: this.merchantId,
        thirdOrderId: thirdOrderId
    };

    const timestamp = Date.now().toString();
    const version = '1.0';
    const nonce = this.generateNonce(16);
    
    const signature = this.generateSignature(
        urlPath,
        this.appId,
        timestamp,
        version,
        nonce,
        JSON.stringify(requestBody),
        this.apiKey
    );

    const headers = {
        'Content-Type': 'application/json',
        'appId': this.appId,
        'timestamp': timestamp,
        'version': version,
        'nonce': nonce,
        'algorithm': 'SHA-512',
        'signature': signature
    };

    try {
        const response = await axios.post(fullUrl, requestBody, { headers });
        console.log('📊 Query Response:', JSON.stringify(response.data, null, 2));
        
        // Return in consistent format
        if (response.data.code === 0 || response.data.code === '0') {
            return {
                code: '0',
                data: {
                    status: response.data.data?.status || 0,
                    payTime: response.data.data?.payTime,
                    amount: response.data.data?.amount
                }
            };
        }
        return response.data;
    } catch (error) {
        console.error('❌ Query Error:', error.response?.data || error.message);
        return { code: '500', msg: error.message };
    }
}
}

module.exports = new YeahPayService();