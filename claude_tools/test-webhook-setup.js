#!/usr/bin/env node

/**
 * Script para probar y configurar el modo webhook
 */

import { SessionManager } from '../dist/session-manager.js';
import { ConfigManager } from '../dist/config-manager.js';
import { SlackClient } from '../dist/slack-client.js';
import { TunnelManager } from '../dist/tunnel-manager.js';
import { WebhookServer } from '../dist/webhook-server.js';

async function testWebhookSetup() {
  console.log('🧪 Probando configuración de webhook...\n');

  const configManager = new ConfigManager();
  await configManager.init();

  // Verificar configuración de Slack
  const slackConfig = configManager.getSlackConfig();
  if (!slackConfig) {
    console.log('❌ Slack no está configurado');
    console.log('Primero configura Slack en Claude con:');
    console.log('mcp__claude-mcp-slack-feedback__setup_slack_config');
    return;
  }

  console.log('✅ Slack configurado');
  console.log(`   Workspace: ${slackConfig.workspaceUrl}`);
  console.log(`   Team ID: ${slackConfig.teamId}\n`);

  // Crear sesión de prueba
  const sessionManager = new SessionManager(configManager);
  await sessionManager.init();
  
  const testSession = {
    sessionId: 'test-webhook',
    userId: 'test-user',
    channelId: '',
    port: 3456,
    createdAt: new Date(),
    lastActivity: new Date(),
    status: 'active',
    mode: 'webhook'
  };

  console.log('📡 Iniciando servidor webhook en puerto', testSession.port);
  
  try {
    // Verificar cloudflared
    const tunnelManager = new TunnelManager(testSession.port);
    const isInstalled = await tunnelManager.checkCloudflaredInstalled();
    
    if (!isInstalled) {
      console.log('❌ cloudflared no está instalado');
      return;
    }
    
    console.log('✅ cloudflared está instalado\n');
    
    // Iniciar túnel
    console.log('🚇 Creando túnel con cloudflared...');
    const tunnelUrl = await tunnelManager.start();
    console.log('✅ Túnel creado:', tunnelUrl);
    
    // Iniciar servidor webhook
    const slackClient = new SlackClient(configManager, sessionManager);
    const webhookServer = new WebhookServer(testSession.port, testSession.sessionId, slackClient);
    await webhookServer.start();
    
    console.log('✅ Servidor webhook iniciado\n');
    
    console.log('📋 CONFIGURACIÓN DE SLACK:');
    console.log('==========================');
    console.log('1. Ve a: https://api.slack.com/apps');
    console.log('2. Selecciona tu app');
    console.log('3. Ve a "Event Subscriptions"');
    console.log('4. Activa "Enable Events"');
    console.log('5. En "Request URL" pega:');
    console.log(`   ${tunnelUrl}/slack/events`);
    console.log('6. Espera el checkmark verde ✓');
    console.log('7. En "Subscribe to bot events" añade:');
    console.log('   - message.channels');
    console.log('   - message.groups');
    console.log('8. Guarda los cambios\n');
    
    console.log('🧪 URL de prueba local:');
    console.log(`   http://localhost:${testSession.port}/health\n`);
    
    console.log('⏸️  Presiona Ctrl+C para detener...');
    
    // Mantener el proceso vivo
    process.on('SIGINT', async () => {
      console.log('\n\n🛑 Deteniendo...');
      await webhookServer.stop();
      await tunnelManager.stop();
      process.exit(0);
    });
    
    // Mantener vivo
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testWebhookSetup().catch(console.error);