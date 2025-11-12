/**
 * Servidor simple de redirección para MercadoPago
 * 
 * Este servidor recibe las redirecciones de MercadoPago y las redirige
 * a los deep links de la aplicación Android.
 * 
 * Despliega este servidor en Render, Vercel, Netlify, Railway o Heroku
 */

// Para Node.js (Render, Railway, Heroku)
const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;

// Access Token de MercadoPago (opcional - solo si quieres consultar merchant_orders automáticamente)
// Configúralo como variable de entorno en Render: ACCESS_TOKEN=tu_token_aqui
const ACCESS_TOKEN = process.env.ACCESS_TOKEN || null;

const server = http.createServer((req, res) => {
    // Usar la API moderna de URL (evita el warning)
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname.toLowerCase();
    const query = Object.fromEntries(url.searchParams);
    
    // Endpoint para webhooks de MercadoPago - DEBE ser POST
    if (path === '/webhook') {
        if (req.method === 'POST') {
            handleWebhook(req, res);
            return;
        } else {
            // Si es GET, responder con información (útil para pruebas)
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                message: 'Webhook endpoint activo',
                method: 'Este endpoint solo acepta POST',
                url: '/webhook'
            }));
            return;
        }
    }
    
    // Obtener parámetros de la query
    const paymentId = query.payment_id || query.preference_id || '';
    const status = query.status || '';
    
    console.log(`Request recibido: ${req.method} ${path}`);
    console.log(`Query params:`, query);
    console.log(`Payment ID: ${paymentId}, Status: ${status}`);
    
    // Determinar el estado del pago basado en la ruta
    let deepLinkPath = 'success';
    if (path.includes('pending')) {
        deepLinkPath = 'pending';
    } else if (path.includes('failure')) {
        deepLinkPath = 'failure';
    } else if (status) {
        const statusLower = status.toLowerCase();
        if (statusLower === 'approved') {
            deepLinkPath = 'success';
        } else if (['pending', 'in_process', 'in_mediation'].includes(statusLower)) {
            deepLinkPath = 'pending';
        } else if (['rejected', 'cancelled', 'refunded'].includes(statusLower)) {
            deepLinkPath = 'failure';
        }
    }
    
    // Construir el deep link
    let deepLink = `futrono://payment/${deepLinkPath}`;
    if (paymentId) {
        deepLink += `?payment_id=${paymentId}`;
    }
    if (status) {
        deepLink += paymentId ? `&status=${status}` : `?status=${status}`;
    }
    
    console.log(`Redirigiendo a: ${deepLink}`);
    
    // Crear una página HTML que redirija automáticamente al deep link
    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Redirigiendo...</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 20px;
        }
        .spinner {
            border: 4px solid rgba(255,255,255,0.3);
            border-radius: 50%;
            border-top: 4px solid white;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        button {
            padding: 15px 30px;
            font-size: 16px;
            background: white;
            color: #667eea;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Procesando pago...</h1>
        <div class="spinner"></div>
        <p>Redirigiendo a la aplicación...</p>
    </div>
    <script>
        // Intentar abrir el deep link
        window.location.href = "${deepLink}";
        
        // Si después de 2 segundos no se abrió, mostrar botón manual
        setTimeout(function() {
            document.body.innerHTML = \`
                <div class="container">
                    <h1>Redirección automática falló</h1>
                    <p>Por favor, presiona el botón para abrir la aplicación:</p>
                    <button onclick="window.location.href='${deepLink}'">
                        Abrir Aplicación
                    </button>
                </div>
            \`;
        }, 2000);
    </script>
</body>
</html>`;
    
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
});

/**
 * Maneja las notificaciones de webhook de MercadoPago
 */
function handleWebhook(req, res) {
    console.log('=== WEBHOOK RECIBIDO ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            if (!body) {
                console.log('⚠️ Webhook sin body - puede ser una verificación de MercadoPago');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    received: true, 
                    message: 'Webhook endpoint activo',
                    timestamp: new Date().toISOString()
                }));
                return;
            }
            
            const data = JSON.parse(body);
            console.log('=== WEBHOOK DATA ===');
            console.log('Data completa:', JSON.stringify(data, null, 2));
            
            // MercadoPago puede enviar webhooks en diferentes formatos:
            // 1. Formato nuevo: { type: "payment", action: "payment.updated", data: {...} }
            // 2. Formato merchant_order: { resource: "https://...", topic: "merchant_order" }
            // 3. Formato preference: { type: "preference", data: {...} }
            
            let processed = false;
            
            // Formato 1: Notificación de pago directo
            if (data.type === 'payment') {
                const paymentId = data.data?.id;
                const status = data.action; // 'payment.created', 'payment.updated', etc.
                
                console.log(`✅ Pago ${paymentId} - Estado: ${status}`);
                console.log(`✅ Webhook procesado exitosamente: Pago ${paymentId} - ${status}`);
                processed = true;
                
            // Formato 2: Notificación de merchant_order (orden de comerciante)
            } else if (data.topic === 'merchant_order') {
                const resourceUrl = data.resource;
                const merchantOrderId = resourceUrl ? resourceUrl.split('/').pop() : 'desconocido';
                
                console.log(`✅ Merchant Order ${merchantOrderId} actualizada`);
                console.log(`📋 Resource URL: ${resourceUrl}`);
                
                // Si hay Access Token configurado, consultar automáticamente los detalles
                if (ACCESS_TOKEN && merchantOrderId !== 'desconocido') {
                    console.log(`🔍 Consultando detalles de la merchant order...`);
                    getMerchantOrderDetails(merchantOrderId, ACCESS_TOKEN)
                        .then(orderDetails => {
                            console.log(`📦 Detalles de la orden:`);
                            console.log(`   - ID: ${orderDetails.id}`);
                            console.log(`   - Estado: ${orderDetails.order_status}`);
                            console.log(`   - Total: ${orderDetails.total_amount} ${orderDetails.currency_id}`);
                            
                            if (orderDetails.payments && orderDetails.payments.length > 0) {
                                console.log(`💳 Pagos asociados (${orderDetails.payments.length}):`);
                                orderDetails.payments.forEach((payment, index) => {
                                    console.log(`   ${index + 1}. Pago ${payment.id}: ${payment.status} (${payment.status_detail})`);
                                    console.log(`      Monto: ${payment.transaction_amount} ${payment.currency_id}`);
                                });
                            }
                        })
                        .catch(error => {
                            console.log(`⚠️ No se pudo obtener detalles (esto es opcional): ${error.message}`);
                        });
                } else {
                    console.log(`ℹ️ Para obtener detalles automáticamente, configura ACCESS_TOKEN como variable de entorno`);
                    console.log(`ℹ️ O consulta manualmente: ${resourceUrl}`);
                }
                
                processed = true;
                
            // Formato 3: Notificación de preferencia
            } else if (data.type === 'preference') {
                const preferenceId = data.data?.id;
                console.log(`✅ Preferencia ${preferenceId} actualizada`);
                processed = true;
                
            // Formato desconocido
            } else {
                console.log(`ℹ️ Formato de notificación no reconocido:`);
                console.log(`   - type: ${data.type}`);
                console.log(`   - topic: ${data.topic}`);
                console.log(`   - action: ${data.action}`);
                console.log(`   - resource: ${data.resource}`);
            }
            
            // Aquí podrías procesar la notificación:
            // 1. Guardar en una base de datos
            // 2. Enviar notificación push a la app
            // 3. Actualizar el estado del pago
            // 4. Enviar email al usuario
            // 5. Para merchant_order, consultar la API para obtener detalles del pago
            
            // Responder 200 OK a MercadoPago (importante para que no reintente)
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({ 
                received: true,
                processed: processed,
                timestamp: new Date().toISOString(),
                topic: data.topic || data.type || 'unknown'
            }));
            
        } catch (error) {
            console.error('❌ Error procesando webhook:', error.message);
            console.error('Body recibido:', body);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
                error: 'Invalid JSON',
                message: error.message
            }));
        }
    });
    
    req.on('error', (error) => {
        console.error('❌ Error en la request del webhook:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
    });
}

/**
 * Consulta los detalles de una merchant_order desde la API de MercadoPago
 * @param {string} merchantOrderId - ID de la merchant order
 * @param {string} accessToken - Access Token de MercadoPago
 * @returns {Promise<Object>} - Detalles de la merchant order
 */
function getMerchantOrderDetails(merchantOrderId, accessToken) {
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
        
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('Timeout al consultar merchant order'));
        });
        
        req.end();
    });
}

server.listen(PORT, () => {
    console.log(`Servidor de redirección corriendo en puerto ${PORT}`);
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
    if (ACCESS_TOKEN) {
        console.log(`✅ Access Token configurado - se consultarán detalles de merchant_orders automáticamente`);
    } else {
        console.log(`ℹ️ Access Token no configurado - solo se procesarán los webhooks básicos`);
    }
});

