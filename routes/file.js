module.exports = (io) => {
  const express = require('express');
  const multer = require('multer');
  const path = require('path');
  const router = express.Router();
  const fileController = require('../fileController');

  // Multer temp upload dir (controller will move/encrypt/remove files)
  const uploadDir = path.join(__dirname, '..', 'uploads');
  const upload = multer({ dest: uploadDir });

  // Upload route
  router.post('/upload', upload.array('files'), (req, res) => {
    return fileController.uploadFiles(req, res, io);
  });

  // File info
  router.get('/file-info/:code', (req, res) => {
    return fileController.getFileInfo(req, res);
  });

  // Download
  router.get('/download/:code', (req, res) => {
    return fileController.downloadFile(req, res, io);
  });

  // Stats: live transfer statistics
  router.get('/api/stats', (req, res) => {
    return res.json(fileController.getStats());
  });

  // Admin: list current transfers (protected by ADMIN_TOKEN)
  router.get('/admin/transfers', (req, res) => {
    const adminToken = process.env.ADMIN_TOKEN;
    if (!adminToken) return res.status(403).json({ success: false, error: 'ADMIN_TOKEN not configured' });
    const auth = (req.headers.authorization || '').replace(/^Bearer\s*/i, '');
    if (auth !== adminToken) return res.status(401).json({ success: false, error: 'Unauthorized' });
    return res.json(fileController.adminStatus());
  });

  return router;
};