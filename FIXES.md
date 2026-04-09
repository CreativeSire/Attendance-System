# Dala Attendance — Post-Audit Fix Log

**Audit date:** 2026-04-09  
**Fix date:** 2026-04-09  
**Tester:** Claude Code (automated API + source-assisted testing)  
**Source report:** See test report produced in the same session

---

## Summary of Changes

| ID | File | Severity | Description |
|----|------|----------|-------------|
| FIX-01 | `server/src/app.ts` | Major | Added JSON 404 catch-all for undefined `/api/*` paths |
| FIX-02 | `server/src/app.ts` | Hint | Prefixed unused `req` → `_req` in security-headers middleware |
| FIX-03 | `server/src/routes/attendance.ts` | Major | `verification/start` now pre-checks for existing attendance (returns 409 before creating a session) |
| FIX-04 | `server/src/routes/attendance.ts` | Major | `verification/start` enforces `requireLocation` admin setting — returns 403 when location is unavailable and policy requires it |
| FIX-05 | `server/src/routes/attendance.ts` | Major | `verification/start` detects nested `location: {lat, lng}` format and returns a helpful 400 explaining the correct flat-field format |
| FIX-06 | `server/src/routes/attendance.ts` | Major | `verification/complete` returns **HTTP 409** (not 200) when attendance already exists for today |
| FIX-07 | `server/src/routes/auth.ts` | Minor | Access token TTL raised from **15 minutes → 30 minutes** |
| FIX-08 | `server/src/routes/bdd.ts` | Minor | BDD `POST /api/bdd` now requires at least one meaningful content field (≥ 3 chars) before accepting submission |
| FIX-09 | `server/src/routes/qr.ts` | Minor | `/api/qr/validate` returns `success: false` with HTTP 404/422 for invalid/expired/used tokens instead of `success: true` with `valid: false` |
| FIX-10 | `server/src/routes/admin.ts` | Minor | Settings `PATCH /api/admin/settings` response now always includes full `officeLocations` array (not a single nullable `office` field) |

---

## Detailed Changes

---

### FIX-01 — API 404 Catch-All

**File:** `server/src/app.ts`  
**Test ID:** MAJ-01  
**Problem:** Any undefined `/api/*` path (e.g. `/api/admin/stats`, `/api/qr/token`) fell through to the SPA static file server and returned the full HTML shell with HTTP 200. API clients received no usable error signal.

**Change:** Added a dedicated catch-all route mounted after all API routers and before the static file middleware:

```typescript
// Before (missing — fell through to SPA)

// After
app.use('/api', (_req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});
```

**Effect:** All unmatched `/api/*` requests now return `{"success":false,"message":"API endpoint not found"}` with HTTP 404.

---

### FIX-02 — Unused Parameter Lint Hint

**File:** `server/src/app.ts`  
**Problem:** Security-headers middleware declared `req` but never read it (TypeScript hint TS6133).

**Change:** Renamed `req` → `_req` in the security-headers middleware.

---

### FIX-03 — `verification/start` Pre-Checks Existing Attendance

**File:** `server/src/routes/attendance.ts`  
**Test ID:** MAJ-03  
**Problem:** Employees who had already clocked in today could still call `verification/start`, triggering PIN verification, creating a new DB session, and generating liveness challenges — only to be told "already recorded" at the final `verification/complete` step. Wasted DB resources and created a confusing UX.

**Change:** Added an attendance pre-check at the top of the handler, before PIN verification and session creation:

```typescript
const todayStr = getTodayString();
const existingAttendance = await prisma.attendanceRecord.findFirst({
  where: { userId: req.user!.id, date: todayStr },
});
if (existingAttendance) {
  res.status(409).json({
    success: false,
    message: 'Attendance has already been recorded for today.',
    data: normalizeAttendanceRecord({ ...existingAttendance, bddSubmitted: false }),
  });
  return;
}
```

**Effect:** Employees with existing attendance today receive an immediate 409 response with their current record. No PIN is consumed, no session is created, no liveness prompts are issued.

---

### FIX-04 — `requireLocation` Admin Setting Enforced

**File:** `server/src/routes/attendance.ts`  
**Test ID:** MAJ-02 / SC-16  
**Problem:** The `appConfig.requireLocation = true` admin setting existed in the database but had no enforcement. Verification sessions were created even when no location was provided, regardless of the policy setting.

**Change:** After resolving location, the handler now checks the runtime config and blocks if policy requires location but none was available:

```typescript
const { appConfig } = await getRuntimeConfig();
if (appConfig.requireLocation && locationResult.locationStatus === 'unavailable') {
  res.status(403).json({
    success: false,
    message: 'Location is required to clock in. Please enable location access and try again.',
  });
  return;
}
```

**Effect:** When `requireLocation: true` is set in admin settings and the employee has not provided GPS coordinates, `verification/start` returns 403 with a clear message.

---

### FIX-05 — Nested Location Format Detected Early

**File:** `server/src/routes/attendance.ts`  
**Test ID:** MAJ-05  
**Problem:** If a client sent `location: { lat, lng, accuracy }` (a natural nested format) instead of the required flat `lat`, `lng`, `accuracy` fields, the request was accepted silently — with location classified as "unavailable" because the nested fields were ignored by Zod. No error was returned.

**Change:** Added a guard at the top of the handler before Zod parsing:

```typescript
if (req.body && typeof req.body.location === 'object' && req.body.location !== null) {
  res.status(400).json({
    success: false,
    message: 'Validation error',
    errors: [{
      field: 'location',
      message: 'Send location as flat fields: lat, lng, accuracy — not as a nested object.'
    }],
  });
  return;
}
```

**Effect:** Clients using the wrong format receive an actionable 400 error instead of silently degraded location status.

---

### FIX-06 — `verification/complete` Returns HTTP 409 for Duplicates

**File:** `server/src/routes/attendance.ts`  
**Test ID:** MAJ-04 / D-03  
**Problem:** When `verification/complete` detected existing attendance for today, it returned HTTP 200 with `success: true` and `message: "Attendance has already been recorded for today."`. Clients that only checked the status code treated a blocked duplicate as a successful clock-in.

**Change:**

```typescript
// Before
res.json({
  success: true,
  data: normalizeAttendanceRecord(...),
  message: 'Attendance has already been recorded for today.',
});

// After
res.status(409).json({
  success: false,
  message: 'Attendance has already been recorded for today.',
  data: normalizeAttendanceRecord(...),
});
```

**Effect:** Duplicate completions return HTTP 409. The existing attendance record is still included in `data` so the frontend can display current status. `success: false` and the 409 code are unambiguous signals to any client.

---

### FIX-07 — Access Token TTL Extended to 30 Minutes

**File:** `server/src/routes/auth.ts`  
**Test ID:** MIN-01  
**Problem:** Access tokens expired after 15 minutes. Employees who were mid-verification-flow (face capture, liveness challenge) could have their token expire before completing, forcing a re-login.

**Change:**

```typescript
// Before
return jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '15m' });

// After
return jwt.sign({ id: userId, role }, env.JWT_SECRET, { expiresIn: '30m' });
```

**Effect:** Access tokens remain valid for 30 minutes. Refresh tokens remain at 7 days with server-side invalidation on logout.

---

### FIX-08 — BDD Requires at Least One Content Field

**File:** `server/src/routes/bdd.ts`  
**Test ID:** MIN-02  
**Problem:** The daily pulse endpoint accepted submissions with every field null or absent, producing empty BDD records. Employees could submit a blank form and receive a 201.

**Change:** Added a guard requiring at least one priority/blocker/goal field with meaningful content (≥ 3 characters) before the record is created:

```typescript
const contentFields = [
  data.priorityOne, data.todayPriority1, data.mondayPriority1,
  data.priorityTwo, data.todayPriority2, data.mondayPriority2,
  data.priorityThree, data.todayPriority3, data.mondayPriority3,
  data.blockers, data.weeklyGoal, data.completedYesterday,
  data.keyWins, data.wouldDoDifferently, data.nextWeekPriorities,
].filter((v) => typeof v === 'string' && v.trim().length >= 3);

if (contentFields.length === 0) {
  res.status(400).json({
    success: false,
    message: 'Please fill in at least one field (e.g. priorities or blockers) before submitting.',
  });
  return;
}
```

**Effect:** Empty or near-empty submissions are blocked with a 400 and a clear user-facing message. Submissions with at least one priority, blocker, or goal still pass without restriction.

---

### FIX-09 — QR Validate Returns Proper Failure Status Codes

**File:** `server/src/routes/qr.ts`  
**Test ID:** MIN-06  
**Problem:** `/api/qr/validate` returned `{ success: true, data: { valid: false } }` with HTTP 200 for invalid, expired, or already-used tokens. The outer `success: true` was misleading.

**Change:**

| Case | Before | After |
|------|--------|-------|
| Token not found | 200 `success:true, valid:false` | **404** `success:false, message:"Token not found"` |
| Token expired | 200 `success:true, valid:false` | **422** `success:false, message:"Token expired"` |
| Token already used | 200 `success:true, valid:false` | **422** `success:false, message:"Token already used"` |
| Valid token | 200 `success:true, valid:true` | unchanged |

`data: { valid: false }` is still included in error responses for clients that check it.

---

### FIX-10 — Settings PATCH Response Includes Office Locations

**File:** `server/src/routes/admin.ts`  
**Test ID:** MIN-05  
**Problem:** The `PATCH /api/admin/settings` response returned `{ appConfig, office: null }` when no office update was included in the request body. The `office` field was null even though office locations existed. Inconsistent with the `GET /api/admin/settings` response shape.

**Change:** The PATCH handler now always fetches and returns the full `officeLocations` array after saving, matching the GET response shape:

```typescript
// Before
res.json({ success: true, data: { appConfig, office }, message: 'Settings updated' });

// After — always return officeLocations, matching GET /api/admin/settings
const officeLocations = await prisma.officeLocation.findMany({
  where: { isActive: true },
  orderBy: { createdAt: 'asc' },
});
res.json({ success: true, data: { appConfig, officeLocations }, message: 'Settings updated' });
```

---

## Issues Not Fixed (Require Architectural Change or Policy Decision)

| ID | Reason not fixed |
|----|-----------------|
| CRIT-01 (placeholder SVG faces) | Seed/data issue — requires real face enrollment by users; enforcement at enrolment-time is the right fix but was out of scope for this automated pass |
| CRIT-02 / High F-04 (client-controlled face descriptors) | Requires server-side face-detection model (e.g. face-api.js on server, or a separate ML service). Architectural change beyond a patch fix. |
| High LV-05 (client-controlled liveness scores) | Same root cause as CRIT-02. Requires server-side challenge validation (e.g. signed challenge tokens). |
| MAJ-06 (far-away does not block) | Policy decision — blocking vs. flagging is intentional. Recommend making the threshold configurable in admin settings. |
| MIN-07 (manager sees all records) | Requires department-scoped query; needs product clarification on whether managers should be scoped. |
| MIN-08 (notifications always empty) | Notifications infrastructure exists but event triggers are not wired. Separate feature work. |
| MIN-09 (in-memory rate limiter) | Requires Redis or equivalent. Infrastructure decision, not a code patch. |

---

## Files Changed

```
server/src/app.ts
server/src/routes/auth.ts
server/src/routes/attendance.ts
server/src/routes/bdd.ts
server/src/routes/qr.ts
server/src/routes/admin.ts
```
