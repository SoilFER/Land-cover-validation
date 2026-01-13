# 🔐 Authentication System Documentation (Server-Side Storage)

## Overview

The Land Cover Validation System includes a robust authentication system with **role-based access control (RBAC)** and **country-based validation access**. Users are stored in a secure JSON file on the server (`./secrets/users.json`), not in Google Sheets.

---

## 📑 Table of Contents

1. [User Roles](#user-roles)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Creating the First Admin User](#creating-the-first-admin-user)
5. [User Management](#user-management)
6. [Country-Based Access Control](#country-based-access-control)
7. [Security Features](#security-features)
8. [User Workflow](#user-workflow)
9. [Troubleshooting](#troubleshooting)

---

## 🎭 User Roles

The system supports three user roles with different permission levels:

### 1. **Admin** (Full Access)
- ✅ View all records from all countries
- ✅ Validate and edit records from ALL countries
- ✅ Manage users (create, edit, deactivate, reset passwords)
- ✅ Access user management page (`/users`)
- ✅ View reports and export data
- 🌍 **Country Access**: ALL countries

### 2. **Validator** (Country-Specific Validation Access)
- ✅ View all records (read-only for other countries)
- ✅ **Validate and edit ONLY assigned country records**
- ✅ View reports and export data
- ❌ Cannot manage users
- ❌ Cannot validate records from non-assigned countries
- 🌍 **Country Access**: Specific countries assigned by Admin (e.g., GTM, HND)

### 3. **Viewer** (Read-Only Access)
- ✅ View dashboard and all records
- ✅ View validated records
- ❌ Cannot validate or edit records
- ❌ Cannot export data
- ❌ Cannot manage users
- 🌍 **Country Access**: View-only (no editing)

---

## 🚀 Initial Setup

### Prerequisites

1. **Node.js 18+** installed
2. **npm packages** installed (`npm install`)
3. **Environment variables** configured (`.env` file)

### Step 1: Install Dependencies

```bash
npm install
```

This installs:
- `express-session` - Session management
- `bcrypt` - Password hashing

---

## ⚙️ Environment Configuration

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### Required Environment Variables

Add the following to your `.env` file:

```bash
# Session Authentication
SESSION_SECRET=your-random-secret-here-minimum-32-characters
SESSION_TIMEOUT=28800000  # 8 hours in milliseconds
```

**Generate a secure session secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and paste it as your `SESSION_SECRET` value.

### Full .env Example

```bash
NODE_ENV=production
PORT=3000

# API Authentication (for upload endpoints)
API_KEY=your-secure-api-key-here

# Session Authentication
SESSION_SECRET=a7f3d8e9c2b4a1f6e8d9c2b4a1f6e8d9c2b4a1f6e8d9c2b4a1f6e8d9c2b4
SESSION_TIMEOUT=28800000

# Google Sheets Configuration
SPREADSHEET_ID=your-google-spreadsheet-id
SHEET_NAME=LandCoverV2
```

---

## 👤 Creating the First Admin User

### Step 3: Run the Initialization Script

Run the admin user creation script:

```bash
node init-admin.js
```

You'll be prompted for:
- **Username**: Lowercase, alphanumeric + underscores (e.g., `admin` or `jdoe`)
- **Full Name**: Display name (e.g., `John Doe`)
- **Email**: Optional contact email
- **Password**: Minimum 8 characters (will be hashed with bcrypt)
- **Password Confirmation**: Must match

**Example Session:**

```
============================================
  ADMIN USER INITIALIZATION
  (JSON File Storage)
============================================

Creating your admin user...

Username (lowercase, alphanumeric + underscores): admin
Full Name (e.g., John Doe): System Administrator
Email (optional, press Enter to skip): admin@example.com
Password (minimum 8 characters): ********
Confirm password: ********

📊 Summary:
   Username:  admin
   Full Name: System Administrator
   Email:     admin@example.com
   Role:      admin
   Storage:   ./secrets/users.json

Create this admin user? (yes/no): yes

👤 Creating admin user...
🔐 Hashing password...

✅ Admin user created successfully!

============================================
  NEXT STEPS:
============================================
1. Start your server: npm start
2. Navigate to: http://localhost:3000/login
3. Login with username: admin
4. You can now create additional users via /users

📁 User database location: C:\...\secrets\users.json
⚠️  Keep ./secrets/ directory secure (it contains password hashes)
============================================
```

### Step 4: Start the Server

```bash
npm start
```

Navigate to `http://localhost:3000` - you'll be redirected to the login page.

---

## 👥 User Management

### Accessing User Management (Admin Only)

1. Log in as an admin user
2. Click **"Manage Users"** in the navbar
3. Or navigate to `/users`

### Creating New Users

1. Go to `/users`
2. Fill out the **Create New User** form:
   - **Username**: Lowercase, alphanumeric + underscores only
   - **Password**: Minimum 8 characters
   - **Role**: Select Admin, Validator, or Viewer
   - **Full Name**: User's display name (required)
   - **Email**: Optional contact email
   - **Countries**: Comma-separated country codes (e.g., `GTM, HND, TUN`) - **for Validators only**
3. Click **"Create User"**

### Assigning Countries to Validators

When creating or editing a **Validator** user:

1. In the **Countries** field, enter comma-separated country codes:
   ```
   GTM, HND, TUN
   ```

2. Available country codes:
   - `GTM` - Guatemala
   - `HND` - Honduras
   - `TUN` - Tunisia
   - `MOZ` - Mozambique
   - `GHA` - Ghana
   - `ZMB` - Zambia
   - `KEN` - Kenya

3. Validators will **only** be able to validate/edit records from their assigned countries

4. Leave empty for Admin (has access to all countries)

### Editing Users

1. In the users table, click **"Edit"** next to a user
2. Update fields:
   - Full Name
   - Role
   - Email
   - **Countries** (for Validators)
3. Click **"Update User"**

**Note**: Username cannot be changed after creation.

### Resetting Passwords

1. In the users table, click **"Reset Password"**
2. Enter a new password (minimum 8 characters)
3. Click **"Reset Password"**
4. The user can immediately log in with the new password

### Deactivating Users

1. In the users table, click **"Deactivate"** next to an active user
2. Confirm the action
3. The user will no longer be able to log in

**To reactivate**: Click **"Activate"** on a deactivated user.

---

## 🌍 Country-Based Access Control

### How It Works

1. **Admin Users**:
   - Have access to **ALL countries** automatically
   - Can validate and edit records from any country
   - No country restrictions

2. **Validator Users**:
   - Assigned specific countries by Admin (e.g., `GTM, HND`)
   - Can **only** validate/edit records from assigned countries
   - Attempting to access records from non-assigned countries returns `403 Forbidden`
   - Example:
     - Validator assigned to `GTM, HND`
     - ✅ Can validate GTM-001, GTM-002, HND-001
     - ❌ Cannot validate TUN-001, MOZ-001

3. **Viewer Users**:
   - Can view all records (read-only)
   - Cannot validate or edit any records

### Country Access Validation

Access is checked at **two points**:

1. **When opening validation form** (`/validate/:uuid`):
   - System checks the record's `country_code`
   - Compares with user's assigned countries
   - If no match → `403 Forbidden`

2. **When saving validation** (`POST /save`):
   - System re-checks the record's `country_code`
   - Ensures user still has access
   - Prevents URL manipulation attacks

---

## 🛡️ Security Features

### Password Security
- **Hashing**: bcrypt with 10 salt rounds
- **Minimum Length**: 8 characters enforced
- **No Plain Text Storage**: Passwords never stored or logged in plain text

### Session Security
- **httpOnly Cookies**: Prevents XSS attacks (JavaScript cannot access session cookies)
- **Secure Flag**: HTTPS-only in production (configured via `NODE_ENV=production`)
- **sameSite: strict**: CSRF protection
- **Session Timeout**: 8 hours default (configurable via `SESSION_TIMEOUT`)
- **Session Regeneration**: New session ID on login (prevents session fixation)

### Input Validation
- **Username Sanitization**: Only lowercase, alphanumeric + underscores allowed
- **Role Validation**: Only valid roles (admin/validator/viewer) accepted
- **Country Code Validation**: Uppercase, comma-separated format
- **XSS Prevention**: All user input escaped in EJS templates using `<%= %>`

### File Security
- **User Database**: Stored in `./secrets/users.json` (excluded from git)
- **Permissions**: Ensure `./secrets/` directory is not web-accessible
- **Backup**: Regularly backup `users.json` file

### Audit Trail
- **Last Login Timestamp**: Automatically updated on each successful login
- **Created Date**: User creation timestamp tracked
- **Validator Name**: Auto-filled from session in `validator_name` field
- **Multiple Validators**: The `validator_name` field can store comma-separated names if a record is validated by multiple people

---

## 🔄 User Workflow

### Login Flow

1. User visits any protected route (e.g., `/`)
2. System checks for valid session
3. If not authenticated → redirect to `/login`
4. User enters username and password
5. System validates credentials against JSON database
6. On success:
   - Generate new session ID (security)
   - Store user data in session (username, role, full_name, countries)
   - Update last_login timestamp
   - Redirect to original URL or dashboard
7. On failure:
   - Display generic error message (prevents username enumeration)
   - Log failed attempt

### Validation Workflow (Country-Based)

1. **Admin** clicks "Validate" on any pending record → Access granted
2. **Validator** clicks "Validate" on a record:
   - System checks record's `country_code`
   - If country matches assigned countries → Access granted
   - If country doesn't match → `403 Forbidden`
3. System loads validation form at `/validate/:uuid`
4. Validator name is **auto-filled** from session (`user.full_name`)
5. Validator completes form and submits
6. System re-validates country access
7. Record is updated in Google Sheets with validator name from session
8. Redirect back to dashboard

### Logout Flow

1. User clicks "Logout" button
2. Session destroyed on server
3. User redirected to `/login`
4. Cannot access protected routes until logging in again

---

## 🐛 Troubleshooting

### Issue: "Invalid username or password" when logging in

**Possible Causes:**
1. Username is case-sensitive - ensure you're using lowercase
2. Password is incorrect
3. User is deactivated (check `is_active` in users.json)
4. Users database file doesn't exist or is corrupted

**Solution:**
- Check `./secrets/users.json` file exists
- Verify `is_active: true` for the user
- Try resetting password via admin account or re-run `init-admin.js`

### Issue: "Forbidden: You do not have access to validate records for [COUNTRY]"

**Possible Causes:**
1. Validator not assigned to that country
2. Countries not configured correctly in user profile

**Solution:**
- Log in as Admin
- Go to `/users`
- Edit the validator user
- Add the country code to the **Countries** field (e.g., `GTM, HND, TUN`)
- User must log out and log back in for changes to take effect

### Issue: Session expires too quickly

**Solution:**
Increase `SESSION_TIMEOUT` in `.env`:

```bash
SESSION_TIMEOUT=43200000  # 12 hours
```

Restart the server for changes to take effect.

### Issue: "Cannot find module 'bcrypt'" error

**Solution:**
Reinstall dependencies:

```bash
npm install
```

If bcrypt installation fails (common on Windows), try:

```bash
npm install bcrypt --build-from-source
```

### Issue: Users database not found

**Solution:**
Run the init script to create the first admin user:

```bash
node init-admin.js
```

This will create `./secrets/users.json` automatically.

### Issue: Cannot access /users page

**Possible Causes:**
1. User is not logged in as Admin
2. User role is not set to `admin` in users.json

**Solution:**
- Verify your role in `./secrets/users.json`
- Role must be exactly `"admin"` (lowercase)
- If needed, manually edit users.json (ensure valid JSON format)

### Issue: Validator name not auto-filling

**Solution:**
- Ensure user has `full_name` set in users.json
- Log out and log back in to refresh session
- Check browser console for JavaScript errors

---

## 📂 User Database Structure

### Location

```
./secrets/users.json
```

**IMPORTANT**: This file contains password hashes and should NEVER be committed to git. The `./secrets/` directory is already in `.gitignore`.

### Format

```json
{
  "users": {
    "admin": {
      "username": "admin",
      "password_hash": "$2b$10$...",
      "role": "admin",
      "email": "admin@example.com",
      "full_name": "System Administrator",
      "countries": [],
      "created_date": "2025-01-13T10:00:00.000Z",
      "last_login": "2025-01-13T12:30:00.000Z",
      "is_active": true
    },
    "validator_gtm": {
      "username": "validator_gtm",
      "password_hash": "$2b$10$...",
      "role": "validator",
      "email": "validator@example.com",
      "full_name": "Guatemala Validator",
      "countries": ["GTM", "HND"],
      "created_date": "2025-01-13T11:00:00.000Z",
      "last_login": "2025-01-13T13:00:00.000Z",
      "is_active": true
    }
  }
}
```

### Fields Explained

- **username**: Unique identifier (lowercase, alphanumeric + underscores)
- **password_hash**: bcrypt hash of password (never plain text)
- **role**: `admin`, `validator`, or `viewer`
- **email**: Optional contact email
- **full_name**: Display name (shown in UI and auto-filled as validator_name)
- **countries**: Array of country codes (e.g., `["GTM", "HND"]`) - for validators only
- **created_date**: ISO timestamp of user creation
- **last_login**: ISO timestamp of last successful login
- **is_active**: Boolean - `true` for active, `false` for deactivated

---

## 🔐 API Routes (Protected)

### Authentication Routes

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/login` | Public | Login page |
| POST | `/login` | Public | Process login |
| GET | `/logout` | Authenticated | Destroy session |

### User Management Routes (Admin Only)

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/users` | Admin | User management page |
| POST | `/users/create` | Admin | Create new user |
| POST | `/users/update` | Admin | Update user (incl. countries) |
| POST | `/users/reset-password` | Admin | Reset user password |

### Dashboard Routes (Role + Country-Based)

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | Authenticated | Pending validations list |
| GET | `/validated` | Authenticated | Validated records list |
| GET | `/validate/:uuid` | Validator/Admin + Country Access | Validation form |
| POST | `/save` | Validator/Admin + Country Access | Save validation |

### API Routes (API Key Auth - Unchanged)

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/api/upload` | API Key | Upload photo |
| GET | `/health` | Public | Health check |

---

## 🔄 Migration from Previous Version

If upgrading from a version without authentication:

1. **Install new dependencies**: `npm install`
2. **Update environment**: Add `SESSION_SECRET` to `.env`
3. **Run init script**: `node init-admin.js` to create first admin
4. **Test login**: Access `/login` and verify authentication works
5. **Create user accounts**: Add users for all validators via `/users`
6. **Assign countries**: Edit each validator to assign their countries
7. **No data loss**: Existing validation data in Google Sheets remains unchanged

**Note**: The `validator_name` field in Google Sheets will now be auto-populated from logged-in user's `full_name`.

---

## 🆚 Key Differences from Previous Implementation

### ✅ What Changed

1. **User Storage**:
   - ❌ OLD: Google Sheets "Users" tab
   - ✅ NEW: JSON file (`./secrets/users.json`)

2. **Country-Based Access**:
   - ❌ OLD: All validators could edit any country
   - ✅ NEW: Validators restricted to assigned countries

3. **Viewer Role**:
   - ❌ OLD: Viewer could export data
   - ✅ NEW: Viewer is strictly read-only (no export)

4. **User Management**:
   - ✅ NEW: Countries field added to user management UI
   - ✅ NEW: Country access validation on validation routes

### ✅ What Stayed the Same

- Password hashing (bcrypt, 10 rounds)
- Session management (express-session, 8-hour timeout)
- Login/logout workflow
- Auto-filled validator names
- Role-based permissions (Admin/Validator/Viewer)
- Security features (httpOnly cookies, XSS prevention, CSRF protection)

---

## 📊 User Role Matrix

| Feature | Viewer | Validator | Admin |
|---------|--------|-----------|-------|
| View dashboard | ✅ | ✅ | ✅ |
| View validated records | ✅ | ✅ | ✅ |
| **Validate assigned country records** | ❌ | ✅ | ✅ |
| **Validate non-assigned country records** | ❌ | ❌ | ✅ |
| Edit own validations | ❌ | ✅ (own country) | ✅ |
| Edit others' validations | ❌ | ❌ (own country) | ✅ |
| Manage users | ❌ | ❌ | ✅ |
| Export data | ❌ | ✅ | ✅ |

---

## 🔒 Security Best Practices

### For Production Deployment

1. **Use HTTPS**: Set `NODE_ENV=production` to enable secure cookies
2. **Strong Session Secret**: Use a cryptographically random 32+ character string
3. **Secure File Permissions**: Ensure `./secrets/` directory is not web-accessible
4. **Regular Backups**: Backup `users.json` file regularly
5. **Monitor Failed Logins**: Check server logs for suspicious activity
6. **Limit Admin Accounts**: Create only necessary admin users
7. **Update Dependencies**: Keep npm packages up to date (`npm audit`)
8. **Password Policy**: Encourage users to change passwords periodically

### Password Requirements

Current: **Minimum 8 characters**

To increase security, modify validation in:
- `server.js` (lines for user creation/update)
- `init-admin.js` (line ~187)

---

## 📞 Support

For issues or questions:

1. Check this documentation
2. Review server logs: `docker logs <container-name>` (or console output)
3. Verify `./secrets/users.json` file format (valid JSON)
4. Check GitHub repository issues

---

## 📝 Changelog

### Version 2.1 (Revised Authentication - JSON Storage)

**Changed:**
- User storage moved from Google Sheets to JSON file (`./secrets/users.json`)
- Country-based access control for Validators
- Viewer role is strictly read-only (no export)
- User management UI includes Countries field

**Added:**
- Country assignment for Validators
- Country access validation on validation routes
- `hasCountryAccess()` middleware function

**Removed:**
- Google Sheets "Users" tab dependency
- Viewer export capability

**Security:**
- All previous security features maintained
- File-based storage isolated from Google Sheets

---

**Last Updated**: 2025-01-13
**Version**: 2.1 (Revised - JSON Storage + Country Access)
