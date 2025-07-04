#!/bin/bash

echo "Para obtener el Slack Signing Secret:"
echo ""
echo "1. Ve a https://api.slack.com/apps"
echo "2. Selecciona tu aplicación 'Claude MCP Feedback'"
echo "3. En el menú lateral, ve a 'Basic Information'"
echo "4. En la sección 'App Credentials', encontrarás 'Signing Secret'"
echo "5. Haz clic en 'Show' para verlo"
echo ""
echo "Una vez que tengas el Signing Secret, configúralo con:"
echo "gh secret set SLACK_SIGNING_SECRET"