# ◈ DropBeam — Instant File Transfer

A production-ready file transfer web app with dark glassmorphism UI, 6-digit transfer codes, QR codes, AES-256 encryption, and real-time Socket.io notifications.

---

## 📁 Project Structure

```
dropbeam/
├── client/
│   ├── index.html       ← SPA frontend (HTML)
│   ├── style.css        ← Dark glassmorphism UI
│   └── script.js        ← Upload, receive, QR logic
├── server/
│   ├── server.js        ← Express + Socket.io entry point
│   ├── routes/
│   │   └── files.js     ← REST API routes
│   └── controllers/
│       └── fileController.js  ← Upload, download, encryption, cleanup
├── uploads/             ← Temp encrypted file storage (auto-created)
├── package.json
├── .env.example
└── .gitignore
```

---

## 🚀 Quick Start (Local)

### 1. Prerequisites
- Node.js **v18+** — [nodejs.org](https://nodejs.org)
- npm (comes with Node)

### 2. Install Dependencies

```bash
cd dropbeam
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

### 4. Run the Server

```bash
# Development (auto-restart on changes)
npm run dev

# Production
npm start
```

### 5. Open in Browser

```
http://localhost:3000
```

---

## 🔄 How to Use

### Sending a File
1. Open `http://localhost:3000` in your browser
2. Drag & drop a file (or click **Browse Files**)
3. Click **Generate Transfer Code**
4. Share the 6-digit code **or** the QR code with the recipient

### Receiving a File
1. Open `http://localhost:3000` and scroll to **Receive a File**
2. Enter the 6-digit code (or scan the QR)
3. Click **Download File** — the file saves automatically

---

## ⚙️ API Endpoints

| Method | Endpoint           | Description                        |
|--------|--------------------|------------------------------------|
| POST   | `/upload`          | Upload file(s), returns 6-digit code |
| GET    | `/file-info/:code` | Get filename/size metadata         |
| GET    | `/download/:code`  | Download file by code              |
| GET    | `/health`          | Server health check                |

### Example — Upload via curl

```bash
curl -X POST http://localhost:3000/upload \
  -F "files=@/path/to/your/file.pdf"
```

Response:
```json
{ "success": true, "code": "482931", "expiresAt": 1700000000000, "fileCount": 1 }
```

---

## 🔐 Security Features

- **AES-256-CBC encryption** — files are encrypted at rest in `/uploads`
- **Unique 6-digit codes** — collision-checked with retry logic
- **Auto-expiry** — files deleted after 15 minutes (configurable via `EXPIRY_MINUTES`)
- **File type blocking** — `.exe`, `.bat`, `.cmd`, `.msi`, `.ps1`, `.sh` blocked
- **File size limit** — 2 GB max per file
- **Rate limiting** — 60 requests/minute per IP on upload/download
- **No persistent storage** — in-memory code map, encrypted temp files only

---

## 🌐 Deploy to Render (Free Tier)

1. Push code to a GitHub repo
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your repo
4. Set:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment Variables**: `PORT=10000`, `NODE_ENV=production`, `CLIENT_URL=https://your-app.onrender.com`
5. Deploy!

---

## 🚂 Deploy to Railway

```bash
# Install Railway CLI
npm install -g @railway/cli
railway login
railway init
railway up
```

Set env vars in the Railway dashboard.

---

## 🛠️ Tech Stack

| Layer     | Technology                  |
|-----------|-----------------------------|
| Frontend  | Vanilla HTML/CSS/JS         |
| Backend   | Node.js + Express           |
| Real-time | Socket.io (WebSockets)      |
| Upload    | Multer                      |
| Encryption| Node.js `crypto` (AES-256)  |
| QR Code   | QRCode.js (CDN)             |
| QR Scan   | jsQR (CDN)                  |
| Rate Limit| express-rate-limit          |

---

## 📝 Environment Variables

| Variable         | Default                    | Description               |
|------------------|----------------------------|---------------------------|
| `PORT`           | `3000`                     | Server port               |
| `NODE_ENV`       | `development`              | Environment mode          |
| `CLIENT_URL`     | `*`                        | Allowed CORS origin       |
| `EXPIRY_MINUTES` | `15`                       | File auto-delete timeout  |

---

## 🧩 Extending DropBeam

- **WebRTC P2P**: Replace XHR upload/download with `RTCDataChannel` for direct browser-to-browser transfer (no server storage)
- **Multi-file zip**: Use `archiver` npm package to bundle multiple files into a `.zip` on download
- **Password protection**: Add optional password field; derive AES key from password + PBKDF2
- **Email notifications**: Integrate SendGrid to email download links

---

MIT License · Built with ❤️ using Node.js + Vanilla JS
