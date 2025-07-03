#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Look for .claude/slack-config.json in current directory or parent directories
function findSlackConfig(startPath = process.cwd()) {
  let currentPath = startPath;
  
  while (currentPath !== '/') {
    const configPath = join(currentPath, '.claude', 'slack-config.json');
    if (existsSync(configPath)) {
      return configPath;
    }
    currentPath = dirname(currentPath);
  }
  
  return null;
}

// Main function
async function setupFromLocalConfig() {
  const configPath = findSlackConfig();
  
  if (!configPath) {
    console.log('❌ No .claude/slack-config.json found in current directory or parent directories');
    console.log('\nCreate .claude/slack-config.json with:');
    console.log(JSON.stringify({
      botToken: "xoxb-YOUR-BOT-TOKEN",
      workspaceUrl: "yourteam.slack.com",
      channel: "claude-feedback",
      contact: "yourusername"
    }, null, 2));
    process.exit(1);
  }
  
  console.log(`✅ Found config at: ${configPath}`);
  
  try {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    
    // Validate required fields
    if (!config.botToken || !config.workspaceUrl) {
      console.error('❌ Missing required fields: botToken and workspaceUrl');
      process.exit(1);
    }
    
    // Output the configuration commands for Claude Code
    console.log('\n📋 Use these in Claude Code:\n');
    console.log(`Tool: setup_slack_config`);
    console.log(`Parameters: ${JSON.stringify({
      botToken: config.botToken,
      workspaceUrl: config.workspaceUrl
    }, null, 2)}\n`);
    
    if (config.channel) {
      console.log(`Tool: set_channel`);
      console.log(`Parameters: ${JSON.stringify({ channel: config.channel }, null, 2)}\n`);
    }
    
    if (config.contact) {
      console.log(`Tool: set_session_contact`);
      console.log(`Parameters: ${JSON.stringify({ contact: config.contact }, null, 2)}\n`);
    }
    
  } catch (error) {
    console.error('❌ Error reading config:', error.message);
    process.exit(1);
  }
}

setupFromLocalConfig();