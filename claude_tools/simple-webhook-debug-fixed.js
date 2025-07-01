import express from 'express';

const app = express();
const PORT = 3333;

// Raw body middleware
app.use(express.raw({ type: '*/*' }));

// Single handler for all routes
app.use((req, res) => {
  const timestamp = new Date().toISOString();
  
  console.log('\n=== NUEVO REQUEST RECIBIDO ===');
  console.log('Timestamp:', timestamp);
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('\nHeaders:');
  Object.entries(req.headers).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  
  const rawBody = req.body ? req.body.toString() : '';
  console.log('\nBody (raw):');
  console.log(rawBody);
  
  try {
    const body = JSON.parse(rawBody);
    console.log('\nBody (parsed):');
    console.log(JSON.stringify(body, null, 2));
    
    // Responder al challenge de verificación
    if (body.type === 'url_verification') {
      console.log('\n✅ Respondiendo con challenge:', body.challenge);
      return res.send(body.challenge);
    }
    
    // Para otros eventos, responder OK
    res.send('ok');
    
  } catch (e) {
    console.log('\n❌ No es JSON válido');
    
    // Intentar como form-urlencoded
    try {
      const params = new URLSearchParams(rawBody);
      console.log('\nForm params:');
      for (const [key, value] of params) {
        console.log(`  ${key}: ${value.substring(0, 100)}...`);
      }
    } catch (e2) {
      console.log('❌ Tampoco es form-urlencoded');
    }
    
    res.send('ok');
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor debug corriendo en puerto ${PORT}`);
  console.log('\n📋 Opciones para exponer el servidor:\n');
  
  console.log('1. Usar Cloudflared (recomendado):');
  console.log('   cloudflared tunnel --url http://localhost:3333\n');
  
  console.log('2. Usar localtunnel:');
  console.log('   npx localtunnel --port 3333\n');
  
  console.log('3. Usar serveo:');
  console.log('   ssh -R 80:localhost:3333 serveo.net\n');
  
  console.log('Luego usa la URL pública en Slack Event Subscriptions');
  console.log('\nPresiona Ctrl+C para detener');
});