#!/usr/bin/env node

/**
 * Cloud Functions entry point - Simplified version
 */

import { http } from '@google-cloud/functions-framework';
import app from './mcp-wrapper.js';

// Export the Express app as the Cloud Function
http('mcp', app);