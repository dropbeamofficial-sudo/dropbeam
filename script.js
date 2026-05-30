/**
 * DropBeam - script.js
 * Frontend logic with Supabase Edge Functions + browser-side AES-256 encryption
 */

// =============================================
// CONFIG
// =============================================
const SUPABASE_URL = window.__SUPABASE_URL__ || 'https://tbngouvplswvziszlnee.supabase.co';
const FUNCTIONS_BASE = window.__FUNCTIONS_BASE__ || SUPABASE_URL + '/functions/v1';
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || '';

// =============================================
// STATE
// =============================================
let selectedFiles = [];
let currentCode = null;
let expiryInterval = null;
let expirySeconds = 900;
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
  var dbLoaded = sessionStorage.getItem('db_loaded');
  var delay = dbLoaded ? 200 : 800;
  sessionStorage.setItem('db_loaded', '1');
  setTimeout(() => {
    if (loaderScreen) loaderScreen.classList.add('hidden');
  }, delay);
});

// =============================================
// PARTICLE CANVAS
// =============================================
if (particlesCanvas) {
  const ctx = particlesCanvas.getContext('2d');
  let particles = [];
  let animId;
  let frameCount = 0;
  window.__isLowEnd = !window.requestAnimationFrame || navigator.hardwareConcurrency <= 2 || (typeof navigator.deviceMemory !== 'undefined' && navigator.deviceMemory <= 4) || /iPad|iPhone/i.test(navigator.userAgent);
  const CONNECTION_INTERVAL = isLowEnd ? 4 : 2;

  function resizeCanvas() {
    const hero = particlesCanvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    particlesCanvas.width = Math.min(hero.offsetWidth * Math.min(dpr, 2), 1600);
    particlesCanvas.height = Math.min(hero.offsetHeight * Math.min(dpr, 2), 1200);
    particlesCanvas.style.width = hero.offsetWidth + 'px';
    particlesCanvas.style.height = hero.offsetHeight + 'px';
  }

  class Particle {
    constructor() { this.reset(); }
    reset() {
      this.x = Math.random() * particlesCanvas.width;
      this.y = Math.random() * particlesCanvas.height;
      this.size = Math.random() * 1.5 + 0.5;
      this.speedX = (Math.random() - 0.5) * 0.25;
      this.speedY = (Math.random() - 0.5) * 0.25;
      this.opacity = Math.random() * 0.4 + 0.08;
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
      ctx.fillStyle = 'rgba(79, 142, 255, ' + this.opacity + ')';
      ctx.fill();
    }
  }

  function initParticles() {
    resizeCanvas();
    const count = Math.min(isLowEnd ? 18 : 35, Math.floor(particlesCanvas.width * particlesCanvas.height / 20000));
    particles = Array.from({ length: count }, () => new Particle());
  }

  function drawConnections() {
    const len = particles.length;
    const maxDist = isLowEnd ? 80 : 110;
    for (let i = 0; i < len; i++) {
      const pi = particles[i];
      for (let j = i + 1; j < len; j++) {
        const pj = particles[j];
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const distSq = dx * dx + dy * dy;
        const maxDistSq = maxDist * maxDist;
        if (distSq < maxDistSq) {
          const dist = Math.sqrt(distSq);
          ctx.beginPath();
          ctx.moveTo(pi.x, pi.y);
          ctx.lineTo(pj.x, pj.y);
          ctx.strokeStyle = 'rgba(79, 142, 255, ' + (0.05 * (1 - dist / maxDist)) + ')';
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, particlesCanvas.width, particlesCanvas.height);
    frameCount++;
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();
    }
    if (frameCount % CONNECTION_INTERVAL === 0) drawConnections();
    animId = requestAnimationFrame(animateParticles);
  }

  let resizeTimer;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeCanvas();
      if (particles.length < 15) initParticles();
    }, 200);
  }

  // Pause particles when hero is off-screen (saves GPU/CPU on low-RAM)
  const heroSection = particlesCanvas.closest('section') || particlesCanvas.parentElement;
  const particleObserver = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        if (!animId) animateParticles();
      } else {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
      }
    });
  }, { threshold: 0.05 });
  if (heroSection) particleObserver.observe(heroSection);

  initParticles();
  animateParticles();
  window.addEventListener('resize', onResize, { passive: true });
}

// =============================================
// MAGNETIC BUTTON EFFECT (disabled on low-end)
// =============================================
if (!window.__isLowEnd) document.querySelectorAll('.magnetic-wrap').forEach(wrap => {
  const magnetic = wrap.querySelector('.magnetic');
  if (!magnetic) return;
  let ticking = false;
  wrap.addEventListener('mousemove', (e) => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        const rect = wrap.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        magnetic.style.transform = 'translate(' + (x * 0.12) + 'px, ' + (y * 0.12) + 'px)';
        ticking = false;
      });
    }
  }, { passive: true });
  wrap.addEventListener('mouseleave', () => {
    magnetic.style.transform = 'translate(0, 0)';
  }, { passive: true });
});

// =============================================
// SCROLL REVEAL
// =============================================
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      revealObserver.unobserve(entry.target);
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
  navLinks.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      navLinks.classList.remove('open');
      navToggle.classList.remove('active');
    }
  });
}

// =============================================
// TRANSFER PARTICLES
// =============================================
function createTransferParticles() {
  if (!transferParticles) return;
  const frag = document.createDocumentFragment();
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('div');
    p.className = 'transfer-particle';
    p.style.cssText = 'left:' + (Math.random() * 100) + '%;bottom:0;animation-duration:' + (1.5 + Math.random() * 1.5) + 's;animation-delay:' + (Math.random() * 1.2) + 's';
    frag.appendChild(p);
  }
  transferParticles.innerHTML = '';
  transferParticles.appendChild(frag);
}

// =============================================
// TOAST NOTIFICATIONS
// =============================================
function toast(message, type, duration) {
  type = type || 'info';
  duration = duration || 3500;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', loading: '⏳' };
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.innerHTML = '<span class="toast-icon">' + (icons[type] || '') + '</span><span>' + message + '</span>';
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
let rippleTimer;
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.btn');
  if (!btn) return;
  clearTimeout(rippleTimer);
  const rect = btn.getBoundingClientRect();
  const r = document.createElement('span');
  const size = Math.max(rect.width, rect.height);
  r.className = 'ripple';
  r.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (e.clientX - rect.left - size / 2) + 'px;top:' + (e.clientY - rect.top - size / 2) + 'px';
  btn.appendChild(r);
  r.addEventListener('animationend', () => r.remove(), { once: true });
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
  if (!filename) return '📄';
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
  addFiles(Array.from(e.dataTransfer.files));
}, { passive: false });
fileInput.addEventListener('change', () => addFiles(Array.from(fileInput.files)));

function addFiles(files) {
  const MAX = 2 * 1024 * 1024 * 1024;
  const valid = files.filter(f => {
    if (f.size > MAX) { toast(f.name + ' exceeds 2 GB limit', 'error'); return false; }
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
    div.innerHTML = '<span class="file-item-icon">' + getFileIcon(f.name) + '</span><div class="file-item-info"><div class="file-item-name">' + f.name + '</div><div class="file-item-size">' + formatBytes(f.size) + '</div></div><button class="file-item-remove btn" data-idx="' + i + '">✕</button>';
    fileItems.appendChild(div);
  });
  Array.from(fileItems.querySelectorAll('.file-item-remove')).forEach(btn => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(Number(btn.dataset.idx), 1);
      renderFileList();
    });
  });
}

clearFilesBtn.addEventListener('click', () => {
  selectedFiles = [];
  fileInput.value = '';
  renderFileList();
});

// =============================================
// BROWSER-SIDE AES-256 ENCRYPTION
// =============================================
function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToArrayBuffer(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

async function encryptFile(file, keyHex, ivHex) {
  const keyData = hexToArrayBuffer(keyHex);
  const ivData = hexToArrayBuffer(ivHex);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-CBC' }, false, ['encrypt']
  );
  const fileData = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-CBC', iv: ivData }, cryptoKey, fileData);
  return new Blob([encrypted], { type: 'application/octet-stream' });
}

async function decryptFile(encryptedBlob, keyHex, ivHex) {
  const keyData = hexToArrayBuffer(keyHex);
  const ivData = hexToArrayBuffer(ivHex);
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'AES-CBC' }, false, ['decrypt']
  );
  const encryptedData = await encryptedBlob.arrayBuffer();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-CBC', iv: ivData }, cryptoKey, encryptedData);
  return decrypted;
}

// =============================================
// UPLOAD - INIT + ENCRYPT + UPLOAD + CONFIRM
// =============================================
uploadBtn.addEventListener('click', handleUpload);

async function handleUpload() {
  if (!selectedFiles.length) { toast('Please select at least one file', 'error'); return; }

  progressCard.style.display = 'block';
  codeCard.style.display = 'none';
  setUploadBtn(true);
  createTransferParticles();

  try {
    // Step 1: Init upload - get encryption keys and signed URLs
    progressLabel.textContent = 'Initializing...';
    const initRes = await fetch(FUNCTIONS_BASE + '/init-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: selectedFiles.map(f => ({ name: f.name, size: f.size, type: f.type || 'application/octet-stream' })) })
    });

    if (!initRes.ok) {
      const errData = await initRes.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to initialize upload (HTTP ' + initRes.status + ')');
    }

    const initData = await initRes.json();
    if (!initData.success) throw new Error(initData.error || 'Failed to initialize upload');

    const code = initData.code;
    const fileEntries = initData.files;
    const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);
    let uploadedBytes = 0;

    // Step 2: Encrypt and upload each file
    const confirmedFiles = [];
    for (let i = 0; i < fileEntries.length; i++) {
      const fe = fileEntries[i];
      const originalFile = selectedFiles[i];

      progressLabel.textContent = 'Encrypting ' + originalFile.name + '...';

      // Encrypt file in browser
      const encryptedBlob = await encryptFile(originalFile, fe.encryptionKey, fe.encryptionIV);

      progressLabel.textContent = 'Uploading ' + originalFile.name + '...';

      // Upload encrypted blob to Supabase Storage via signed URL
      const uploadRes = await fetch(fe.signedUploadUrl, {
        method: 'PUT',
        body: encryptedBlob,
        headers: { 'Content-Type': 'application/octet-stream' }
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload ' + originalFile.name + ' to storage');
      }

      uploadedBytes += originalFile.size;
      const pct = Math.round((uploadedBytes / totalSize) * 100);
      progressBar.style.width = pct + '%';
      progressPct.textContent = pct + '%';
      progressSize.textContent = formatBytes(uploadedBytes) + ' / ' + formatBytes(totalSize);

      confirmedFiles.push({
        originalName: fe.originalName,
        mimeType: fe.mimeType,
        size: fe.size,
        storagePath: fe.storagePath,
        encryptionKey: fe.encryptionKey,
        encryptionIV: fe.encryptionIV
      });
    }

    // Step 3: Confirm upload - register files in database
    progressLabel.textContent = 'Finalizing...';
    const confirmRes = await fetch(FUNCTIONS_BASE + '/confirm-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, files: confirmedFiles })
    });

    if (!confirmRes.ok) {
      throw new Error('Failed to confirm upload');
    }

    const confirmData = await confirmRes.json();
    if (!confirmData.success) throw new Error(confirmData.error || 'Failed to confirm upload');

    // Success
    showCode(code);
    selectedFiles = [];
    fileInput.value = '';
    renderFileList();
    progressBar.style.width = '100%';
    progressPct.textContent = '100%';
    progressLabel.textContent = 'Upload Complete' + ' ✓';
    toast('Files uploaded! Share the code.', 'success');
    if (transferParticles) transferParticles.innerHTML = '';

  } catch (err) {
    setUploadBtn(false);
    if (transferParticles) transferParticles.innerHTML = '';
    progressCard.style.display = 'none';
    toast('❌ Download failed: ' + err.message + '. Please try again.', 'error');
    receiveBtn.disabled = false;
    receiveBtn.querySelector('.btn-text').textContent = 'Download';
    console.error('Upload error:', err);
  } finally {
    setUploadBtn(false);
  }
}

function setUploadBtn(loading) {
  const btnText = uploadBtn.querySelector('.btn-text');
  const btnLoader = uploadBtn.querySelector('.btn-loader');
  if (btnText) btnText.style.display = loading ? 'none' : 'inline';
  if (btnLoader) btnLoader.style.display = loading ? 'inline' : 'none';
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
    el.style.animationDelay = (i * 0.06) + 's';
    el.textContent = digits[i];
  });

  generateQR(code);

  clearInterval(expiryInterval);
  expirySeconds = 900;
  updateExpiryDisplay();
  expiryInterval = setInterval(() => {
    expirySeconds--;
    updateExpiryDisplay();
    if (expirySeconds <= 0) {
      clearInterval(expiryInterval);
      toast('Transfer code expired', 'error');
      resetSendUI();
    }
  }, 1000);

  // Subscribe to realtime updates for this transfer
  initSupabaseRealtime();
}

function updateExpiryDisplay() {
  const m = String(Math.floor(expirySeconds / 60)).padStart(2, '0');
  const s = String(expirySeconds % 60).padStart(2, '0');
  const el = document.getElementById('expiry-countdown');
  if (el) el.textContent = m + ':' + s;
  if (expirySeconds <= 60 && el) el.style.color = 'var(--red)';
}

// =============================================
// QR CODE GENERATION
// =============================================
function generateQR(code) {
  const canvas = document.getElementById('qr-canvas');
  const qrUrl = window.location.origin + '?code=' + code;

  if (typeof QRCode !== 'undefined') {
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
    canvas.width = 200;
    canvas.height = 200;
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
    canvas.width = 200;
    canvas.height = 200;
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
  selectedFiles = [];
  fileInput.value = '';
  renderFileList();
  codeCard.style.display = 'none';
  progressCard.style.display = 'none';
  currentCode = null;
  clearInterval(expiryInterval);
}

function resetReceiveUI() {
  receiveProgress.style.display = 'none';
  recvFileInfo.style.display = 'none';
  recvBar.style.width = '0%';
  recvPct.textContent = '0%';
  recvLabel.textContent = '';
  recvSpeed.textContent = '-- KB/s';
  recvSize.textContent = '-- / --';
  codeInputs.forEach(i => { i.value = ""; i.classList.remove("filled"); });
  receiveBtn.disabled = false;
  const rBtnText = receiveBtn.querySelector(".btn-text");
  if (rBtnText) rBtnText.textContent = "Download";
}

// =============================================
// CODE INPUT - RECEIVE
// =============================================
const codeInputs = [0, 1, 2, 3, 4, 5].map(i => document.getElementById('ci' + i));

codeInputs.forEach((input, idx) => {
  input.addEventListener('input', (e) => {
    const val = e.target.value.replace(/\D/g, '');
    e.target.value = val;
    if (val) {
      input.classList.add('filled');
      if (idx < 5) codeInputs[idx + 1].focus();
    } else input.classList.remove('filled');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !input.value && idx > 0) {
      codeInputs[idx - 1].focus();
      codeInputs[idx - 1].value = '';
      codeInputs[idx - 1].classList.remove('filled');
    }
  });
  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    pasted.split('').forEach((ch, i) => {
      if (codeInputs[i]) {
        codeInputs[i].value = ch;
        codeInputs[i].classList.add('filled');
      }
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
      if (codeInputs[i]) {
        codeInputs[i].value = ch;
        codeInputs[i].classList.add('filled');
      }
    });
    document.getElementById('receive').scrollIntoView({ behavior: 'smooth' });
    toast('Code detected from QR! Click Download.', 'info', 5000);
  }
})();

// =============================================
// RECEIVE / DOWNLOAD (via Supabase Edge Functions)
// =============================================
receiveBtn.addEventListener('click', handleReceive);

async function handleReceive() {
  const code = codeInputs.map(i => i.value).join('');
  if (code.length < 6) { toast('Please enter the full 6-digit code', 'error'); return; }

  receiveProgress.style.display = 'block';
  recvFileInfo.style.display = 'none';
  recvBar.style.width = '0%';
  recvPct.textContent = '0%';
  receiveBtn.disabled = true;
  receiveBtn.querySelector(".btn-text").textContent = "Downloading...";
  recvLabel.textContent = "Fetching file info...";

  try {
    // Step 1: Get file info
    const infoRes = await fetch(FUNCTIONS_BASE + '/file-info?code=' + code);
    if (!infoRes.ok) {
      toast('Invalid or expired code', 'error');
      receiveProgress.style.display = 'none';
      return;
    }
    const infoData = await infoRes.json();
    if (!infoData.success) {
      toast(infoData.error || 'Invalid or expired code', 'error');
      receiveProgress.style.display = 'none';
      return;
    }

    const files = infoData.files;
    if (!files || files.length === 0) {
      toast('No files found for this code', 'error');
      receiveProgress.style.display = 'none';
      return;
    }

    // Show first file info
    const firstFile = files[0];
    recvLabel.textContent = 'Downloading ' + firstFile.originalName + '...';
    rfpName.textContent = firstFile.originalName;
    rfpSize.textContent = formatBytes(firstFile.size);
    rfpIcon.textContent = getFileIcon(firstFile.originalName);

    // Step 2: Initiate download to get signed URL and encryption keys
    const dlRes = await fetch(FUNCTIONS_BASE + '/get-download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!dlRes.ok) {
      throw new Error('Download request failed');
    }

    const dlData = await dlRes.json();
    if (!dlData.success) {
      throw new Error(dlData.error || 'Download failed');
    }

    const downloadFiles = dlData.files || [];
    if (downloadFiles.length === 0) {
      throw new Error('No download files returned');
    }

    // Step 3: Download encrypted file via signed URL
    const dlFile = downloadFiles[0];
    recvLabel.textContent = 'Downloading encrypted file...';

    const encryptedRes = await fetch(dlFile.downloadUrl);
    if (!encryptedRes.ok) {
      throw new Error('Failed to download encrypted file from storage');
    }

    const encryptedBlob = await encryptedRes.blob();
    const totalBytes = encryptedBlob.size;

    // Update progress
    recvBar.style.width = '50%';
    recvPct.textContent = '50%';
    recvSize.textContent = formatBytes(totalBytes) + ' / ' + formatBytes(firstFile.size);

    // Step 4: Decrypt in browser
    recvLabel.textContent = 'Decrypting ' + dlFile.originalName + '...';
    const decryptedData = await decryptFile(encryptedBlob, dlFile.encryptionKey, dlFile.encryptionIV);

    recvBar.style.width = '100%';
    recvPct.textContent = '100%';
    recvLabel.textContent = 'Download Ready' + ' ✓';

    // Step 5: Create download link and trigger
    const decryptedBlob = new Blob([decryptedData], { type: dlFile.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(decryptedBlob);

    rfpDownloadBtn.href = url;
    rfpDownloadBtn.download = dlFile.originalName;
    recvFileInfo.style.display = 'flex';

    // Auto-download
    const a = document.createElement('a');
    a.href = url;
    a.download = dlFile.originalName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast('File decrypted and saved!', 'success');
    receiveBtn.disabled = false;
    receiveBtn.querySelector('.btn-text').textContent = 'Download';
    setTimeout(() => resetReceiveUI(), 1000);

  } catch (err) {
    toast('❌ Download failed: ' + err.message + '. Please try again.', 'error');
    receiveBtn.disabled = false;
    receiveBtn.querySelector('.btn-text').textContent = 'Download';
    receiveProgress.style.display = 'none';
    console.error('Download error:', err);
  }
}

// =============================================
// QR SCANNER
// =============================================
if (scanQrBtn && closeScanner) {
  scanQrBtn.addEventListener('click', openScanner);
  closeScanner.addEventListener('click', stopScanner);
}

async function openScanner() {
  if (!navigator.mediaDevices) { toast('Camera not supported in this browser', 'error'); return; }
  try {
    qrStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
    });
    qrVideo.srcObject = qrStream;
    qrScannerCard.style.display = 'flex';
    try { await qrVideo.play(); } catch (_) {}
    toast('Point camera at a DropBeam QR code', 'info');
    scanning = true;
    requestAnimationFrame(scanFrame);
  } catch (err) {
    toast('Camera access denied', 'error');
  }
}

function stopScanner() {
  scanning = false;
  if (qrStream) { qrStream.getTracks().forEach(t => t.stop()); qrStream = null; }
  qrScannerCard.style.display = 'none';
}

const scanCanvas = document.createElement('canvas');
const scanCtx = scanCanvas.getContext('2d');

function scanFrame() {
  if (!scanning) return;
  if (qrVideo.readyState === qrVideo.HAVE_ENOUGH_DATA) {
    const vw = qrVideo.videoWidth || qrVideo.clientWidth;
    const vh = qrVideo.videoHeight || qrVideo.clientHeight;
    if (vw && vh) {
      const scale = Math.min(1, 320 / Math.max(vw, vh));
      scanCanvas.width = Math.floor(vw * scale);
      scanCanvas.height = Math.floor(vh * scale);
      scanCtx.drawImage(qrVideo, 0, 0, scanCanvas.width, scanCanvas.height);
      try {
        const imageData = scanCtx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
        if (typeof jsQR !== 'undefined') {
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });
          if (qrCode && qrCode.data) {
            handleQrResult(qrCode.data);
            return;
          }
        }
      } catch (_) {}
    }
  }
  setTimeout(() => { if (scanning) requestAnimationFrame(scanFrame); }, 200);
}

function handleQrResult(url) {
  stopScanner();
  try {
    const u = new URL(url);
    const code = u.searchParams.get('code');
    if (code && /^\d{6}$/.test(code)) {
      code.split('').forEach((ch, i) => {
        if (codeInputs[i]) {
          codeInputs[i].value = ch;
          codeInputs[i].classList.add('filled');
        }
      });
      toast('QR scanned! Starting download...', 'success');
      setTimeout(() => {
        try { handleReceive(); } catch (_) {
          document.getElementById('receive').scrollIntoView({ behavior: 'smooth' });
        }
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
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const target = document.querySelector(a.getAttribute('href'));
  if (target) {
    e.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}, { passive: false });

// =============================================
// TRANSFER STATS (Live Visualizer)
// =============================================
let statsInterval = null;

async function fetchStats() {
  try {
    const res = await fetch(FUNCTIONS_BASE + '/stats');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;
    const elTransfers = document.getElementById('tv-transfers');
    const elData = document.getElementById('tv-data-transferred');
    const elActive = document.getElementById('tv-active');
    if (elTransfers) elTransfers.textContent = data.totalTransfers || 0;
    if (elData) elData.textContent = formatBytes(data.totalDataTransferred || 0);
    if (elActive) elActive.textContent = data.activeTransfers || 0;
  } catch (_) {}
}

const liveSection = document.getElementById('live');
if (liveSection) {
  const liveObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        fetchStats();
        statsInterval = setInterval(fetchStats, 10000);
      } else if (statsInterval) {
        clearInterval(statsInterval);
        statsInterval = null;
      }
    });
  }, { threshold: 0.3 });
  liveObserver.observe(liveSection);
}

window.addEventListener('pagehide', () => {
  if (statsInterval) clearInterval(statsInterval);
  if (expiryInterval) clearInterval(expiryInterval);
});
window.addEventListener('beforeunload', () => {
  if (statsInterval) clearInterval(statsInterval);
  if (expiryInterval) clearInterval(expiryInterval);
});

// =============================================
// SUPABASE REALTIME - Listen for transfer updates
// =============================================
let transferSubscription = null;

function initSupabaseRealtime() {
  try {
    if (typeof supabase !== "undefined" && typeof supabaseClient === "undefined") {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    if (supabaseClient && currentCode) {
      transferSubscription = supabaseClient
        .channel('transfer-updates')
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'transfers',
          filter: 'code=eq.' + currentCode
        }, (payload) => {
          if (payload.new && payload.new.download_count > 0) {
            toast('📥 Someone downloaded your file!', 'success', 5000);
          }
        })
        .subscribe();
    }
  } catch (_) {}
}

// Init Supabase client for realtime
(function initSupabase() {
  try {
    if (typeof supabase !== 'undefined') {
      window.supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  } catch (_) {}
})();

// Show init message
console.log('DropBeam loaded with Supabase backend');
