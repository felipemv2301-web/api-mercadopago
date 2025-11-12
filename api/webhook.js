/**
 * Endpoint de webhook para Vercel (ruta separada)
 */

export default function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const data = req.body;
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
            
        } else if (data.type === 'preference') {
            const preferenceId = data.data?.id;
            console.log(`Preferencia ${preferenceId} actualizada`);
        }
        
        // Responder 200 OK a MercadoPago
        res.status(200).json({ received: true });
        
    } catch (error) {
        console.error('Error procesando webhook:', error);
        res.status(400).json({ error: 'Invalid request' });
    }
}

