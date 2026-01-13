# Authentication System Documentation

## Overview

The Land Cover Validation System now includes a robust authentication system with role-based access control (RBAC). All users must log in to access the system, and permissions are enforced based on user roles.

## Table of Contents

1. [User Roles](#user-roles)
2. [Initial Setup](#initial-setup)
3. [Environment Configuration](#environment-configuration)
4. [Creating the First Admin User](#creating-the-first-admin-user)
5. [User Management](#user-management)
6. [Security Features](#security-features)
7. [User Workflow](#user-workflow)
8. [Troubleshooting](#troubleshooting)

---

## User Roles

The system supports three user roles with different permission levels:

### 1. **Admin** (Full Access)
- ✅ View dashboard and all records
- ✅ Validate new records
- ✅ Edit all validations (own and others)
- ✅ Manage users (create, edit, deactivate, reset passwords)
- ✅ Access user management page (`/users`)
- ✅ View reports and export data

### 2. **Validator** (Validation Access)
- ✅ View dashboard and all records
- ✅ Validate new records
- ✅ Edit own validations
- ✅ View reports and export data
- ❌ Cannot manage users
- ❌ Cannot edit others' validations (unless changed by Admin)

### 3. **Viewer** (Read-Only Access)
- ✅ View dashboard and all records
- ✅ View validated records
- ✅ Export data
- ❌ Cannot validate or edit records
- ❌ Cannot manage users

---

## Initial Setup

### Prerequisites

Before setting up authentication, ensure you have:

1. **Google Sheets API credentials** configured (`./secrets/credentials.json`)
2. **A Google Spreadsheet** with a "Users" sheet (will be created automatically by init script)
3. **Node.js 18+** installed
4. **Required npm packages** installed

### Step 1: Install Dependencies

```bash
npm install
```

This will install the new authentication dependencies:
- `express-session` - Session management
- `bcrypt` - Password hashing
- `multer` - Already included (file uploads)

---

## Environment Configuration

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

## Creating the First Admin User

### Step 3: Prepare Google Sheets

1. Open your Google Spreadsheet
2. Create a new sheet named **"Users"** (if it doesn't exist)
3. The init script will automatically create headers if needed:
   - `username` | `password_hash` | `role` | `email` | `full_name` | `created_date` | `last_login` | `is_active`

### Step 4: Run the Initialization Script

Run the admin user creation script:

```bash
node init-admin.js
```

You'll be prompted for:
- **Username**: Lowercase, alphanumeric + underscores (e.g., `jdoe` or `admin_user`)
- **Full Name**: Display name (e.g., `John Doe`)
- **Email**: Optional contact email
- **Password**: Minimum 8 characters (will be hashed with bcrypt)
- **Password Confirmation**: Must match

**Example Session:**

```
============================================
  ADMIN USER INITIALIZATION
============================================

🔑 Authenticating with Google Sheets API...
✅ Authentication successful

Creating your first admin user...

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
============================================
```

### Step 5: Start the Server

```bash
npm start
```

Navigate to `http://localhost:3000` - you'll be redirected to the login page.

---

## User Management

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
3. Click **"Create User"**

### Editing Users

1. In the users table, click **"Edit"** next to a user
2. Update fields:
   - Full Name
   - Role
   - Email
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

## Security Features

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
- **XSS Prevention**: All user input escaped in EJS templates using `<%= %>`

### Authentication Middleware
- **requireAuth**: Redirects to login if not authenticated
- **requireRole([roles])**: Enforces role-based permissions
- **attachUserToLocals**: Makes user data available in views

### Audit Trail
- **Last Login Timestamp**: Automatically updated on each successful login
- **Created Date**: User creation timestamp tracked
- **Validator Name**: Auto-filled from session (cannot be spoofed)

---

## User Workflow

### Login Flow

1. User visits any protected route (e.g., `/`)
2. System checks for valid session
3. If not authenticated → redirect to `/login`
4. User enters username and password
5. System validates credentials against Google Sheets
6. On success:
   - Generate new session ID (security)
   - Store user data in session (excluding password hash)
   - Update last_login timestamp
   - Redirect to original URL or dashboard
7. On failure:
   - Display generic error message (prevents username enumeration)
   - Log failed attempt

### Validation Workflow

1. **Validator** or **Admin** clicks "Validate" on a pending record
2. System loads validation form at `/validate/:uuid`
3. Validator name is **auto-filled** from session (read-only)
4. Validator completes form and submits
5. System uses `req.session.user.full_name` as validator name (server-side, secure)
6. Record is updated in Google Sheets
7. Redirect back to dashboard

### Logout Flow

1. User clicks "Logout" button
2. Session destroyed on server
3. User redirected to `/login`
4. Cannot access protected routes until logging in again

---

## Troubleshooting

### Issue: "Invalid username or password" when logging in

**Possible Causes:**
1. Username is case-sensitive - ensure you're using lowercase
2. Password is incorrect
3. User is deactivated (check `is_active` column in Users sheet)
4. Google Sheets authentication failed

**Solution:**
- Verify username in Google Sheets (Users tab, column A)
- Check `is_active` column is set to `YES`
- Try resetting password via admin account

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

Or use the pre-built binaries:

```bash
npm install @mapbox/node-pre-gyp
npm install bcrypt
```

### Issue: Users sheet not found

**Solution:**
1. Ensure you have a sheet named **"Users"** in your Google Spreadsheet
2. Run `node init-admin.js` which will create headers automatically
3. Or manually add headers: `username | password_hash | role | email | full_name | created_date | last_login | is_active`

### Issue: "SESSION_SECRET not configured" warning

**Solution:**
1. Copy `.env.example` to `.env`
2. Generate a secure secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
3. Add to `.env`:
   ```bash
   SESSION_SECRET=<generated-secret>
   ```

### Issue: Cannot access /users page

**Possible Causes:**
1. User is not logged in as Admin
2. User role is not set to `admin` in Google Sheets

**Solution:**
- Verify your role in Google Sheets (Users tab, column C)
- Role must be exactly `admin` (lowercase)
- If needed, manually change role in Google Sheets and log out/in

### Issue: Validator name not showing correctly

**Solution:**
- Ensure user has `full_name` set in Google Sheets (column E)
- Log out and log back in to refresh session
- Check that `attachUserToLocals` middleware is working

---

## API Routes (Protected)

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
| POST | `/users/update` | Admin | Update user |
| POST | `/users/reset-password` | Admin | Reset user password |

### Dashboard Routes

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| GET | `/` | Authenticated | Pending validations list |
| GET | `/validated` | Authenticated | Validated records list |
| GET | `/validate/:uuid` | Validator/Admin | Validation form |
| POST | `/save` | Validator/Admin | Save validation |

### API Routes (API Key Auth)

| Method | Route | Access | Description |
|--------|-------|--------|-------------|
| POST | `/api/upload` | API Key | Upload photo |
| POST | `/api/upload-batch` | API Key | Upload multiple photos |
| GET | `/api/photos` | API Key | List photos |
| DELETE | `/api/photos/:filename` | API Key | Delete photo |
| GET | `/health` | Public | Health check |

---

## Security Best Practices

### For Production Deployment

1. **Use HTTPS**: Set `NODE_ENV=production` to enable secure cookies
2. **Strong Session Secret**: Use a cryptographically random 32+ character string
3. **Regular Password Updates**: Encourage users to change passwords periodically
4. **Monitor Failed Logins**: Check server logs for suspicious activity
5. **Limit Admin Accounts**: Create only necessary admin users
6. **Backup User Data**: Regularly backup your Google Sheets
7. **Update Dependencies**: Keep npm packages up to date (`npm audit`)

### Password Requirements

Current: **Minimum 8 characters**

To increase security, modify validation in:
- `server.js` (line ~926, ~972)
- `init-admin.js` (line ~152)

Example: Require 12 characters with special characters:

```javascript
if (password.length < 12 || !/[!@#$%^&*]/.test(password)) {
  return res.redirect('/users?error=' + encodeURIComponent('Password must be at least 12 characters and include a special character'));
}
```

---

## Migration from Previous Version

If upgrading from a version without authentication:

1. **Install new dependencies**: `npm install`
2. **Update environment**: Add `SESSION_SECRET` to `.env`
3. **Create Users sheet**: Add "Users" sheet to Google Spreadsheet
4. **Run init script**: `node init-admin.js` to create first admin
5. **Test login**: Access `/login` and verify authentication works
6. **Create user accounts**: Add users for all validators via `/users`
7. **No data loss**: Existing validation data remains unchanged

**Note**: Validator names in historical records remain as-is. Future validations will use authenticated user names.

---

## Support

For issues or questions:

1. Check this documentation
2. Review server logs: `docker logs <container-name>` (or console output)
3. Verify Google Sheets permissions
4. Check GitHub repository issues

---

## Changelog

### Version 2.0 (Authentication Update)

**Added:**
- User authentication with login/logout
- Role-based access control (Admin, Validator, Viewer)
- User management interface (Admin only)
- Password hashing with bcrypt
- Session management with express-session
- Auto-filled validator names from session
- User creation/editing/deactivation
- Password reset functionality
- Security headers and CSRF protection

**Changed:**
- All routes now require authentication
- Validator name auto-populated (was manual input)
- Dashboard includes user info navbar

**Security:**
- httpOnly session cookies
- bcrypt password hashing (10 rounds)
- Input validation and sanitization
- XSS prevention in templates
- Session regeneration on login

---

**Last Updated**: 2025-01-13
