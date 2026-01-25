# SyntaxisAI Application Assets

This directory contains application assets for the Electron desktop app.

## Required Files

### Icon Files

For the Windows build, you need to provide the following icon files:

1. **icon.png** (512x512 or larger)
   - Used for the application window icon
   - Format: PNG with transparency
   - Minimum size: 512x512 pixels

2. **icon.ico** (256x256 or larger)
   - Used for the Windows installer and taskbar
   - Format: ICO (Windows Icon)
   - Can be generated from icon.png using tools like ImageMagick or online converters

### How to Generate Icons

#### Using ImageMagick (if installed):
```bash
magick convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

#### Using Online Tools:
- Visit https://convertio.co/png-ico/ or similar PNG to ICO converters
- Upload your icon.png file
- Download the generated icon.ico file

#### Using Python:
```python
from PIL import Image
img = Image.open('icon.png')
img.save('icon.ico', sizes=[(256, 256), (128, 128), (96, 96), (64, 64), (48, 48), (32, 32), (16, 16)])
```

## Recommended Icon Design

- Use a simple, recognizable design
- Ensure the icon looks good at small sizes (16x16, 32x32)
- Use a transparent background for PNG
- Include the app name or initials for clarity

## File Structure

```
assets/
├── icon.png          # Main application icon (PNG)
├── icon.ico          # Windows icon file (ICO)
└── README.md         # This file
```

## Notes

- The icon files are required for building the Windows executable
- Without proper icons, the build may fail or the app may not display correctly
- Always test the icons at different sizes to ensure they look good

