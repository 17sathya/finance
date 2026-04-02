# Finance Data Processing and Access Control Backend

A RESTful backend API for a finance dashboard system with role-based access control, financial record management, and analytics. Built with **Node.js**, **Express**, and **MongoDB**.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup & Running](#setup--running)
- [Role Permissions](#role-permissions)
- [API Reference](#api-reference)
  - [Auth](#auth)
  - [Users](#users)
  - [Records](#records)
  - [Dashboard](#dashboard)
- [Design Decisions & Assumptions](#design-decisions--assumptions)
- [Testing](#testing)

---

## Tech Stack

| Layer        | Technology                        |
|--------------|-----------------------------------|
| Runtime      | Node.js                           |
| Framework    | Express.js                        |
| Database     | MongoDB (via Mongoose ODM)        |
| Auth         | JWT (jsonwebtoken) + bcryptjs     |
| Validation   | express-validator                 |
| Rate Limiting| express-rate-limit                |
| Testing      | Jest + Supertest                  |

---

## Project Structure

```
finance-backend/
├── src/
│   ├── app.js                  # Express app, middleware, route mounting
│   ├── config/
│   │   └── db.js               # MongoDB connection
│   ├── models/
│   │   ├── User.js             # User schema (roles, password hashing)
│   │   └── Record.js           # Financial record schema (soft delete)
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication + role authorization
│   │   └── errorHandler.js     # Global error handler + validation helper
│   ├── controllers/
│   │   ├── authController.js   # Register, login, get current user
│   │   ├── userController.js   # User CRUD (admin only)
│   │   ├── recordController.js # Financial record CRUD + filtering
│   │   └── dashboardController.js # Analytics: summary, trends, breakdown
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── recordRoutes.js
│   │   └── dashboardRoutes.js
│   └── utils/
│       └── seed.js             # Seed script for demo data
├── tests/
│   ├── auth.test.js
│   ├── records.test.js
│   └── dashboard.test.js
├── .env.example
├── .gitignore
├── jest.config.json
├── package.json
└── README.md
```

---

## Setup & Running

### Prerequisites

- Node.js v18+
- MongoDB running locally (or a MongoDB Atlas URI)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/finance_db
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

### 3. (Optional) Seed demo data

```bash
npm run seed
```

This creates three demo accounts:

| Email                  | Password    | Role     |
|------------------------|-------------|----------|
| admin@finance.dev      | password123 | admin    |
| analyst@finance.dev    | password123 | analyst  |
| viewer@finance.dev     | password123 | viewer   |

And 60 randomised financial records across the past 6 months.

### 4. Start the server

```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs at: `http://localhost:3000`

Health check: `GET /health`

---

## Role Permissions

| Action                        | Viewer | Analyst | Admin |
|-------------------------------|:------:|:-------:|:-----:|
| View financial records        | ✅     | ✅      | ✅    |
| Create / edit records         | ❌     | ✅      | ✅    |
| Delete records (soft)         | ❌     | ❌      | ✅    |
| Access dashboard analytics    | ❌     | ✅      | ✅    |
| List / view users             | ❌     | ❌      | ✅    |
| Change user roles             | ❌     | ❌      | ✅    |
| Activate / deactivate users   | ❌     | ❌      | ✅    |
| Delete users                  | ❌     | ❌      | ✅    |

---

## API Reference

All authenticated endpoints require:
```
Authorization: Bearer <token>
```

All responses follow the shape:
```json
{ "success": true | false, ...data }
```

---

### Auth

#### `POST /api/auth/register`
Create a new account. The very first registered user is automatically assigned the `admin` role; all subsequent registrations default to `viewer`.

**Body:**
```json
{
  "name": "Sathya C",
  "email": "sathya@example.com",
  "password": "securepassword"
}
```

**Response `201`:**
```json
{
  "success": true,
  "token": "<jwt>",
  "user": { "_id": "...", "name": "Sathya C", "email": "...", "role": "admin" }
}
```

---

#### `POST /api/auth/login`
Authenticate and receive a JWT token.

**Body:**
```json
{ "email": "sathya@example.com", "password": "securepassword" }
```

**Response `200`:**
```json
{ "success": true, "token": "<jwt>", "user": { ... } }
```

---

#### `GET /api/auth/me` 🔒
Returns the currently authenticated user.

**Response `200`:**
```json
{ "success": true, "user": { ... } }
```

---

### Users

> All user management endpoints require **admin** role.

#### `GET /api/users`
List all users with optional filters.

**Query params:**
| Param    | Type    | Description                        |
|----------|---------|------------------------------------|
| role     | string  | Filter by `viewer`, `analyst`, `admin` |
| isActive | boolean | Filter by account status           |
| page     | number  | Page number (default: 1)           |
| limit    | number  | Results per page (default: 20)     |

**Response `200`:**
```json
{
  "success": true,
  "total": 3,
  "page": 1,
  "pages": 1,
  "users": [ ... ]
}
```

---

#### `GET /api/users/:id`
Get a single user by ID.

---

#### `PATCH /api/users/:id/role`
Change a user's role. Admins cannot change their own role.

**Body:**
```json
{ "role": "analyst" }
```

---

#### `PATCH /api/users/:id/status`
Activate or deactivate a user. Deactivated users cannot log in.

**Body:**
```json
{ "isActive": false }
```

---

#### `DELETE /api/users/:id`
Permanently delete a user. Admins cannot delete themselves.

---

### Records

#### `GET /api/records` 🔒 (viewer, analyst, admin)
List financial records with rich filtering and pagination.

**Query params:**
| Param      | Type   | Description                                    |
|------------|--------|------------------------------------------------|
| type       | string | `income` or `expense`                          |
| category   | string | e.g. `salary`, `food`, `transport`             |
| startDate  | ISO date | Records on or after this date               |
| endDate    | ISO date | Records on or before this date              |
| minAmount  | number | Minimum amount                                 |
| maxAmount  | number | Maximum amount                                 |
| search     | string | Search within notes (case-insensitive)         |
| sortBy     | string | Field to sort by (default: `date`)             |
| order      | string | `asc` or `desc` (default: `desc`)              |
| page       | number | Page number (default: 1)                       |
| limit      | number | Results per page (default: 20, max: 100)       |

**Response `200`:**
```json
{
  "success": true,
  "total": 45,
  "page": 1,
  "pages": 3,
  "records": [ ... ]
}
```

---

#### `GET /api/records/:id` 🔒 (viewer, analyst, admin)
Get a single record by ID.

---

#### `POST /api/records` 🔒 (analyst, admin)
Create a new financial record.

**Body:**
```json
{
  "amount": 5000,
  "type": "income",
  "category": "salary",
  "date": "2024-03-01",
  "notes": "March salary payment"
}
```

**Valid categories:** `salary`, `freelance`, `investment`, `rental`, `food`, `transport`, `utilities`, `healthcare`, `entertainment`, `education`, `shopping`, `other`

---

#### `PATCH /api/records/:id` 🔒 (analyst, admin)
Update one or more fields of an existing record. Only provided fields are updated.

**Body (all fields optional):**
```json
{
  "amount": 5500,
  "notes": "Updated amount after bonus"
}
```

---

#### `DELETE /api/records/:id` 🔒 (admin only)
Soft-deletes the record (sets `isDeleted: true`). Soft-deleted records are excluded from all queries but remain in the database for audit purposes.

---

### Dashboard

> Requires **analyst** or **admin** role.

All dashboard endpoints accept optional `startDate` and `endDate` query params to scope the data to a time range.

---

#### `GET /api/dashboard/summary`
Returns high-level financial totals and recent activity.

**Response `200`:**
```json
{
  "success": true,
  "summary": {
    "income": 24500,
    "expense": 4300,
    "net": 20200,
    "incomeCount": 12,
    "expenseCount": 18
  },
  "byCategory": {
    "salary": { "income": { "total": 20000, "count": 4 } },
    "food":   { "expense": { "total": 800, "count": 8 } }
  },
  "recentActivity": [ ... ]
}
```

---

#### `GET /api/dashboard/trends`
Returns income/expense totals grouped by time period.

**Query params:**
| Param  | Values             | Default  |
|--------|--------------------|----------|
| period | `monthly`, `weekly`| `monthly`|

**Response `200`:**
```json
{
  "success": true,
  "period": "monthly",
  "trends": [
    { "period": "2024-01", "income": 6000, "expense": 1200, "net": 4800 },
    { "period": "2024-02", "income": 7500, "expense": 900,  "net": 6600 }
  ]
}
```

---

#### `GET /api/dashboard/category-breakdown`
Returns totals and percentages per category.

**Query params:**
| Param | Values              | Description         |
|-------|---------------------|---------------------|
| type  | `income`, `expense` | Filter by entry type|

**Response `200`:**
```json
{
  "success": true,
  "grandTotal": 28800,
  "breakdown": [
    { "category": "salary",    "total": 20000, "count": 4, "avgAmount": 5000, "percentage": 69.44 },
    { "category": "freelance", "total": 4500,  "count": 3, "avgAmount": 1500, "percentage": 15.63 }
  ]
}
```

---

## Design Decisions & Assumptions

### Authentication
- JWT stored client-side (Authorization header). No refresh tokens — kept simple for this scope.
- The first registered user becomes admin automatically, removing the need for a separate admin bootstrap step.

### Role Model
- Three roles: `viewer` (read-only), `analyst` (read + create/edit), `admin` (full access including user management).
- Role checks are enforced at the route level via `authorize(...roles)` middleware, keeping controllers free of permission logic.

### Soft Delete
- Records are never hard-deleted; instead, `isDeleted: true` is set. A Mongoose pre-query hook automatically filters these out of all find operations.
- This preserves an audit trail which is especially important in financial systems.

### Data Validation
- Input validated at the route layer using `express-validator` before reaching controllers.
- Mongoose schema validators provide a second layer of defence.
- Structured, field-level error messages are returned for validation failures (`422`).

### Error Handling
- A single global error handler normalises all errors (Mongoose, JWT, application) into consistent JSON responses with appropriate HTTP status codes.

### Rate Limiting
- 100 requests per 15 minutes per IP using `express-rate-limit`. Configurable.

### Pagination
- All list endpoints support `page` and `limit` query params and return `total` and `pages` in the response.

### Dashboard Aggregations
- Uses MongoDB's native aggregation pipeline (`$group`, `$match`, `$sort`) for efficient server-side computation rather than fetching all records into memory.

---

## Testing

Tests use **Jest** and **Supertest** against a separate in-memory test MongoDB instance.

```bash
npm test
```

Test coverage includes:
- Auth: register, login, token validation, edge cases
- Records: CRUD, role enforcement, filtering, soft delete
- Dashboard: summary totals, trends, category breakdown, role enforcement
- User management: role changes, status toggling, self-modification guard
