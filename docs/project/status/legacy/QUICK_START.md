# 🚀 SyntaxisAI - Quick Start Guide

## ⚡ 30-Second Setup

### Step 1: Run the App
```
Double-click: frontend/dist-app-build/win-unpacked/SyntaxisAI.exe
```

### Step 2: See Sample Data
The app automatically loads with 3 sample invoices:
- Acme Corporation ($1,100)
- Tech Solutions Inc ($2,750)
- Office Supplies Ltd ($385)

### Step 3: Start Using
- View invoices in the list
- Click on any invoice to see details
- Upload a PDF to create a new invoice
- Export to CSV or PDF

---

## 📋 FEATURES AT A GLANCE

| Feature | Status | How to Use |
|---------|--------|-----------|
| View Invoices | ✅ | Click "Invoice List" in sidebar |
| Upload PDF | ✅ | Go to "Invoice Processor" → Drop PDF |
| Extract Text | ✅ | Upload PDF → OCR runs automatically |
| View Details | ✅ | Click any invoice in list |
| Export CSV | ✅ | Click invoice → "Export to CSV" |
| Export PDF | ✅ | Click invoice → "Export to PDF" |
| Batch Export | ✅ | Select multiple → "Export Selected" |
| Delete Invoice | ✅ | Click invoice → "Delete" |

---

## 📁 WHERE IS MY DATA?

All your data is stored locally at:
```
C:\Users\[YourUsername]\AppData\Roaming\@syntaxis-ai\frontend\
```

**Folders:**
- `data/invoices.json` - All invoice records
- `data/files/` - Uploaded PDF files
- `logs/app.log` - Application logs

---

## 🎯 COMMON TASKS

### Upload a PDF
1. Go to "Invoice Processor" page
2. Drag & drop a PDF file (or click to browse)
3. Click "Upload"
4. OCR automatically extracts text
5. New invoice created with extracted data

### Export an Invoice
1. Click on any invoice in the list
2. Click "Export to CSV" or "Export to PDF"
3. File downloads to your Downloads folder

### Export Multiple Invoices
1. Go to Invoice List
2. Check boxes next to invoices
3. Click "Export Selected"
4. Choose CSV or PDF format

### Delete an Invoice
1. Click on the invoice
2. Click "Delete" button
3. Confirm deletion

---

## ⚙️ SYSTEM REQUIREMENTS

- **OS**: Windows 10 or later
- **RAM**: 512 MB minimum (1 GB recommended)
- **Disk Space**: 300 MB for app + data
- **No Installation**: Just run the .exe file

---

## 🔧 TROUBLESHOOTING

### App Won't Start
- Check if another instance is running
- Try restarting your computer
- Check logs: `%APPDATA%\@syntaxis-ai\frontend\logs\app.log`

### PDF Upload Not Working
- Ensure PDF file is not corrupted
- Try a different PDF file
- Check available disk space

### Data Not Saving
- Check folder permissions: `%APPDATA%\@syntaxis-ai\frontend\`
- Ensure disk has free space
- Check logs for errors

### OCR Not Extracting Text
- PDF might be image-only (scanned document)
- Try a different PDF with selectable text
- Check Tesseract.js logs

---

## 📞 SUPPORT

**Check Logs:**
```
%APPDATA%\@syntaxis-ai\frontend\logs\app.log
```

**Common Log Locations:**
- Application errors
- File upload issues
- OCR processing status
- Export operations

---

## 🎓 TIPS & TRICKS

1. **Keyboard Shortcuts**
   - `Ctrl+Q` - Quit app
   - `F12` - Open developer tools (for debugging)

2. **Batch Operations**
   - Select multiple invoices with checkboxes
   - Export or delete all at once

3. **PDF Preview**
   - Preview PDFs before uploading
   - Verify content is correct

4. **Sample Data**
   - Use sample invoices to test features
   - Delete them when ready for real data

5. **Backup Data**
   - Copy `%APPDATA%\@syntaxis-ai\frontend\data\` folder
   - Backup before major updates

---

## 🚀 YOU'RE ALL SET!

Your SyntaxisAI app is ready to use. Start by:
1. Running the app
2. Exploring the sample invoices
3. Uploading a test PDF
4. Exporting to CSV/PDF

**Enjoy! 🎉**

