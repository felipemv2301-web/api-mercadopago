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
const url = require('url');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname.toLowerCase();
    const query = parsedUrl.query;
    
    // Endpoint para webhooks de MercadoPago
    if (path === '/webhook' && req.method === 'POST') {
        handleWebhook(req, res);
        return;
    }
    
    // Obtener parámetros de la query
    const paymentId = query.payment_id || query.preference_id || '';
    const status = query.status || '';
    
    console.log(`Request recibido: ${req.method} ${path}`);
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
    let body = '';
    
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const data = JSON.parse(body);
            console.log('=== WEBHOOK RECIBIDO ===');
            console.log('Tipo:', data.type);
            console.log('Action:', data.action);
            console.log('Data:', JSON.stringify(data, null, 2));
            
            // MercadoPago envía diferentes tipos de notificaciones
            if (data.type === 'payment') {
                const paymentId = data.data?.id;
                const status = data.action; // 'payment.created', 'payment.updated', etc.
                
                console.log(`Pago ${paymentId} - Estado: ${status}`);
                
                // Aquí podrías:
                // 1. Guardar en una base de datos
                // 2. Enviar notificación push a la app
                // 3. Actualizar el estado del pago
                // 4. Enviar email al usuario
                
                // Por ahora, solo logueamos
                console.log(`Webhook procesado: Pago ${paymentId} - ${status}`);
            } else if (data.type === 'preference') {
                const preferenceId = data.data?.id;
                console.log(`Preferencia ${preferenceId} actualizada`);
            }
            
            // Responder 200 OK a MercadoPago
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true }));
            
        } catch (error) {
            console.error('Error procesando webhook:', error);
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
    });
}

server.listen(PORT, () => {
    console.log(`Servidor de redirección corriendo en puerto ${PORT}`);
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhook`);
});

