/**
 * DropBeam — script.js
 * Complete frontend logic: loader, particles, upload, QR, receive, scanner, transfer viz
 */

// =============================================
// CONFIG
// =============================================
const API_BASE = (window.__BACKEND_URL__ && window.__BACKEND_URL__.length) ? window.__BACKEND_URL__ : window.location.origin;

// =============================================
// STATE
// =============================================
let selectedFiles = [];
let currentCode = null;
let expiryInterval = null;
let expirySeconds = 900; // 15 min
let qrCodeInstance = null;
let qrStream = null;
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
const loaderScreen = document.getElementById('loader-screen');
const particlesCanvas = document.getElementById('particles-canvas');
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');
const transferParticles = document.getElementById('transfer-particles');

// =============================================
// PAGE LOADER
// =============================================
window.addEventListener('load', () => {
  setTimeout(() => {
    if (loaderScreen) loaderScreen.classList.add('hidden');
  }, 1000);
});

// =============================================
// PARTICLE CANVAS
// =============================================
if (particlesCanvas) {
  const ctx = particlesCanvas.getContext('2d');
  let particles = [];
  let animId;

  function resizeCanvas() {
    const hero = particlesCanvas.parentElement;
    particlesCanvas.width = hero.offsetWidth;
    particlesCanvas.height = hero.offsetHeight;
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * particlesCanvas.width;
      this.y = Math.random() * particlesCanvas.height;
      this.size = Math.random() * 2 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.3;
      this.speedY = (Math.random() - 0.5) * 0.3;
      this.opacity = Math.random() * 0.5 + 0.1;
    }
    update() {
      this.x += this.speedX;
      this.y += this.speedY;
      if (this.x < 0 || this.x > particlesCanvas.width) this.speedX *= -1;
      if (this.y < 0 || this.y > particlesCanvas.height) this.speedY *= -1;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(79, 142, 255, ${this.opacity})`;
      ctx.fill();
    }
  }

  function initParticles() {
    resizeCanvas();
    const count = Math.min(80, Math.floor(particlesCanvas.width * particlesCanvas.height / 10000));
    particles = Array.from({ length: count }, () => new Particle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(79, 142, 255, ${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    animId = requestAnimationFrame(animateParticles);
  }

  initParticles();
  animateParticles();
  window.addEventListener('resize', () => { resizeCanvas(); if (particles.length < 20) initParticles(); });
}

// =============================================
// MAGNETIC BUTTON EFFECT
// =============================================
document.querySelectorAll('.magnetic-wrap').forEach(wrap => {
  const magnetic = wrap.querySelector('.magnetic');
  if (!magnetic) return;
  wrap.addEventListener('mousemove', (e) => {
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    magnetic.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
  });
  wrap.addEventListener('mouseleave', () => {
    magnetic.style.transform = 'translate(0, 0)';
  });
});

// =============================================
// SCROLL REVEAL
// =============================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// =============================================
// NAV TOGGLE (MOBILE)
// =============================================
if (navToggle && navLinks) {
  navToggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    navToggle.classList.toggle('active');
  });
  // Close nav on link click
  navLinks.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('active');
    });
  });
}

// =============================================
// TRANSFER PARTICLES (upload animation)
// =============================================
function createTransferParticles() {
  if (!transferParticles) return;
  transferParticles.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const p = document.createElement('div');
    p.className = 'transfer-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.bottom = '0%';
    p.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
    p.style.animationDelay = Math.random() * 1.5 + 's';
    transferParticles.appendChild(p);
  }
}

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

  progressCard.style.display = 'block';
  codeCard.style.display = 'none';
  setUploadBtn(true);
  createTransferParticles();

  const formData = new FormData();
  selectedFiles.forEach(f => formData.append('files', f));

  const xhr = new XMLHttpRequest();
  let startTime = Date.now();
  let lastLoaded = 0;

  xhr.upload.addEventListener('progress', (e) => {
    if (!e.lengthComputable) return;
    const pct = Math.round((e.loaded / e.total) * 100);
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = elapsed > 0 ? (e.loaded - lastLoaded) / elapsed : 0;
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
    if (transferParticles) transferParticles.innerHTML = '';
    if (xhr.status === 200) {
      const res = JSON.parse(xhr.responseText);
      if (res.success) {
        showCode(res.code);
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
    if (transferParticles) transferParticles.innerHTML = '';
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

  const digits = code.split('');
  const ids = ['d0', 'd1', 'd2', 'd3', 'd4', 'd5'];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    el.style.animationDelay = `${i * 0.06}s`;
    el.textContent = digits[i];
  });

  generateQR(code);

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

  if (typeof QRCode !== 'undefined') {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
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
      const drawImg = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (img.complete && img.naturalWidth !== 0) drawImg();
      else img.onload = drawImg;
    } else {
      const c = qrDiv.querySelector('canvas');
      if (c) ctx.drawImage(c, 0, 0, canvas.width, canvas.height);
    }
  } else {
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
    const metaRes = await fetch(`${API_BASE}/file-info/${code}`);
    if (!metaRes.ok) { toast('Invalid or expired code', 'error'); receiveProgress.style.display = 'none'; return; }
    const meta = await metaRes.json();

    recvLabel.textContent = `Downloading ${meta.filename}…`;
    rfpName.textContent = meta.filename;
    rfpSize.textContent = formatBytes(meta.size);
    rfpIcon.textContent = getFileIcon(meta.filename);

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
        const a = document.createElement('a');
        a.href = url; a.download = meta.filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
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
    try { await qrVideo.play(); } catch (_) { }
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
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
    const vw = qrVideo.videoWidth || qrVideo.clientWidth;
    const vh = qrVideo.videoHeight || qrVideo.clientHeight;
    if (!vw || !vh) { requestAnimationFrame(scanFrame); return; }
    const maxDim = 800;
    const scale = Math.min(1, maxDim / Math.max(vw, vh));
    canvas.width = Math.max(100, Math.floor(vw * scale));
    canvas.height = Math.max(100, Math.floor(vh * scale));
    ctx.drawImage(qrVideo, 0, 0, canvas.width, canvas.height);
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
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
// TRANSFER STATS (Live Visualizer)
// =============================================
let statsInterval = null;

async function fetchStats() {
  try {
    const res = await fetch(`${API_BASE}/api/stats`);
    if (!res.ok) return;
    const data = await res.json();
    const tvTransfers = document.getElementById('tv-transfers');
    const tvData = document.getElementById('tv-data-transferred');
    const tvActive = document.getElementById('tv-active');
    if (tvTransfers) tvTransfers.textContent = data.totalTransfers || 0;
    if (tvData) tvData.textContent = formatBytes(data.totalDataTransferred || 0);
    if (tvActive) tvActive.textContent = data.activeTransfers || 0;
  } catch (_) { /* silently fail */ }
}

// Start polling stats when the live section is visible
const liveSection = document.getElementById('live');
if (liveSection) {
  const liveObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        fetchStats();
        statsInterval = setInterval(fetchStats, 3000);
      } else if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
      }
    });
  }, { threshold: 0.3 });
  liveObserver.observe(liveSection);
}

// =============================================
// SOCKET.IO (real-time notifications)
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

setTimeout(tryConnectSocket, 1000);
