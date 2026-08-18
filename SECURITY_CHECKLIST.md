# Pre-Deployment Security Checklist — MATIX

Use this checklist prior to every public release or production deployment of MATIX.

---

## 1. Secrets & Environment Configuration
- [ ] `.env` file is excluded from Git tracking (verified in `.gitignore`).
- [ ] `.env.example` contains only placeholder values and zero production secrets.
- [ ] `JWT_SECRET` is generated with high entropy (min 32 random characters: `openssl rand -base64 32`).
- [ ] `JWT_REFRESH_SECRET` is generated with high entropy (min 32 random characters).
- [ ] `INITIAL_ADMIN_EMAIL` is set to the authorized administrative email address.
- [ ] `INITIAL_ADMIN_PASSWORD` satisfies complexity requirements (min 10 characters, upper, lower, digit, symbol).
- [ ] `FRONTEND_ORIGIN` is configured to the production domain (e.g. `https://matix.yourcompany.com`).
- [ ] `NODE_ENV` is set to `production`.

---

## 2. Authentication & Session Security
- [ ] Passwords hashed using bcrypt with salt rounds $\ge 12$.
- [ ] `passwordHash` field has `select: false` in Mongoose schema to prevent leakage.
- [ ] Login errors use timing-safe generic message (`INVALID_CREDENTIALS`, 401) to prevent account enumeration.
- [ ] Deactivated users are blocked from authentication and token refresh.
- [ ] Rate limiting is active on `/api/auth/login` and `/api/auth/refresh` (max 5 failed attempts / 15 min).
- [ ] Access tokens are short-lived (1 hour); refresh tokens are rotated and strictly typed.

---

## 3. Authorization & Access Control (RBAC & IDOR)
- [ ] Every protected route has `auth` middleware applied.
- [ ] Role-restricted routes have explicit `authorize(...)` middleware.
- [ ] `VIEWER` role is restricted to read-only queries.
- [ ] `RECEIPT` movement is restricted to `ADMIN`, `WAREHOUSE_MANAGER`, and `SUPERVISOR`.
- [ ] User role updates and deactivations are restricted to `ADMIN`.
- [ ] Guard preventing deactivation or demotion of the last remaining active `ADMIN` is operational.
- [ ] Direct object references (`/:id`) validate existence and authorization server-side.

---

## 4. Input Sanitization & Injection Defense
- [ ] Recursive NoSQL injection sanitization strips `$` and `.` from all `req.body`, `req.query`, and `req.params`.
- [ ] MongoDB queries avoid dynamic `$where` evaluation or unsanitized `$regex` from client.
- [ ] CSV and XLSX exports sanitize leading formula characters (`=`, `+`, `-`, `@`, `\t`, `\r`, `%`) to prevent spreadsheet DDE/formula injection.
- [ ] JSON body parsing limit is capped at 1MB to prevent buffer exhaustion.

---

## 5. Movement Ledger Integrity
- [ ] No API endpoint exists that allows direct mutation of inventory stock balances.
- [ ] Current stock and location positions are dynamically derived exclusively from confirmed ledger lines.
- [ ] `unitCostSnapshot` and `totalCost` are permanently computed server-side from database `item.unitPrice`.
- [ ] Outbound movements (`ISSUE`, `TRANSFER`, `RETURN`) validate stock availability within MongoDB transactions.
- [ ] Confirmed movements are strictly immutable (cannot be re-confirmed, modified, or cancelled).

---

## 6. File Upload & Attachment Security
- [ ] File uploads are restricted to 5MB maximum.
- [ ] Allowed file types are strictly whitelisted: `.jpg`, `.jpeg`, `.png`, `.webp`, `.pdf`.
- [ ] Executable files (`.exe`, `.sh`, `.php`, `.js`), HTML, and SVGs are rejected.
- [ ] Storage filenames use cryptographically random hex UUIDs.
- [ ] Upload directory is outside web root or hosted on secure Cloudinary storage.

---

## 7. HTTP Headers & Transport Layer Security
- [ ] Helmet is active with Content-Security-Policy (CSP) restricting script/style/font/image sources.
- [ ] HSTS (`Strict-Transport-Security`) is enabled in production (`max-age=31536000; includeSubDomains; preload`).
- [ ] `X-Frame-Options: DENY` (clickjacking defense) is active.
- [ ] `X-Content-Type-Options: nosniff` (MIME sniffing defense) is active.
- [ ] Application is deployed behind an HTTPS reverse proxy with valid TLS certificate.

---

## 8. Database & Infrastructure
- [ ] MongoDB Atlas Network Access is restricted exclusively to production server IP addresses.
- [ ] MongoDB database user operates with least-privilege access.
- [ ] Automated daily database backups with point-in-time recovery are enabled.
- [ ] Setup script (`npm run setup`) is executed once to provision the single admin and 2 base warehouses.
- [ ] Zero demo/mock records exist in production database.

---

## 9. Verification & Pre-Flight Testing
- [ ] Security test suite passed 100%: `node server/src/testSecuritySuite.js`.
- [ ] Golden Scenario acceptance test passed 100%: `node server/src/testGoldenScenario.js`.
- [ ] `npm audit` executed and reviewed.
- [ ] No plain passwords or test credentials exist in client source or documentation.
