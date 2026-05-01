# OKR Module — Stitch Design Specification (v2)

> Comprehensive design document for the Kacha HRMS OKR module aligned with the updated BRD, execution system documentation, and multi-layer database schema. Every page, modal, and shared component is defined with exact layout, behavior, and sequential flow.

> [!IMPORTANT]
> This document reflects the **governed multi-layer OKR model**: Company → Department → (Team) → Individual. OKRs are not freely created — they cascade top-down through publication gates, contributor assignment, and configurable workflows. Score, Value, and Completion are separate concepts.

---

## 1. Design System Reference

### Color Palette

| Token | CSS Variable | Hex / Value | Usage |
|---|---|---|---|
| **Primary** | `--color-primary` | `#e55400` | Buttons, active tabs, sidebar active, headers |
| **Primary Light** | `--color-primary-light` | `color-mix(in srgb, var(--color-primary), #fff 90%)` | Hover backgrounds, selected row tints |
| **Primary Dark** | `--color-primary-dark` | `color-mix(in srgb, var(--color-primary), #000 20%)` | Pressed button states |
| **Secondary** | `--color-secondary` | `#ffda00` | Accent icons, decorative blobs, secondary stat cards |
| **Secondary Light**| `--color-secondary-light`| `color-mix(in srgb, var(--color-secondary), #fff 90%)` | Secondary hover states |
| **Success** | `--color-success` | `#28a745` | Green badges, green progress, "On Track", "Completed" |
| **Warning** | `--color-warning` | `#ffc107` | Yellow badges, "At Risk", "Changes Requested" |
| **Error** | `--color-error` | `#dc3545` | Red badges, red progress, "Off Track", "Rejected" |
| **Info** | `--color-info` | `#17a2b8` | Informational banners, "Published" status |
| **Dark Grey** | `--color-k-dark-grey`| `#333333` | Heading text, body text |
| **Medium Grey** | `--color-k-medium-grey`| `#888888` | Subtext, captions |
| **Light Grey** | `--color-k-light-grey`| `#f5f5f5` | Page background, input backgrounds, tab containers |
| **White** | `--color-k-white` | `#ffffff` | Card surfaces |

### Typography

| Role | Font | Weight | Example |
|---|---|---|---|
| Page titles (h1) | `Jost` | 700 | "Company Objectives" |
| Section titles (h2, h3) | `Space Grotesk` | 600 | "Department Performance" |
| Body & labels | `Montserrat` | 400–500 | Table cells, form labels |
| Accent / display numbers | `Outfit` | 600 | Large stat values like "87%" |

### Core UI Patterns

| Pattern | Spec |
|---|---|
| **Card** | `bg-white rounded-2xl shadow-card p-6`, optional `border border-gray-100` |
| **Page Header** | `bg-primary rounded-2xl p-8 text-white` + decorative SVG blob (`#ffda00`, `opacity-70`) floating right |
| **Stat Card** | Card with 48×48px icon container (`rounded-xl`, colored bg), label (`text-sm text-gray-500`), large value (`text-3xl font-bold`), optional trend badge |
| **Status Badge** | `px-3 py-1 rounded-full text-xs font-semibold` — colored backgrounds at 10% opacity |
| **Level Badge** | Company = gold bg, Department = orange bg, Individual = blue bg |
| **Contribution Flag** | `📊 Score` (blue), `💰 Value` (green), `🔒 Required` (red) — small pill badges on KR rows |
| **Tab Bar** | `bg-gray-100 p-1 rounded-xl` container; active tab = `bg-primary text-white rounded-lg` |
| **Modal** | Centered, `rounded-2xl`, `backdrop-blur-sm bg-black/50` overlay, `max-h-[90vh]`, sticky header with title + close (×), scrollable body |
| **Data Table** | Card container, `bg-gray-50` header row, hover rows, sticky "actions" column, pagination footer |
| **Button (Primary)** | `bg-primary text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-dark` |
| **Button (Secondary)** | `border border-gray-200 text-gray-700 rounded-xl px-6 py-3 hover:bg-gray-50` |
| **Publication Gate Banner** | `bg-warning/10 border border-warning/30 rounded-xl p-4` — shown when parent not yet published |
| **Alignment Connector** | Vertical tree with `border-l-2 border-primary` dashed lines connecting cascade levels |
| **Binary Completion Toggle** | Large toggle switch, green check when complete, grey X when not. Label: "Completed / Not Completed" |

### Layout Shell

All OKR pages render inside AdminLayout:
- **Left:** Collapsible sidebar (`w-72` open, `w-24` collapsed), white bg, company logo at top
- **Top:** Header bar with search, notifications bell, user avatar
- **Main:** Scrollable content area, `px-8 py-6`, `bg-[#F5F5F5]`

### Sidebar Addition

Add a new nav group to the sidebar between "Leave Management" and "Departments":
- **Icon:** `MdTrackChanges` (Material Design)
- **Label:** "OKR"
- **Active style:** `bg-primary text-white rounded-2xl`
- **Sub-items:** Dashboard, Company OKRs, Department OKRs, My OKRs, Approvals, Archives, Settings

---

## 2. Page & Modal Inventory

The OKR module consists of **16 pages** and **14 modals**, sequentially ordered to follow the OKR lifecycle.

### Pages

| # | Page | URL Pattern | Primary User | Follows |
|---|---|---|---|---|
| P1 | OKR Cycle Management | `/admin/okr/cycles` | HR | Entry point |
| P2 | Company Objectives Board | `/admin/okr/company` | CEO / HR | After cycle opens |
| P3 | Company Objective Detail | `/admin/okr/company/:id` | CEO / HR | Drill from P2 |
| P4 | Department OKR Board | `/admin/okr/department/:id` | Dept Head | After company publishes |
| P5 | Department Objective Detail | `/admin/okr/department/objective/:id` | Dept Head | Drill from P4 |
| P6 | Contributor Assignment View | `/admin/okr/department/:id/contributors` | Dept Head / Manager | After dept KRs created |
| P7 | My Execution Dashboard | `/employee/okr/my-okrs` | Employee | After assignment |
| P8 | Employee Objective Detail | `/employee/okr/objective/:id` | Employee | Drill from P7 |
| P9 | Team Execution Monitor | `/manager/okr/team` | Manager | Monitor contributors |
| P10 | OKR Approval Queue | `/admin/okr/approvals` | Manager / HR | Cross-cutting |
| P11 | CEO Strategic Dashboard | `/admin/okr/dashboard` | CEO | Cross-cutting |
| P12 | Department Comparison | `/admin/okr/departments` | CEO / HR | Cross-cutting |
| P13 | Company OKR Gallery | `/employee/okr/gallery` | All employees | Read-only transparency |
| P14 | OKR Configuration | `/admin/okr/settings` | HR / Admin | System setup |
| P15 | Archive Management | `/admin/okr/archives` | HR | Quarter-end |
| P16 | Archive Detail & Reports | `/admin/okr/archives/:id` | HR / CEO | Drill from P15 |

### Modals

| # | Modal | Triggered From | Sequential Context |
|---|---|---|---|
| M1 | Create / Edit Cycle | P1 | First step in quarter |
| M2 | Create / Edit Company Objective | P2 | Create company OKR |
| M3 | Create / Edit Company KR | P3 | Add KRs to company obj |
| M4 | Assign Department to Company KR | P3 | Assign dept ownership |
| M5 | Create / Edit Department KR | P5 | Create dept KRs |
| M6 | Assign Contributor | P5 / P6 | Assign employees to KRs |
| M7 | Employee Execution Setup | P7 | Adopt or decompose KR |
| M8 | Create / Edit Employee KR | P8 | Define execution KRs |
| M9 | Create / Edit Monthly Plan | P8 | Monthly planning |
| M10 | Create / Edit Weekly Plan | P8 | Weekly planning |
| M11 | Progress Update | P7 / P8 | Submit updates |
| M12 | Approve / Reject / Publish | P10 | Workflow actions |
| M13 | Configure KR Weights | P3 / P5 / P8 | Weight adjustment |
| M14 | Archive Quarter | P1 / P15 | Archive + generate reports |

---

## 3. Detailed Page Specifications

---

### P1: OKR Cycle Management

> **Owner:** HR · **Route:** `/admin/okr/cycles`

#### Purpose
HR creates, opens, closes, and archives quarterly OKR cycles. No planning can begin until a cycle is opened. Only one cycle can be `OPEN` at a time.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "OKR Cycle Management"                 │
│  Subtitle: "Create and manage quarterly cycles"     │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ StatCard │ StatCard │ StatCard │ StatCard │
│ Open     │ Total    │ Avg Score│ Days     │
│ Cycle    │ Archived │          │ Remaining│
└──────────┴──────────┴──────────┴──────────┘

┌─────────────────────────────────────────────────────┐
│  [+ Create New Cycle] button (top-right)            │
│                                                     │
│  DataTable:                                         │
│  ┌──────┬────────┬──────────┬────────┬───────────┐  │
│  │ Name │ Period │ Status   │ # OKRs │ Actions   │  │
│  ├──────┼────────┼──────────┼────────┼───────────┤  │
│  │ Q1'26│ Jan-Mar│ ●Open    │   47   │ ⋮ Menu    │  │
│  │ Q4'25│ Oct-Dec│ ●Archived│   52   │ ⋮ Menu    │  │
│  └──────┴────────┴──────────┴────────┴───────────┘  │
│  Pagination footer                                  │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Stat Cards (4):**
  - "Open Cycle" — icon `MdPlayCircle`, `bg-primary`, shows name of currently open cycle or "None"
  - "Total Archived" — icon `MdArchive`, `bg-secondary`, count of `ARCHIVED` cycles
  - "Avg Score" — icon `MdTrendingUp`, `bg-primary`, avg final_score across last archived cycle
  - "Days Remaining" — icon `MdTimer`, `bg-secondary`, countdown to open cycle end date

- **DataTable columns:**
  - `Cycle Name` — e.g., "Q1 2026"
  - `Period` — "Jan 1, 2026 – Mar 31, 2026"
  - `Status` — StatusBadge: Open (green), Draft (grey), Closed (yellow), Archived (blue)
  - `Total OKRs` — count of company objectives in this cycle
  - `Actions` — 3-dot menu: "Edit", "Open Cycle", "Close Cycle", "Archive" → M14, "Delete" (only if no objectives)

- **"+ Create New Cycle":** Opens M1

#### Interaction Notes
- Only **one** cycle can be `OPEN` at a time — system prevents opening a second
- Opening a cycle triggers: notification to all department heads that planning may begin at company level
- Closing triggers confirmation: "All incomplete objectives will be finalized. Continue?"
- Archive action opens M14 (Archive Quarter modal)
- **Next step:** After opening a cycle → navigate to P2 to create company objectives

---

### P2: Company Objectives Board

> **Owner:** CEO / HR · **Route:** `/admin/okr/company`

#### Purpose
Display and manage company-level strategic objectives for the current open cycle. This is Level 1 of the OKR cascade. Company objectives must be created, approved, and published before departments can begin planning.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Company Objectives"                   │
│  Subtitle: "Q1 2026 · Strategic Priorities"         │
│  [+ Add Objective] button (in header, white text)   │
└─────────────────────────────────────────────────────┘

┌─── Cycle Selector ──────────────────────────────────┐
│  ▼ Q1 2026 (Open)                                   │
└─────────────────────────────────────────────────────┘

┌─── Planning Status Banner ──────────────────────────┐
│  📋 Company planning: 3 objectives created          │
│  Status: Draft · [Submit for Approval] [Publish]    │
└─────────────────────────────────────────────────────┘

┌── Objective Card #1 ────────────────────────────────┐
│  ┌─ Header ─────────────────────────────────────┐   │
│  │ "Generate ETB 10M Revenue"    ● Published    │   │
│  │  Metric: Currency (ETB) · Target: 10,000,000 │   │
│  │  Score: 60% · Value: ETB 6.2M · 3 KRs       │   │
│  │  4 Departments Assigned                      │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ Key Result Summary ─────────────────────────┐   │
│  │ KR1: "Upsell clients ETB 6M" (40%)          │   │
│  │   📊Score 💰Value · Assigned: Sales          │   │
│  │ KR2: "New deals ETB 4M" (35%)               │   │
│  │   📊Score 💰Value · Assigned: BD             │   │
│  │ KR3: "Launch billing portal" (25%)           │   │
│  │   📊Score 🔒Required · Assigned: Engineering │   │
│  └──────────────────────────────────────────────┘   │
│  [View Detail →]                                    │
└─────────────────────────────────────────────────────┘

┌── Objective Card #2 (collapsed) ────────────────────┐
│  "Build Engineering Excellence"  ● Draft            │
│  Metric: Rating · 2 KRs · 0 Depts Assigned         │
│  ▸ Click to expand                                  │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Cycle Selector:** Dropdown showing all cycles; default = open cycle
- **Planning Status Banner:** Shows current company planning status with action buttons:
  - Draft → "Submit for Approval" → "Publish"
  - Published → "Published ✓" (green badge, no action)
  - Uses configurable status transitions from `okr_status_definition`
- **Objective Card:** White card, `rounded-2xl`, `shadow-card`. Contains:
  - Title (h3, bold)
  - StatusBadge (Draft/Submitted/Approved/Published)
  - Metric type + unit + target value
  - Score / Value / Completion summary (3 separate indicators)
  - KR count, assigned department count
  - Expandable KR summary section
- **Key Result Summary Row:** Shows:
  - KR name + weight percentage
  - Contribution flags: `📊 Score`, `💰 Value`, `🔒 Required`
  - Assigned department name
- **Configurable limits:** System enforces configurable limits (default 3–6 objectives). "Add Objective" disabled with tooltip when at limit
- **"+ Add Objective":** Opens M2

#### Interaction Notes
- "View Detail →" navigates to P3 (Company Objective Detail)
- **Publication Gate:** Departments cannot plan until status = `Published`
- Score is auto-calculated: weighted average of completed score-contributing KRs
- Value is auto-calculated: sum of value-contributing KRs with aligned metrics
- **Next step:** Click objective card → P3 to manage KRs and assign departments

---

### P3: Company Objective Detail

> **Owner:** CEO / HR · **Route:** `/admin/okr/company/:id`

#### Purpose
Deep-dive into a single company objective. Manage its Key Results, assign departments to each KR, view department uptake, and track score/value/completion separately.

#### Layout

```
┌── BackButton: "← Back to Company Objectives" ──────┐

┌── Objective Header Card ────────────────────────────┐
│  "Generate ETB 10M Revenue"                         │
│  Cycle: Q1 2026 · Status: ● Published               │
│  Metric: Currency (ETB) · Target: ETB 10,000,000    │
│  Created by: CEO · Approved by: HR Director         │
│                                                     │
│  ┌─ Score ──┐  ┌─ Value ────┐  ┌─ Completion ──┐   │
│  │   60%    │  │ ETB 6.2M   │  │  2/3 KRs Done │   │
│  │ Weighted │  │ of 10M     │  │  1 Required   │   │
│  └──────────┘  └────────────┘  └───────────────┘   │
│                                                     │
│  [Edit ✏️] [⚙ Configure Weights]                    │
└─────────────────────────────────────────────────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [ Key Results (3) ] [ Department Uptake ] [ Activity Log ] │
└─────────────────────────────────────────────────────┘

── Tab: Key Results ──────────────────────────────────
│  ┌─ KR Card ────────────────────────────────────┐   │
│  │ KR1: "Upsell existing clients by ETB 6M"    │   │
│  │ Metric: Currency (ETB) · Weight: 40%         │   │
│  │ Target: ETB 6,000,000 · Final Value: —       │   │
│  │ Flags: 📊 Score  💰 Value                    │   │
│  │ Status: ● Published                          │   │
│  │ Assigned to: Sales Department                │   │
│  │ [Edit] [Assign Department →] opens M4        │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [+ Add Key Result] → opens M3                      │

── Tab: Department Uptake ────────────────────────────
│  DataTable showing which departments have taken     │
│  each KR and their planning status:                 │
│  ┌──────────┬────────────┬────────────┬──────────┐  │
│  │ KR       │ Department │ Dept Status│ Score    │  │
│  │ Upsell   │ Sales      │ Published  │ 65%      │  │
│  │ New deals│ BD         │ Draft      │ —        │  │
│  │ Billing  │ Engineering│ In Progress│ 40%      │  │
│  └──────────┴────────────┴────────────┴──────────┘  │

── Tab: Activity Log ─────────────────────────────────
│  Timeline: creation, submission, approval,          │
│  publication, department assignments, status changes │
```

#### Components

- **Objective Header:** Full metadata with the **three-indicator panel** (Score / Value / Completion) displayed separately
- **KR Card:** Full KR detail with contribution flags, metric info, weight, assigned department, status
- **"+ Add Key Result":** Opens M3 (Create Company KR)
- **"Assign Department":** Opens M4 (per-KR department assignment)
- **Department Uptake Tab:** Shows which departments inherited each KR and their current planning status
- **Activity Log:** Vertical timeline of all actions from `okr_activity_log`

#### Interaction Notes
- "Edit" opens M2 (edit objective) or M3 (edit KR)
- "⚙ Configure Weights" opens M13
- Weight validation: score-contributing KRs must sum to 100%
- **Financial Rule:** KR3 (billing portal) is `🔒 Required` but NOT `💰 Value` — it won't add to ETB total but blocks full completion
- **Next step:** After publishing and assigning departments → departments see their objectives in P4

---

### P4: Department OKR Board

> **Owner:** Department Head · **Route:** `/admin/okr/department/:id`

#### Purpose
Department heads view their inherited company KR assignments (which become department objectives) and create department-level Key Results. Planning cannot begin until the parent company KR is `Published`.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Engineering Department OKRs"          │
│  Subtitle: "Q1 2026 · 2 Objectives Inherited"      │
└─────────────────────────────────────────────────────┘

┌── Publication Gate Banner (if parent not published) ┐
│  ⚠️ Company planning is not yet published.          │
│  Department planning will unlock once company       │
│  objectives are finalized and published.            │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ StatCard │ StatCard │ StatCard │ StatCard │
│ Dept     │ Completed│ At Risk  │ Contribs │
│ Score    │ KRs      │ KRs      │ Assigned │
│  52%     │  3/8     │  2       │  12      │
└──────────┴──────────┴──────────┴──────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [ Active (2) ] [ Published ] [ Archived ] │
└─────────────────────────────────────────────────────┘

┌── Inherited Objective Card ─────────────────────────┐
│  ┌─ Parent Context ─────────────────────────────┐   │
│  │ 🏢 From Company KR: "Launch billing portal"  │   │
│  │    Parent Obj: "Generate ETB 10M Revenue"     │   │
│  │    Flags: 📊Score 🔒Required (no 💰Value)    │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  Dept Objective: "Launch billing portal"            │
│  Status: ● In Progress   Score: 40%                 │
│  4 Department KRs · 6 Contributors Assigned         │
│                                                     │
│  [View Detail →]                                    │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Publication Gate Banner:** Shown when parent company planning is NOT published. All creation buttons are disabled. Uses `bg-warning/10` styling
- **Parent Context Panel:** Each inherited objective card shows the originating company KR and its contribution flags
- **Stat Cards (4):**
  - "Dept Score" — weighted score aggregate, `bg-primary`
  - "Completed KRs" — binary completion count, `bg-success`
  - "At Risk KRs" — KRs with Off Track confidence, `bg-error`
  - "Contributors Assigned" — total assigned contributors, `bg-secondary`

#### Interaction Notes
- Department objectives are **auto-created** when a company KR is assigned to the department (from P3/M4)
- "View Detail →" navigates to P5 (Department Objective Detail)
- **Planning gate enforced:** If company KR status ≠ `Published`, all planning actions are disabled
- **Next step:** Click objective → P5 to create department KRs and assign contributors

---

### P5: Department Objective Detail

> **Owner:** Department Head · **Route:** `/admin/okr/department/objective/:id`

#### Purpose
Manage department KRs under an inherited company KR. Create KRs, assign contributors, create quarterly and monthly plans. This is the hub for department-level execution planning.

#### Layout

```
┌── BackButton: "← Back to Department OKRs" ─────────┐

┌── Objective Header Card ────────────────────────────┐
│  Dept Objective: "Launch billing portal"            │
│  Inherited from: 🏢 "Generate ETB 10M Revenue"     │
│  Department: Engineering · Cycle: Q1 2026           │
│  Status: ● In Progress                              │
│                                                     │
│  ┌─ Score ──┐  ┌─ Value ────┐  ┌─ Completion ──┐   │
│  │   40%    │  │ N/A        │  │  1/4 KRs Done │   │
│  │ Weighted │  │ (non-fin.) │  │  0 Required   │   │
│  └──────────┘  └────────────┘  └───────────────┘   │
│                                                     │
│  [Submit for Approval] [Publish]                    │
│  [⚙ Configure Weights]                              │
└─────────────────────────────────────────────────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [Key Results (4)] [Contributors (6)] [Monthly Plans] [Activity] │
└─────────────────────────────────────────────────────┘

── Tab: Key Results ──────────────────────────────────
│  KR1: "Design billing UI" (20%)                     │
│  Metric: Binary · Flags: 📊Score 🔒Required        │
│  Status: ● Completed ✓ · Assigned to: 2 contribs   │
│  [Edit] [Assign Contributors → M6]                  │
│                                                     │
│  KR2: "Build payment API" (30%)                     │
│  Metric: Milestone · Flags: 📊Score               │
│  Steps: 3/5 complete · Assigned to: 3 contribs     │
│  [Edit] [Assign Contributors → M6]                  │
│                                                     │
│  [+ Add Key Result] → opens M5                      │

── Tab: Contributors ─────────────────────────────────
│  Same as P6 (inline contributor view)               │

── Tab: Monthly Plans ────────────────────────────────
│  Month 1 (Jan): Published · 3 items                 │
│  Month 2 (Feb): Draft · 2 items                     │
│  Month 3 (Mar): Not started                         │

── Tab: Activity ─────────────────────────────────────
│  Timeline of changes                                │
```

#### Components

- **Three-Indicator Panel:** Score / Value / Completion displayed separately — Value shows "N/A" for non-financial objectives
- **KR Card:** Shows contribution flags, metric type, assigned contributor count, binary completion status
- **Contributors Tab:** Inline version of P6 — shows all contributors assigned across all KRs
- **Monthly Plans Tab:** Shows planning structure by month with sequence enforcement (Month 1 before Month 2)
- **"+ Add Key Result":** Opens M5
- **"Assign Contributors":** Opens M6

#### Interaction Notes
- Weight validation enforced: score-contributing KRs must sum to 100%
- Monthly sequence: Month 2 cannot be created until Month 1 exists
- **Publication gate for contributors:** After dept publishes → contributors receive assignments and can begin planning in P7
- **Next step:** Assign contributors → P6 for management, or contributors see assignments in P7

---

### P6: Contributor Assignment View

> **Owner:** Dept Head / Manager · **Route:** `/admin/okr/department/:id/contributors`

#### Purpose
Centralized view of all contributor assignments across a department's KRs. Assign employees to specific KRs, set contribution roles, and mark whether each contributor is required for completion.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Contributor Management"               │
│  Subtitle: "Engineering · Q1 2026"                  │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┐
│ StatCard │ StatCard │ StatCard │
│ Total    │ Unassigned│ Required│
│ Contribs │ KRs      │ Pending │
│  12      │  1       │  3      │
└──────────┴──────────┴──────────┘

┌── KR Assignment Cards ─────────────────────────────┐
│  ┌─ KR: "Build payment API" ────────────────────┐  │
│  │  Metric: Milestone · Weight: 30%             │  │
│  │  Status: In Progress · 3/5 steps done        │  │
│  │                                              │  │
│  │  Contributors:                               │  │
│  │  ┌───────────────────────────────────────┐   │  │
│  │  │ 👤 Abebe K. · Developer · Required ✓ │   │  │
│  │  │ 👤 Sara T.  · QA Lead · Required ✓   │   │  │
│  │  │ 👤 Dawit H. · Designer · Optional    │   │  │
│  │  └───────────────────────────────────────┘   │  │
│  │  [+ Assign Contributor → M6]                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ KR: "Design billing UI" ────────────────────┐  │
│  │  ⚠️ No contributors assigned                 │  │
│  │  [+ Assign Contributor → M6]                 │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Stat Cards (3):**
  - "Total Contributors" — count of unique assigned employees, `bg-primary`
  - "Unassigned KRs" — KRs with zero contributors, `bg-warning`
  - "Required Pending" — required contributors who haven't started execution, `bg-error`
- **KR Assignment Card:** Per department KR:
  - KR title, metric, weight, status
  - List of assigned contributors with: avatar, name, role type, required/optional badge
  - Remove contributor (×) button
  - "Assign Contributor" opens M6
- **Contributor role types:** Employee, Team Leader, Manager, Director, Department Head
- **Required flag:** `is_required_for_completion` — determines if this contributor must complete for KR to be done

#### Interaction Notes
- Assignment triggers auto-creation of `employee_objective` for the contributor
- Contributors receive notification of assignment
- Self-assignment configurable via `okr_config_profile`
- **Next step:** Assigned contributors see their objectives in P7

---

### P7: My Execution Dashboard

> **Owner:** Employee · **Route:** `/employee/okr/my-okrs`

#### Purpose
The personal execution workspace. Employees see objectives auto-created from their contributor assignments, adopt or decompose assigned KRs, submit progress updates, and manage monthly/weekly plans.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "My Execution Dashboard"               │
│  Subtitle: "Q1 2026 · Your Assigned Objectives"     │
└─────────────────────────────────────────────────────┘

┌── Alignment Breadcrumb ─────────────────────────────┐
│  🏢 Company: "Generate ETB 10M Revenue"             │
│    └─ 🏬 Dept: "Launch billing portal"              │
│        └─ 👤 You: Assigned KR → "Build payment API" │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ StatCard │ StatCard │ StatCard │ StatCard │
│ My Score │ Completed│ Blocked  │ Next     │
│          │ KRs      │ Items    │ Update   │
│  60%     │  2/5     │  1       │ 2 days   │
└──────────┴──────────┴──────────┴──────────┘

┌── Objective Card ───────────────────────────────────┐
│  "Build payment API"                 ● In Progress   │
│  Assigned from: Eng Dept → Company Revenue Goal     │
│  Execution Mode: 🔀 Decomposed (3 KRs)             │
│                                                     │
│  ┌─ Score ──┐  ┌─ Value ─┐  ┌─ Completion ──┐     │
│  │   60%    │  │  N/A    │  │   2/3 Done    │     │
│  └──────────┘  └─────────┘  └───────────────┘     │
│                                                     │
│  KR1: "Design API endpoints"          ✓ Completed   │
│  KR2: "Implement payment logic"       ● In Progress │
│  KR3: "Write integration tests"       ○ Not Started │
│                                                     │
│  [View Detail →] [�� Submit Update → M11]           │
└─────────────────────────────────────────────────────┘

┌── Objective Card #2 ────────────────────────────────┐
│  "Design billing UI"                 ● Not Started   │
│  Execution Mode: ⚙️ Not configured                  │
│  [Set Up Execution → M7]                            │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Alignment Breadcrumb:** Tree showing Company → Department → Employee cascade
- **Stat Cards (4):**
  - "My Score" — weighted score aggregate, `bg-primary`
  - "Completed KRs" — binary completion count, `bg-success`
  - "Blocked Items" — KRs/subtasks with blockers, `bg-error`
  - "Next Update" — days until next update is due, `bg-secondary`
- **Objective Cards:** Each shows:
  - Title + status badge
  - Assignment origin (parent dept KR → company objective)
  - Execution mode: "Direct Adoption" or "Decomposed (N KRs)"
  - Three-indicator panel (Score/Value/Completion)
  - KR summary with binary completion status (✓ / ● / ○)
  - Action buttons: "View Detail" → P8, "Submit Update" → M11
- **Unconfigured Objective:** Shows "Set Up Execution → M7" when employee hasn't chosen adoption vs decomposition

#### Interaction Notes
- Objectives are **auto-created** when employee is assigned as contributor (from P6/M6)
- Employee must first choose execution mode via M7 before planning
- Binary completion: each KR shows ✓ Completed or ○ Not Completed
- **Next step:** "View Detail" → P8 for full execution planning; "Set Up Execution" → M7

---

### P8: Employee Objective Detail

> **Owner:** Employee · **Route:** `/employee/okr/objective/:id`

#### Purpose
Full execution workspace for a single employee objective. Manage execution KRs, monthly plans, weekly plans, subtasks, milestones, and submit progress updates.

#### Layout

```
┌── BackButton: "← Back to My Dashboard" ────────────┐

┌── Objective Header ─────────────────────────────────┐
│  "Build payment API"                                │
│  Status: ● In Progress · Mode: Decomposed          │
│  Parent: Eng Dept KR → Company Revenue Goal         │
│  Score: 60% · Completion: 2/3 KRs                  │
└─────────────────────────────────────────────────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [Execution KRs (3)] [Monthly Plans] [Weekly Plans] [Subtasks] [Updates] │
└─────────────────────────────────────────────────────┘

── Tab: Execution KRs ────────────────────────────────
│  KR1: "Design API endpoints" · Binary · 20%        │
│  Status: ✓ Completed · Completed at: Feb 15        │
│  [View Updates]                                     │
│                                                     │
│  KR2: "Implement payment logic" · Milestone · 50%  │
│  Steps: ✓Auth ✓Validate ○Process ○Settle ○Test     │
│  Status: ● In Progress                              │
│  [📝 Update → M11] [Edit → M8]                     │
│                                                     │
│  KR3: "Write integration tests" · Numeric · 30%    │
│  Current: 0/20 tests · Status: ○ Not Started       │
│  [📝 Update → M11] [Edit → M8]                     │
│                                                     │
│  [+ Add Execution KR → M8]                          │
│  ⚠️ Total Weight: 100% ✓                            │

── Tab: Monthly Plans ────────────────────────────────
│  ┌─ Month 1 (January) ── Published ─────────────┐  │
│  │  • Complete API design                        │  │
│  │  • Start auth implementation                  │  │
│  │  Status: ● Published                          │  │
│  └───────────────────────────────────────────────┘  │
│  ┌─ Month 2 (February) ── Draft ────────────────┐  │
│  │  • Finish payment logic                       │  │
│  │  [Edit → M9]                                  │  │
│  └───────────────────────────────────────────────┘  │
│  [+ Add Monthly Plan → M9]                          │

── Tab: Weekly Plans (if cadence = weekly) ───────────
│  Week 1: Published · 2 milestones                   │
│  Week 2: Draft · 1 milestone                        │
│  [+ Add Weekly Plan → M10]                          │

── Tab: Subtasks ─────────────────────────────────────
│  ☑ Set up test environment · Target: Jan, Week 2    │
│  ☐ Write auth unit tests · Target: Feb, Week 1     │
│  ☐ Load testing · Target: Mar, Week 2              │
│  [+ Add Subtask]                                    │

── Tab: Updates ──────────────────────────────────────
│  DataTable of all progress_update records           │
│  Date │ KR │ Value │ Confidence │ Completed? │ Note │
```

#### Components

- **Execution KRs Tab:** Full KR details with binary completion, milestone checklists, metric progress
- **Monthly Plans Tab:** Cards per month with sequence enforcement (Month 1 before Month 2)
- **Weekly Plans Tab:** Only visible if planning cadence includes weekly. Shows week numbers with milestones
- **Subtasks Tab:** Checklist of granular work items with target month/week
- **Updates Tab:** History of all `progress_update` records

#### Interaction Notes
- Monthly Plan sequence enforced: cannot create Month 2 before Month 1 exists
- Weekly Plans only shown if `OkrPlanningCadence = WEEKLY` in configuration
- Binary completion: "Mark as Complete" toggle on each KR
- **Completion propagation:** When all required KRs complete → objective completes → contributor marked complete → dept KR rolls up

---

### P9: Team Execution Monitor

> **Owner:** Manager · **Route:** `/manager/okr/team`

#### Purpose
Managers monitor execution progress of their assigned contributors. View completion status, blockers, update compliance, and trigger approvals.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Team Execution Monitor"               │
│  Subtitle: "Q1 2026 · Managing 8 contributors"      │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ StatCard │ StatCard │ StatCard │ StatCard │
│ Team     │ Pending  │ Blocked  │ Update   │
│ Score    │ Approval │ Members  │ Compliance│
│  65%     │  3       │  2       │  75%     │
└──────────┴──────────┴──────────┴──────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [All Contributors] [Pending Approval (3)] [Blocked] │
└─────────────────────────────────────────────────────┘

┌── Contributor Card ─────────────────────────────────┐
│  👤 Abebe Kebede · Developer                        │
│  Assigned to: "Build payment API" (Eng Dept)        │
│  Execution: Decomposed · 3 KRs                     │
│  Score: 60% · Completed: 2/3 · Status: In Progress │
│  Last update: Today                                 │
│  [View Detail →]                                    │
├─────────────────────────────────────────────────────┤
│  👤 Sara Tesfaye · QA Lead                          │
│  Assigned to: "Design billing UI" (Eng Dept)        │
│  Execution: ⚠️ Not configured                       │
│  [Nudge to Set Up]                                  │
├─────────────────────────────────────────────────────┤
│  👤 Dawit Hailu · Designer (PENDING APPROVAL)       │
│  Submitted execution plan for review                │
│  [Review & Approve → M12]                           │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Stat Cards (4):**
  - "Team Score" — weighted avg across contributors, `bg-primary`
  - "Pending Approval" — count awaiting manager action, `bg-warning`, pulse animation if > 0
  - "Blocked Members" — contributors with active blockers, `bg-error`
  - "Update Compliance" — % who submitted updates this period, `bg-info`
- **Contributor Cards:** Per-contributor showing:
  - Avatar, name, role
  - Assignment origin (which dept KR)
  - Execution mode + KR count
  - Score + completion + status
  - Last update timestamp, overdue warning if > configured threshold
  - "View Detail →" navigates to P8 (read-only for manager)
  - "Review & Approve →" opens M12 for pending items
- **Sorting:** By score (ascending for at-risk), name, last update

---

### P10: OKR Approval Queue

> **Owner:** Manager / HR · **Route:** `/admin/okr/approvals`

#### Purpose
Centralized queue of all items awaiting approval or publication across all levels. Supports configurable approval workflows.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "OKR Approval Queue"                   │
│  Subtitle: "Review and approve submitted items"     │
└─────────────────────────────────────────────────────┘

┌── FilterBar ────────────────────────────────────────┐
│  Level: [All ▼]  Department: [All ▼]                │
│  Entity Type: [All ▼]  Status: [Submitted ▼]       │
└─────────────────────────────────────────────────────┘

┌── DataTable ────────────────────────────────────────┐
│ Submitted By │ Entity Type      │ Title       │ Level│ Submitted │ Actions │
│──────────────│──────────────────│─────────────│──────│───────────│─────────│
│ CEO Office   │ Company Obj      │ Revenue 10M │ Co.  │ 1 day ago │ [Review]│
│ Eng Dept     │ Dept Quarter Plan│ Q1 Plan     │ Dept │ 2 days ago│ [Review]│
│ Abebe K.     │ Employee KR Plan │ API Testing │ Indiv│ 3 days ago│ [Review]│
└─────────────────────────────────────────────────────┘
```

#### Components

- **FilterBar:** Level (Company/Department/Individual), Department, Entity Type (Objective/KR/Plan), Status
- **DataTable:** Shows all pending items across all layers with:
  - Submitted By, Entity Type (with icon), Title, Level Badge, Submitted Date, Actions
  - "Review" → opens M12 (Approve/Reject/Publish modal)
- **Approval Rules (configurable via `okr_status_transition`):**
  - Company OKRs → approved by CEO / HR
  - Department OKRs → approved by CEO / HR / configured role
  - Individual Plans → approved by Direct Manager / configured role

---

### P6: Contributor Assignment View

> **Owner:** Dept Head / Manager · **Route:** `/admin/okr/department/:id/contributors`

#### Purpose
Centralized view of all contributor assignments across a department's KRs. Assign employees, set roles, and mark required contributors.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Contributor Management"               │
│  Subtitle: "Engineering · Q1 2026"                  │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┐
│ StatCard │ StatCard │ StatCard │
│ Total    │ Unassigned│ Required│
│ Contribs │ KRs      │ Pending │
│  12      │  1       │  3      │
└──────────┴──────────┴──────────┘

┌── KR Assignment Cards ─────────────────────────────┐
│  ┌─ KR: "Build payment API" ────────────────────┐  │
│  │  Metric: Milestone · Weight: 30%             │  │
│  │  Contributors:                               │  │
│  │  👤 Abebe K. · Developer · Required ✓        │  │
│  │  👤 Sara T.  · QA Lead · Required ✓          │  │
│  │  👤 Dawit H. · Designer · Optional           │  │
│  │  [+ Assign Contributor → M6]                 │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ┌─ KR: "Design billing UI" ────────────────────┐  │
│  │  ⚠️ No contributors assigned                 │  │
│  │  [+ Assign Contributor → M6]                 │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Stat Cards (3):**
  - "Total Contributors" — unique assigned employees, `bg-primary`
  - "Unassigned KRs" — KRs with zero contributors, `bg-warning`
  - "Required Pending" — required contributors not yet started, `bg-error`
- **KR Assignment Card:** Per dept KR: title, metric, weight, contributor list with role type and required/optional badge, remove (×) button
- **Contributor role types:** Employee, Team Leader, Manager, Director, Department Head (from `OkrContributorRoleType` enum)

#### Interaction Notes
- Assignment triggers auto-creation of `employee_objective`
- Self-assignment configurable via `okr_config_profile`
- **Next step:** Contributors see assignments in P7

---

### P7: My Execution Dashboard

> **Owner:** Employee · **Route:** `/employee/okr/my-okrs`

#### Purpose
Personal execution workspace. Employees see auto-created objectives from contributor assignments, choose execution mode, submit updates, and manage plans.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "My Execution Dashboard"               │
│  Subtitle: "Q1 2026 · Your Assigned Objectives"     │
└─────────────────────────────────────────────────────┘

┌── Alignment Breadcrumb ─────────────────────────────┐
│  🏢 Company: "Generate ETB 10M Revenue"             │
│    └─ 🏬 Dept: "Launch billing portal"              │
│        └─ 👤 You: "Build payment API"               │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ StatCard │ StatCard │ StatCard │ StatCard │
│ My Score │ Completed│ Blocked  │ Next     │
│          │ KRs      │ Items    │ Update   │
│  60%     │  2/5     │  1       │ 2 days   │
└──────────┴──────────┴──────────┴──────────┘

┌── Objective Card ───────────────────────────────────┐
│  "Build payment API"                 ● In Progress   │
│  Mode: 🔀 Decomposed (3 KRs)                       │
│  Score: 60% · Completion: 2/3 Done                  │
│                                                     │
│  KR1: "Design API endpoints"          ✓ Completed   │
│  KR2: "Implement payment logic"       ● In Progress │
│  KR3: "Write integration tests"       ○ Not Started │
│                                                     │
│  [View Detail →] [📝 Submit Update → M11]           │
└─────────────────────────────────────────────────────┘

┌── Unconfigured Objective ───────────────────────────┐
│  "Design billing UI"                 ⚙️ Not set up   │
│  [Set Up Execution → M7]                            │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Alignment Breadcrumb:** Company → Department → Employee tree with clickable links
- **Stat Cards (4):** My Score (`bg-primary`), Completed KRs (`bg-success`), Blocked Items (`bg-error`), Next Update (`bg-secondary`)
- **Objective Cards:** Title, status, execution mode (Direct/Decomposed), Score/Completion, KR list with binary status (✓/●/○)
- **Unconfigured Card:** Shown when employee hasn't chosen execution mode via M7

#### Interaction Notes
- Objectives are auto-created from contributor assignment
- Employee must choose execution mode (M7) before planning
- Binary completion: ✓ = Complete (100%), ○ = Not Complete (0%)
- **Next step:** "View Detail" → P8; "Set Up" → M7

---

### P8: Employee Objective Detail

> **Owner:** Employee · **Route:** `/employee/okr/objective/:id`

#### Purpose
Full execution workspace for a single objective. Manage KRs, monthly/weekly plans, subtasks, milestones, and progress updates.

#### Layout

```
┌── BackButton: "← Back to Dashboard" ───────────────┐

┌── Objective Header ─────────────────────────────────┐
│  "Build payment API" · ● In Progress · Decomposed  │
│  Score: 60% · Completion: 2/3 KRs                  │
└─────────────────────────────────────────────────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [KRs (3)] [Monthly Plans] [Weekly Plans] [Subtasks] [Updates] │
└─────────────────────────────────────────────────────┘

── Tab: KRs ──────────────────────────────────────────
│  KR1: "Design API endpoints" · Binary · 20%        │
│  ✓ Completed · Feb 15                               │
│                                                     │
│  KR2: "Implement payment logic" · Milestone · 50%  │
│  Steps: ✓Auth ✓Validate ○Process ○Settle ○Test     │
│  [📝 Update → M11] [Edit → M8]                     │
│                                                     │
│  [+ Add KR → M8]  ⚠️ Weight: 100% ✓                │

── Tab: Monthly Plans ────────────────────────────────
│  Month 1 (Jan): Published · Month 2 (Feb): Draft   │
│  [+ Add → M9]                                       │

── Tab: Weekly Plans (if cadence = weekly) ───────────
│  Week 1: Published · Week 2: Draft                  │
│  [+ Add → M10]                                      │

── Tab: Subtasks ─────────────────────────────────────
│  ☑ Set up test env · Jan W2  ☐ Auth tests · Feb W1 │
│  [+ Add Subtask]                                    │

── Tab: Updates ──────────────────────────────────────
│  DataTable: Date, KR, Value, Confidence, Note       │
```

#### Components

- **KRs Tab:** Full detail with binary completion, milestones, metrics. Actions: Update (M11), Edit (M8)
- **Monthly Plans Tab:** Sequence-enforced month cards. Create via M9
- **Weekly Plans Tab:** Only if `OkrPlanningCadence = WEEKLY`. Create via M10
- **Subtasks Tab:** Checklist items with target month/week
- **Updates Tab:** All `progress_update` records in a DataTable

#### Interaction Notes
- Monthly sequence: Month 2 requires Month 1 to exist first
- Weekly plans only visible when cadence config allows
- Completion propagates upward: KRs → Objective → Contributor → Dept KR

---

### P9: Team Execution Monitor

> **Owner:** Manager · **Route:** `/manager/okr/team`

#### Purpose
Managers monitor contributor progress, identify blockers, check update compliance, trigger approvals.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Team Execution Monitor"               │
│  Subtitle: "Q1 2026 · 8 contributors"               │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ Team     │ Pending  │ Blocked  │ Update   │
│ Score    │ Approval │ Members  │ Compliance│
│  65%     │  3       │  2       │  75%     │
└──────────┴──────────┴──────────┴──────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [All Contributors] [Pending Approval (3)] [Blocked] │
└─────────────────────────────────────────────────────┘

┌── Contributor Card ─────────────────────────────────┐
│  👤 Abebe K. · Developer · "Build payment API"     │
│  Score: 60% · Completed: 2/3 · Last update: Today  │
│  [View Detail →]                                    │
├─────────────────────────────────────────────────────┤
│  👤 Dawit H. · Designer (PENDING APPROVAL)          │
│  [Review & Approve → M12]                           │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Stat Cards (4):** Team Score, Pending Approval (pulse if > 0), Blocked Members, Update Compliance
- **Contributor Cards:** Avatar, name, assignment, score, completion, last update, overdue warning
- **Sorting:** By score (asc), name, last update

---

### P10: OKR Approval Queue

> **Owner:** Manager / HR · **Route:** `/admin/okr/approvals`

#### Purpose
Centralized queue of all items awaiting approval across all levels. Supports configurable approval workflows via `okr_status_transition`.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "OKR Approval Queue"                   │
│  Subtitle: "Review and approve submitted items"     │
└─────────────────────────────────────────────────────┘

┌── FilterBar ────────────────────────────────────────┐
│  Level: [All ▼]  Department: [All ▼]                │
│  Entity: [All ▼]  Status: [Submitted ▼]            │
└─────────────────────────────────────────────────────┘

┌── DataTable ────────────────────────────────────────┐
│ Submitted By │ Entity Type   │ Title    │ Level │ Date    │ Actions │
│ CEO Office   │ Company Obj   │ Revenue  │ Co.   │ 1d ago  │ [Review]│
│ Eng Dept     │ Dept Plan     │ Q1 Plan  │ Dept  │ 2d ago  │ [Review]│
│ Abebe K.     │ Employee Plan │ API Test │ Indiv │ 3d ago  │ [Review]│
└─────────────────────────────────────────────────────┘
```

#### Components

- **FilterBar:** Level, Department, Entity Type, Status dropdowns
- **DataTable:** All pending items across layers. "Review" → M12
- **Approval rules** from `okr_status_transition`: Company → CEO/HR, Department → CEO/HR/configured, Individual → Manager/configured

---

### P11: CEO Strategic Dashboard

> **Owner:** CEO · **Route:** `/admin/okr/dashboard`

#### Purpose
Highest-level view of organizational performance. Company-wide score/value/completion health, department comparison, risk areas, quarterly trends, and financial objective tracking.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Strategic OKR Dashboard"              │
│  Subtitle: "Q1 2026 · Company Performance"          │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┬──────────┐
│ Company  │ Depts On │ At Risk  │ Financial│
│ Score    │ Track    │ Items    │ Attain.  │
│  67%     │  6/8     │  4       │ ETB 6.2M │
└──────────┴──────────┴──────────┴──────────┘

┌── Company Objective Summary (Horiz. Bar Chart) ─────┐
│  "Revenue Growth"    ████████████░░░ Score: 60%     │
│                      Value: ETB 6.2M / 10M          │
│  "Eng Excellence"    ██████░░░░░░░░ Score: 45%      │
│  "Customer Sat."     ██████████████ Score: 88%      │
└─────────────────────────────────────────────────────┘

┌── Info Banner ──────────────────────────────────────┐
│  ℹ️ Score reflects weighted completion of KRs.       │
│  Value reflects metric-aligned quantitative roll-up. │
│  These may differ by design.                         │
└─────────────────────────────────────────────────────┘

┌─────────────────────┬───────────────────────────────┐
│ Dept Performance    │ Confidence Trend              │
│ (Vertical Bar Chart)│ (Area Chart)                  │
│ Eng  Sales  HR  Ops │ Week 1──Week 12               │
│ 52%  78%  65% 41%   │ Avg confidence over time      │
└─────────────────────┴───────────────────────────────┘

┌── Financial Objectives Panel ───────────────────────┐
│  "Revenue Growth" (ETB)                              │
│  Value-Contributing KRs:                            │
│    KR1: Upsell ETB 6M → ETB 3.8M achieved          │
│    KR2: New deals ETB 4M → ETB 2.4M achieved       │
│  Non-Financial Supporting KRs:                      │
│    KR3: Billing portal → ● In Progress (Required)  │
│  Total Value: ETB 6.2M / 10M target                │
└─────────────────────────────────────────────────────┘

┌── At-Risk Table ────────────────────────────────────┐
│ Objective      │ Owner  │ Dept  │ Score │ Blockers │
│ Eng Excellence │ CTO    │ Eng   │ 45%   │ 2        │
│ Ops Efficiency │ VP Ops │ Ops   │ 41%   │ 3        │
└─────────────────────────────────────────────────────┘

┌── Quarterly Trend (Line Chart) ─────────────────────┐
│  Q4'25 vs Q1'26 score trajectory by week            │
└─────────────────────────────────────────────────────┘
```

#### Components

- **Stat Cards (4):**
  - "Company Score" — weighted avg of all company objectives, `bg-primary`
  - "Depts On Track" — depts with > 60% score, `bg-success`
  - "At Risk Items" — objectives with Off Track confidence, `bg-error`
  - "Financial Attainment" — sum of value-contributing KR values for financial objectives, `bg-secondary`
- **Financial Objectives Panel:** Separates value-contributing KRs from non-financial supporting KRs. Shows monetary totals only from financially aligned KRs
- **Score vs Value info banner:** Explains that Score and Value are separate concepts
- **At-Risk Table:** Objectives below threshold with blocker count
- **Quarterly Trend:** Line chart comparing current vs previous quarter

---

### P12: Department Comparison

> **Owner:** CEO / HR · **Route:** `/admin/okr/departments`

#### Purpose
Side-by-side comparison of all departments' OKR score, completion, and contributor compliance.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Department Performance"               │
│  Subtitle: "Compare score and execution quality"    │
└─────────────────────────────────────────────────────┘

┌── Heat Map Grid (3-column) ─────────────────────────┐
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Engineering  │  │ Sales       │  │ HR          │ │
│  │ Score: 52%   │  │ Score: 78%  │  │ Score: 65%  │ │
│  │ Done: 3/8    │  │ Done: 7/9   │  │ Done: 5/8   │ │
│  │ ● At Risk    │  │ ● On Track  │  │ ● On Track  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘

┌── DataTable ────────────────────────────────────────┐
│ Dept   │ Head │ Score │ Completed │ At Risk │ Contribs │ → │
│ Eng    │ CTO  │ 52%   │ 3/8       │ 2       │ 12       │ → │
│ Sales  │ VP   │ 78%   │ 7/9       │ 1       │ 8        │ → │
└─────────────────────────────────────────────────────┘

[Export Report] button (top-right) — PDF/CSV
```

#### Components

- **Heat Map Grid:** Department cards with score, completion ratio, confidence badge. Tint: green > 60%, yellow 40-60%, red < 40%. Clickable → P4
- **DataTable:** Score, completed KRs, at-risk count, contributor count. Arrow → P4
- **Export Button:** PDF/CSV of comparison data

---

### P13: Company OKR Gallery

> **Owner:** All employees · **Route:** `/employee/okr/gallery`

#### Purpose
Read-only transparency view. Any employee can see company and department objectives to understand the strategic context.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Company OKR Gallery"                  │
│  Subtitle: "See how we're tracking our goals"       │
└─────────────────────────────────────────────────────┘

┌── Info Banner ──────────────────────────────────────┐
│  ℹ️ Read-only view. Update your goals in "My OKRs". │
└─────────────────────────────────────────────────────┘

┌── Company Objectives ───────────────────────────────┐
│  • "Revenue Growth" — Score: 60% · ● On Track      │
│  • "Eng Excellence" — Score: 45% · ● At Risk       │
│  • "Customer Sat."  — Score: 88% · ● On Track      │
└─────────────────────────────────────────────────────┘

┌── Department Sections (Accordion) ──────────────────┐
│  ▾ Sales (Score: 78%)                               │
│    • "Expand EMEA" — 66% · "Increase Pipeline" — 85%│
│  ▸ Engineering (52%)                                │
│  ▸ HR (65%)                                         │
└─────────────────────────────────────────────────────┘
```

#### Components
- **Info Banner:** Links "My OKRs" to P7
- **Company Section:** Compact read-only cards
- **Department Accordion:** Collapsible, employee's own department auto-expanded
- **No action buttons** — purely informational

---

### P14: OKR Configuration

> **Owner:** HR / Admin · **Route:** `/admin/okr/settings`

#### Purpose
Manage all configurable aspects of the OKR module: config profiles, status definitions, metric definitions, feature flags, and assignment rules.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "OKR Configuration"                    │
│  Subtitle: "Manage module behavior and policies"    │
└─────────────────────────────────────────────────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [General] [Statuses] [Metrics] [Profiles] [Feature Flags] │
└─────────────────────────────────────────────────────┘

── Tab: General Settings ─────────────────────────────
│  Planning Cadence: [▼ Monthly / Weekly]             │
│  Require Strict Sequence: [✓]                       │
│  Require Parent Publish Before Child: [✓]           │
│  Allow Self-Assignment: [✗]                         │
│  Require Weight Validation: [✓]                     │
│  Allow Non-Contributing KRs: [✓]                    │
│  Enforce Metric Alignment Roll-up: [✓]              │
│  Monetary Roll-up Mode: [▼ Contributing Only]       │
│  Archive Lock After Close: [✓]                      │
│  Enable Archive Reports: [✓]                        │
│  Enable Archive Insights: [✓]                       │
│  [Save Settings]                                    │

── Tab: Statuses ─────────────────────────────────────
│  DataTable of okr_status_definition:                │
│  Entity Type │ Code │ Display │ Initial │ Terminal │
│  COMPANY_OBJ │ draft│ Draft   │ ✓       │ ✗        │
│  COMPANY_OBJ │ pub  │ Published│ ✗      │ ✗        │
│  [+ Add Status] [Edit Transitions]                  │

── Tab: Metrics ──────────────────────────────────────
│  DataTable of okr_metric_definition:                │
│  Code │ Name │ Category │ Financial │ Value Roll-up │
│  ETB  │ Birr │ Currency │ ✓         │ ✓             │
│  PCT  │ %    │ Percentage│ ✗        │ ✓             │
│  BIN  │ Binary│ Binary  │ ✗         │ ✗             │
│  [+ Add Metric Type]                                │

── Tab: Profiles ─────────────────────────────────────
│  Config profiles with scope assignments             │
│  [+ Create Profile]                                 │

── Tab: Feature Flags ────────────────────────────────
│  Feature toggles for controlled rollout             │
│  weekly_planning: ✓ Enabled                         │
│  team_layer: ✗ Disabled                             │
│  archive_insights: ✓ Enabled                        │
```

#### Components

- **General Tab:** Form fields for `system_settings` values
- **Statuses Tab:** CRUD for `okr_status_definition` + transitions editor
- **Metrics Tab:** CRUD for `okr_metric_definition`
- **Profiles Tab:** CRUD for `okr_config_profile` with value overrides
- **Feature Flags Tab:** Toggle switches for `okr_feature_flag`

#### Interaction Notes
- Changes are audited via `okr_audit_log`
- Config snapshots are captured at key events to preserve historical integrity
- Safe defaults apply if a config key is missing

---

### P15: Archive Management

> **Owner:** HR · **Route:** `/admin/okr/archives`

#### Purpose
Manage archived quarters. View archive status, trigger report/insight generation, and access export downloads.

#### Layout

```
┌─────────────────────────────────────────────────────┐
│  PageHeader: "Archive Management"                   │
│  Subtitle: "Quarterly archives and reports"         │
└─────────────────────────────────────────────────────┘

┌──────────┬──────────┬──────────┐
│ StatCard │ StatCard │ StatCard │
│ Total    │ Reports  │ Exports  │
│ Archives │ Ready    │ Ready    │
│  4       │  3       │  12      │
└──────────┴──────────┴──────────┘

┌── DataTable ────────────────────────────────────────┐
│ Quarter │ Archived │ Reports │ Insights │ Exports│ Actions  │
│ Q1'26   │ Mar 31   │ ✓ 6     │ ✓ 4      │ ✓ 8   │ [View →] │
│ Q4'25   │ Dec 31   │ ✓ 6     │ ✓ 4      │ ✓ 8   │ [View →] │
│ Q3'25   │ Sep 30   │ ✗ 0     │ ✗ 0      │ ✗ 0   │ [Generate]│
└─────────────────────────────────────────────────────┘
```

#### Components

- **Stat Cards (3):** Total archives, report-ready count, export-ready count
- **DataTable:** Quarter, archived date, report/insight/export counts with checkmarks
- **"View →":** Navigates to P16 (Archive Detail)
- **"Generate":** Triggers report/insight/export generation for older quarters

---

### P16: Archive Detail & Reports

> **Owner:** HR / CEO · **Route:** `/admin/okr/archives/:id`

#### Purpose
View and download archive reports, insights, and export files for a specific quarter.

#### Layout

```
┌── BackButton: "← Back to Archives" ────────────────┐

┌── Archive Header ───────────────────────────────────┐
│  Q1 2026 Archive                                    │
│  Archived: Mar 31, 2026 · By: HR Director          │
│  Status: ● Completed                                │
│  Config Snapshot: ✓ Preserved                       │
└─────────────────────────────────────────────────────┘

┌── TabBar ───────────────────────────────────────────┐
│ [Reports (6)] [Insights (4)] [Exports (8)]          │
└─────────────────────────────────────────────────────┘

── Tab: Reports ──────────────────────────────────────
│  📄 Strategic Summary Report        [View] [Download PDF] │
│  📄 Completion Report               [View] [Download PDF] │
│  📄 Alignment Report                [View] [Download PDF] │
│  📄 Execution Quality Report        [View] [Download PDF] │
│  📄 Contributor Performance Report  [View] [Download PDF] │
│  📄 Financial Roll-Up Report        [View] [Download PDF] │

── Tab: Insights ─────────────────────────────────────
│  💡 Top completion bottlenecks                      │
│  💡 Most common blocker categories                  │
│  💡 Departments with strongest execution            │
│  💡 Financial objectives dependency analysis        │

── Tab: Exports ──────────────────────────────────────
│  DataTable:                                         │
│  Scope │ Format │ Status │ Generated │ Actions      │
│  Full  │ XLSX   │ Ready  │ Apr 1     │ [Download]   │
│  Sales │ PDF    │ Ready  │ Apr 1     │ [Download]   │
│  [+ Request Export] → specify scope + format        │
```

#### Components

- **Reports Tab:** List of `archive_report` records with view/download actions
- **Insights Tab:** List of `archive_insight` records with expandable payloads
- **Exports Tab:** DataTable of `exported_file` records with download links
- **"+ Request Export":** Create new `export_job` with scope (full/dept/objective/contributor) and format (PDF/XLSX/CSV/JSON)


---

## 4. Modal Specifications

---

### M1: Create / Edit Cycle

> **Trigger:** P1 "Create New Cycle" or "Edit" action · **Size:** `max-w-lg`

#### Fields

| Field | Type | Validation | DB Column |
|---|---|---|---|
| Cycle Name | text | Required, max 50, e.g. "Q1 2026" | `okr_cycle.name` |
| Start Date | date picker | Required, must be before end | `okr_cycle.start_date` |
| End Date | date picker | Required, must be after start | `okr_cycle.end_date` |
| Description | textarea | Optional, max 500 | `okr_cycle.description` |

#### Footer
- **Create:** `[Cancel] [Create Cycle]` — primary button
- **Edit:** `[Cancel] [Save Changes]`

#### Behavior
- On create: cycle status = `DRAFT`
- System prevents two cycles with overlapping dates
- Company_id auto-set from logged-in user's company

---

### M2: Create / Edit Company Objective

> **Trigger:** P2 "+ Add Objective" or P3 "Edit" · **Size:** `max-w-xl`

#### Fields

| Field | Type | Validation | DB Column |
|---|---|---|---|
| Title | text | Required, max 200 | `company_objective.title` |
| Description | textarea | Optional, max 2000 | `company_objective.description` |
| Metric Type | dropdown | Required. Options from `okr_metric_definition` | `company_objective.metric_type` |
| Metric Unit | text | Auto-filled from metric def, editable | `company_objective.metric_unit` |
| Target Value | number | Required for numeric/currency metrics | `company_objective.target_value` |
| Baseline Value | number | Optional | `company_objective.baseline_value` |

#### Footer
`[Cancel] [Create / Save]`

#### Behavior
- Metric type dropdown populated from `okr_metric_definition` table
- Financial metrics: unit auto-filled (e.g., "ETB"), target is monetary amount
- Binary metrics: target/baseline hidden
- Created status = `DRAFT` (from `okr_status_definition`)

---

### M3: Create / Edit Company KR

> **Trigger:** P3 "+ Add Key Result" or "Edit" on KR · **Size:** `max-w-xl`

#### Fields

| Field | Type | Validation | DB Column |
|---|---|---|---|
| Title | text | Required, max 200 | `company_kr.title` |
| Description | textarea | Optional, max 2000 | `company_kr.description` |
| Metric Type | dropdown | From `okr_metric_definition` | `company_kr.metric_type` |
| Metric Unit | text | Auto-filled from metric def | `company_kr.metric_unit` |
| Target Value | number | Required for numeric/currency | `company_kr.target_value` |
| Baseline Value | number | Optional | `company_kr.baseline_value` |
| Weight | number (%) | Required, 1–100 | `company_kr.weight` |
| Contributes to Score | toggle | Default: true | `company_kr.contributes_to_score` |
| Contributes to Value | toggle | Default: false | `company_kr.contributes_to_value` |
| Required for Completion | toggle | Default: false | `company_kr.is_required_for_completion` |

#### Contribution Flag Section
- Toggle switches with visual flag previews:
  - `📊 Score` — "This KR counts toward the weighted score"
  - `💰 Value` — "This KR adds to quantitative value roll-up"
  - `🔒 Required` — "Completion of this KR is mandatory"

#### Footer
`[Cancel] [Create / Save]`

#### Behavior
- Weight validation: all score-contributing KRs under same objective must sum to 100%
- If `contributes_to_value = true`, metric must align with parent objective metric
- Financial KRs: Value flag auto-enabled for currency metrics

---

### M4: Assign Department to Company KR

> **Trigger:** P3 "Assign Department" on a KR · **Size:** `max-w-md`

#### Fields

| Field | Type | Validation |
|---|---|---|
| Department | searchable dropdown | Required. From company's department list |

#### Content
- Shows KR title and metric at top
- Searchable department dropdown with avatar + name
- Already assigned departments shown as chips with (×) to unassign
- Warning: "Assigning a department will auto-create a department objective under this KR."

#### Footer
`[Cancel] [Assign]`

#### Behavior
- On assign: creates `department_objective` linked to this company KR
- Triggers notification to department head
- Department appears in P3 "Department Uptake" tab

---

### M5: Create / Edit Department KR

> **Trigger:** P5 "+ Add Key Result" · **Size:** `max-w-xl`

#### Fields
Same structure as M3 but for `department_kr`:

| Field | Type | DB Column |
|---|---|---|
| Title | text | `department_kr.title` |
| Description | textarea | `department_kr.description` |
| Metric Type | dropdown | `department_kr.metric_type` |
| Target Value | number | `department_kr.target_value` |
| Weight | number (%) | `department_kr.weight` |
| Contributes to Score | toggle | `department_kr.contributes_to_score` |
| Contributes to Value | toggle | `department_kr.contributes_to_value` |
| Required for Completion | toggle | `department_kr.is_required_for_completion` |

#### Footer
`[Cancel] [Create / Save]`

---

### M6: Assign Contributor

> **Trigger:** P5 / P6 "Assign Contributor" · **Size:** `max-w-md`

#### Fields

| Field | Type | Validation |
|---|---|---|
| Employee | searchable dropdown | Required. Employees in this dept |
| Role Type | dropdown | Required. From `OkrContributorRoleType` enum |
| Required for Completion | toggle | Default: false |
| Notes | textarea | Optional |

#### Content
- Shows KR title and metric at top
- Employee dropdown with avatar + name + current role
- Already assigned contributors shown as chips
- Role type: EMPLOYEE, TEAM_LEADER, MANAGER, DIRECTOR, DEPARTMENT_HEAD

#### Footer
`[Cancel] [Assign]`

#### Behavior
- On assign: creates `employee_objective` for the contributor
- Contributor receives notification with link to P7
- If `is_required_for_completion = true`, contributor must complete for KR to close

---

### M7: Employee Execution Setup

> **Trigger:** P7 "Set Up Execution" on unconfigured objective · **Size:** `max-w-lg`

#### Content

```
"How would you like to execute this objective?"

┌── Option A ─────────────────────────────────────────┐
│  ✅ Direct Adoption                                  │
│  Adopt the assigned KR directly. Progress updates   │
│  will apply to the department KR.                   │
└─────────────────────────────────────────────────────┘

┌── Option B ─────────────────────────────────────────┐
│  🔀 Decompose into execution KRs                    │
│  Break this down into smaller KRs that roll up to   │
│  the assigned KR.                                   │
└─────────────────────────────────────────────────────┘
```

#### Footer
`[Cancel] [Confirm Selection]`

#### Behavior
- **Direct Adoption:** Employee works directly, submits updates against dept KR
- **Decompose:** Employee creates sub-KRs (via M8). Objective score = weighted avg of sub-KRs
- Choice stored in `employee_objective.execution_mode` field
- Once chosen and KR work begins, mode cannot change

---

### M8: Create / Edit Employee KR

> **Trigger:** P8 "+ Add KR" · **Size:** `max-w-xl`

#### Fields

| Field | Type | DB Column |
|---|---|---|
| Title | text | `employee_kr.title` |
| Description | textarea | `employee_kr.description` |
| Metric Type | dropdown | `employee_kr.metric_type` |
| Target Value | number | `employee_kr.target_value` |
| Weight | number (%) | `employee_kr.weight` |

#### Footer
`[Cancel] [Create / Save]`

#### Behavior
- Contributes to parent employee objective score
- Weights must sum to 100% for score-contributing KRs

---

### M9: Create / Edit Monthly Plan

> **Trigger:** P8 Monthly Plans tab "+ Add" · **Size:** `max-w-lg`

#### Fields

| Field | Type | Validation |
|---|---|---|
| Month | dropdown | Required. Available months in quarter |
| Description | textarea | Optional |
| Milestones | repeater | Add milestone items with title + target date |

#### Footer
`[Cancel] [Save Plan]`

#### Behavior
- Sequence enforced: Month 2 cannot be created before Month 1
- Status starts as `DRAFT`, can be submitted for approval

---

### M10: Create / Edit Weekly Plan

> **Trigger:** P8 Weekly Plans tab "+ Add" · **Size:** `max-w-lg`

#### Fields

| Field | Type | Validation |
|---|---|---|
| Week Number | dropdown | Required. Weeks within selected month |
| Month | dropdown | Required. Must have a monthly plan first |
| Description | textarea | Optional |
| Milestones | repeater | Title + target day |

#### Footer
`[Cancel] [Save Plan]`

#### Behavior
- Only available when `OkrPlanningCadence = WEEKLY` in config
- Week must belong to an existing monthly plan

---

### M11: Progress Update

> **Trigger:** P7 / P8 "Submit Update" · **Size:** `max-w-lg`

#### Fields

| Field | Type | Validation | DB Column |
|---|---|---|---|
| KR | dropdown | Required. Employee's KRs | `progress_update.employee_kr_id` |
| Current Value | number | Required | `progress_update.new_value` |
| Confidence | dropdown | ON_TRACK / AT_RISK / OFF_TRACK | `progress_update.confidence_level` |
| Completed? | toggle | Binary completion flag | `progress_update.is_completed` |
| Notes | textarea | Optional | `progress_update.notes` |
| Blocker? | toggle | If yes, show blocker text | `progress_update.has_blocker` |
| Blocker Description | textarea | Required if blocker=true | `progress_update.blocker_description` |

#### Preview Section
Before submit, show:
- Previous value → New value (delta)
- Score impact estimate
- Completion status change

#### Footer
`[Cancel] [Submit Update]`

---

### M12: Approve / Reject / Publish

> **Trigger:** P10 / P9 "Review" · **Size:** `max-w-lg`

#### Content
- **Entity Header:** Type badge + title + submitted by + submitted date
- **Entity Preview:** Key details of the submitted item (objective/KR/plan)
- **Action Section:**
  - `[Approve]` — green button
  - `[Reject]` — red button, requires rejection reason textarea
  - `[Publish]` — blue button (only for approved items), with confirmation
  - `[Request Changes]` — yellow button, requires feedback textarea

#### Footer
`[Cancel] [Selected Action]`

#### Behavior
- Transitions governed by `okr_status_transition` table
- Publishing triggers downstream notifications and unlocks child planning
- Rejection sends notification with reason to submitter

---

### M13: Configure KR Weights

> **Trigger:** P3 / P5 / P8 "⚙ Configure Weights" · **Size:** `max-w-md`

#### Content
- List of all KRs under the objective
- Each row: KR title + slider (0–100) or number input for weight
- Contribution toggle: Score / Value / Required
- Running total displayed: `Total: 95% / 100%` (red if ≠ 100 for score KRs)

#### Footer
`[Cancel] [Save Weights]`

#### Behavior
- Score-contributing KRs must sum to exactly 100%
- Non-score KRs (value-only or required-only) don't count in sum
- Changes audited in `okr_audit_log`

---

### M14: Archive Quarter

> **Trigger:** P1 / P15 "Archive" action · **Size:** `max-w-lg`

#### Content
- **Quarter Summary:** Cycle name, date range, total objectives/KRs/contributors
- **Pre-archive checklist:**
  - ☐ All objectives reviewed
  - ☐ All incomplete items finalized
  - ☐ Config snapshot captured
- **Report generation options:**
  - ☑ Generate Strategic Summary Report
  - ☑ Generate Completion Report
  - ☑ Generate Contributor Performance Report
  - ☑ Generate Financial Roll-Up Report
  - ☑ Generate Insights
- **Export options:**
  - Format: [PDF ▼] [XLSX ▼] [CSV ▼]
  - Scope: [Full ▼] [By Department ▼]

#### Footer
`[Cancel] [Archive Quarter]`

#### Behavior
- Archives cycle: status → `ARCHIVED`, locks all data from editing
- Creates `archive_snapshot` with config snapshot
- Triggers report/insight/export generation jobs
- Navigates to P16 after completion


---

## 5. Reusable Shared Components

These components are used across multiple pages and modals in the OKR module. Each should be implemented as a standalone React component in the shared components directory.

### Layout & Navigation

| Component | Props | Used In | Description |
|---|---|---|---|
| `OkrPageHeader` | `title, subtitle, actionButton?, cycleName?` | All 16 pages | Orange gradient header with decorative blob, optional action button |
| `OkrSidebarNav` | `activeItem, permissions` | All pages | OKR sidebar section with Dashboard/Company/Dept/My OKRs/Approvals/Archives/Settings |
| `BackButton` | `label, to` | P3, P5, P8, P16 | "← Back to X" navigation link |
| `CycleSelector` | `cycles[], selectedId, onChange` | P2, P4, P11 | Dropdown to switch between cycles |

### Data Display

| Component | Props | Used In | Description |
|---|---|---|---|
| `StatCard` | `icon, label, value, trend?, color` | P1–P12, P15 | 48px icon + label + large value + optional trend badge |
| `StatusBadge` | `status, size?` | All pages & modals | Colored pill: Draft(grey), Submitted(blue), Approved(green), Published(teal), In Progress(primary), Completed(green), Rejected(red), Archived(blue) |
| `LevelBadge` | `level` | P2–P13 | Company(gold), Department(orange), Individual(blue) pill badge |
| `ContributionFlags` | `score?, value?, required?` | P2, P3, P5, P7, P8 | Row of small pill badges: 📊Score(blue), 💰Value(green), 🔒Required(red) |
| `ThreeIndicatorPanel` | `score, value, completion, metricUnit?` | P3, P5, P7, P8 | Three side-by-side boxes showing Score%, Value (with unit), Completion (n/m) separately |
| `AlignmentBreadcrumb` | `levels[]` | P7, P8 | Company→Dept→Employee tree with icons and connector lines |
| `PublicationGateBanner` | `parentLevel, parentStatus` | P4, P7 | Warning banner when parent not published, disables action buttons |
| `ProgressBar` | `value, max, color?, showLabel?` | P2–P9, P11, P12 | Horizontal bar with percentage label |
| `BinaryCompletionToggle` | `completed, onChange, disabled?` | P7, P8, M11 | Large toggle: green ✓ (Complete) / grey ○ (Not Complete) |
| `ConfidenceBadge` | `level` | P7–P9, P11, M11 | ON_TRACK(green), AT_RISK(yellow), OFF_TRACK(red) badge |

### Cards

| Component | Props | Used In | Description |
|---|---|---|---|
| `ObjectiveCard` | `objective, level, expanded?, onToggle?, onViewDetail?` | P2, P4, P7, P13 | White card with title, status, metric, score/completion, KR preview, expand/collapse |
| `KrCard` | `kr, contributionFlags, assignedTo?, onEdit?, onAssign?` | P3, P5, P8 | KR detail card with metric, weight, flags, status, actions |
| `ContributorCard` | `contributor, krTitle?, asMgr?` | P6, P9 | Avatar + name + role + assignment + score/completion + last update |
| `KrAssignmentCard` | `kr, contributors[], onAssign?` | P6 | KR with contributor list, assign button |
| `MonthlyPlanCard` | `month, status, items[], onEdit?` | P5, P8 | Month label + status + milestone list |
| `WeeklyPlanCard` | `week, month, status, items[], onEdit?` | P8 | Week number + milestones |
| `DeptHeatCard` | `deptName, score, completedRatio, confidence` | P12 | Colored card tinted by score range |

### Forms & Inputs

| Component | Props | Used In | Description |
|---|---|---|---|
| `MetricTypeDropdown` | `value, onChange, definitions[]` | M2, M3, M5, M8 | Dropdown populated from `okr_metric_definition` |
| `WeightInput` | `value, onChange, max?` | M3, M5, M8, M13 | Number input (0–100) with % suffix |
| `WeightSummaryBar` | `weights[], target` | M13, P3, P5, P8 | Running total display with color: green=100%, red≠100% |
| `ContributionToggleGroup` | `score, value, required, onChange` | M3, M5 | Three toggle switches with flag previews |
| `EmployeeSearchDropdown` | `deptId?, value, onChange` | M6 | Searchable employee dropdown with avatar |
| `DepartmentSearchDropdown` | `companyId, value, onChange` | M4 | Searchable department dropdown |
| `MilestoneRepeater` | `items[], onChange` | M9, M10 | Add/remove milestone rows with title + date |
| `ExecutionModeSelector` | `selected, onChange` | M7 | Two large radio-card options: Direct/Decompose |

### Tables & Lists

| Component | Props | Used In | Description |
|---|---|---|---|
| `OkrDataTable` | `columns, data, pagination?, sorting?, actions?` | P1, P6, P10, P12, P15, P16 | Reusable data table with card container, grey header, hover rows, pagination |
| `ActivityTimeline` | `events[]` | P3, P5 | Vertical timeline of activity_log entries with icons and timestamps |
| `UpdateHistoryTable` | `updates[]` | P8 | DataTable of progress_update records |
| `ArchiveReportList` | `reports[]` | P16 | List of reports with view/download actions |

### Charts & Visualization

| Component | Props | Used In | Description |
|---|---|---|---|
| `HorizontalBarChart` | `items[], showValue?` | P11 | Objective scores as horizontal bars |
| `VerticalBarChart` | `items[], labelKey, valueKey` | P11, P12 | Department comparison bars |
| `AreaChart` | `series[], xLabels[]` | P11 | Confidence trend over weeks |
| `LineChart` | `series[], xLabels[], compareWith?` | P11 | Quarter-over-quarter trajectory |

---

## 6. Notification Triggers

| Event | Recipient | Content |
|---|---|---|
| Cycle Opened | All Dept Heads | "OKR cycle Q1 2026 is now open. Company planning can begin." |
| Company OKRs Published | All Dept Heads | "Company objectives are published. Department planning is now unlocked." |
| Department Assigned to KR | Dept Head | "Your department has been assigned to KR: {title}" |
| Contributor Assigned | Employee | "You've been assigned to: {kr_title}. Set up your execution plan." |
| Plan Submitted for Approval | Approver | "{employee} submitted {entity_type} for review." |
| Plan Approved | Submitter | "Your {entity_type} has been approved by {approver}." |
| Plan Rejected | Submitter | "Your {entity_type} was rejected. Reason: {reason}" |
| Plan Published | Downstream users | "{entity_type} has been published. Planning is now unlocked." |
| Update Overdue | Employee + Manager | "Progress update is overdue for: {kr_title}" |
| KR Completed | Manager + Dept Head | "{employee} completed KR: {kr_title}" |
| Objective Completed | Dept Head + HR | "All KRs completed for objective: {title}" |
| Quarter Archived | All stakeholders | "Q1 2026 has been archived. Reports are available." |

---

## 7. Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| `≥1280px` (Desktop) | Full sidebar + 4-column stat cards + full data tables |
| `1024–1279px` (Tablet landscape) | Collapsed sidebar + 2-column stat cards + scrollable tables |
| `768–1023px` (Tablet portrait) | Hidden sidebar (hamburger) + 2-column stat cards + card-based tables |
| `<768px` (Mobile) | Full-width stacked layout + bottom nav + modals go full-screen |

---

## 8. Animation & Polish

| Element | Animation |
|---|---|
| Page transition | `opacity 0→1, translateY 8→0`, `200ms ease-out` |
| Modal open | Overlay: `opacity 0→1 150ms`. Content: `scale(0.95)→1, opacity 0→1, 200ms ease-spring` |
| Modal close | Reverse of open, `150ms` |
| Stat card value | Count-up animation on mount, `600ms` |
| Status badge change | `background-color transition 300ms` + subtle scale pulse |
| Card expand/collapse | `max-height transition 300ms ease-in-out` |
| Tab switch | Content: `opacity 0→1, translateX ±10→0`, `200ms` |
| Progress bar fill | `width transition 600ms ease-out` on mount or value change |
| Publication gate banner | Slide-down `200ms` with `border-left-4 border-warning` pulse |
| Binary completion toggle | Toggle slide `150ms` with color transition |
| Hover animations | Cards: `translateY(-2px), shadow-lg`, `150ms`. Buttons: `brightness(1.1)`, `100ms` |
| Loading states | Skeleton shimmer for cards and tables |
| Toast notifications | Slide-in from bottom-right, auto-dismiss after `5s` |
