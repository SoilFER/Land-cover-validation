# 🚀 Quick Setup Guide - Authentication System (Revised)

## Overview

This authentication system uses **server-side JSON file storage** for users, with **country-based access control** for validators.

---

## 🎯 Key Features

- ✅ **JSON File Storage**: Users stored in `./secrets/users.json` (not Google Sheets)
- ✅ **Country-Based Access**: Validators restricted to assigned countries
- ✅ **3 User Roles**: Admin, Validator (country-specific), Viewer (read-only)
- ✅ **Secure**: bcrypt password hashing, session management, httpOnly cookies
- ✅ **Auto-filled Validator Names**: From session data

---

## Setup Steps (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Generate secure session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Add to .env file:
SESSION_SECRET=<paste-generated-secret-here>
SESSION_TIMEOUT=28800000
```

### 3. Create First Admin User
```bash
node init-admin.js
```

Follow the prompts:
- Username: `admin` (or your choice)
- Full Name: `System Administrator`
- Email: (optional)
- Password: Choose a strong password (min 8 characters)

### 4. Start Server
```bash
npm start
```

### 5. Login
Navigate to: `http://localhost:3000`

You'll be redirected to `/login` - use the credentials you just created!

---

## 🎭 User Roles

### Admin
- ✅ Full access to ALL countries
- ✅ Manage users, validate any record

### Validator
- ✅ Assigned to specific countries (e.g., GTM, HND)
- ✅ Can **ONLY** validate records from assigned countries
- ❌ Cannot validate other countries

### Viewer
- ✅ Read-only access to all records
- ❌ Cannot validate or edit anything

---

## 🌍 Country-Based Access Control

### How It Works

1. **Admin** assigns countries to Validators (e.g., `GTM, HND, TUN`)
2. **Validators** can only validate/edit records from their assigned countries
3. Trying to access non-assigned country records → `403 Forbidden`

### Example:

```
Validator: John Doe
Assigned Countries: GTM, HND

✅ Can validate: GTM-001, GTM-002, HND-001
❌ Cannot validate: TUN-001, MOZ-001, KEN-001
```

---

## 👥 User Management (Admin Only)

### Creating Validators with Country Assignment

1. Log in as Admin
2. Go to `/users`
3. Fill form:
   - Username: `validator_guatemala`
   - Password: (strong password)
   - Role: **Validator**
   - Full Name: `Guatemala Validator`
   - **Countries**: `GTM, HND` ← **Comma-separated country codes**
4. Click "Create User"

### Available Country Codes

- `GTM` - Guatemala
- `HND` - Honduras
- `TUN` - Tunisia
- `MOZ` - Mozambique
- `GHA` - Ghana
- `ZMB` - Zambia
- `KEN` - Kenya

---

## 📂 File Structure

### User Database

```
./secrets/users.json
```

**Example:**

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
      "email": "",
      "full_name": "Guatemala Validator",
      "countries": ["GTM", "HND"],
      "created_date": "2025-01-13T11:00:00.000Z",
      "last_login": "2025-01-13T13:00:00.000Z",
      "is_active": true
    }
  }
}
```

**Security**: `./secrets/` directory is excluded from git via `.gitignore`

---

## 🛡️ Security Features

- **Password Hashing**: bcrypt (10 salt rounds)
- **Session Security**: httpOnly cookies, 8-hour timeout, CSRF protection
- **Country Validation**: Access checked when opening validation form AND when saving
- **File Security**: Users database stored in `./secrets/` (not web-accessible)
- **Audit Trail**: Last login timestamps tracked

---

## 🔄 Common Workflows

### Adding a New Validator

1. Admin logs in → `/users`
2. Create user:
   - Username: `john_doe`
   - Role: `Validator`
   - Full Name: `John Doe`
   - Countries: `GTM, HND` ← **Important!**
3. Validator logs in with their credentials
4. They can **only** validate GTM and HND records

### Changing Country Assignment

1. Admin logs in → `/users`
2. Click "Edit" next to the validator
3. Update Countries field: `GTM, HND, TUN`
4. Click "Update User"
5. Validator must **log out and log back in** for changes to take effect

### Resetting Password

1. Admin logs in → `/users`
2. Click "Reset Password" next to the user
3. Enter new password (min 8 chars)
4. User can immediately log in with new password

---

## 🐛 Common Issues

### "Forbidden: You do not have access to validate records for [COUNTRY]"

**Solution:**
- Log in as Admin → `/users`
- Edit the validator user
- Add the country code to **Countries** field (e.g., `GTM, HND`)
- Validator must log out and log back in

### "Invalid username or password"

**Solutions:**
- Check username is lowercase
- Verify user is active (`is_active: true` in users.json)
- Try resetting password via Admin panel
- Check `./secrets/users.json` file exists

### Session expires too quickly

**Solution:**
Edit `.env`:
```bash
SESSION_TIMEOUT=43200000  # 12 hours
```
Restart server.

---

## 📋 File Changes Summary

### Modified Files

- ✅ `server.js` - JSON storage, country-based access control
- ✅ `views/users.ejs` - Added Countries field
- ✅ `init-admin.js` - JSON storage (not Google Sheets)
- ✅ `.env.example` - Added SESSION_SECRET

### New Concepts

- ✅ Country-based validation access
- ✅ Validator country assignment
- ✅ Server-side JSON user storage
- ✅ Country access validation middleware

---

## 🆚 Key Differences from Previous Version

| Feature | OLD | NEW |
|---------|-----|-----|
| User Storage | Google Sheets | JSON File |
| Validator Access | All countries | Assigned countries only |
| Viewer Role | Can export data | Read-only, no export |
| Country Control | None | Enforced via middleware |

---

## 📞 Next Steps

1. **Create Admin User**: `node init-admin.js`
2. **Start Server**: `npm start`
3. **Login**: `http://localhost:3000/login`
4. **Add Validators**: Go to `/users` and create validator accounts
5. **Assign Countries**: Set country codes for each validator
6. **Test Access**: Try validating records from different countries

---

## 📚 Full Documentation

See `README-AUTH-REVISED.md` for:
- Complete security architecture
- Detailed troubleshooting
- API route documentation
- Migration guide

---

**Ready to go? Run `node init-admin.js` to get started!**
