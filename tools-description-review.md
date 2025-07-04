# MCP Tools Description Review

This document contains all the tool descriptions for the Claude MCP Slack Feedback server. Review these to ensure they are clear and complete for someone without context of the development.

## 1. setup_slack_config
**Description:** Configure Slack workspace connection (required for first-time setup)

**Parameters:**
- `botToken` (required): Slack bot token (starts with xoxb-)
- `workspaceUrl` (required): Slack workspace URL (e.g., myteam.slack.com)

## 2. ask_feedback
**Description:** Send a question to Slack for human feedback (waits for response)

**Parameters:**
- `question` (required): The question to ask
- `context` (optional): Optional context to help the human understand the question
- `options` (optional): Optional list of suggested responses

## 3. send_question
**Description:** Send a BLOCKING question that requires human input to proceed.

Use this when:
- You need a decision or clarification before continuing
- The task cannot proceed without human input
- You're asking for approval, confirmation, or choice between options

DO NOT use for:
- Progress updates or status reports (use inform_slack instead)
- Optional feedback that won't block your work

The tool returns immediately with a question_id. Use check_responses to poll for answers.
Polling is automatic: 3 seconds for 1 minute (intensive), then 15-second pauses.

**Parameters:**
- `question` (required): The question to ask
- `context` (optional): Optional context to help the human understand
- `options` (optional): Suggested response options
- `priority` (optional): Visual priority indicator (low/normal/high/urgent)
- `response_type` (optional): quick (expect short answer in channel) / detailed (expect thread response) / any

## 4. check_responses
**Description:** Check for responses to a previously sent question.

This tool will:
1. Check for responses in the thread
2. Check for recent channel messages (last 2 minutes)
3. Return all potential responses with context

YOU (the LLM) should analyze the responses and decide:
- If a channel message seems like a response to your question by considering:
  * Timing: Messages within 30s are very likely responses
  * Content: Does it answer or relate to your question?
  * User: Is it from someone who typically responds?
  * Options: Does it match suggested options?
- Confidence level: high (certain), medium (probable), low (possible)
- Whether to accept, ignore, or ask for clarification

Channel messages include:
- Time elapsed since your question
- User information
- Full message text

Example analysis:
- Question: "REST or GraphQL?"
- Channel message (10s later): "rest" → High confidence response
- Channel message (15s later): "hey did you see the PR?" → Low confidence, likely unrelated

**Parameters:**
- `question_id` (required): The ID returned by send_question
- `include_channel` (optional): Whether to check channel messages for potential responses (default: true)
- `channel_window` (optional): Seconds to look back for channel messages (max 300, default: 120)

## 5. add_reaction
**Description:** Add an emoji reaction to any message.

Common reactions:
- white_check_mark (✅): Confirmed/accepted
- eyes (👀): Seen/processing
- thinking_face (🤔): Considering
- question (❓): Need clarification
- timer_clock (⏲️): Will check back later
- thumbsup (👍): Acknowledged

Use reactions for lightweight communication without adding noise.

**Parameters:**
- `channel` (required): Channel ID where the message is
- `timestamp` (required): Message timestamp
- `reaction` (required): Emoji name without colons (e.g., "thumbsup", not ":thumbsup:")

## 6. inform_slack
**Description:** Send a NON-BLOCKING status update or progress report.

Use this when:
- Reporting progress or completion of tasks
- Sharing results or findings
- Providing status updates
- Informing about decisions you've made

The tool will briefly check (1 minute) if the user wants to intervene,
but continues working if no response is received.

DO NOT use for questions that need answers to proceed.

**Parameters:**
- `message` (required): The informational message to send
- `context` (optional): Optional additional context

## 7. update_progress
**Description:** Update the Slack thread with progress information

**Parameters:**
- `message` (required): Progress update message
- `threadTs` (required): Thread timestamp from previous message

## 8. get_responses
**Description:** Get responses from Slack (uses webhook or polling based on configuration)

**Parameters:**
- `sessionId` (optional): Optional session ID to get responses for specific session
- `since` (optional): Optional timestamp to get responses since

## 9. list_sessions
**Description:** List all active sessions

**Parameters:** None

## 10. get_version
**Description:** Get MCP server version and build time

**Parameters:** None

## 11. set_channel
**Description:** Set the Slack channel for the current session

**Parameters:**
- `channel` (required): Channel name (without #) or channel ID

## 12. list_channels
**Description:** List available Slack channels

**Parameters:** None

## 13. set_session_label
**Description:** Set a custom label for the current session to help identify it in Slack

**Parameters:**
- `label` (required): Custom label for the session (e.g., "Frontend Dev", "API Testing")

## 14. set_session_contact
**Description:** Set the contact to mention in Slack messages (e.g., @jorge or @here)

**Parameters:**
- `contact` (required): Slack username to mention (without @) or "here" for @here

## Additional Tools (MCP Dev Only)

### configure_polling
**Description:** Configure polling behavior for the current session

**Parameters:**
- `autoStart` (optional): Start polling automatically when in polling/hybrid mode
- `normalInterval` (optional): Normal polling interval in milliseconds (default: 5000)
- `idleInterval` (optional): Idle polling interval in milliseconds (default: 30000)
- `maxInterval` (optional): Maximum polling interval in milliseconds (default: 60000)
- `initialDelay` (optional): Initial polling delay in milliseconds (default: 2000)

### configure_hybrid
**Description:** Configure hybrid mode behavior for the current session

**Parameters:**
- `webhookTimeout` (optional): Webhook timeout in milliseconds (default: 5000)
- `fallbackAfterFailures` (optional): Number of failures before switching to polling (default: 3)
- `healthCheckInterval` (optional): Health check interval in milliseconds (default: 300000)

### set_session_mode
**Description:** Set the operation mode for the current session

**Parameters:**
- `mode` (required): Operation mode: webhook (instant), polling (reliable), or hybrid (best of both)

## Visual Distinctions

### Questions (send_question / ask_feedback)
- **Urgent**: 🚨 **URGENT DECISION NEEDED**
- **High**: ⚠️ **Important Question**
- **Normal**: ❓ **Question**
- **Low**: 💭 Quick question

### Status Updates (inform_slack)
- Always shows: 📊 **Status Update**
- Note: "_This is a status update. Reply if you need to intervene._"

### Progress Updates (update_progress)
- Shows in thread with session emoji and label
- Format: `[Session Label] 🤖 *Progress Update:* <message>`