/**
 * DropBeam — script.js
 * Frontend logic: upload, code display, QR, receive, progress, QR scanning
 */

// =============================================
// CONFIG
// =============================================
// `window.__BACKEND_URL__` may be injected in `index.html` on Vercel deploys.
// Fallback to same-origin when not provided (useful for local dev).
const API_BASE = (window.__BACKEND_URL__ && window.__BACKEND_URL__.length) ? window.__BACKEND_URL__ : window.location.origin;
// same-origin in production

// =============================================
// STATE
// =============================================
let selectedFiles = [];
let currentCode = null;
let expiryInterval = null;
let expirySeconds = 900; // 15 min
let qrCodeInstance = null;
let qrStream = null;  // camera stream
let scanning = false;

// =============================================
// DOM REFS
// =============================================
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileList = document.getElementById('file-list');
const fileItems = document.getElementById('file-items');
const clearFilesBtn = document.getElementById('clear-files');
const uploadBtn = document.getElementById('upload-btn');
const codeCard = document.getElementById('code-card');
const progressCard = document.getElementById('progress-card');
const progressBar = document.getElementById('progress-bar');
const progressPct = document.getElementById('progress-pct');
const progressLabel = document.getElementById('progress-label');
const progressSpeed = document.getElementById('progress-speed');
const progressSize = document.getElementById('progress-size');
const copyCodeBtn = document.getElementById('copy-code-btn');
const newTransferBtn = document.getElementById('new-transfer-btn');
const receiveBtn = document.getElementById('receive-btn');
const receiveProgress = document.getElementById('receive-progress');
const recvBar = document.getElementById('recv-bar');
const recvPct = document.getElementById('recv-pct');
const recvLabel = document.getElementById('recv-label');
const recvSpeed = document.getElementById('recv-speed');
const recvSize = document.getElementById('recv-size');
const recvFileInfo = document.getElementById('recv-file-info');
const rfpName = document.getElementById('rfp-name');
const rfpSize = document.getElementById('rfp-size');
const rfpIcon = document.getElementById('rfp-icon');
const rfpDownloadBtn = document.getElementById('rfp-download-btn');
const scanQrBtn = document.getElementById('scan-qr-btn');
const qrScannerCard = document.getElementById('qr-scanner-card');
const closeScanner = document.getElementById('close-scanner');
const qrVideo = document.getElementById('qr-video');

// =============================================
// TOAST NOTIFICATIONS
// =============================================
function toast(message, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', loading: '⏳' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    el.addEventListener('animationend', () => el.remove());
  }, duration);
  return el;
}

// =============================================
// RIPPLE EFFECT
// =============================================
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const r = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  r.className = 'ripple';
  r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove());
});

// =============================================
// FILE UTILITIES
// =============================================
const FILE_ICONS = {
  pdf: '📄', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🎞️', webp: '🖼️',
  mp4: '🎬', mov: '🎬', avi: '🎬', mkv: '🎬', webm: '🎬',
  mp3: '🎵', wav: '🎵', flac: '🎵', aac: '🎵', ogg: '🎵',
  zip: '📦', rar: '📦', '7z': '📦', tar: '📦', gz: '📦',
  doc: '📝', docx: '📝', xls: '📊', xlsx: '📊', ppt: '📊', pptx: '📊',
  txt: '📃', csv: '📃', json: '📟', xml: '📟',
  js: '🟨', ts: '🔷', py: '🐍', html: '🌐', css: '🎨',
};

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_ICONS[ext] || '📄';
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// =============================================
// DRAG & DROP
// =============================================
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addFiles([...e.dataTransfer.files]);
});
fileInput.addEventListener('change', () => addFiles([...fileInput.files]));

function addFiles(files) {
  const MAX = 2 * 1024 * 1024 * 1024; // 2 GB
  const valid = files.filter(f => {
    if (f.size > MAX) { toast(`${f.name} exceeds 2 GB limit`, 'error'); return false; }
    return true;
  });
  if (!valid.length) return;

  // Deduplicate
  valid.forEach(f => {
    if (!selectedFiles.find(sf => sf.name === f.name && sf.size === f.size)) {
      selectedFiles.push(f);
    }
  });
  renderFileList();
}

function renderFileList() {
  if (!selectedFiles.length) { fileList.style.display = 'none'; return; }
  fileList.style.display = 'block';
  fileItems.innerHTML = '';
  selectedFiles.forEach((f, i) => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerHTML = `
      <span class="file-item-icon">${getFileIcon(f.name)}</span>
      <div class="file-item-info">
        <div class="file-item-name">${f.name}</div>
        <div class="file-item-size">${formatBytes(f.size)}</div>
      </div>
      <button class="file-item-remove btn" data-idx="${i}">✕</button>
    `;
    fileItems.appendChild(div);
  });

  // Remove buttons
  fileItems.querySelectorAll('.file-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(Number(btn.dataset.idx), 1);
      renderFileList();
    });
  });
}

clearFilesBtn.addEventListener('click', () => {
  selectedFiles = []; fileInput.value = '';
  renderFileList();
});

// =============================================
// UPLOAD
// =============================================
uploadBtn.addEventListener('click', handleUpload);

async function handleUpload() {
  if (!selectedFiles.length) { toast('Please select at least one file', 'error'); return; }

  // Show progress
  progressCard.style.display = 'block';
  codeCard.style.display = 'none';
  setUploadBtn(true);

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append('files', f));

  const xhr = new XMLHttpRequest();
  let startTime = Date.now();
  let lastLoaded = 0;

  xhr.upload.addEventListener('progress', (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = (e.loaded - lastLoaded) / (elapsed || 1);
    lastLoaded = e.loaded;
    startTime = Date.now();

    progressBar.style.width = pct + '%';
    progressPct.textContent = pct + '%';
    progressLabel.textContent = 'Uploading…';
    progressSpeed.textContent = formatBytes(speed) + '/s';
    progressSize.textContent = `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`;
  });

  xhr.addEventListener('load', () => {
    setUploadBtn(false);
    if (xhr.status === 200) {
      const res = JSON.parse(xhr.responseText);
      if (res.success) {
        showCode(res.code);
        // clear selected files so next upload starts fresh
        selectedFiles = [];
        fileInput.value = '';
        renderFileList();
        progressBar.style.width = '100%';
        progressPct.textContent = '100%';
        progressLabel.textContent = 'Upload Complete ✓';
        toast('File uploaded successfully!', 'success');
      } else {
        toast(res.error || 'Upload failed', 'error');
        progressCard.style.display = 'none';
      }
    } else {
      toast('Upload failed. Check server connection.', 'error');
      progressCard.style.display = 'none';
    }
  });

  xhr.addEventListener('error', () => {
    setUploadBtn(false);
    progressCard.style.display = 'none';
    toast('Network error. Is the server running?', 'error');
  });

  xhr.open('POST', `${API_BASE}/upload`);
  xhr.send(formData);
}

function setUploadBtn(loading) {
  const btnText = uploadBtn.querySelector('.btn-text');
  const btnLoader = uploadBtn.querySelector('.btn-loader');
  btnText.style.display = loading ? 'none' : 'inline';
  btnLoader.style.display = loading ? 'inline' : 'none';
  uploadBtn.disabled = loading;
}

// =============================================
// SHOW TRANSFER CODE
// =============================================
function showCode(code) {
  currentCode = code;
  codeCard.style.display = 'flex';

  // Populate digits with animation
  const digits = code.split('');
  const ids = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.animation = 'none';
    void el.offsetWidth; // reflow
    el.style.animation = '';
    el.style.animationDelay = `${i * 0.06}s`;
    el.textContent = digits[i];
  });

  // QR Code
  generateQR(code);

  // Expiry countdown
  clearInterval(expiryInterval);
  expirySeconds = 900;
  updateExpiryDisplay();
  expiryInterval = setInterval(() => {
    expirySeconds--;
    updateExpiryDisplay();
    if (expirySeconds <= 0) { clearInterval(expiryInterval); toast('Transfer code expired', 'error'); resetSendUI(); }
  }, 1000);
}

function updateExpiryDisplay() {
  const m = String(Math.floor(expirySeconds / 60)).padStart(2, '0');
  const s = String(expirySeconds % 60).padStart(2, '0');
  const el = document.getElementById('expiry-countdown');
  if (el) el.textContent = `${m}:${s}`;
  if (expirySeconds <= 60 && el) el.style.color = 'var(--red)';
}

// =============================================
// QR CODE GENERATION
// =============================================
function generateQR(code) {
  const canvas = document.getElementById('qr-canvas');
  const qrUrl = `${window.location.origin}?code=${code}`;

  // Use QRCode.js library
  if (typeof QRCode !== 'undefined') {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    // QRCode.js doesn't expose canvas API directly, use div approach
    const qrDiv = document.createElement('div');
    new QRCode(qrDiv, {
      text: qrUrl,
      width: 200,
      height: 200,
      colorDark: '#1a1a2e',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    const img = qrDiv.querySelector('img');
    const ctx = canvas.getContext('2d');
    canvas.width = 200; canvas.height = 200;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img) {
      // Draw immediately if already loaded, otherwise draw onload
      const drawImg = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (img.complete && img.naturalWidth !== 0) drawImg();
      else img.onload = drawImg;
    } else {
      // Fallback: render from canvas produced by QRCode.js
      const c = qrDiv.querySelector('canvas');
      if (c) ctx.drawImage(c, 0, 0, canvas.width, canvas.height);
    }
  } else {
    // Fallback: simple text-based indicator
    const ctx = canvas.getContext('2d');
    canvas.width = 200; canvas.height = 200;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 200, 200);
    ctx.fillStyle = '#333';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('QR: ' + code, 100, 100);
  }
}

// =============================================
// COPY CODE
// =============================================
copyCodeBtn.addEventListener('click', () => {
  if (!currentCode) return;
  navigator.clipboard.writeText(currentCode).then(() => {
    const label = document.getElementById('copy-label');
    label.textContent = '✅ Copied!';
    setTimeout(() => label.textContent = '📋 Copy Code', 2000);
  }).catch(() => toast('Could not copy', 'error'));
});

// =============================================
// NEW TRANSFER
// =============================================
newTransferBtn.addEventListener('click', resetSendUI);

function resetSendUI() {
  selectedFiles = []; fileInput.value = '';
  renderFileList();
  codeCard.style.display = 'none';
  progressCard.style.display = 'none';
  currentCode = null;
  clearInterval(expiryInterval);
}

function resetReceiveUI() {
  receiveProgress.style.display = 'none';
  recvFileInfo.style.display = 'none';
  recvBar.style.width = '0%'; recvPct.textContent = '0%';
  recvLabel.textContent = '';
  recvSpeed.textContent = '-- KB/s'; recvSize.textContent = '-- / --';
  codeInputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
}

// =============================================
// CODE INPUT — RECEIVE
// =============================================
const codeInputs = [0, 1, 2, 3, 4, 5].map(i => document.getElementById(`ci${i}`));

codeInputs.forEach((input, idx) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val;
    if (val) { input.classList.add('filled'); if (idx < 5) codeInputs[idx + 1].focus(); }
    else input.classList.remove('filled');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && idx > 0) {
      codeInputs[idx - 1].focus(); codeInputs[idx - 1].value = '';
      codeInputs[idx - 1].classList.remove('filled');
    }
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((ch, i) => {
      if (codeInputs[i]) { codeInputs[i].value = ch; codeInputs[i].classList.add('filled'); }
    });
    if (pasted.length === 6) receiveBtn.focus();
  });
});

// Auto-fill from URL param
(function checkUrlCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  if (code && /^\d{6}$/.test(code)) {
    code.split('').forEach((ch, i) => {
      codeInputs[i].value = ch; codeInputs[i].classList.add('filled');
    });
    // Scroll to receive section
    document.getElementById('receive').scrollIntoView({ behavior: 'smooth' });
    toast('Code detected from QR! Click Download.', 'info', 5000);
  }
})();

// =============================================
// RECEIVE / DOWNLOAD
// =============================================
receiveBtn.addEventListener('click', handleReceive);

async function handleReceive() {
  const code = codeInputs.map(i => i.value).join('');
  if (code.length < 6) { toast('Please enter the full 6-digit code', 'error'); return; }

  receiveProgress.style.display = 'block';
  recvFileInfo.style.display = 'none';
  recvBar.style.width = '0%'; recvPct.textContent = '0%';
  recvLabel.textContent = 'Connecting…';

  try {
    // First: get file metadata
    const metaRes = await fetch(`${API_BASE}/file-info/${code}`);
    if (!metaRes.ok) { toast('Invalid or expired code', 'error'); receiveProgress.style.display = 'none'; return; }
    const meta = await metaRes.json();

    recvLabel.textContent = `Downloading ${meta.filename}…`;
    rfpName.textContent = meta.filename;
    rfpSize.textContent = formatBytes(meta.size);
    rfpIcon.textContent = getFileIcon(meta.filename);

    // Stream download with progress
    const xhr = new XMLHttpRequest();
    xhr.open('GET', `${API_BASE}/download/${code}`);
    xhr.responseType = 'blob';

    let startTime = Date.now();
    let lastLoaded = 0;

    xhr.addEventListener('progress', (e) => {
      if (!e.lengthComputable) return;
      const pct = Math.round((e.loaded / e.total) * 100);
      const speed = (e.loaded - lastLoaded) / ((Date.now() - startTime) / 1000 || 1);
      lastLoaded = e.loaded; startTime = Date.now();
      recvBar.style.width = pct + '%';
      recvPct.textContent = pct + '%';
      recvSpeed.textContent = formatBytes(speed) + '/s';
      recvSize.textContent = `${formatBytes(e.loaded)} / ${formatBytes(meta.size)}`;
    });

    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        const url = URL.createObjectURL(xhr.response);
        rfpDownloadBtn.href = url;
        rfpDownloadBtn.download = meta.filename;
        recvFileInfo.style.display = 'flex';
        recvBar.style.width = '100%'; recvPct.textContent = '100%';
        recvLabel.textContent = 'Download Ready ✓';
        toast('File ready to save!', 'success');
        // Auto-trigger download
        const a = document.createElement('a');
        a.href = url; a.download = meta.filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        // Reset receive UI shortly after download starts so the page returns to neutral state
        setTimeout(() => resetReceiveUI(), 800);
      } else {
        toast('Download failed', 'error');
        receiveProgress.style.display = 'none';
      }
    });

    xhr.addEventListener('error', () => {
      toast('Network error during download', 'error');
      receiveProgress.style.display = 'none';
    });

    xhr.send();

  } catch (err) {
    toast('Error: ' + err.message, 'error');
    receiveProgress.style.display = 'none';
  }
}

// =============================================
// QR SCANNER
// =============================================
scanQrBtn.addEventListener('click', openScanner);
closeScanner.addEventListener('click', stopScanner);

async function openScanner() {
  if (!navigator.mediaDevices) { toast('Camera not supported in this browser', 'error'); return; }
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    qrVideo.srcObject = qrStream;
    qrScannerCard.style.display = 'flex';
    // Some browsers require calling play() for the video element to start producing frames
    try { await qrVideo.play(); } catch (_) { /* ignore play errors */ }
    toast('Point camera at a DropBeam QR code', 'info');
    scanning = true;
    scanFrame();
  } catch (err) {
    toast('Camera access denied', 'error');
  }
}

function stopScanner() {
  scanning = false;
  if (qrStream) { qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
  qrScannerCard.style.display = 'none';
}

function scanFrame() {
  if (!scanning) return;
  // Create an offscreen canvas and downscale the frame for faster decoding
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
    const vw = qrVideo.videoWidth || qrVideo.clientWidth;
    const vh = qrVideo.videoHeight || qrVideo.clientHeight;
    if (!vw || !vh) { requestAnimationFrame(scanFrame); return; }
    // Limit decoding resolution to improve performance
    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    canvas.width = Math.max(100, Math.floor(vw * scale));
    canvas.height = Math.max(100, Math.floor(vh * scale));
    ctx.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      // Use jsQR if available (loaded dynamically)
      if (typeof jsQR !== 'undefined') {
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          handleQrResult(code.data);
          return;
        }
      }
    } catch (err) {
      console.debug('[QR scan error]', err && err.message);
    }
  }
  // small delay to avoid CPU spike on some devices
  setTimeout(() => { if (scanning) requestAnimationFrame(scanFrame); }, 50);
}

function handleQrResult(url) {
  stopScanner();
  try {
    const u = new URL(url);
    const code = u.searchParams.get('code');
    if (code && /^\d{6}$/.test(code)) {
      code.split('').forEach((ch, i) => {
        codeInputs[i].value = ch; codeInputs[i].classList.add('filled');
      });
      toast('QR scanned! Starting download…', 'success');
      // Auto-start the receive flow so scanning leads directly to downloading
      setTimeout(() => {
        try { handleReceive(); } catch (_) { document.getElementById('receive').scrollIntoView({ behavior: 'smooth' }); }
      }, 300);
    } else {
      toast('QR code not recognized as DropBeam', 'error');
    }
  } catch (_) {
    toast('Invalid QR code', 'error');
  }
}

// jsQR is loaded via index.html script tag

// =============================================
// SMOOTH NAV
// =============================================
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
});

// =============================================
// SOCKET.IO (real-time notifications, optional)
// =============================================
function tryConnectSocket() {
  if (typeof io === 'undefined') return;
  const socket = io(API_BASE);
  socket.on('connect', () => console.log('[DropBeam] Socket connected'));
  socket.on('file:received', (data) => {
    if (data.code === currentCode) {
      toast(`📥 Someone downloaded your file!`, 'success', 5000);
    }
  });
}

// Try after a short delay to allow Socket.io script to load
setTimeout(tryConnectSocket, 1000);
