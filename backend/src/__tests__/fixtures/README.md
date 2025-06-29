# Test Fixtures

This directory contains test fixtures used in the test suite. These files are used to simulate real-world scenarios and test various aspects of the system.

## File Types

### PDF Invoices
- `valid-invoice.pdf`: A standard, well-formatted invoice PDF
- `invalid-invoice.pdf`: An invoice PDF with formatting issues
- `large-invoice.pdf`: A large invoice PDF (>10MB) for testing file size limits
- `multi-page-invoice.pdf`: A multi-page invoice PDF for testing pagination
- `corrupted-invoice.pdf`: A corrupted PDF file for testing error handling
- `password-protected-invoice.pdf`: A password-protected PDF for testing security

### Image Files
- `valid-invoice.jpg`: A standard invoice image
- `valid-invoice.png`: A standard invoice image in PNG format
- `low-quality-invoice.jpg`: A low-quality invoice image for testing OCR
- `rotated-invoice.jpg`: A rotated invoice image for testing image processing
- `multi-page-invoice.tiff`: A multi-page TIFF file for testing multi-page support

### Test Data
- `test-data.json`: Sample test data for various scenarios
- `validation-rules.json`: Test validation rules
- `templates.json`: Sample invoice templates
- `error-cases.json`: Sample error cases for testing

## Usage

These fixtures are used in various test scenarios:

1. **Unit Tests**
   - Testing file validation
   - Testing OCR processing
   - Testing data extraction
   - Testing template matching

2. **Integration Tests**
   - Testing file upload
   - Testing invoice processing
   - Testing batch operations
   - Testing error handling

3. **E2E Tests**
   - Testing complete user flows
   - Testing system behavior
   - Testing performance
   - Testing error recovery

## Adding New Fixtures

When adding new test fixtures:

1. Use realistic data that represents real-world scenarios
2. Include edge cases and error conditions
3. Document the purpose and expected behavior
4. Keep file sizes reasonable
5. Use appropriate file formats
6. Include metadata if relevant

## Maintenance

- Keep fixtures up to date with system changes
- Remove obsolete fixtures
- Update documentation when adding new fixtures
- Ensure fixtures are properly licensed
- Maintain consistent naming conventions

## Security

- Do not include sensitive data in fixtures
- Use dummy data for testing
- Remove any PII or confidential information
- Use appropriate file permissions
- Follow security best practices

## Notes

- All fixtures should be committed to version control
- Keep file sizes as small as possible while maintaining test effectiveness
- Use consistent naming conventions
- Document any special requirements or dependencies
- Include cleanup procedures if needed 