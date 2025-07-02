#!/usr/bin/env node

const { existsSync, readFileSync, writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const { homedir } = require('os');
const { execSync } = require('child_process');

console.log('🤖 Claude MCP Slack Feedback Installer for Claude Code\n');

// Possible locations for Claude Code config
const configPaths = [
  join(homedir(), '.config', 'claude', 'settings.json'),
  join(homedir(), '.claude', 'settings.json'),
  join(homedir(), 'Library', 'Application Support', 'claude', 'settings.json')
];

// Find existing config
let configPath = configPaths.find(p => existsSync(p));

if (!configPath) {
  console.log('📝 No Claude Code configuration found. Creating new configuration...');
  
  // Try to create in the most common location
  const defaultPath = configPaths[0];
  const configDir = join(homedir(), '.config', 'claude');
  
  try {
    mkdirSync(configDir, { recursive: true });
    configPath = defaultPath;
    writeFileSync(configPath, JSON.stringify({ mcp: { servers: {} } }, null, 2));
    console.log(`✅ Created new configuration at: ${configPath}`);
  } catch (error) {
    console.error('❌ Failed to create configuration directory');
    console.error('Please create the configuration manually at one of these locations:');
    configPaths.forEach(p => console.log(`  - ${p}`));
    process.exit(1);
  }
}

console.log(`📁 Found Claude Code configuration at: ${configPath}`);

// Read existing config
let config;
try {
  config = JSON.parse(readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('❌ Failed to read configuration file');
  process.exit(1);
}

// Ensure mcp.servers structure exists
if (!config.mcp) config.mcp = {};
if (!config.mcp.servers) config.mcp.servers = {};

// Check if already installed
if (config.mcp.servers['claude-mcp-slack-feedback']) {
  console.log('⚠️  claude-mcp-slack-feedback is already configured');
  console.log('   Current command:', config.mcp.servers['claude-mcp-slack-feedback'].command);
  
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  rl.question('Do you want to update the configuration? (y/n) ', (answer) => {
    rl.close();
    
    if (answer.toLowerCase() !== 'y') {
      console.log('Installation cancelled.');
      process.exit(0);
    }
    
    continueInstallation();
  });
} else {
  continueInstallation();
}

function continueInstallation() {
  // Get the global npm bin directory
  let npmBin;
  try {
    npmBin = execSync('npm bin -g', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.error('❌ Failed to find npm global bin directory');
    process.exit(1);
  }

  const executablePath = join(npmBin, 'claude-mcp-slack-feedback');

  // Add the MCP server configuration
  config.mcp.servers['claude-mcp-slack-feedback'] = {
    command: executablePath
  };

  // Write the updated config
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('\n✅ Successfully configured Claude Code!');
    console.log('\n📋 Configuration added:');
    console.log(JSON.stringify(config.mcp.servers['claude-mcp-slack-feedback'], null, 2));
    console.log('\n🚀 Next steps:');
    console.log('1. Restart Claude Code to activate the MCP server');
    console.log('2. Use the "setup_slack_config" tool to configure your Slack workspace');
    console.log('\nExample:');
    console.log('  Tool: setup_slack_config');
    console.log('  Parameters: {');
    console.log('    "botToken": "xoxb-your-bot-token",');
    console.log('    "workspaceUrl": "yourteam.slack.com"');
    console.log('  }');
  } catch (error) {
    console.error('❌ Failed to write configuration file');
    console.error(error);
    process.exit(1);
  }
}