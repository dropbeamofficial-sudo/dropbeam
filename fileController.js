/**
 * DropBeam — controllers/fileController.js
 * Handles upload, download, metadata, cleanup, stats
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const archiver = require('archiver');

// ---- In-memory store: code → { files, createdAt, expiresAt } ----
const transferStore = new Map();

// ---- Config ----
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const EXPIRY_MINUTES = Number(process.env.EXPIRY_MINUTES) || 15;
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

// Ensure uploads dir exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// =============================================
// GENERATE UNIQUE 6-DIGIT CODE
// =============================================
function generateCode() {
  let code, attempts = 0;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
    attempts++;
    if (attempts > 100) throw new Error('Could not generate unique code');
  } while (transferStore.has(code));
  return code;
}

// =============================================
// ENCRYPT FILE (AES-256-CBC)
// =============================================
function encryptBuffer(buffer) {
  const key = crypto.randomBytes(32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { encrypted, key: key.toString('hex'), iv: iv.toString('hex') };
}

function decryptBuffer(encrypted, keyHex, ivHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

// =============================================
// UPLOAD HANDLER
// =============================================
async function uploadFiles(req, res, io) {
  try {
    if (!req.files || !req.files.length) {
      return res.status(400).json({ success: false, error: 'No files provided' });
    }

    const code = generateCode();
    const expiresAt = Date.now() + EXPIRY_MINUTES * 60 * 1000;
    const fileRecords = [];

    for (const file of req.files) {
      const buffer = fs.readFileSync(file.path);
      const { encrypted, key, iv } = encryptBuffer(buffer);

      const encPath = file.path + '.enc';
      fs.writeFileSync(encPath, encrypted);
      fs.unlinkSync(file.path);

      fileRecords.push({
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        encPath,
        key,
        iv,
      });
    }

    transferStore.set(code, {
      files: fileRecords,
      createdAt: Date.now(),
      expiresAt,
      downloadCount: 0,
    });

    console.log(`[Upload] Code ${code} | ${fileRecords.length} file(s)`);

    return res.json({
      success: true,
      code,
      expiresAt,
      fileCount: fileRecords.length,
    });

  } catch (err) {
    console.error('[Upload Error]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// =============================================
// GET FILE INFO (metadata, no download)
// =============================================
async function getFileInfo(req, res) {
  const { code } = req.params;
  const entry = transferStore.get(code);

  if (!entry) return res.status(404).json({ success: false, error: 'Code not found or expired' });
  if (Date.now() > entry.expiresAt) {
    cleanupEntry(code, entry);
    return res.status(410).json({ success: false, error: 'Transfer code has expired' });
  }

  const firstFile = entry.files[0];
  return res.json({
    success: true,
    filename: firstFile.originalname,
    size: firstFile.size,
    mimetype: firstFile.mimetype,
    fileCount: entry.files.length,
    expiresAt: entry.expiresAt,
  });
}

// =============================================
// DOWNLOAD HANDLER
// =============================================
async function downloadFile(req, res, io) {
  try {
    const { code } = req.params;
    const entry = transferStore.get(code);

    if (!entry) return res.status(404).json({ success: false, error: 'Code not found or expired' });
    if (Date.now() > entry.expiresAt) {
      cleanupEntry(code, entry);
      return res.status(410).json({ success: false, error: 'Transfer code has expired' });
    }

    entry.downloadCount = (entry.downloadCount || 0) + 1;
    console.log(`[Download] Code ${code} | Downloads: ${entry.downloadCount}`);

    if (io) {
      io.to(`room:${code}`).emit('file:received', {
        code,
        filename: entry.files[0].originalname,
        downloadCount: entry.downloadCount,
      });
    }

    // Single file
    if (entry.files.length === 1) {
      const fileRecord = entry.files[0];
      const encBuffer = fs.readFileSync(fileRecord.encPath);
      const decBuffer = decryptBuffer(encBuffer, fileRecord.key, fileRecord.iv);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.originalname)}"`);
      res.setHeader('Content-Type', fileRecord.mimetype || 'application/octet-stream');
      res.setHeader('Content-Length', decBuffer.length);
      return res.send(decBuffer);
    }

    // Multiple files — zip
    res.setHeader('Content-Disposition', `attachment; filename="DropBeam-${code}.zip"`);
    res.setHeader('Content-Type', 'application/zip');
    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const fileRecord of entry.files) {
      const encBuffer = fs.readFileSync(fileRecord.encPath);
      const decBuffer = decryptBuffer(encBuffer, fileRecord.key, fileRecord.iv);
      archive.append(decBuffer, { name: fileRecord.originalname });
    }

    await archive.finalize();

  } catch (err) {
    console.error('[Download Error]', err);
    return res.status(500).json({ success: false, error: 'Failed to decrypt/send file' });
  }
}

// =============================================
// CLEANUP
// =============================================
function cleanupEntry(code, entry) {
  entry.files.forEach(f => {
    try { if (fs.existsSync(f.encPath)) fs.unlinkSync(f.encPath); } catch (_) { }
  });
  transferStore.delete(code);
  console.log(`[Cleanup] Removed code ${code}`);
}

function cleanupExpiredFiles() {
  const now = Date.now();
  let count = 0;
  for (const [code, entry] of transferStore.entries()) {
    if (now > entry.expiresAt) { cleanupEntry(code, entry); count++; }
  }
  if (count > 0) console.log(`[Cleanup] Removed ${count} expired transfer(s)`);
}

// =============================================
// STATS
// =============================================
function getStats() {
  const now = Date.now();
  let totalTransfers = 0;
  let totalDataTransferred = 0;
  let activeTransfers = 0;

  for (const [, entry] of transferStore.entries()) {
    const isExpired = now > entry.expiresAt;
    if (!isExpired) {
      totalTransfers++;
      activeTransfers++;
      entry.files.forEach(f => { totalDataTransferred += f.size; });
    }
  }

  return {
    success: true,
    totalTransfers,
    totalDataTransferred,
    activeTransfers,
  };
}

// =============================================
// ADMIN / DEBUG
// =============================================
function adminStatus() {
  const now = Date.now();
  const items = [];
  for (const [code, entry] of transferStore.entries()) {
    items.push({
      code,
      createdAt: entry.createdAt,
      expiresAt: entry.expiresAt,
      expired: now > entry.expiresAt,
      downloadCount: entry.downloadCount || 0,
      fileCount: entry.files.length,
      files: entry.files.map(f => ({ name: f.originalname, size: f.size }))
    });
  }
  return { success: true, count: items.length, transfers: items };
}

// =============================================
// EXPORTS
// =============================================
module.exports = {
  uploadFiles,
  getFileInfo,
  downloadFile,
  cleanupExpiredFiles,
  getStats,
  adminStatus,
};
