const express = require('express');
const cors = require('cors');
const QRCode = require('qrcode');
const path = require('path');

const app = express();

// Railway uses process.env.PORT - இது முக்கியம்!
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve static files from 'public' folder (Railway will use this)
app.use(express.static(path.join(__dirname, 'public')));

// Test merchant ID - Replace with your actual test merchant ID
const TEST_MERCHANT_ID = "826010000001234";

// Create payment endpoint
app.post('/api/create-payment', async (req, res) => {
    const { amount, productName } = req.body;
    
    // Generate unique order ID
    const orderId = 'DEMO_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    console.log(`[ORDER] Created: ${orderId} | Amount: ${amount} | Product: ${productName}`);
    
    // YeahPay official demo URL
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

// Generate QR endpoint
app.post('/api/generate-qr', async (req, res) => {
    const { amount } = req.body;
    const testPaymentUrl = `https://mertest.ysepay.com/merchant_web/demo/merchantExperience.do?method=webExperience`;
    const qrCodeBase64 = await QRCode.toDataURL(testPaymentUrl);
    
    res.json({
        success: true,
        qrCode: qrCodeBase64,
        qrData: testPaymentUrl
    });
});

// Status check endpoint
app.get('/api/check-status/:orderId', (req, res) => {
    res.json({
        status: "pending",
        message: "Waiting for payment..."
    });
});

// 🔥 IMPORTANT: Serve index.html for all other routes (For Railway)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Open browser: http://localhost:${PORT}`);
    console.log(`🌐 Railway URL will auto-assign PORT`);
});