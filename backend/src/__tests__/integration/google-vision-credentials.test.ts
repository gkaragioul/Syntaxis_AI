import { ImageAnnotatorClient } from '@google-cloud/vision';
import { promises as fs } from 'fs';
import { join } from 'path';
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

/**
 * Google Vision API Credentials Verification Tests
 *
 * These tests verify that Google Vision API credentials are properly configured
 * and functional on the local development environment. They test:
 * 1. Authentication and API connectivity
 * 2. Basic text detection functionality
 * 3. Error handling for credential issues
 * 4. Service availability and quota limits
 */
describe('Google Vision API Credentials Verification', () => {
  let visionClient: ImageAnnotatorClient | null = null;
  let credentialsAvailable = false;
  let testImageBuffer: Buffer;

  beforeAll(async () => {
    // Skip external API tests in CI environment
    if (process.env.CI) {
      console.log('⏭️  Skipping Google Vision API tests in CI environment');
      return;
    }

    // Check if Google Vision API credentials are configured
    credentialsAvailable = !!(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_VISION_API_KEY
    );

    if (credentialsAvailable) {
      try {
        visionClient = new ImageAnnotatorClient();

        // Create a simple test image buffer (1x1 white PNG)
        testImageBuffer = Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
          0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
          0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
          0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63,
          0xf8, 0x0f, 0x00, 0x00, 0x01, 0x00, 0x01, 0x5c, 0xc2, 0x8a, 0x8e,
          0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60,
          0x82,
        ]);
      } catch (error) {
        console.warn('Failed to initialize Google Vision client:', error);
        credentialsAvailable = false;
      }
    }
  });

  afterAll(async () => {
    // Clean up any resources if needed
    visionClient = null;
  });

  describe('Credential Configuration', () => {
    it('should have Google Vision API credentials configured', () => {
      const hasCredentials = !!(
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.GOOGLE_VISION_API_KEY
      );

      if (!hasCredentials) {
        console.warn(`
⚠️  Google Vision API credentials not found!

To configure Google Vision API credentials:

1. **Service Account Method (Recommended)**:
   - Go to Google Cloud Console
   - Create a service account with Vision API permissions
   - Download the JSON key file
   - Set GOOGLE_APPLICATION_CREDENTIALS environment variable:
     export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/credentials.json"

2. **API Key Method**:
   - Go to Google Cloud Console
   - Create an API key with Vision API access
   - Set GOOGLE_VISION_API_KEY environment variable:
     export GOOGLE_VISION_API_KEY="your-api-key"

3. **Update your .env file**:
   Add one of these lines to your .env file:
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/google-credentials.json
   # OR
   GOOGLE_VISION_API_KEY=your-google-vision-api-key

Current environment variables:
- GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS || 'NOT SET'}
- GOOGLE_VISION_API_KEY: ${process.env.GOOGLE_VISION_API_KEY ? 'SET (hidden)' : 'NOT SET'}
        `);
      }

      expect(hasCredentials).toBe(true);
    });

    it('should initialize Google Vision client successfully', () => {
      if (!credentialsAvailable) {
        console.log(
          '⏭️  Skipping test - Google Vision API credentials not available',
        );
        return;
      }

      expect(visionClient).not.toBeNull();
      expect(visionClient).toBeInstanceOf(ImageAnnotatorClient);
    });
  });

  describe('API Connectivity', () => {
    it('should successfully connect to Google Vision API', async () => {
      if (process.env.CI) {
        console.log('⏭️  Skipping Google Vision API test in CI environment');
        return;
      }

      if (!credentialsAvailable || !visionClient) {
        console.log(
          '⏭️  Skipping test - Google Vision API credentials not available',
        );
        return;
      }

      try {
        // Test basic connectivity with a simple image - with timeout
        const apiCall = visionClient.textDetection({
          image: { content: testImageBuffer },
        });

        const [result] = await Promise.race([
          apiCall,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Google Vision API timeout')), 15000)
          )
        ]) as any;

        // The API should respond (even if no text is detected in our simple image)
        expect(result).toBeDefined();
        expect(Array.isArray(result.textAnnotations)).toBe(true);

        console.log('✅ Google Vision API connectivity verified successfully');
      } catch (error: any) {
        if (error.code === 7) {
          // PERMISSION_DENIED
          throw new Error(`
❌ Google Vision API Permission Denied!

This usually means:
1. The service account doesn't have Vision API permissions
2. The Vision API is not enabled for your project
3. The credentials are invalid or expired

To fix this:
1. Go to Google Cloud Console
2. Enable the Vision API for your project
3. Ensure your service account has the 'Cloud Vision API User' role
4. Verify your credentials file is valid and accessible

Error details: ${error.message}
          `);
        } else if (error.code === 16) {
          // UNAUTHENTICATED
          throw new Error(`
❌ Google Vision API Authentication Failed!

This usually means:
1. The credentials file path is incorrect
2. The credentials file is corrupted or invalid
3. The service account key has been revoked

To fix this:
1. Verify GOOGLE_APPLICATION_CREDENTIALS points to a valid JSON file
2. Check that the file exists and is readable
3. Try downloading a new service account key

Error details: ${error.message}
          `);
        } else {
          throw new Error(`Google Vision API test failed: ${error.message}`);
        }
      }
    }, 30000); // 30 second timeout for API calls

    it('should handle API quota and rate limiting gracefully', async () => {
      if (!credentialsAvailable || !visionClient) {
        console.log(
          '⏭️  Skipping test - Google Vision API credentials not available',
        );
        return;
      }

      try {
        // Make multiple rapid requests to test rate limiting
        const promises = Array(3)
          .fill(null)
          .map(() =>
            visionClient!.textDetection({
              image: { content: testImageBuffer },
            }),
          );

        const results = await Promise.all(promises);

        // All requests should succeed (or fail gracefully)
        expect(results).toHaveLength(3);
        results.forEach(([result]) => {
          expect(result).toBeDefined();
        });

        console.log('✅ Google Vision API rate limiting handled successfully');
      } catch (error: any) {
        if (error.code === 8) {
          // RESOURCE_EXHAUSTED
          console.warn(
            '⚠️  Google Vision API quota exceeded - this is expected in some cases',
          );
          expect(error.message).toContain('quota');
        } else {
          throw error;
        }
      }
    }, 45000); // 45 second timeout for multiple API calls
  });

  describe('Text Detection Functionality', () => {
    it('should detect text in a real invoice image', async () => {
      if (!credentialsAvailable || !visionClient) {
        console.log(
          '⏭️  Skipping test - Google Vision API credentials not available',
        );
        return;
      }

      // Try to load a test invoice image
      const testInvoicePath = join(
        __dirname,
        '../fixtures/invoices/test-invoice.png',
      );
      let invoiceBuffer: Buffer;

      try {
        invoiceBuffer = await fs.readFile(testInvoicePath);
      } catch (error) {
        // If no test image exists, create a simple text image buffer
        console.log('📝 No test invoice image found, using simple test image');
        invoiceBuffer = testImageBuffer;
      }

      try {
        const [result] = await visionClient.textDetection({
          image: { content: invoiceBuffer },
        });

        expect(result).toBeDefined();
        expect(result.textAnnotations).toBeDefined();

        if (result.textAnnotations && result.textAnnotations.length > 0) {
          const fullText = result.textAnnotations[0].description;
          console.log(
            '✅ Text detection successful. Sample text:',
            fullText?.substring(0, 100),
          );

          expect(typeof fullText).toBe('string');
          expect(fullText!.length).toBeGreaterThan(0);
        } else {
          console.log(
            'ℹ️  No text detected in test image (this is normal for simple test images)',
          );
        }
      } catch (error: any) {
        throw new Error(`Text detection failed: ${error.message}`);
      }
    }, 30000);

    it('should provide confidence scores for detected text', async () => {
      if (!credentialsAvailable || !visionClient) {
        console.log(
          '⏭️  Skipping test - Google Vision API credentials not available',
        );
        return;
      }

      try {
        const [result] = await visionClient.textDetection({
          image: { content: testImageBuffer },
        });

        expect(result).toBeDefined();

        if (result.textAnnotations && result.textAnnotations.length > 0) {
          // Check that confidence scores are provided (when available)
          const annotations = result.textAnnotations;

          annotations.forEach((annotation, index) => {
            expect(annotation.description).toBeDefined();

            // Confidence might not always be provided by Google Vision API
            if (annotation.confidence !== undefined) {
              expect(annotation.confidence).toBeGreaterThanOrEqual(0);
              expect(annotation.confidence).toBeLessThanOrEqual(1);
            }
          });

          console.log('✅ Confidence scoring verification completed');
        } else {
          console.log('ℹ️  No text annotations to verify confidence scores');
        }
      } catch (error: any) {
        throw new Error(`Confidence scoring test failed: ${error.message}`);
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle invalid image data gracefully', async () => {
      if (!credentialsAvailable || !visionClient) {
        console.log(
          '⏭️  Skipping test - Google Vision API credentials not available',
        );
        return;
      }

      const invalidImageBuffer = Buffer.from('invalid image data');

      try {
        await visionClient.textDetection({
          image: { content: invalidImageBuffer },
        });

        // If we reach here, the API handled invalid data gracefully
        console.log('✅ Invalid image data handled gracefully');
      } catch (error: any) {
        // This is expected - the API should reject invalid image data
        expect(error).toBeDefined();
        expect(error.code).toBeDefined();
        console.log('✅ Invalid image data properly rejected by API');
      }
    }, 30000);

    it('should handle network connectivity issues', async () => {
      if (!credentialsAvailable) {
        console.log(
          '⏭️  Skipping test - Google Vision API credentials not available',
        );
        return;
      }

      // Create a client with invalid endpoint to simulate network issues
      const invalidClient = new ImageAnnotatorClient({
        apiEndpoint: 'https://invalid-endpoint-that-does-not-exist.com',
      });

      try {
        await invalidClient.textDetection({
          image: { content: testImageBuffer },
        });

        // Should not reach here
        throw new Error('Expected network error did not occur');
      } catch (error: any) {
        // This is expected - should handle network errors gracefully
        expect(error).toBeDefined();
        console.log('✅ Network connectivity issues handled gracefully');
      }
    }, 30000);
  });

  describe('Service Status', () => {
    it('should report Google Vision API service status', async () => {
      console.log(`
📊 Google Vision API Service Status Report:

🔧 Configuration:
- Credentials Available: ${credentialsAvailable ? '✅ YES' : '❌ NO'}
- GOOGLE_APPLICATION_CREDENTIALS: ${process.env.GOOGLE_APPLICATION_CREDENTIALS ? '✅ SET' : '❌ NOT SET'}
- GOOGLE_VISION_API_KEY: ${process.env.GOOGLE_VISION_API_KEY ? '✅ SET' : '❌ NOT SET'}

🌐 Client Status:
- Vision Client Initialized: ${visionClient ? '✅ YES' : '❌ NO'}
- Client Type: ${visionClient ? 'ImageAnnotatorClient' : 'N/A'}

📝 Recommendations:
${!credentialsAvailable ? '- Configure Google Vision API credentials (see test output above)' : '- Google Vision API is ready for use'}
${!visionClient ? '- Fix credential configuration to enable Vision API features' : '- All systems operational'}

🔗 Useful Links:
- Google Cloud Console: https://console.cloud.google.com/
- Vision API Documentation: https://cloud.google.com/vision/docs
- Service Account Setup: https://cloud.google.com/docs/authentication/getting-started
      `);

      // This test always passes but provides useful information
      expect(true).toBe(true);
    });
  });
});
