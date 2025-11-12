# Servidor de Redirección para MercadoPago

Este servidor simple recibe las redirecciones de MercadoPago y las redirige a los deep links de tu aplicación Android.

## Opciones de Despliegue Gratuito

### 1. Render (Recomendado - Más Fácil)

1. Ve a https://render.com y crea una cuenta
2. Haz clic en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub o sube los archivos
4. Configuración:
   - **Name**: `mercadopago-redirect`
   - **Environment**: `Node`
   - **Build Command**: (dejar vacío)
   - **Start Command**: `node server.js`
5. Haz clic en "Create Web Service"
6. Copia la URL que te da (ej: `https://mercadopago-redirect.onrender.com`)
7. Actualiza `MercadoPagoConfig.kt` con esa URL

### 2. Vercel (Ideal para Serverless)

1. Ve a https://vercel.com y crea una cuenta
2. Instala Vercel CLI: `npm i -g vercel`
3. En la carpeta `redirect-server`, ejecuta: `vercel`
4. Sigue las instrucciones
5. Copia la URL que te da
6. Actualiza `MercadoPagoConfig.kt` con esa URL

**Nota**: Para Vercel, usa la carpeta `api/` con `index.js` en lugar de `server.js`

### 3. Netlify

1. Ve a https://netlify.com y crea una cuenta
2. Arrastra la carpeta `redirect-server` a Netlify
3. Configuración:
   - **Build command**: (dejar vacío)
   - **Publish directory**: (dejar vacío)
4. Copia la URL que te da
5. Actualiza `MercadoPagoConfig.kt` con esa URL

### 4. Railway

1. Ve a https://railway.app y crea una cuenta
2. Haz clic en "New Project" → "Deploy from GitHub"
3. Selecciona tu repositorio
4. Railway detectará automáticamente Node.js
5. Copia la URL que te da
6. Actualiza `MercadoPagoConfig.kt` con esa URL

### 5. Heroku

1. Ve a https://heroku.com y crea una cuenta
2. Instala Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli
3. En la carpeta `redirect-server`, ejecuta:
   ```bash
   heroku create tu-nombre-app
   git init
   git add .
   git commit -m "Initial commit"
   git push heroku main
   ```
4. Copia la URL que te da (ej: `https://tu-nombre-app.herokuapp.com`)
5. Actualiza `MercadoPagoConfig.kt` con esa URL

## Configurar en la App Android

Una vez que tengas la URL de tu servidor (ej: `https://tu-servidor.onrender.com`), actualiza `MercadoPagoConfig.kt`:

```kotlin
// En MercadoPagoConfig.kt, agrega:
const val REDIRECT_SERVICE_URL = "https://tu-servidor.onrender.com"

// Y actualiza las funciones:
fun getSuccessUrl(): String {
    return "$REDIRECT_SERVICE_URL/payment/success"
}

fun getPendingUrl(): String {
    return "$REDIRECT_SERVICE_URL/payment/pending"
}

fun getFailureUrl(): String {
    return "$REDIRECT_SERVICE_URL/payment/failure"
}
```

Y en `MercadoPagoService.kt`, actualiza para usar estas URLs:

```kotlin
val preferenceRequest = PaymentPreferenceRequest(
    items = preferenceItems,
    backUrls = BackUrls(
        success = MercadoPagoConfig.getSuccessUrl(),
        pending = MercadoPagoConfig.getPendingUrl(),
        failure = MercadoPagoConfig.getFailureUrl()
    ),
    autoReturn = "all"
)
```

## Pruebas

Una vez desplegado, prueba las URLs:
- `https://tu-servidor.onrender.com/payment/success?payment_id=123&status=approved`
- `https://tu-servidor.onrender.com/payment/pending?payment_id=123&status=pending`
- `https://tu-servidor.onrender.com/payment/failure?payment_id=123&status=rejected`

Deberían redirigir a `futrono://payment/success`, `futrono://payment/pending`, o `futrono://payment/failure` respectivamente.

