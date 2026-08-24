# Production Deployment Security Guide — MATIX

This document provides technical instructions for securely deploying MATIX to a production Linux server (Ubuntu/Debian, Railway, Render, or VPS).

---

## 1. Production Architecture Overview

```
Internet (HTTPS :443)
       │
       ▼
┌──────────────────────────────────────────────┐
│  Reverse Proxy (Nginx / Caddy / Cloudflare) │
│  - TLS Termination (Let's Encrypt / ACME)    │
│  - HSTS & Security Headers                   │
│  - Rate Limiting & DDoS Buffer               │
└──────────────────────┬───────────────────────┘
                       │ HTTP (127.0.0.1:5000)
                       ▼
┌──────────────────────────────────────────────┐
│  Node.js / Express Application (MATIX)       │
│  - Helmet CSP, HSTS, Frameguard              │
│  - CORS Origin Validation                    │
│  - Application Token Bucket Rate Limiter     │
│  - NoSQL Injection Sanitization              │
│  - Server-Authoritative Movement Ledger      │
└──────────────────────┬───────────────────────┘
                       │ TLS Encrypted Connection
                       ▼
┌──────────────────────────────────────────────┐
│  MongoDB Atlas Cluster                       │
│  - IP Whitelist (App Server Only)            │
│  - SCRAM-SHA-256 Authentication              │
│  - Automated Snapshots & Backups             │
└──────────────────────────────────────────────┘
```

---

## 2. Required Production Environment Variables

Create `/var/www/matix/.env` with strict permissions (`chmod 600 .env`):

```bash
# Server Runtime
PORT=5000
NODE_ENV=production

# CORS Allowed Origin (Your Production Domain)
FRONTEND_ORIGIN=https://matix.yourcompany.com

# MongoDB Atlas Replica Set Connection URI
MONGODB_URI=mongodb+srv://matix_prod_user:<STRONG_DB_PASSWORD>@cluster0.xxxxx.mongodb.net/matix?retryWrites=true&w=majority

# Initial Admin Provisioning (Used during 'npm run setup')
INITIAL_ADMIN_EMAIL=admin@yourcompany.com
INITIAL_ADMIN_PASSWORD=<STRONG_MIN_10_CHARS_UPPER_LOWER_DIGIT_SYMBOL>

# Cryptographically Random JWT Secrets (Generate with: openssl rand -base64 32)
JWT_SECRET=<32_PLUS_CHARS_BASE64_SECRET_KEY>
JWT_REFRESH_SECRET=<32_PLUS_CHARS_BASE64_SECRET_KEY>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_AUTH_MAX=5
RATE_LIMIT_API_MAX=120

# Required Cloudinary Storage for Product Images
# Configure either CLOUDINARY_URL or all three explicit values below.
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
# Alternative: cloudinary://<api_key>:<api_secret>@<cloud_name>
CLOUDINARY_URL=
```

On Render, configure **one Cloudinary method only**: either `CLOUDINARY_URL`
copied directly from the Cloudinary Console, or the complete three-variable
set. Enter raw values without surrounding quote characters, then choose
**Save and deploy** so the running service receives the new values.

---

## 3. Nginx HTTPS Reverse Proxy Configuration

Create `/etc/nginx/sites-available/matix.conf`:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name matix.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name matix.yourcompany.com;

    # SSL Certificates
    ssl_certificate /etc/letsencrypt/live/matix.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/matix.yourcompany.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Max upload body size (matches application 5MB upload limit)
    client_max_body_size 6M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/matix.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 4. Initial Provisioning & Startup Procedure

1. **Clone repository and install dependencies**:
   ```bash
   cd /var/www/matix
   npm ci --production
   ```

2. **Run Secure System Setup**:
   ```bash
   npm run setup
   ```
   *This provisions the single initial administrator defined in `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` and base warehouses.*

3. **Start Process via PM2 Service Manager**:
   ```bash
   sudo npm install -g pm2
   pm2 start server/server.js --name "matix-api" -i max
   pm2 save
   pm2 startup
   ```

---

## 5. MongoDB Atlas Production Security Settings

1. **Network Access (IP Access List)**:
   - Do **NOT** use `0.0.0.0/0` in production.
   - Whitelist only the static public IP address of your application server / reverse proxy.
2. **Database Users**:
   - Create a dedicated user (`matix_prod_user`) with `readWrite` access scoped exclusively to the `matix` database.
   - Do not grant `atlasAdmin` or `dbAdminAnyDatabase` permissions to the application user.
3. **Backup & Retention**:
   - Enable Continuous Cloud Backups with point-in-time recovery.

---

## 6. Secret Rotation & Incident Response

### Secret Rotation (JWT Keys)
To rotate `JWT_SECRET` or `JWT_REFRESH_SECRET`:
1. Generate new 32-character keys: `openssl rand -base64 32`.
2. Update `.env` on the production server.
3. Reload application: `pm2 reload matix-api`.
4. *Note*: Users will be prompted to log in again upon access token expiration.

### Audit Log Inspection
Security-sensitive events (`LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `ISSUE`, `TRANSFER`, `RETURN`, `RECEIVE`) are written to the immutable `AuditLog` collection.
Administrators can inspect these logs at `/api/audit-logs` or via MongoDB query:
```javascript
db.auditlogs.find({ action: { $in: ['LOGIN', 'UPDATE'] } }).sort({ timestamp: -1 }).limit(50);
```
