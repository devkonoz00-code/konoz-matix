# MATIX — Material Tracking & Project Logistics System (MVP)

A complementary cloud tracking layer for construction material and equipment logistics. Tracks where materials end up, which project holds them, who is responsible, movement history between locations, returns, and current valuation — built around an immutable **Movement Ledger** architecture where stock balances and locations are always derived dynamically, never stored as mutable numbers.

---

## 🌟 Key Architecture & Non-Negotiable Rules

1. **Movement Ledger as Single Source of Truth**:
   - Stock balances are **never** stored as a mutable number and never written directly by the frontend.
   - Every change in quantity or location happens through an immutable Movement Ledger event (`RECEIPT`, `ISSUE`, `TRANSFER`, `RETURN`, `ADJUSTMENT`).
   - Balances and current item locations are dynamically derived: $\text{Balance} = \sum \text{Inbound} - \sum \text{Outbound}$ from confirmed ledger lines.

2. **Polymorphic Location Abstraction**:
   - `fromLocation` and `toLocation` use uniform polymorphic descriptors `{ kind: "WAREHOUSE" | "PROJECT", id: ObjectId }`.

3. **Material Requests ≠ Movements**:
   - Material Requests record *intent*. They do not move or reserve stock until an authorized user acts on them via an actual Movement event.

4. **Item Identity vs. Barcodes**:
   - An Item is not its Barcode. One item can have zero, one, or several barcodes. When an item has no physical manufacturer barcode, an internal code (`ITM-XXXXXX`) is automatically generated and linked.

5. **First-Class Barcode & QR Label Printing (§11)**:
   - Scannable 1D barcode symbols (Code 128 / EAN-13) and 2D QR codes (encoding itemCode / primary barcode) rendered client-side.
   - Physical print layout using `@media print` with physical `cm` units (footprint strictly $\le 10\text{ cm}$).
   - Multi-item batch printing packed onto A4 sheets (2-column grid layout, as many labels as fit per sheet).
   - Every barcode displayed across the application is a clickable direct link opening that item's printable label.

6. **Historical Cost Freezing**:
   - Every movement line freezes the item's unit cost at the exact moment of movement (`unitCostSnapshot`), ensuring accounting integrity even if catalog prices change later.

7. **Clean Light / White-Based UI Theme (§13, §20)**:
   - Clean, crisp, high-contrast light theme with enterprise ergonomics for construction and logistics management.
   - Tri-lingual support with instantaneous switching: English (LTR), French (LTR), and Arabic (RTL, with native Cairo typography and mirrored layouts).

---

## 🚀 Getting Started & Go-Live Setup

### 1. Prerequisites
- **Node.js** v18+
- **MongoDB** (Local instance or MongoDB Atlas)

### 2. Installation
```bash
# Clone the repository
git clone <repo-url> && cd matix

# Install dependencies
npm install

# Setup environment configuration
cp .env.example .env

# Configure required environment variables in .env:
# - MONGODB_URI (Your MongoDB Atlas connection URI)
# - JWT_SECRET and JWT_REFRESH_SECRET (Strong 32+ character secrets)
# - INITIAL_ADMIN_EMAIL (Your administrator email)
# - INITIAL_ADMIN_PASSWORD (Strong password with uppercase, lowercase, digit, and symbol)
```

### 3. Initialize Production Administrator & Base Records
Run the secure setup script to provision the initial administrator account from `.env` and initialize sequence counters and base warehouses. Operational collections start completely clean:

```bash
npm run setup
```

The system provisions **one initial administrative user** based on `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`. All subsequent team members and roles are created through the secure management interface after logging in.

### 4. Start the Application
```bash
npm run dev
# Or for production:
npm start
```
Open **`http://localhost:5000`** in your browser.

---

## 🛠️ Tech Stack & Structure

- **Backend**: Node.js & Express
  - RESTful API structured cleanly as `Routes → Controllers → Services → Models`.
  - MongoDB & Mongoose ODM with resilient transaction management.
  - JWT stateless authentication (short-lived access + refresh tokens).
  - ExcelJS & json2csv for real-time XLSX/CSV reports.
- **Frontend**: Vanilla JavaScript SPA (Zero compilation / bundler lock-in)
  - Hash-based client router (`#/dashboard`, `#/items`, `#/items/labels`, `#/projects`, `#/projects/:id`, `#/movements`, `#/scanner`, etc.).
  - Mobile-first responsive layout with camera barcode scanner (`html5-qrcode`).
  - Barcode and QR generators (`JsBarcode` + `QRCode`).
  - Native i18n dictionary system with LTR/RTL support and Algerian Dinar (`DZD`) formatting.

---

## 🧪 Testing & Golden Scenario Verification

An automated end-to-end acceptance script executes the 10 steps of the Golden Scenario (§18):
```bash
node server/src/testGoldenScenario.js
```
1. Create Item with photo, no barcode, and starting quantity 50 at المخزن $\rightarrow$ auto-generates barcode, derived stock shows 50 at المخزن.
2. Generate and verify printable label ($\le 10\text{ cm}$, 1D barcode + 2D QR + name); batch-print with a second item onto one A4 sheet.
3. Create Project PRJ-01 $\rightarrow$ set POC assignment $\rightarrow$ SUPERVISOR can still act on it regardless of assignment.
4. Supervisor looks up item by barcode search $\rightarrow$ "Issue to a project" direct issue $\rightarrow$ sits PENDING until project confirms.
5. In parallel, Material Request for second item is created, approved, issued, and received.
6. Project's Materials view shows both items with correct quantities and values; Current Value and Total Consumption reflect them; printable Décharge lists both items with grand total matching Total Consumption.
7. Attempting to issue/transfer more than available is rejected with a clear insufficient/out-of-stock error.
8. "Add Stock" shortcut on first item by Warehouse Manager records new RECEIPT into المحل $\rightarrow$ derived total rises accordingly with a distinct new RECEIPT entry.
9. First item is transferred to second project, confirmed, then returned to warehouse with destination choice, confirmed.
10. Full movement history is intact, correctly ordered, and all figures reconcile with the ledger in DZD throughout.

---

## 📋 Assumptions Recorded

1. **Single Currency**: Algerian Dinar (DZD / د.ج) used consistently across all financial valuation layers, dashboards, item prices, and printable Décharge documents.
2. **Online-First Architecture**: Real-time REST ledger queries ensure multiple simultaneous warehouse and site personnel always operate on live derivations.
3. **Camera Security**: WebRTC camera barcode scanning requires standard localhost or HTTPS in production.
4. **Decoupled Document Links**: Official ERP Bon de Vente numbers are linked as metadata on movements without hard external dependencies.
