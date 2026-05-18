const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// ============ SINGAPORE API CONFIGURATION ============
// 🔥 REPLACE WITH YOUR ACTUAL CREDENTIALS FROM YEAHPAY SINGAPORE
const CONFIG = {
    // Test environment
    apiUrl: 'https://t-acquire-business.lepass.cn/gw/abroad-business-acceptance/open-api/',
    // Production: 'https://open-api.yeahpay.sg/acceptance/acceptance-open-api/',
    
    appId: 'YOUR_APP_ID',           // 🔥 Get from YeahPay
    merchantId: 'YOUR_MERCHANT_ID',  // 🔥 Get from YeahPay
    apiKey: 'YOUR_API_KEY',          // 🔥 Get from YeahPay
    version: '1.0',
    algorithm: 'SHA-512'
};

// Helper: Generate signature
function generateSignature(url, appId, timestamp, version, nonce, body, apiKey) {
    // Format: URL\nappId\ntimestamp\nversion\nnonce\nbody\napiKey
    const signString = `${url}\n${appId}\n${timestamp}\n${version}\n${nonce}\n${body}\n${apiKey}`;
    return crypto.createHash('sha512').update(signString, 'utf8').digest('hex');
}

// Helper: Generate random nonce
function generateNonce(length = 16) {
    return crypto.randomBytes(length).toString('hex');
}

// API: Create Payment (Master Scan - Consumer scans QR)
app.post('/api/create-payment', async (req, res) => {
    const { amount, productName, payWay } = req.body;
    
    const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const timestamp = Date.now().toString();
    const nonce = generateNonce();
    const urlPath = '/order/unifiedOrder';
    
    // Request body as per Singapore API docs
    const requestBody = {
        payWay: payWay || 'WXZF',  // WXZF=WeChat, ZFBZF=Alipay, PayNowPay=PayNow
        amount: amount || '0.01',
        currency: 'SGD',
        merchantId: CONFIG.merchantId,
        thirdOrderId: orderId,
        body: productName || 'Demo Product',
        attach: 'test_payment',
        orderExpiration: '600'  // 10 minutes
    };
    
    const bodyString = JSON.stringify(requestBody);
    
    // Generate signature
    const signature = generateSignature(
        urlPath,
        CONFIG.appId,
        timestamp,
        CONFIG.version,
        nonce,
        bodyString,
        CONFIG.apiKey
    );
    
    console.log(`[ORDER] Creating: ${orderId} | Amount: ${amount} SGD`);
    
    try {
        // Call YeahPay Singapore API
        const response = await axios.post(CONFIG.apiUrl + 'order/unifiedOrder', requestBody, {
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
        
        if (apiResponse.code === '0' && apiResponse.data && apiResponse.data.tdCode) {
            // Generate QR code from the tdCode URL
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
        console.error('API Error:', error.response?.data || error.message);
        res.json({
            success: false,
            error: error.response?.data?.message || error.message,
            message: "Please check API credentials. Contact YeahPay for appId and merchantId."
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
        const response = await axios.post(CONFIG.apiUrl + 'order/queryOrder', requestBody, {
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
    console.log(`⚠️ Make sure to replace YOUR_APP_ID, YOUR_MERCHANT_ID, YOUR_API_KEY`);
});