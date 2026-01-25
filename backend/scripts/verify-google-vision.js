#!/usr/bin/env node

/**
 * Google Vision API Verification Script
 * 
 * This script verifies that Google Vision API credentials are properly configured
 * and functional for the SyntaxisAI system.
 */

const { ImageAnnotatorClient } = require('@google-cloud/vision');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

async function checkEnvironmentVariables() {
  log('\n📋 Checking Environment Variables...', 'cyan');
  
  const hasServiceAccount = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasApiKey = !!process.env.GOOGLE_VISION_API_KEY;
  
  if (hasServiceAccount) {
    logSuccess(`GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);
    
    // Check if file exists
    if (fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
      logSuccess('Service account file exists');
      
      // Check if file is readable
      try {
        const content = fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8');
        const parsed = JSON.parse(content);
        
        if (parsed.type === 'service_account') {
          logSuccess('Valid service account JSON format');
          logInfo(`Project ID: ${parsed.project_id}`);
          logInfo(`Client Email: ${parsed.client_email}`);
        } else {
          logError('Invalid service account format');
          return false;
        }
      } catch (error) {
        logError(`Cannot read service account file: ${error.message}`);
        return false;
      }
    } else {
      logError('Service account file does not exist');
      return false;
    }
  } else if (hasApiKey) {
    logSuccess('GOOGLE_VISION_API_KEY: [CONFIGURED]');
  } else {
    logError('No Google Vision API credentials found');
    log('\n📖 Setup Instructions:', 'yellow');
    log('1. Service Account Method (Recommended):');
    log('   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/credentials.json"');
    log('2. API Key Method:');
    log('   export GOOGLE_VISION_API_KEY="your-api-key"');
    log('\n📚 See docs/google-vision-setup.md for detailed instructions');
    return false;
  }
  
  return true;
}

async function testVisionClient() {
  log('\n🔧 Testing Google Vision Client...', 'cyan');
  
  try {
    const client = new ImageAnnotatorClient();
    logSuccess('Google Vision client initialized successfully');
    return client;
  } catch (error) {
    logError(`Failed to initialize Google Vision client: ${error.message}`);
    return null;
  }
}

async function testApiConnectivity(client) {
  log('\n🌐 Testing API Connectivity...', 'cyan');
  
  // Create a simple 1x1 white PNG for testing
  const testImageBuffer = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00,
    0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x5C, 0xC2, 0x8A, 0x8E, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  
  try {
    const [result] = await client.textDetection({
      image: { content: testImageBuffer },
    });
    
    logSuccess('API connectivity test passed');
    logInfo('Google Vision API is responding correctly');
    return true;
  } catch (error) {
    if (error.code === 7) { // PERMISSION_DENIED
      logError('Permission denied - check API is enabled and service account has correct roles');
      log('💡 Solutions:', 'yellow');
      log('   1. Enable Vision API in Google Cloud Console');
      log('   2. Add "Cloud Vision API User" role to service account');
      log('   3. Ensure billing is enabled for your project');
    } else if (error.code === 16) { // UNAUTHENTICATED
      logError('Authentication failed - check credentials');
      log('💡 Solutions:', 'yellow');
      log('   1. Verify GOOGLE_APPLICATION_CREDENTIALS path');
      log('   2. Check service account key is valid');
      log('   3. Ensure key file is readable');
    } else if (error.code === 8) { // RESOURCE_EXHAUSTED
      logWarning('API quota exceeded - this may be temporary');
      log('💡 Solutions:', 'yellow');
      log('   1. Check quota usage in Google Cloud Console');
      log('   2. Wait for quota reset or request increase');
    } else {
      logError(`API connectivity test failed: ${error.message}`);
    }
    return false;
  }
}

async function testWithSampleInvoice(client) {
  log('\n📄 Testing with Sample Invoice...', 'cyan');
  
  const sampleInvoicePath = path.join(__dirname, '../src/__tests__/fixtures/invoices/test-invoice.png');
  
  if (!fs.existsSync(sampleInvoicePath)) {
    logWarning('Sample invoice image not found, skipping this test');
    logInfo('Run: cd src/__tests__/fixtures/invoices && node create-test-invoice-image.js');
    return true;
  }
  
  try {
    const imageBuffer = fs.readFileSync(sampleInvoicePath);
    const [result] = await client.textDetection({
      image: { content: imageBuffer },
    });
    
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      const detectedText = result.textAnnotations[0].description;
      logSuccess('Text detection successful');
      logInfo(`Detected text preview: "${detectedText.substring(0, 50)}..."`);
      
      // Check for expected invoice content
      const expectedTerms = ['INVOICE', 'INV-2024-001', '$1,519.00'];
      const foundTerms = expectedTerms.filter(term => detectedText.includes(term));
      
      if (foundTerms.length > 0) {
        logSuccess(`Found expected invoice terms: ${foundTerms.join(', ')}`);
      } else {
        logWarning('Expected invoice terms not detected - may need image quality improvement');
      }
    } else {
      logWarning('No text detected in sample invoice');
    }
    
    return true;
  } catch (error) {
    logError(`Sample invoice test failed: ${error.message}`);
    return false;
  }
}

function generateReport(results) {
  log('\n📊 Google Vision API Verification Report', 'magenta');
  log('='.repeat(50), 'magenta');
  
  const { envCheck, clientInit, apiConnectivity, sampleTest } = results;
  
  log(`Environment Variables: ${envCheck ? '✅ PASS' : '❌ FAIL'}`);
  log(`Client Initialization: ${clientInit ? '✅ PASS' : '❌ FAIL'}`);
  log(`API Connectivity: ${apiConnectivity ? '✅ PASS' : '❌ FAIL'}`);
  log(`Sample Invoice Test: ${sampleTest ? '✅ PASS' : '⚠️  SKIP'}`);
  
  const overallStatus = envCheck && clientInit && apiConnectivity;
  
  log('\n🎯 Overall Status:', 'cyan');
  if (overallStatus) {
    logSuccess('Google Vision API is properly configured and functional!');
    log('\n🚀 Next Steps:', 'green');
    log('   1. Run the full test suite: npm test -- --testPathPattern=google-vision-credentials.test.ts');
    log('   2. Test OCR processing: npm test -- --testPathPattern=ocr.service.test.ts');
    log('   3. Try the multi-engine fallback system');
  } else {
    logError('Google Vision API setup needs attention');
    log('\n🔧 Next Steps:', 'yellow');
    log('   1. Follow the setup guide: docs/google-vision-setup.md');
    log('   2. Fix the failing checks above');
    log('   3. Re-run this verification script');
  }
  
  log('\n📚 Resources:', 'blue');
  log('   • Setup Guide: docs/google-vision-setup.md');
  log('   • Google Cloud Console: https://console.cloud.google.com/');
  log('   • Vision API Docs: https://cloud.google.com/vision/docs');
  
  return overallStatus;
}

async function main() {
  log('🔍 Google Vision API Verification Script', 'bright');
  log('This script will verify your Google Vision API setup for SyntaxisAI\n');
  
  const results = {
    envCheck: false,
    clientInit: false,
    apiConnectivity: false,
    sampleTest: false,
  };
  
  try {
    // Step 1: Check environment variables
    results.envCheck = await checkEnvironmentVariables();
    
    if (!results.envCheck) {
      generateReport(results);
      process.exit(1);
    }
    
    // Step 2: Test client initialization
    const client = await testVisionClient();
    results.clientInit = !!client;
    
    if (!client) {
      generateReport(results);
      process.exit(1);
    }
    
    // Step 3: Test API connectivity
    results.apiConnectivity = await testApiConnectivity(client);
    
    // Step 4: Test with sample invoice (optional)
    if (results.apiConnectivity) {
      results.sampleTest = await testWithSampleInvoice(client);
    }
    
    // Generate final report
    const success = generateReport(results);
    process.exit(success ? 0 : 1);
    
  } catch (error) {
    logError(`Verification script failed: ${error.message}`);
    log('\n🐛 Debug Information:', 'yellow');
    log(`Error stack: ${error.stack}`);
    process.exit(1);
  }
}

// Run the verification
if (require.main === module) {
  main();
}

module.exports = { main };
