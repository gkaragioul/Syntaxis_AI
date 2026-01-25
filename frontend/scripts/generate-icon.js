#!/usr/bin/env node

/**
 * Icon Generation Script for SyntaxisAI
 * Generates a simple icon using canvas if available, or provides instructions
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '../assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('SyntaxisAI Icon Generation Script');
console.log('==================================\n');

// Check if canvas is available
let canvasAvailable = false;
try {
  require('canvas');
  canvasAvailable = true;
} catch (e) {
  console.log('Note: canvas module not found. Using fallback method.\n');
}

if (canvasAvailable) {
  generateIconWithCanvas();
} else {
  generateIconWithFallback();
}

function generateIconWithCanvas() {
  try {
    const { createCanvas } = require('canvas');
    
    // Create a 512x512 PNG icon
    const canvas = createCanvas(512, 512);
    const ctx = canvas.getContext('2d');
    
    // Background gradient
    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#667eea');
    gradient.addColorStop(1, '#764ba2');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    
    // Draw rounded rectangle
    const radius = 80;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    roundRect(ctx, 50, 50, 412, 412, radius);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 120px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('S', 256, 256);
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(assetsDir, 'icon.png'), buffer);
    console.log('✓ Generated icon.png (512x512)');
    
    // Note about ICO conversion
    console.log('\nNext steps:');
    console.log('1. Convert icon.png to icon.ico using an online tool:');
    console.log('   https://convertio.co/png-ico/');
    console.log('2. Or use ImageMagick if installed:');
    console.log('   magick convert assets/icon.png -define icon:auto-resize=256,128,96,64,48,32,16 assets/icon.ico');
    
  } catch (error) {
    console.error('Error generating icon with canvas:', error.message);
    generateIconWithFallback();
  }
}

function generateIconWithFallback() {
  console.log('Icon Generation Instructions');
  console.log('============================\n');
  
  console.log('To create icons for SyntaxisAI, follow these steps:\n');
  
  console.log('Option 1: Using an Online Tool (Easiest)');
  console.log('1. Visit: https://www.favicon-generator.org/');
  console.log('2. Upload or create a simple icon (e.g., with letter "S")');
  console.log('3. Download the icon files');
  console.log('4. Place icon.png and icon.ico in the assets/ directory\n');
  
  console.log('Option 2: Using ImageMagick');
  console.log('1. Install ImageMagick: https://imagemagick.org/');
  console.log('2. Create a 512x512 PNG image (icon.png)');
  console.log('3. Run: magick convert assets/icon.png -define icon:auto-resize=256,128,96,64,48,32,16 assets/icon.ico\n');
  
  console.log('Option 3: Using Python PIL');
  console.log('1. Install Pillow: pip install Pillow');
  console.log('2. Create a Python script to generate the icon');
  console.log('3. Save as icon.png and icon.ico\n');
  
  console.log('Required Files:');
  console.log('- assets/icon.png (512x512 or larger, PNG format)');
  console.log('- assets/icon.ico (256x256 or larger, ICO format)\n');
  
  console.log('After creating the icons, run:');
  console.log('npm run electron:build:portable\n');
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

console.log('\nFor more information, see: assets/README.md');

