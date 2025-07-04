#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Files to process
const filesToProcess = [
  '../src/index.ts',
  '../src/slack-client.ts',
  '../src/cloud-polling-client.ts',
  '../src/polling-strategy.ts',
  '../src/health-monitor.ts',
  '../src/polling-manager.ts',
  '../src/session-manager.ts',
  '../src/webhook-server.ts',
  '../src/tunnel-manager.ts',
  '../src/config-manager.ts'
];

function removeConsoleLogs(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  const originalContent = content;
  
  // Replace console.log/error/warn with logger calls
  // Match console.log, console.error, console.warn
  content = content.replace(/console\.(log|error|warn)\s*\(/g, (match, method) => {
    const logMethod = method === 'log' ? 'debug' : method;
    return `logger.${logMethod}(`;
  });
  
  // Check if logger is imported, if not add import
  if (content.includes('logger.') && !content.includes('import { logger }')) {
    // Add import at the beginning after other imports
    const importMatch = content.match(/^((?:import .+;\n)+)/m);
    if (importMatch) {
      content = content.replace(importMatch[0], importMatch[0] + `import { logger } from './logger';\n`);
    } else {
      content = `import { logger } from './logger';\n` + content;
    }
  }
  
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content);
    console.log(`✅ Updated ${filePath}`);
  } else {
    console.log(`⏭️  No changes needed in ${filePath}`);
  }
}

console.log('Removing console.log statements and replacing with logger...\n');

filesToProcess.forEach(file => {
  removeConsoleLogs(file);
});

console.log('\n✅ Done! Remember to rebuild the project.');