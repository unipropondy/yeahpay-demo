const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

// Generate QR for customer to scan (Master Scan)
router.post('/generate-qr', paymentController.generateQRPayment);

// Check order status
router.get('/status/:orderId', paymentController.checkOrderStatus);

// Micro Pay - Cashier scans customer code
router.post('/micropay', paymentController.microPay);

// Webhook callback from YeahPay
router.post('/callback', paymentController.paymentCallback);

// Refund order
router.post('/refund', paymentController.refundOrder);

// Get order details
router.get('/order/:orderId', paymentController.getOrder);

router.get('/orders', paymentController.getAllOrders);

module.exports = router;