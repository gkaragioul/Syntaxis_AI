const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3001;
// This server has no authentication, so it only listens on this machine by
// default. Set PDF_CONVERTER_HOST (for example 0.0.0.0) to listen on other
// interfaces, and only on a network you trust.
const HOST = process.env.PDF_CONVERTER_HOST || '127.0.0.1';

// Enable CORS
app.use(cors());

// Root endpoint to verify server is running
app.get('/', (req, res) => {
    res.send('SyntaxisAI Local Upload Server is Running! 🚀<br>Send POST requests to /upload');
});

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        // Use original filename but prepend timestamp to avoid collisions
        cb(null, Date.now() + '-' + file.originalname)
    }
});

const upload = multer({ storage: storage });

// Upload Endpoint
app.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: { message: 'No file uploaded' } });
    }

    // Simulate processing time
    setTimeout(() => {
        res.status(201).json({
            success: true,
            data: {
                filename: req.file.filename,
                originalName: req.file.originalname,
                path: req.file.path,
                size: req.file.size
            }
        });
    }, 1000);
});

// Serve React App (Optional, if we want single port)
// app.use(express.static(path.join(__dirname, 'build')));

app.listen(PORT, HOST, () => {
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Uploads will be saved to: ${uploadDir}`);
});
