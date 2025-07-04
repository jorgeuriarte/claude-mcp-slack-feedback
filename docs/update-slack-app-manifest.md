# Actualizar Slack App con el Manifest

Para aplicar el manifest y asegurar que los webhooks funcionen correctamente:

## Pasos:

1. Ve a tu Slack App:
   https://api.slack.com/apps/A072ZT00GC6

2. En el menú lateral, busca **"App Manifest"**

3. Haz clic en **"Edit"** 

4. Copia todo el contenido de `slack-app-manifest.yml`

5. Pégalo reemplazando el manifest actual

6. Haz clic en **"Save Changes"**

7. Slack te pedirá confirmar los cambios. Revisa que incluya:
   - La URL del webhook: `https://claude-mcp-slack-feedback-7af7we7bvq-ew.a.run.app/slack/events`
   - Los eventos suscritos: message.channels, message.groups, etc.

8. Confirma los cambios

9. **IMPORTANTE**: Después de aplicar el manifest, Slack automáticamente verificará la URL del webhook

## Ventajas de usar el manifest:

- Configuración declarativa y versionada
- Asegura que todos los settings estén correctos
- Evita errores de configuración manual
- La URL se verifica automáticamente al aplicar cambios

## Verificación:

Después de aplicar el manifest, verifica que:
1. La URL tenga checkmark verde en Event Subscriptions
2. Los bot events estén correctamente suscritos
3. Los OAuth scopes sean los correctos

Si todo está bien, los webhooks deberían empezar a llegar correctamente.