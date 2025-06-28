# Frequently Asked Questions

## Do I need to configure webhooks?

**No!** The bot works perfectly with polling mode (default). Webhooks are completely optional and only needed if you want instant responses instead of waiting 1-2 seconds.

## Why doesn't the manifest include a webhook URL?

Webhook URLs are generated dynamically each time you start a session because:
- They use cloudflared tunnels that create temporary URLs
- Each session gets a unique URL for security
- The URL changes every time

This is why the manifest has webhooks disabled by default.

## How do I know if I should use webhooks or polling?

**Use polling (default) if:**
- You want a simple setup that just works
- A 1-2 second delay is acceptable
- You don't want to reconfigure Slack each session

**Use webhooks if:**
- You need instant responses
- You're testing real-time features
- You don't mind updating Slack settings each session

## Can I set up a permanent webhook URL?

Yes, but this requires additional setup:
- Deploy the webhook server to a cloud service (AWS, Heroku, etc.)
- Set up a permanent domain with HTTPS
- Update the Slack app with your permanent URL

This is beyond the scope of the basic setup but possible for production use.

## The bot isn't responding to my messages

Check:
1. Is the bot in the channel? (It should be automatically added)
2. Are you messaging in the correct channel? (Check with `list_sessions`)
3. Did you use `get_responses` to check for messages?
4. Is your bot token correct? (starts with `xoxb-`)

## Can multiple people use this at the same time?

Yes! The system supports:
- Multiple users (each gets their own channels)
- Multiple sessions per user (for different Claude conversations)
- Automatic user detection and channel creation

## How do I update the Slack app permissions?

If you used the manifest:
1. Go to your app settings at https://api.slack.com/apps
2. Navigate to "OAuth & Permissions"
3. Add any missing scopes
4. Reinstall the app to your workspace

## Why do I need cloudflared?

You don't! Cloudflared is only needed for webhook mode. The bot works fine without it using polling mode.