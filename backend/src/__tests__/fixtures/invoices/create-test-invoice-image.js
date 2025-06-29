const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Creates a simple test invoice image for Google Vision API testing
 */
async function createTestInvoiceImage() {
  const invoiceText = `
INVOICE

Invoice Number: INV-2024-001
Date: December 15, 2024
Due Date: January 15, 2025

Bill To:
Test Company Inc.
123 Main Street
Anytown, ST 12345

Description                 Qty    Price    Total
Web Development Services     1    $1,250.00  $1,250.00
Hosting Setup               1      $150.00    $150.00
                                            --------
                           Subtotal:       $1,400.00
                           Tax (8.5%):       $119.00
                           TOTAL:          $1,519.00

Payment Terms: Net 30
Thank you for your business!
  `.trim();

  try {
    // Create a simple white background image with text
    const width = 600;
    const height = 800;
    
    // Create SVG with the invoice text
    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        <text x="50" y="50" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="black">INVOICE</text>
        <text x="50" y="100" font-family="Arial, sans-serif" font-size="14" fill="black">Invoice Number: INV-2024-001</text>
        <text x="50" y="120" font-family="Arial, sans-serif" font-size="14" fill="black">Date: December 15, 2024</text>
        <text x="50" y="140" font-family="Arial, sans-serif" font-size="14" fill="black">Due Date: January 15, 2025</text>
        
        <text x="50" y="180" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="black">Bill To:</text>
        <text x="50" y="200" font-family="Arial, sans-serif" font-size="14" fill="black">Test Company Inc.</text>
        <text x="50" y="220" font-family="Arial, sans-serif" font-size="14" fill="black">123 Main Street</text>
        <text x="50" y="240" font-family="Arial, sans-serif" font-size="14" fill="black">Anytown, ST 12345</text>
        
        <text x="50" y="300" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="black">Description</text>
        <text x="300" y="300" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="black">Qty</text>
        <text x="350" y="300" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="black">Price</text>
        <text x="450" y="300" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="black">Total</text>
        
        <line x1="50" y1="310" x2="550" y2="310" stroke="black" stroke-width="1"/>
        
        <text x="50" y="330" font-family="Arial, sans-serif" font-size="12" fill="black">Web Development Services</text>
        <text x="300" y="330" font-family="Arial, sans-serif" font-size="12" fill="black">1</text>
        <text x="350" y="330" font-family="Arial, sans-serif" font-size="12" fill="black">$1,250.00</text>
        <text x="450" y="330" font-family="Arial, sans-serif" font-size="12" fill="black">$1,250.00</text>
        
        <text x="50" y="350" font-family="Arial, sans-serif" font-size="12" fill="black">Hosting Setup</text>
        <text x="300" y="350" font-family="Arial, sans-serif" font-size="12" fill="black">1</text>
        <text x="350" y="350" font-family="Arial, sans-serif" font-size="12" fill="black">$150.00</text>
        <text x="450" y="350" font-family="Arial, sans-serif" font-size="12" fill="black">$150.00</text>
        
        <line x1="400" y1="370" x2="550" y2="370" stroke="black" stroke-width="1"/>
        
        <text x="350" y="390" font-family="Arial, sans-serif" font-size="12" fill="black">Subtotal:</text>
        <text x="450" y="390" font-family="Arial, sans-serif" font-size="12" fill="black">$1,400.00</text>
        
        <text x="350" y="410" font-family="Arial, sans-serif" font-size="12" fill="black">Tax (8.5%):</text>
        <text x="450" y="410" font-family="Arial, sans-serif" font-size="12" fill="black">$119.00</text>
        
        <text x="350" y="430" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="black">TOTAL:</text>
        <text x="450" y="430" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="black">$1,519.00</text>
        
        <text x="50" y="480" font-family="Arial, sans-serif" font-size="12" fill="black">Payment Terms: Net 30</text>
        <text x="50" y="500" font-family="Arial, sans-serif" font-size="12" fill="black">Thank you for your business!</text>
      </svg>
    `;

    // Convert SVG to PNG
    const outputPath = path.join(__dirname, 'test-invoice.png');
    
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log(`✅ Test invoice image created: ${outputPath}`);
    
    // Also create a JPEG version
    const jpegPath = path.join(__dirname, 'test-invoice.jpg');
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 90 })
      .toFile(jpegPath);

    console.log(`✅ Test invoice JPEG created: ${jpegPath}`);

    return { pngPath: outputPath, jpegPath };
  } catch (error) {
    console.error('❌ Failed to create test invoice image:', error);
    throw error;
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  createTestInvoiceImage()
    .then(() => {
      console.log('🎉 Test invoice images created successfully!');
    })
    .catch((error) => {
      console.error('💥 Failed to create test invoice images:', error);
      process.exit(1);
    });
}

module.exports = { createTestInvoiceImage };
