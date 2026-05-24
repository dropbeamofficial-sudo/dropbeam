const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // built-in Node.js, no install needed

// Configurable uploads directory (use platform temp dir or env override)
const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY; // 32 chars
const IV_LENGTH = 16;

// Encrypt file buffer
function encryptFile(buffer) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return { iv: iv.toString('hex'), encryptedData: encrypted };
}

// Decrypt file buffer
function decryptFile(encryptedBuffer, ivHex) {
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
    return Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
}

// Store files in memory (temporary DB)
let filesDB = {};

// Generate 6 digit code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ===============================
// UPLOAD
// ===============================
exports.uploadFiles = (req, res, io) => {
    if (!req.files || req.files.length === 0) {
        return res.json({ success: false, error: "No files uploaded" });
    }

    const code = generateCode();
    const file = req.files[0]; // take first file

    filesDB[code] = {
        path: file.path,
        filename: file.originalname,
        size: file.size,
        createdAt: Date.now()
    };

    res.json({ success: true, code });
};

// ===============================
// FILE INFO
// ===============================
exports.getFileInfo = (req, res) => {
    const { code } = req.params;
    const file = filesDB[code];

    if (!file) {
        return res.status(404).json({ error: "Invalid or expired code" });
    }

    res.json({
        filename: file.filename,
        size: file.size
    });
};

// ===============================
// DOWNLOAD
// ===============================
exports.downloadFile = (req, res, io) => {
    const { code } = req.params;
    const file = filesDB[code];

    if (!file) {
        return res.status(404).send("File not found");
    }

    res.download(file.path, file.filename, () => {
        // Notify sender
        if (io) {
            io.to(`room:${code}`).emit('file:received', { code });
        }
    });
};

// ===============================
// CLEANUP (optional)
// ===============================
exports.cleanupExpiredFiles = () => {
    const now = Date.now();
    const EXPIRY = 15 * 60 * 1000; // 15 min

    for (let code in filesDB) {
        if (now - filesDB[code].createdAt > EXPIRY) {
            try {
                fs.unlinkSync(filesDB[code].path);
            } catch { }
            delete filesDB[code];
        }
    }
};