# Dala Workforce Intelligence Platform

A full-stack workforce management system with smart QR clock-in, daily BDD check-ins, payroll integration, and ERP modules.

---

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (local or cloud e.g. Neon, Railway)

### 1. Configure Environment

Edit `server/.env`:
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/dala_db"
JWT_SECRET="your-secret-here"
JWT_REFRESH_SECRET="your-refresh-secret-here"
PORT=3001
CLIENT_URL="http://localhost:5173"
NODE_ENV="development"
```

### 2. Install Dependencies
```bash
npm install                              # root
cd server && npm install                 # backend
cd ../client && npm install              # frontend
```

### 3. Set Up Database
```bash
cd server
npx prisma db push          # create tables
npx ts-node prisma/seed.ts  # seed demo data
```

### 4. Run Development Servers
```bash
# From root — runs both simultaneously
npm run dev

# Or individually:
cd server && npm run dev     # http://localhost:3001
cd client && npm run dev     # http://localhost:5173
```

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@dala.com | admin123 |
| Manager | sarah@dala.com | password123 |
| Employee | amaka@dala.com | password123 |
| Employee | chidi@dala.com | password123 |
| Employee | fatima@dala.com | password123 |

---

## Entry Screen (Door Display)

Mount on a tablet/phone at each office entrance. Navigate to:
```
http://localhost:5173/entry/ep-main    ← Main Entrance
http://localhost:5173/entry/ep-side    ← Side Entrance
```

No login required. Shows rotating QR code that refreshes every 3 minutes.

---

## Features

### Clock-In System
- Rotating QR codes (3-min expiry, one-time use)
- Face recognition + liveness detection
- Multiple entry points supported
- Late detection (threshold: 9:00 AM)

### Daily Pulse (BDD Form)
- Mandatory after every clock-in
- Monday: Weekly brief + goals
- Tue–Fri: Daily standup + progress slider
- Saturday: Weekly wrap + AI usage reflection

### ERP Modules
- Payroll: Nigerian tax (PAYE, Pension, NHF), deductions, overtime
- Leave Management: 4 leave types, balance tracking, approvals
- Expense Management: Receipt upload, category tracking, reimbursement
- Performance: OKR tracking, BDD-fed scores, streaks
- Team: Employee directory, profiles, org management

### Verification Phases
- **Phase 0 (current):** QR code + Face recognition
- **Phase 1 (next):** + NFC tag tap at door
- **Phase 2 (future):** + BLE beacon presence detection

---

## Project Structure

```
├── client/          React + TypeScript + Vite frontend
├── server/          Express + Prisma + PostgreSQL backend
│   ├── prisma/      Schema + migrations + seed
│   └── src/         Routes, middleware, socket, utils
├── DALA_SYSTEM_DESIGN.md
├── DALA_SYSTEM_DESIGN.pdf
└── README.md
```

---

*Built with the Dala system design v2.0 — March 2026*
