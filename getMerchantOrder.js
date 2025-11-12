/**
 * Función auxiliar para obtener detalles de una merchant_order desde la API de MercadoPago
 * 
 * Uso: Cuando recibas un webhook con topic: "merchant_order", puedes usar esta función
 * para obtener más información sobre los pagos asociados.
 * 
 * Ejemplo:
 * const merchantOrder = await getMerchantOrder('35507449982', 'TU_ACCESS_TOKEN');
 * console.log('Pagos:', merchantOrder.payments);
 */

const https = require('https');

/**
 * Obtiene los detalles de una merchant_order desde la API de MercadoPago
 * @param {string} merchantOrderId - ID de la merchant order
 * @param {string} accessToken - Access Token de MercadoPago
 * @returns {Promise<Object>} - Detalles de la merchant order
 */
function getMerchantOrder(merchantOrderId, accessToken) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.mercadopago.com',
            path: `/merchant_orders/${merchantOrderId}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const order = JSON.parse(data);
                        resolve(order);
                    } catch (error) {
                        reject(new Error('Error parseando respuesta: ' + error.message));
                    }
                } else {
                    reject(new Error(`Error ${res.statusCode}: ${data}`));
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.end();
    });
}

/**
 * Extrae información útil de una merchant_order
 * @param {Object} merchantOrder - Objeto de merchant order de la API
 * @returns {Object} - Información procesada
 */
function processMerchantOrder(merchantOrder) {
    const payments = merchantOrder.payments || [];
    const orderStatus = merchantOrder.order_status || 'unknown';
    
    return {
        id: merchantOrder.id,
        status: orderStatus,
        totalAmount: merchantOrder.total_amount,
        currency: merchantOrder.currency_id,
        payments: payments.map(payment => ({
            id: payment.id,
            status: payment.status,
            statusDetail: payment.status_detail,
            transactionAmount: payment.transaction_amount
        })),
        // Determinar estado general
        hasApprovedPayment: payments.some(p => p.status === 'approved'),
        hasPendingPayment: payments.some(p => ['pending', 'in_process'].includes(p.status)),
        hasRejectedPayment: payments.some(p => p.status === 'rejected')
    };
}

module.exports = {
    getMerchantOrder,
    processMerchantOrder
};

