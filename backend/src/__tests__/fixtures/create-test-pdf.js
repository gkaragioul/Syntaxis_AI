/**
 * Create Test PDF Files
 * 
 * This script creates test PDF files for testing file upload and OCR functionality.
 */

const fs = require('fs');
const path = require('path');

// Simple PDF content with basic structure
const createSimplePDF = () => {
  return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
  >>
>>
>>
endobj

4 0 obj
<<
/Length 100
>>
stream
BT
/F1 12 Tf
50 750 Td
(INVOICE) Tj
0 -20 Td
(Invoice Number: INV-001) Tj
0 -20 Td
(Date: 2024-01-15) Tj
0 -20 Td
(Amount: $1,000.00) Tj
0 -20 Td
(Vendor: Test Company Inc.) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000274 00000 n 
0000000526 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
623
%%EOF`;
};

// Create test invoice PDF with more realistic content
const createInvoicePDF = () => {
  return `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
  /Font <<
    /F1 5 0 R
    /F2 6 0 R
  >>
>>
>>
endobj

4 0 obj
<<
/Length 400
>>
stream
BT
/F2 16 Tf
50 750 Td
(INVOICE) Tj
/F1 12 Tf
0 -30 Td
(Invoice Number: INV-2024-001) Tj
0 -20 Td
(Date: January 15, 2024) Tj
0 -20 Td
(Due Date: February 15, 2024) Tj
0 -40 Td
(Bill To:) Tj
0 -20 Td
(Test Customer Inc.) Tj
0 -15 Td
(123 Customer Street) Tj
0 -15 Td
(Customer City, CC 12345) Tj
0 -40 Td
(From:) Tj
0 -20 Td
(Test Vendor LLC) Tj
0 -15 Td
(456 Vendor Avenue) Tj
0 -15 Td
(Vendor City, VC 67890) Tj
0 -40 Td
(Description: Professional Services) Tj
0 -20 Td
(Quantity: 10 hours) Tj
0 -20 Td
(Rate: $100.00/hour) Tj
0 -20 Td
(Subtotal: $1,000.00) Tj
0 -20 Td
(Tax (8.5%): $85.00) Tj
/F2 12 Tf
0 -20 Td
(Total: $1,085.00) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

6 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica-Bold
>>
endobj

xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000295 00000 n 
0000000747 00000 n 
0000000844 00000 n 
trailer
<<
/Size 7
/Root 1 0 R
>>
startxref
946
%%EOF`;
};

// Create corrupted PDF for error testing
const createCorruptedPDF = () => {
  return `%PDF-1.4
This is not a valid PDF file content.
It should cause parsing errors.
CORRUPTED DATA HERE
%%EOF`;
};

// Create large PDF content for size testing
const createLargePDF = () => {
  let content = createInvoicePDF();
  // Repeat content to make it larger
  const largeContent = 'A'.repeat(1024 * 1024); // 1MB of 'A' characters
  content = content.replace('endstream', largeContent + '\nendstream');
  return content;
};

// Main function to create all test files
const createTestFiles = () => {
  const fixturesDir = __dirname;
  
  // Create test files
  const files = [
    { name: 'test-invoice.pdf', content: createSimplePDF() },
    { name: 'detailed-invoice.pdf', content: createInvoicePDF() },
    { name: 'corrupted.pdf', content: createCorruptedPDF() },
    { name: 'large-invoice.pdf', content: createLargePDF() }
  ];

  files.forEach(file => {
    const filePath = path.join(fixturesDir, file.name);
    fs.writeFileSync(filePath, file.content);
    console.log(`Created: ${file.name} (${file.content.length} bytes)`);
  });

  // Create a non-PDF file for testing file type validation
  const textFilePath = path.join(fixturesDir, 'not-a-pdf.txt');
  fs.writeFileSync(textFilePath, 'This is a text file, not a PDF.');
  console.log(`Created: not-a-pdf.txt`);

  // Create an empty file for testing
  const emptyFilePath = path.join(fixturesDir, 'empty.pdf');
  fs.writeFileSync(emptyFilePath, '');
  console.log(`Created: empty.pdf`);

  console.log('\nAll test fixture files created successfully!');
  console.log(`Location: ${fixturesDir}`);
};

// Run if called directly
if (require.main === module) {
  createTestFiles();
}

module.exports = {
  createSimplePDF,
  createInvoicePDF,
  createCorruptedPDF,
  createLargePDF,
  createTestFiles
};
