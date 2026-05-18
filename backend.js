const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Test merchant ID - You need to replace with your actual test merchant ID
// Get this from your YeahPay merchant list (826xxxxxx format)
const TEST_MERCHANT_ID = "826010000001234";  // 🔥 REPLACE WITH YOUR ACTUAL TEST MERCHANT ID

// Test endpoint (Official YeahPay Demo - No real API call, just demo response)
// Since we don't have real credentials yet, we'll generate a mock QR that opens YeahPay demo

app.post('/api/create-payment', async (req, res) => {
    const { amount, productName } = req.body;
    
    // Generate unique order ID
    const orderId = 'DEMO_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    console.log(`[ORDER] Created: ${orderId} | Amount: ${amount} | Product: ${productName}`);
    
    // 🔥 DEMO MODE: Generate a QR code that opens YeahPay official demo experience
    // This is the official YeahPay test gateway - REAL demo payment experience
    const demoPaymentUrl = `https://mertest.ysepay.com/merchant_web/demo/merchantExperience.do?method=webExperience`;
    
    // Generate QR code as base64
    const qrCodeBase64 = await QRCode.toDataURL(demoPaymentUrl);
    
    res.json({
        success: true,
        orderId: orderId,
        qrCode: qrCodeBase64,
        paymentUrl: demoPaymentUrl,
        amount: amount,
        message: "Scan QR code to open YeahPay demo gateway"
    });
});

// Alternative: Direct QR code generation without API call
app.post('/api/generate-qr', async (req, res) => {
    const { amount } = req.body;
    
    // YeahPay test payment page (simulated checkout)
    const testPaymentUrl = `https://mertest.ysepay.com/merchant_web/demo/merchantExperience.do?method=webExperience`;
    
    const qrCodeBase64 = await QRCode.toDataURL(testPaymentUrl);
    
    res.json({
        success: true,
        qrCode: qrCodeBase64,
        qrData: testPaymentUrl
    });
});

// Status check endpoint (for polling)
app.get('/api/check-status/:orderId', (req, res) => {
    // In real implementation, you would check with YeahPay API
    // For demo, we'll return pending
    res.json({
        status: "pending",
        message: "Waiting for payment..."
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📱 Open browser: http://localhost:${PORT}`);
});