# DropBeam — Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (Client)                         │
│  - Web Crypto API for AES-256 encryption/decryption         │
│  - QR Code generation & scanning                           │
│  - Supabase Realtime for live notifications                │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────┐    ┌──────────────────────────┐
│    Vercel (Frontend CDN)     │    │   Supabase (Backend)      │
│  - dropbeam.in              │    │  ┌────────────────────┐  │
│  - www → @ redirect        │    │  │ Edge Functions:    │  │
│  - Static assets:           │    │  │  init-upload       │  │
│    index.html, style.css,   │    │  │  confirm-upload    │  │
│    script.js, admin.html    │    │  │  get-download      │  │
│    _env.js, Shriiis_logo.png│    │  │  file-info         │  │
│                              │    │  │  stats             │  │
│                              │    │  │  admin-transfers   │  │
│                              │    │  └────────────────────┘  │
│                              │    │  ┌────────────────────┐  │
│                              │    │  │ PostgreSQL DB      │  │
│                              │    │  │  transfers table   │  │
│                              │    │  │  files table       │  │
│                              │    │  └────────────────────┘  │
│                              │    │  ┌────────────────────┐  │
│                              │    │  │ Storage Bucket     │  │
│                              │    │  │  dropbeam-files    │  │
│                              │    │  │  (encrypted data)  │  │
│                              │    │  └────────────────────┘  │
│                              │    └──────────────────────┘   │
└──────────────────────────────┘
```

## Live URL
- **Production:** https://dropbeam.in
- **Vercel alias:** https://dropbeam-rust.vercel.app
- **www redirect:** www.dropbeam.in → dropbeam.in

## DNS Configuration (Hostinger)

To connect your Hostinger domain:

| Type  | Name            | Value                  |
|-------|-----------------|------------------------|
| A     | @               | 76.76.21.21           |
| CNAME | www             | cname.vercel-dns.com  |

**Steps:**
1. Log in to Hostinger control panel
2. Go to DNS Zone Editor for dropbeam.in
3. Add the A record and CNAME record above
4. Wait 24-48 hours for DNS propagation

## Supabase Configuration

### Project
- **Project URL:** https://tbngouvplswvziszlnee.supabase.co
- **Project Ref:** tbngouvplswvziszlnee

### Database Tables
- **transfers** — Transfer status, code, download count, expiry
- **files** — File metadata, storage paths, encryption keys

### Storage Bucket
- **Name:** `dropbeam-files`
- **Type:** Private (access via signed URLs)
- **Max file size:** 2 GB

### Edge Functions
| Function | Endpoint | Method | Purpose |
|----------|----------|--------|---------|
| init-upload | /functions/v1/init-upload | POST | Initialize upload, get encryption keys + signed URLs |
| confirm-upload | /functions/v1/confirm-upload | POST | Register encrypted files in database |
| get-download | /functions/v1/get-download | POST | Get signed download URL + decryption keys |
| file-info | /functions/v1/file-info | GET | Get file metadata by transfer code |
| stats | /functions/v1/stats | GET | Live transfer statistics |
| admin-transfers | /functions/v1/admin-transfers | GET | Admin panel (requires token) |

### Environment Variables (set via Supabase CLI)
- `ADMIN_TOKEN` — Authentication for admin panel (current: 727218)
- `EXPIRY_MINUTES` — Transfer expiry time (current: 15)

## Frontend Environment Variables (_env.js)

| Variable | Value |
|----------|-------|
| `window.__SUPABASE_URL__` | https://tbngouvplswvziszlnee.supabase.co |
| `window.__FUNCTIONS_BASE__` | https://tbngouvplswvziszlnee.supabase.co/functions/v1 |
| `window.__SUPABASE_ANON_KEY__` | [anon key — safe for public use] |

## Maintenance

### Deploy Edge Function Updates
```bash
cd ~/Desktop/Dropbeam
npx supabase functions deploy init-upload
npx supabase functions deploy confirm-upload
npx supabase functions deploy get-download
# ... repeat for all functions
```

### Deploy Frontend Updates
```bash
cd ~/Desktop/Dropbeam
node scripts/generate-env.js
vercel deploy --prod
```

### View Database
```bash
npx supabase db remote commit
npx supabase db push
```

### View Logs
Supabase Edge Function logs: https://supabase.com/dashboard/project/tbngouvplswvziszlnee/functions
Vercel deployment logs: https://vercel.com/dropbeamofficial-1369/dropbeam

## Security
- Files are encrypted with AES-256-CBC in the browser before upload
- Decryption occurs in the browser — server never sees unencrypted data
- Signed URLs provide time-limited access to storage
- Admin panel protected by token
- Row Level Security enabled on database tables
- Rate limiting via Edge Function response handling

## Admin Panel
URL: https://dropbeam.in/admin
Token: 727218

---
*Last updated: May 30, 2026*
