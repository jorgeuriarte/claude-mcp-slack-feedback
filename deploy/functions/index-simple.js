#!/usr/bin/env node

/**
 * Cloud Functions entry point - Simplified version
 */

import { http } from '@google-cloud/functions-framework';
import app from './simple-http.js';

// Register the function with the correct name
http('mcp', app);