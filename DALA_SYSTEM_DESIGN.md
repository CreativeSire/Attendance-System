# Dala Workforce Intelligence Platform
## Complete System Design Document

**Version:** 2.0
**Date:** March 30, 2026
**Status:** Active Planning — Phase 0 Ready to Build

---

## 1. Overview

Dala is a sophisticated workforce management platform designed to replace manual, paper-based processes — specifically the handwritten BDD (Business Development Daily) check-in forms — with a digital, intelligent, and verifiable system.

It combines a smart clock-in engine with layered physical verification, a structured daily productivity check-in (the BDD form), full ERP modules, and an AI intelligence layer — all feeding directly into payroll.

The system is designed around one core principle: **you must prove you are physically present before you can log a working day.**

---

## 2. The Problem Being Solved

The current process uses handwritten weekly BDD sheets capturing:

- Daily priorities and accomplishments
- Blockers and support needed
- Weekly goal progress
- AI usage reflection (Saturdays)

**Problems with the paper process:**

- No verification the person was physically present
- Data is not searchable, reportable, or analyzable
- No link between daily output and payroll
- Easy to falsify or fill in retroactively
- Manager must manually read 10–20 forms per week
- No early warning for recurring blockers or absenteeism

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                 DALA WORKFORCE INTELLIGENCE PLATFORM             │
│                                                                  │
│  ┌───────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  Clock-In Engine  │  │  Daily Pulse   │  │  ERP Modules   │  │
│  │  (Verification)   │  │  (BDD Form)    │  │  (HR/Pay/OKR)  │  │
│  └───────────────────┘  └────────────────┘  └────────────────┘  │
│             │                   │                   │            │
│  ┌──────────▼───────────────────▼───────────────────▼─────────┐  │
│  │              Intelligence Layer (AI + Analytics)           │  │
│  └────────────────────────────────────────────────────────────┘  │
│             │                                                    │
│  ┌──────────▼────────────────────────────────────────────────┐   │
│  │          Notification & Communication Hub                  │   │
│  │          (WhatsApp / Email / In-App)                       │   │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Tech Stack:**

- **Frontend:** React + TypeScript + Tailwind CSS (shadcn/ui)
- **Backend:** Node.js + Express
- **Database:** PostgreSQL via Prisma ORM
- **AI/ML:** Face recognition (`@vladmandic/face-api`), Claude API for text summarization
- **Real-time:** WebSockets (Socket.io)
- **Background Jobs:** Trigger.dev
- **Notifications:** Twilio (WhatsApp/SMS) + Firebase Cloud Messaging
- **Deployment:** Railway

---

## 4. Clock-In Verification — Phased Rollout

The verification stack is built in phases. Each phase adds a hardware layer on top of the previous one. The app logic handles all phases — you upgrade the hardware, not the software.

### Phase 0 — QR Code (Current, No Hardware Required)

**What it uses:** A screen at each entry point + any smartphone camera.

**How it works:**

A cheap device (old phone, tablet, spare laptop) is mounted at each entry point and loads a single rotating QR page. The server generates a brand new code every 3 minutes. The old code is immediately invalidated.

```
Each QR token contains:
├── Entry point ID        (which door)
├── Timestamp             (when generated)
├── One-time token        (cryptographic string)
└── Expiry                (3 minutes)
```

**Employee clock-in flow:**

```
Employee arrives at door
        ↓
Opens Dala app → taps Clock In
        ↓
Camera opens → scans QR on screen
        ↓
Server validates token (not expired, not used before)
        ↓
Face scan (live photo vs. master photo)
        ↓
Liveness check (blink prompt — prevents photo spoofing)
        ↓
Daily Pulse BDD form (mandatory, cannot skip)
        ↓
Clock-in complete ✓
```

**How cheating is prevented:**

| Attempt | Why It Fails |
|---------|-------------|
| Screenshot QR, send to absent colleague | Token expires in 3 minutes |
| Use old screenshot | Token is one-time use — consumed on first scan |
| One person scans for others | Face recognition catches the wrong person immediately after |
| Scan from outside through a window | Must be within close camera range of the screen |
| Manipulate the app | Server validates all tokens — client cannot forge them |

**Hardware needed per entry point:**

- Any screen: old Android phone, cheap tablet, or spare laptop
- Mounted at eye level, facing employees as they walk in
- Loads: `dala.app/entry/door-[id]` — nothing else
- Cost: ₦0 if spare devices available / ₦30,000–₦50,000 for a new tablet

---

### Phase 1 — NFC Tags (Next Step)

**What it adds:** NFC sticker on each door frame. Employee taps their phone against it before the QR scan. Confirms they touched that exact entry point.

**Requirement:** Employee phone must have NFC hardware.

**Nigerian phone reality:** Budget phones (Tecno Spark, Itel, old Androids) often do not have NFC. Therefore NFC is **optional** — employees without NFC phones fall back to QR automatically. No one is blocked.

```
Employee WITH NFC phone:
└── NFC tap → QR scan → Face scan → Liveness ✓

Employee WITHOUT NFC phone:
└── QR scan → Face scan → Liveness ✓
```

**Where to buy NFC tags (Nigeria):**

| Option | Product | Price | Link |
|--------|---------|-------|------|
| Jumia Nigeria | Yiliker 10pcs NTAG215 stickers | ₦5,053 | jumia.com.ng/mlp-nfc-tags |
| Jumia Nigeria | 50pcs NTAG216 stickers | ₦9,990 | jumia.com.ng/mlp-nfc-tags |
| Jumia Nigeria | RFID White Cards 10pcs | ₦6,500 | jumia.com.ng/mlp-nfc-tags |
| AliExpress | 100pcs NTAG213 stickers | ~₦8,000 | aliexpress.com |

**Recommended purchase:** 50pcs NTAG216 for ₦9,990 on Jumia — covers a full team and arrives in 2–3 days.

**NFC chip recommendation:** NTAG213 or NTAG215. NTAG213 (144 bytes) is sufficient for an employee ID and entry token. NTAG216 (888 bytes) is overkill but fine.

---

### Phase 2 — BLE Beacons (Full Stack)

**What it adds:** Small Bluetooth devices mounted inside the building. The phone passively detects beacon signal — if detected at sufficient strength, the person is confirmed physically inside the building.

**Why this matters:** NFC and QR prove you were at the door. BLE proves you are inside the building throughout the session — passive and continuous.

**Beacon signal is controllable:** Radius can be tuned (5–30 metres) so it does not bleed significantly outside a solid standalone building.

**BLE is NOT available on Jumia Nigeria.** The "bluetooth adapters" shown on Jumia are USB dongles for computers — a completely different product. Do not buy those.

**Where to buy BLE beacons (Nigeria):**

| Option | Product | Price | Notes |
|--------|---------|-------|-------|
| Dirigible Nigeria (Lagos) | Teltonika BTSID1 | Call for price | +234 818 024 5741 / sales@dirigible.com.ng |
| AliExpress | NRF51822 iBeacon (BLE 4.2) | ~₦8,000–₦12,000/unit | 15–30 day delivery |
| AliExpress | Minew E7 (BLE 5.0) | ~₦10,000–₦20,000/unit | Better quality |
| Computer Village, Ikeja | IoT/Arduino component vendors | Variable | Ask for "iBeacon BLE module" |

**Recommended beacons by budget:**

- **Budget:** NRF51822 generic (AliExpress ~$5) — good for testing
- **Mid-tier:** Minew E7 (AliExpress ~$8–$12) — better battery, BLE 5.0
- **Premium/local support:** Teltonika BTSID1 (Dirigible Nigeria)

**Deployment:** 1 beacon per entry zone + 1–2 inside main work area. A 3-door office needs 4–5 beacons total.

---

### Full Verification Stack (Phase 2 Complete)

| Layer | Method | Phase | Presence Proof |
|-------|--------|-------|---------------|
| 1 | QR Code (rotating, 3-min expiry) | 0 — Now | At the door |
| 2 | NFC Tag tap (optional fallback to QR) | 1 — Soon | Exact door frame |
| 3 | BLE Beacon detection | 2 — Later | Inside building |
| 4 | Face Recognition | 0 — Now | Identity |
| 5 | Liveness Detection | 0 — Now | Anti-spoof |
| 6 | Google Fused Location | 0 — Now | Audit log only |

**Note on GPS / Google Maps:** Raw GPS is unreliable indoors. The system uses Google's Fused Location Provider (combines GPS + visible WiFi signals + cell towers) as a **background audit tag only** — it logs approximate coordinates for records but does not block or gate the clock-in. It is most useful for remote/field workers.

---

## 5. Module 2 — Daily Pulse (Digital BDD Check-In)

This is a **mandatory form that appears immediately after a successful clock-in.** It cannot be dismissed or skipped. It directly replaces the handwritten BDD weekly sheet.

### Monday Form — Weekly Brief

```
1. What did you accomplish last week?             [Long text]
2. What is your top priority / goal this week?    [Long text]
3. Any challenges you foresee this week?          [Long text]
4. What support do you need from management?      [Long text]
5. Today's top 1–3 priorities                     [3 fields]
6. Questions / Notes                              [Long text]
7. Previous S.E. Meeting feedback                 [Long text]
```

### Tuesday – Friday Form — Daily Standup

```
1. Progress toward weekly goal                    [0–100% slider]
2. What did you complete yesterday?               [Long text]
3. Today's top 1–3 priorities                    [3 fields]
4. Any blockers?                                 [Long text]
5. Support / assistance needed                    [Long text]
6. Questions / Notes                              [Long text]
```

### Saturday Form — Weekly Wrap

```
1. Was your weekly goal achieved?                 [Yes / Partial / No + reason]
2. Key wins this week                             [Long text]
3. What you achieved WITH AI this week            [Long text]
4. What would you do differently?                 [Long text]
5. Top 1–3 priorities for next week               [3 fields]
```

### AI Layer on the BDD Form

- Each submission is summarized into one sentence by Claude API
- Every Monday at 8:30 AM the system generates a **Team Brief** — a narrative of what every team member is focused on that week, surfaced to managers without reading individual forms
- If someone logs the **same blocker 3 consecutive days**, the system auto-flags it to their line manager
- Saturday AI usage responses aggregate into a weekly **AI Adoption Report** across the team

---

## 6. How Attendance Feeds Payroll

Every clock-in data point has a direct financial consequence. The system does not separate attendance from pay.

### Direct Pay Calculations

```
Hours worked    = Clock-out time − Clock-in time
Late minutes    = Clock-in time − 9:00 AM shift start (if after)
```

### Full Payroll Formula

```
Base Salary
  − Late deductions          (late_minutes × hourly_rate ÷ 60)
  − Absent deductions        (no attendance + no approved leave = full day deducted)
  − Early departure penalty  (hours_short × hourly_rate)
  + Overtime pay             (hours beyond scheduled × 1.5× rate)
  + Weekend allowance        (Saturday clock-in, where applicable)
  + Performance bonus        (BDD weekly goal completion rate ≥ threshold)
  + AI usage incentive       (optional — based on Saturday BDD field)
  − Unpaid leave days
──────────────────────────────────────────────────────
= Gross Taxable Pay
  − PAYE Tax                 (Nigerian tax brackets)
  − Pension Employee (8%)
  − NHF (2.5% of basic)
──────────────────────────────────────────────────────
= Net Pay (bank transfer amount)
```

### BDD Form → Performance Pay

| BDD Data Point | Payroll Impact |
|---------------|---------------|
| Weekly goal completion rate ≥ 80% | Bonus eligibility unlocked |
| Consecutive BDD submissions (no skips) | Consistency bonus |
| Skipped BDD form after clock-in | Warning → docked from performance score |
| Same blocker unresolved 3+ days | Under-performance review flag |
| Saturday AI usage field | AI adoption incentive (if company runs programme) |

### Leave Types → Pay Rules

| Leave Type | Pay Rule |
|------------|----------|
| Annual Leave | Full pay |
| Sick Leave | Full pay (within allowance) |
| Casual Leave | Full or half pay (policy-defined) |
| Study Leave | Partial pay |
| Unpaid Leave | Zero pay |
| Absent (no request filed) | Full day deducted + disciplinary flag |

### The Audit Trail Advantage

Because every action is timestamped, photo-verified, and GPS-tagged:

- No disputes about "I was there" — QR token + face + liveness proves it
- BDD timestamps prove when work planning occurred
- Full exportable log per employee per month
- Payroll disputes resolved from immutable records

### Payroll Outputs

- Individual payslip PDF per employee
- Bank transfer summary export (Excel)
- Month-to-date deduction breakdown
- Employee dispute mechanism (flag a line item for manager review)

---

## 7. ERP Core Modules

### 7.1 HR Management

- Employee profiles: personal info, role, department, contract type
- Org chart view
- Document storage: contracts, ID, certificates (with expiry alerts)
- Onboarding digital checklist per role
- Offboarding workflow

### 7.2 Leave Management

- Leave balance tracker per employee per type
- Manager approval workflow (approve / reject / request clarification)
- Team calendar — see who is out on any given day
- Automatic payroll deduction on approval

### 7.3 Expense Management

- Submit expenses with receipt photo
- Category tagging (travel, meals, supplies, client entertainment)
- Manager approval workflow
- Approved expenses added to payroll reimbursement line
- Monthly expense summary report per employee and department

### 7.4 Performance Management (OKR)

- Quarterly objective setting per employee
- Key results with progress tracking
- BDD daily data feeds performance score automatically
- Manager review cycle (monthly / quarterly)
- Streak tracking: longest consecutive on-time days with completed BDD forms

### 7.5 Training and Certification Tracking

- Log completed training per employee
- Certification expiry alerts (30 days and 7 days before expiry)
- Required vs. completed training matrix per role
- Training completion visible in performance reviews

### 7.6 Shift and Schedule Management

- Assign shifts and working hours per employee
- Overtime pre-approval requests
- Shift swap requests (peer-to-peer, manager-approved)
- Late threshold configurable per shift (not hardcoded to 9:00 AM)

---

## 8. Intelligence Layer

| Feature | Description |
|---------|-------------|
| Attendance Prediction | Identifies employees likely to be absent based on historical patterns |
| Pattern Anomaly Alerts | "Employee X has been late every Monday for 6 weeks" → manager alert |
| AI Team Brief | Auto-generated Monday narrative of team priorities via Claude API |
| Productivity Correlation | BDD goal completion rate vs. attendance consistency graph |
| Mood Trend Dashboard | Team-level emotion trends over time (anonymized aggregate) |
| AI Adoption Tracker | Saturday BDD field aggregated into weekly team report |
| Blocker Detection | Same blocker logged 3+ days → escalated to manager automatically |
| Absence Escalation | No clock-in by 10 AM with no leave on file → automatic manager alert |

---

## 9. Notification and Communication Hub

### Automated Alerts

| Trigger | Recipient | Channel |
|---------|-----------|---------|
| Not clocked in by threshold time | Employee | WhatsApp / SMS |
| Absent, no leave request, by 10 AM | Line Manager | Email + In-App |
| Late 3+ consecutive days | HR | In-App alert |
| Same blocker 3 days running | Manager | In-App alert |
| Leave request submitted | Manager | Email + In-App |
| Leave approved or rejected | Employee | WhatsApp + In-App |
| Payslip ready | Employee | Email + In-App |
| Certification expiring in 30 days | Employee + Manager | Email |

### Manager Daily Digest (7:00 AM)

- Who is clocked in (count and names)
- Who is late and by how many minutes
- Who is absent and whether leave is filed
- Pending approvals: leave, expense, corrections
- Team mood summary from previous day's clock-ins

### Broadcast System

- Admin sends office-wide or department-specific broadcasts
- Broadcasts appear on employee dashboard on next login
- Expiry time configurable per broadcast

---

## 10. Multi-Location and Hybrid Work

- Define multiple office locations (HQ, branch, client sites)
- Each location has its own QR entry screens and (later) beacons
- **Work From Home mode:** Face + liveness check, BDD form mandatory, Fused Location logs home coordinates
- **Field Work mode:** GPS trail logged throughout the day, pre-approved by manager before day starts
- **Client Site mode:** Manager pre-registers the site, employee clocks in at client location
- All modes visible to admin on map view

---

## 11. Data Model — Key Tables

| Table | Purpose |
|-------|---------|
| `User` | Employee profiles, roles, master photo, hourly rate |
| `AttendanceRecord` | Every clock-in/out with QR token, photo, method, mood, hours |
| `QRToken` | Generated tokens with entry point, expiry, used status |
| `BDDCheckIn` | Daily pulse form responses, AI summary, goal progress |
| `CorrectionRequest` | Employee-requested fixes to attendance records |
| `LeaveRequest` | Leave applications with type, dates, approval status |
| `ExpenseRequest` | Expense claims with receipt, amount, approval status |
| `PerformanceGoal` | Quarterly OKRs per employee |
| `Shift` | Scheduled shifts and hours per employee |
| `BroadcastMessage` | Office announcements with expiry |
| `Notification` | All system notifications with read status |
| `AuditLog` | Immutable record of every system action |

---

## 12. Daily User Experience

### Employee

```
7:45 AM  → Phone notification: "Time to check in"
           ↓
Walks to entry door
           ↓
Opens Dala app → Clock In → camera opens
           ↓
Scans rotating QR on door screen
           ↓
Face scan → liveness check (blink)
           ↓
Daily Pulse BDD form (2–3 minutes)
           ↓
"Good morning [Name]. Top priority today: [from BDD form]"

5:30 PM  → Notification: "Don't forget to clock out"
           ↓
Scans QR at exit → face scan
           ↓
"You worked 8.5 hours. 0.5 hours overtime logged."
```

### Manager

```
7:00 AM  → Email digest: 18 in ✓, 2 late, 1 absent (no leave on file)
           ↓
Dashboard: 1 leave request, 2 expense claims pending
           ↓
8:30 AM  → AI Team Brief: "This week the team is focused on..."
           ↓
One-click approvals for routine items
```

---

## 13. Security and Compliance

- JWT authentication with refresh tokens and MFA
- Role-based access control: Admin / Manager / Employee
- QR tokens are single-use, server-generated, cryptographically signed
- All photos and biometric data encrypted at rest
- Audit log for every action (who, what, when, from where)
- NDPR-aligned data handling (Nigeria Data Protection Regulation)

---

## 14. Hardware Summary

### Phase 0 — What You Need Right Now

| Item | Purpose | Cost |
|------|---------|------|
| 1 screen per entry point (old phone, tablet, or laptop) | Display rotating QR | ₦0 if spare devices available |
| Internet connection for the screen | Load QR page | Already available (company laptops are online) |

**Total hardware cost for Phase 0: ₦0**

---

### Phase 1 — NFC Tags (Next Purchase)

| Item | Where | Cost |
|------|-------|------|
| 50pcs NTAG216 sticker tags | Jumia Nigeria | ₦9,990 |

**Delivery:** 2–3 days (Jumia Express).
**Note:** NFC is optional in the app. Employees without NFC phones automatically fall back to QR. No one is blocked.

---

### Phase 2 — BLE Beacons

**Important:** BLE beacons are NOT available on Jumia Nigeria. The "Bluetooth adapters" on Jumia are USB dongles for computers — a completely different product.

| Option | Where | Cost per Unit | Lead Time |
|--------|-------|---------------|-----------|
| NRF51822 iBeacon | AliExpress | ~₦8,000–₦12,000 | 15–30 days |
| Minew E7 (BLE 5.0) | AliExpress | ~₦10,000–₦20,000 | 15–30 days |
| Teltonika BTSID1 | Dirigible Nigeria, Lagos | Call for price | Days |

**Dirigible Nigeria contact:** +234 818 024 5741 / sales@dirigible.com.ng

**Quantity needed:** 1 per entry zone + 1–2 inside the main work area. A 3-door office needs 4–5 beacons.

---

### Full Budget Estimate (20–50 person office)

| Phase | Item | Cost |
|-------|------|------|
| Phase 0 | Entry screens (spare devices) | ₦0 |
| Phase 1 | 50 NFC tags (Jumia) | ₦9,990 |
| Phase 2 | 4–5 BLE beacons (AliExpress) | ₦40,000–₦100,000 |
| **Total** | | **₦50,000–₦110,000** |

---

## 15. Build Phases

| Phase | What Gets Built | Priority |
|-------|----------------|---------|
| **Phase 1** | QR clock-in engine + rotating token system + entry screens | Critical |
| **Phase 2** | BDD Daily Pulse form (mandatory post-clock-in gate) | Critical |
| **Phase 3** | JWT auth upgrade + MFA + real-time WebSockets | High |
| **Phase 4** | Payroll engine (deductions, overtime, bonuses, payslip PDF) | High |
| **Phase 5** | Leave and expense management with approval workflows | High |
| **Phase 6** | NFC tap layer (optional, falls back to QR) | Medium |
| **Phase 7** | Performance / OKR module + BDD feeding performance scores | Medium |
| **Phase 8** | AI summarization (Claude API) — Team Brief + blocker detection | Medium |
| **Phase 9** | Notification hub (WhatsApp / SMS + email digests) | Medium |
| **Phase 10** | BLE beacon layer + hybrid/remote work modes | Low |
| **Phase 11** | Predictive ML + advanced analytics + AI adoption tracking | Low |

---

## 16. Key Design Principles

1. **Verification before entry** — no one logs attendance without proving presence
2. **The BDD form is not optional** — it is gated, not a courtesy
3. **Data drives pay** — every attendance point has a direct payroll consequence
4. **Hardware phases, software stays stable** — QR today, NFC tomorrow, BLE later; the app handles all without rewrites
5. **No employee is blocked by their phone model** — every layer has a fallback
6. **Managers see signals, not noise** — AI surfaces patterns so humans decide
7. **Audit everything** — every action is logged, timestamped, and non-repudiable

---

*Dala Workforce Intelligence Platform — Internal System Design Document*
*Version 2.0 — Updated March 30, 2026 following planning session*
*Incorporates: QR-first verification, phased NFC/BLE rollout, payroll integration, BDD digital form, ERP modules, Nigerian hardware sourcing*
