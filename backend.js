const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const crypto = require('crypto');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============ SINGAPORE API CONFIGURATION ============
const CONFIG = {
    apiUrl: 'https://t-acquire-business.lepass.cn/gw/abroad-business-acceptance-open-api',
    appId: 'YOUR_APP_ID',           // 🔥 Replace with actual
    merchantId: '4079688802',  // 🔥 Replace with actual
    apiKey: 'YOUR_API_KEY',          // 🔥 Replace with actual
    version: '1.0',
    algorithm: 'SHA-512'
};

// Helper: Generate signature
function generateSignature(url, appId, timestamp, version, nonce, body, apiKey) {
    // Exact format: url\nappId\ntimestamp\nversion\nonce\nbody\napiKey
    const signString = `${url}\n${appId}\n${timestamp}\n${version}\n${nonce}\n${body}\n${apiKey}`;
    console.log('[SIGN STRING LENGTH]', signString.length);
    return crypto.createHash('sha512').update(signString, 'utf8').digest('hex');
}

// Helper: Generate random nonce
function generateNonce(length = 16) {
    return crypto.randomBytes(length).toString('hex');
}

// API: Create Payment
app.post('/api/create-payment', async (req, res) => {
    const { amount, productName, payWay } = req.body;
    
    const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    const urlPath = '/order/unifiedOrder';
    
    // 🔥 CRITICAL: All values must be strings
    const requestBody = {
        payWay: payWay || 'WXZF',
        amount: String(amount || '0.01'),      // ✅ String
        currency: 'SGD',
        merchantId: CONFIG.merchantId,
        thirdOrderId: String(orderId),          // ✅ String
        body: productName || 'Demo Product',
        attach: 'test_payment',
        orderExpiration: '600'
    };
    
    const bodyString = JSON.stringify(requestBody);
    
    const signature = generateSignature(
        urlPath,
        CONFIG.appId,
        timestamp,
        CONFIG.version,
        nonce,
        bodyString,
        CONFIG.apiKey
    );
    
    console.log(`[ORDER] ID: ${orderId} | Amount: ${amount} SGD | PayWay: ${payWay}`);
    console.log('[REQUEST BODY]', bodyString);
    
    try {
        const fullUrl = `${CONFIG.apiUrl}${urlPath}`;
        console.log(`[REQUEST URL] ${fullUrl}`);
        
        const response = await axios.post(fullUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'appId': CONFIG.appId,
                'timestamp': timestamp,
                'version': CONFIG.version,
                'algorithm': CONFIG.algorithm,
                'nonce': nonce,
                'signature': signature
            }
        });
        
        const apiResponse = response.data;
        console.log('[API RESPONSE]', JSON.stringify(apiResponse, null, 2));
        
        if (apiResponse.code === '0' && apiResponse.data && apiResponse.data.tdCode) {
            const qrCodeBase64 = await QRCode.toDataURL(apiResponse.data.tdCode);
            
            res.json({
                success: true,
                orderId: orderId,
                qrCode: qrCodeBase64,
                paymentUrl: apiResponse.data.tdCode,
                leshuaOrderId: apiResponse.data.leshuaOrderId,
                amount: amount,
                message: "Scan QR code with WeChat/Alipay/PayNow"
            });
        } else {
            throw new Error(apiResponse.message || 'API returned error');
        }
        
    } catch (error) {
        console.error('[API ERROR]', error.response?.data || error.message);
        res.json({
            success: false,
            error: error.response?.data?.message || error.message,
            message: "API call failed. Check credentials and request format."
        });
    }
});

// API: Check Payment Status
app.get('/api/check-status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    const urlPath = '/order/queryOrder';
    
    const requestBody = {
        merchantId: CONFIG.merchantId,
        thirdOrderId: orderId
    };
    
    const bodyString = JSON.stringify(requestBody);
    const signature = generateSignature(
        urlPath, CONFIG.appId, timestamp, CONFIG.version, nonce, bodyString, CONFIG.apiKey
    );
    
    try {
        const fullUrl = `${CONFIG.apiUrl}${urlPath}`;
        const response = await axios.post(fullUrl, requestBody, {
            headers: {
                'Content-Type': 'application/json',
                'appId': CONFIG.appId,
                'timestamp': timestamp,
                'version': CONFIG.version,
                'algorithm': CONFIG.algorithm,
                'nonce': nonce,
                'signature': signature
            }
        });
        
        const data = response.data;
        if (data.code === '0' && data.data) {
            res.json({
                status: data.data.status === '2' ? 'success' : 'pending',
                message: data.data.status === '2' ? 'Payment successful' : 'Waiting for payment'
            });
        } else {
            res.json({ status: 'pending', message: 'Checking...' });
        }
    } catch (error) {
        res.json({ status: 'pending', message: 'Status check failed' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📍 API URL: ${CONFIG.apiUrl}`);
    console.log(`⚠️ Make sure appId, merchantId, apiKey are set correctly`);
});