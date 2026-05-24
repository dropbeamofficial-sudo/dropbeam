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

  return router;
};