# Google Vision API Setup Guide

This guide will help you set up Google Vision API credentials for the SyntaxisAI OCR system.

## 🎯 Overview

Google Vision API provides advanced OCR capabilities that complement our Tesseract.js implementation. The system uses a multi-engine fallback approach where Google Vision API serves as a high-accuracy fallback when Tesseract confidence is low.

## 📋 Prerequisites

1. Google Cloud Platform account
2. Billing enabled on your GCP project
3. Vision API enabled for your project

## 🔧 Setup Methods

### Method 1: Service Account (Recommended for Production)

#### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your Project ID

#### Step 2: Enable Vision API
1. In the Google Cloud Console, go to **APIs & Services > Library**
2. Search for "Cloud Vision API"
3. Click on it and press **Enable**

#### Step 3: Create Service Account
1. Go to **IAM & Admin > Service Accounts**
2. Click **Create Service Account**
3. Fill in the details:
   - **Name**: `syntaxis-vision-api`
   - **Description**: `Service account for SyntaxisAI Vision API access`
4. Click **Create and Continue**

#### Step 4: Assign Roles
1. Add the following role:
   - **Cloud Vision API User**
2. Click **Continue** and then **Done**

#### Step 5: Create and Download Key
1. Find your service account in the list
2. Click on it to open details
3. Go to **Keys** tab
4. Click **Add Key > Create New Key**
5. Choose **JSON** format
6. Download the key file
7. Save it securely (e.g., `~/credentials/syntaxis-vision-credentials.json`)

#### Step 6: Set Environment Variable
Add to your `.env` file:
```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/syntaxis-vision-credentials.json
```

### Method 2: API Key (Simpler for Development)

#### Step 1-2: Same as Method 1

#### Step 3: Create API Key
1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > API Key**
3. Copy the generated API key
4. (Optional) Restrict the key to Vision API only

#### Step 4: Set Environment Variable
Add to your `.env` file:
```bash
GOOGLE_VISION_API_KEY=your-api-key-here
```

## 🧪 Verification

### Run the Credential Verification Test
```bash
npm test -- --testPathPattern=google-vision-credentials.test.ts --verbose
```

### Expected Output (Success)
```
✅ Google Vision API credentials configured
✅ Vision client initialized successfully  
✅ API connectivity verified
✅ Text detection working
✅ Error handling functional
```

### Expected Output (Not Configured)
```
❌ Google Vision API credentials not found!
⏭️ Skipping tests - credentials not available
```

## 🔍 Testing with Sample Invoice

Once credentials are configured, test with a real invoice:

```bash
# Test with our sample invoice image
npm test -- --testPathPattern=google-vision-credentials.test.ts --verbose
```

The test will:
1. ✅ Verify credentials are configured
2. ✅ Initialize Google Vision client
3. ✅ Test API connectivity
4. ✅ Process sample invoice image
5. ✅ Verify text detection accuracy
6. ✅ Test error handling scenarios

## 🚨 Troubleshooting

### Common Issues

#### 1. Permission Denied (Error Code 7)
```
❌ Google Vision API Permission Denied!
```
**Solution**: 
- Ensure Vision API is enabled for your project
- Verify service account has "Cloud Vision API User" role
- Check project billing is enabled

#### 2. Authentication Failed (Error Code 16)
```
❌ Google Vision API Authentication Failed!
```
**Solution**:
- Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Check the JSON file exists and is readable
- Ensure the service account key hasn't been revoked

#### 3. Quota Exceeded (Error Code 8)
```
⚠️ Google Vision API quota exceeded
```
**Solution**:
- Check your API usage in Google Cloud Console
- Increase quotas if needed
- Implement rate limiting in your application

#### 4. Network Issues
```
❌ Network connectivity issues
```
**Solution**:
- Check internet connection
- Verify firewall settings
- Test with `curl` to Google APIs

### Debug Commands

#### Check Environment Variables
```bash
echo $GOOGLE_APPLICATION_CREDENTIALS
echo $GOOGLE_VISION_API_KEY
```

#### Verify JSON Key File
```bash
cat $GOOGLE_APPLICATION_CREDENTIALS | jq .
```

#### Test API Access (with curl)
```bash
# Using service account
gcloud auth activate-service-account --key-file=$GOOGLE_APPLICATION_CREDENTIALS
gcloud auth print-access-token

# Using API key
curl -X POST \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json; charset=utf-8" \
  "https://vision.googleapis.com/v1/images:annotate" \
  -d '{"requests":[{"image":{"content":"base64-encoded-image"},"features":[{"type":"TEXT_DETECTION"}]}]}'
```

## 📊 Cost Considerations

### Google Vision API Pricing (as of 2024)
- **Text Detection**: $1.50 per 1,000 images
- **First 1,000 images per month**: Free
- **Document Text Detection**: $1.50 per 1,000 images

### Cost Optimization Tips
1. **Use fallback strategy**: Only call Google Vision when Tesseract confidence is low
2. **Implement caching**: Cache results for identical images
3. **Batch processing**: Process multiple images in single requests when possible
4. **Monitor usage**: Set up billing alerts in Google Cloud Console

## 🔐 Security Best Practices

### Service Account Security
1. **Principle of least privilege**: Only grant Vision API User role
2. **Rotate keys regularly**: Create new keys every 90 days
3. **Secure storage**: Never commit keys to version control
4. **Environment isolation**: Use different service accounts for dev/staging/prod

### API Key Security
1. **Restrict by API**: Limit to Vision API only
2. **Restrict by referrer**: Add domain restrictions
3. **Monitor usage**: Set up usage alerts
4. **Rotate regularly**: Generate new keys periodically

## 🔄 Integration with SyntaxisAI

### Multi-Engine Fallback
The system automatically uses Google Vision API when:
- Tesseract confidence < 70% (configurable)
- Tesseract processing fails
- Tesseract returns empty results

### Configuration Options
```typescript
const ocrConfig = {
  engine: 'tesseract', // Primary engine
  fallback: {
    enabled: true,
    primaryEngine: 'tesseract',
    fallbackEngine: 'google-vision',
    confidenceThreshold: 0.7,
    fallbackConditions: {
      lowConfidence: true,
      processingError: true,
      emptyResult: true,
    },
  },
};
```

## 📈 Monitoring and Analytics

### Performance Metrics
The system tracks:
- API response times
- Confidence scores
- Fallback frequency
- Error rates
- Cost per document

### Monitoring Dashboard
Access metrics at: `http://localhost:3000/admin/ocr-metrics`

## 🆘 Support

### Getting Help
1. **Documentation**: [Google Vision API Docs](https://cloud.google.com/vision/docs)
2. **Community**: [Stack Overflow](https://stackoverflow.com/questions/tagged/google-cloud-vision)
3. **Support**: [Google Cloud Support](https://cloud.google.com/support)

### SyntaxisAI Specific Issues
1. Check the test output for specific error messages
2. Review logs in `backend/logs/`
3. Run diagnostic tests: `npm run test:ocr-diagnostics`
