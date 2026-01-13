# 🚀 Quick Setup Guide - Authentication System

## Prerequisites
- ✅ Node.js 18+ installed
- ✅ Google Sheets API credentials configured (`./secrets/credentials.json`)
- ✅ Google Spreadsheet created with data

## Setup Steps (5 minutes)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Generate secure session secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Edit .env and add the generated secret:
# SESSION_SECRET=<paste-generated-secret-here>
```

### 3. Create Users Sheet
1. Open your Google Spreadsheet
2. Create a new sheet named: **Users**
3. (Headers will be created automatically in next step)

### 4. Create First Admin User
```bash
node init-admin.js
```

Follow the prompts:
- Username: `admin` (or your choice)
- Full Name: `System Administrator`
- Email: (optional)
- Password: Choose a strong password (min 8 characters)

### 5. Start Server
```bash
npm start
```

### 6. Login
Navigate to: `http://localhost:3000`

You'll be redirected to `/login` - use the credentials you just created!

---

## What's New?

### 🔐 Login System
- All users must log in to access the system
- Sessions timeout after 8 hours (configurable)
- Passwords hashed with bcrypt

### 👥 User Roles
- **Admin**: Full access + user management
- **Validator**: Can validate records
- **Viewer**: Read-only access

### ✨ New Features
- User-friendly login page
- Navbar with username and logout button
- User management interface (Admin only)
- Auto-filled validator names (no manual entry)
- Password reset functionality
- User activation/deactivation

### 🛡️ Security
- Password hashing with bcrypt (10 rounds)
- httpOnly session cookies (XSS protection)
- Input validation and sanitization
- Session regeneration on login
- CSRF protection (sameSite: strict)

---

## Next Steps

1. **Create Additional Users** (as Admin):
   - Go to `/users`
   - Click "Create New User"
   - Assign appropriate roles

2. **Test Validation Workflow**:
   - Log in as Validator
   - Click "Validate" on a pending record
   - Notice validator name is auto-filled
   - Submit validation

3. **Review Documentation**:
   - See `README-AUTH.md` for comprehensive guide
   - Includes troubleshooting and security best practices

---

## Common Issues

### "Invalid username or password"
- Usernames are case-sensitive (use lowercase)
- Check `is_active` column in Users sheet is `YES`

### "Cannot find module 'bcrypt'"
```bash
npm install
```

### Session expires too quickly
Edit `.env`:
```bash
SESSION_TIMEOUT=43200000  # 12 hours
```

### Can't access /users page
- Only Admin users can access user management
- Check your role in Google Sheets Users tab (column C)

---

## File Changes

### Modified Files
- ✅ `server.js` - Added authentication system
- ✅ `package.json` - Added dependencies
- ✅ `.env.example` - Added SESSION_SECRET
- ✅ `views/index.ejs` - Added navbar
- ✅ `views/validate.ejs` - Added navbar, auto-fill validator

### New Files
- ✅ `views/login.ejs` - Login page
- ✅ `views/users.ejs` - User management (Admin only)
- ✅ `init-admin.js` - Admin user creation script
- ✅ `README-AUTH.md` - Full documentation
- ✅ `SETUP-AUTH.md` - This quick setup guide

---

## User Role Matrix

| Feature | Viewer | Validator | Admin |
|---------|--------|-----------|-------|
| View dashboard | ✅ | ✅ | ✅ |
| Validate records | ❌ | ✅ | ✅ |
| Edit own validations | ❌ | ✅ | ✅ |
| Edit others' validations | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |

---

## Support

Need help? Check:
1. `README-AUTH.md` - Comprehensive documentation
2. Server logs - Check console output
3. Google Sheets - Verify Users sheet structure

---

**Ready to go? Run `npm start` and navigate to http://localhost:3000**
