const yeahpayService = require('../services/yeahpayService');
const QRCode = require('qrcode');

// Store orders in memory (use database in production)
const orders = new Map();

/**
 * Generate QR Code for customer to scan
 * POST /api/payment/generate-qr
 */
exports.generateQRPayment = async (req, res) => {
    try {
        const { amount, payWay = 'WXZF' } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }

        // Generate unique order ID
        const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
        
        // Call YeahPay API to create QR payment
        const result = await yeahpayService.createMasterScanQR(
            orderId,
            amount,
            payWay
        );
        
        console.log('YeahPay Result:', JSON.stringify(result, null, 2));
        
        if (result.code === '0' || result.code === 0) {
            // Get QR code URL from response
            const qrUrl = result.data?.code || result.data?.qrCode;
            
            // Generate QR code image as base64
            let qrBase64 = null;
            if (qrUrl) {
                qrBase64 = await QRCode.toDataURL(qrUrl);
            }
            
            // Store order info
            orders.set(orderId, {
                orderId,
                amount,
                payWay,
                status: 'PENDING',
                yeahpayOrderId: result.data?.leshuaOrderId,
                createdAt: new Date(),
                qrUrl
            });
            
            return res.json({
                success: true,
                data: {
                    orderId,
                    amount,
                    qrUrl,
                    qrBase64,
                    status: 'PENDING',
                    message: 'QR Code generated successfully. Customer can scan to pay.'
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.msg || 'Failed to generate QR code',
                code: result.code
            });
        }
        
    } catch (error) {
        console.error('Generate QR Error:', error);
        return res.status(500).json({
            success: false,
            message: error.response?.data?.msg || error.message || 'Internal server error'
        });
    }
};

/**
 * Check order status
 * GET /api/payment/status/:orderId
 */
exports.checkOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = orders.get(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        // Query YeahPay for latest status
        const result = await yeahpayService.queryOrder(orderId);
        
        console.log('📊 Query Result:', JSON.stringify(result, null, 2));
        
        let status = 'PENDING';
        let statusText = 'Waiting for payment';
        
        if (result.code === '0' || result.code === 0) {
            const paymentStatus = result.data?.status;
            
            console.log('💰 Payment Status from YeahPay:', paymentStatus);
            
            // Status mapping based on API.pdf
            switch (paymentStatus) {
                case 0:
                    status = 'PENDING';
                    statusText = 'Waiting for payment';
                    break;
                case 2:
                    status = 'SUCCESS';
                    statusText = 'Payment successful!';
                    break;
                case 6:
                    status = 'CLOSED';
                    statusText = 'Order closed';
                    break;
                case 8:
                    status = 'FAILED';
                    statusText = 'Payment failed';
                    break;
                case 11:
                    status = 'REFUNDED';
                    statusText = 'Refunded';
                    break;
                default:
                    status = 'UNKNOWN';
                    statusText = 'Unknown status - ' + paymentStatus;
            }
            
            // Update local order status
            order.status = status;
            if (status === 'SUCCESS') {
                order.paidAt = new Date();
                order.payTime = result.data?.payTime;
            }
            
            // IMPORTANT: Save the updated order back to Map
            orders.set(orderId, order);
        }
        
        return res.json({
            success: true,
            data: {
                orderId,
                status,
                statusText,
                amount: order.amount,
                paidAt: order.paidAt || null,
                yeahpayResponse: result.data
            }
        });
        
    } catch (error) {
        console.error('Check Status Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Internal server error'
        });
    }
};
exports.getAllOrders = async (req, res) => {
    try {
        const allOrders = Array.from(orders.values());
        return res.json({
            success: true,
            data: allOrders,
            count: allOrders.length
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
/**
 * Process Micro Pay (cashier scans customer code)
 * POST /api/payment/micropay
 */
exports.microPay = async (req, res) => {
    try {
        const { amount, authCode, payWay = 'WXZF' } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount'
            });
        }
        
        if (!authCode) {
            return res.status(400).json({
                success: false,
                message: 'Authorization code (customer barcode) is required'
            });
        }
        
        const orderId = `MICRO_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        
        const result = await yeahpayService.microPay(orderId, amount, authCode, payWay);
        
        if (result.code === '0' || result.code === 0) {
            orders.set(orderId, {
                orderId,
                amount,
                payWay,
                status: 'SUCCESS',
                yeahpayOrderId: result.data?.leshuaOrderId,
                createdAt: new Date(),
                paidAt: new Date()
            });
            
            return res.json({
                success: true,
                data: {
                    orderId,
                    amount,
                    status: 'SUCCESS',
                    message: 'Payment successful!',
                    transactionId: result.data?.leshuaOrderId
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.msg || 'Payment failed'
            });
        }
        
    } catch (error) {
        console.error('MicroPay Error:', error);
        return res.status(500).json({
            success: false,
            message: error.response?.data?.msg || error.message || 'Payment failed'
        });
    }
};

/**
 * Payment Callback Webhook (YeahPay will call this)
 * POST /api/payment/callback
 */
exports.paymentCallback = async (req, res) => {
    try {
        console.log('📞 Webhook received:', JSON.stringify(req.body, null, 2));
        
        const { thirdOrderId, leshuaOrderId, status, amount, payTime } = req.body;
        
        // Find and update order
        if (thirdOrderId && orders.has(thirdOrderId)) {
            const order = orders.get(thirdOrderId);
            
            if (status == 2) { // Payment success
                order.status = 'SUCCESS';
                order.paidAt = new Date();
                order.payTime = payTime;
                order.yeahpayOrderId = leshuaOrderId;
                orders.set(thirdOrderId, order);
                
                console.log(`✅ Payment successful for order: ${thirdOrderId}`);
            }
        }
        
        // Must return "success" string as per API.pdf
        res.send('success');
        
    } catch (error) {
        console.error('Webhook Error:', error);
        res.send('success'); // Still return success to avoid retry
    }
};

/**
 * Refund Order
 * POST /api/payment/refund
 */
exports.refundOrder = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        
        const order = orders.get(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        if (order.status !== 'SUCCESS') {
            return res.status(400).json({
                success: false,
                message: 'Only successful orders can be refunded'
            });
        }
        
        const refundOrderId = `REFUND_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const refundAmount = amount || order.amount;
        
        const result = await yeahpayService.refund(orderId, refundOrderId, refundAmount);
        
        if (result.code === '0' || result.code === 0) {
            order.status = 'REFUNDED';
            order.refundAmount = refundAmount;
            order.refundedAt = new Date();
            orders.set(orderId, order);
            
            return res.json({
                success: true,
                data: {
                    refundOrderId,
                    amount: refundAmount,
                    status: 'REFUNDED'
                }
            });
        } else {
            return res.status(400).json({
                success: false,
                message: result.msg || 'Refund failed'
            });
        }
        
    } catch (error) {
        console.error('Refund Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Refund failed'
        });
    }
};

/**
 * Get order details
 * GET /api/payment/order/:orderId
 */
exports.getOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = orders.get(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        
        return res.json({
            success: true,
            data: order
        });
        
    } catch (error) {
        console.error('Get Order Error:', error);
        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};