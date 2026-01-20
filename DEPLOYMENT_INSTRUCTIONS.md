# 🚀 Deployment Instructions - Validation Logic Update

## 📋 Overview

This document provides step-by-step instructions for deploying the simplified validation logic changes across all environments.

## 🔄 Changes Summary

### What Changed:
1. ❌ **Removed**: "Correct Category" dropdown (redundant)
2. ✨ **Unified**: Hierarchical classification now used for both Correct and Incorrect validations
3. 🗑️ **Deleted**: `crops_hierarchical.json` file (duplicate)
4. 📊 **Simplified**: Data structure - removed `corrected_classification` column
5. 🎯 **Improved**: User experience with streamlined workflow

### Benefits:
- Less redundancy in UI and data collection
- Consistent hierarchical classification for all validations
- Country-specific Level 1 options from `crops.json`
- Simpler codebase and easier maintenance

---

## 📝 Files Modified

| File | Changes |
|------|---------|
| `views/validate.ejs` | Removed correction panel (lines 355-370), updated JavaScript logic |
| `server.js` | Removed `correctedClassification` field handling, updated validation logic |
| `crops_hierarchical.json` | Deleted (obsolete file) |
| `README.md` | Updated with new validation workflow documentation |
| `VALIDATION_LOGIC_EXPLAINED.md` | New comprehensive logic documentation |
| `VALIDATION_FLOW_DIAGRAM.txt` | New visual flow diagrams |

---

## 🖥️ Deployment Steps

### 1️⃣ Local Development Environment

**Purpose**: Test changes on your local machine before committing

```bash
# Navigate to project directory
cd /path/to/Land-cover-validation

# Make scripts executable
chmod +x deploy_local.sh

# Run local deployment
bash deploy_local.sh
```

**What it does**:
- Stops current Docker container
- Rebuilds Docker image with new code
- Starts new container
- Waits for application to start
- Verifies application is responding

**Test the changes**:
1. Open http://localhost:3000
2. Login as validator
3. Open a validation site
4. Test validation workflow:
   - Click "Correct" → Verify hierarchical panel appears with Level 1 pre-selected
   - Click "Incorrect" → Verify hierarchical panel appears without pre-selection
   - Click "Review" → Verify direct submit (no hierarchy)
5. Complete a validation and verify data is saved correctly

---

### 2️⃣ Git Repository (GitHub/GitLab)

**Purpose**: Commit and push changes to remote repository

```bash
# Make script executable
chmod +x deploy_git.sh

# Run git deployment
bash deploy_git.sh
```

**What it does**:
1. Shows current git status
2. Asks for confirmation
3. Stages modified files
4. Creates descriptive commit
5. Shows commit details
6. Asks for push confirmation
7. Pushes to remote repository

**Manual alternative** (if you prefer):
```bash
# Stage changes
git add views/validate.ejs server.js README.md
git add VALIDATION_LOGIC_EXPLAINED.md VALIDATION_FLOW_DIAGRAM.txt
git add deploy_local.sh deploy_git.sh deploy_server.sh
git rm crops_hierarchical.json

# Commit
git commit -m "Simplify validation logic: remove redundant correction dropdown

- Remove 'Correct Category' dropdown (redundant with hierarchical classification)
- Hierarchical classification now appears for both Correct and Incorrect validations
- When incorrect: validator chooses correct class from Level 1 dropdown
- Removed corrected_classification field from server.js
- Deleted obsolete crops_hierarchical.json file
- All Level 1 categories now from crops.json (country-specific)"

# Push to remote
git push origin main
```

---

### 3️⃣ Production Server Deployment

**Purpose**: Deploy changes to production server

#### Option A: Automated Script (Recommended)

```bash
# 1. Copy script to server
scp deploy_server.sh ubuntu@your-server:/home/ubuntu/

# 2. SSH to server
ssh ubuntu@your-server

# 3. Make script executable
chmod +x deploy_server.sh

# 4. Run deployment (requires sudo)
sudo bash deploy_server.sh
```

**What it does**:
1. Creates backup of current files
2. Downloads updated files from GitHub
3. Removes obsolete `crops_hierarchical.json`
4. Stops current Docker container
5. Rebuilds Docker image
6. Starts new container
7. Verifies application is responding

#### Option B: Manual Deployment

```bash
# 1. SSH to server
ssh ubuntu@your-server

# 2. Navigate to application directory
cd /home/ubuntu/Land-cover-validation

# 3. Create backup
mkdir -p ../backups/validation-$(date +%Y%m%d_%H%M%S)
cp views/validate.ejs ../backups/validation-$(date +%Y%m%d_%H%M%S)/
cp server.js ../backups/validation-$(date +%Y%m%d_%H%M%S)/

# 4. Pull latest changes from GitHub
git pull origin main

# 5. Remove obsolete file
rm -f crops_hierarchical.json

# 6. Rebuild and restart Docker container
docker stop land-cover-validation
docker rm land-cover-validation
docker build -t land-cover-validation:latest .
docker run -d \
  --name land-cover-validation \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /home/ubuntu/Land-cover-validation/secrets:/app/secrets \
  -v /home/ubuntu/Land-cover-validation/public/photos:/app/public/photos \
  land-cover-validation:latest

# 7. Check logs
docker logs -f land-cover-validation
```

---

## ✅ Post-Deployment Verification

### 1. Health Check
```bash
# Check if application is responding
curl http://localhost:3000

# Expected: HTML page with "Land Cover Validation" title
```

### 2. Container Status
```bash
# Check container is running
docker ps | grep land-cover-validation

# Check logs for errors
docker logs land-cover-validation --tail 50
```

### 3. Functional Testing

Open the application in browser and test:

#### Test Case 1: Correct Validation
1. Login as validator
2. Click "Validate" on a pending site
3. Click "Correct" button
4. **Verify**: Hierarchical classification panel appears
5. **Verify**: Level 1 is pre-selected with primary classification
6. Select Level 2 and Level 3
7. Submit validation
8. **Verify**: Record moves to "Validated Sites" tab
9. **Verify**: In Google Sheets:
   - `validation_status` = "VALIDATED"
   - `is_correct` = "YES"
   - `final_classification` = Level 1 value
   - `land_cover_group` = Level 2 value
   - `main_crop_type` = Level 3 value
   - `corrected_classification` = (empty - column no longer used)

#### Test Case 2: Incorrect Validation
1. Click "Validate" on another pending site
2. Click "Incorrect" button
3. **Verify**: Hierarchical classification panel appears
4. **Verify**: NO "Correct Category" dropdown (removed!)
5. **Verify**: Level 1 is NOT pre-selected (empty dropdown)
6. Select correct class from Level 1 dropdown
7. Select Level 2 and Level 3
8. Submit validation
9. **Verify**: Record moves to "Validated Sites" tab with "Corrected" status
10. **Verify**: In Google Sheets:
    - `validation_status` = "CORRECTED"
    - `is_correct` = "NO"
    - `final_classification` = Level 1 value (user-selected)
    - `land_cover_group` = Level 2 value
    - `main_crop_type` = Level 3 value

#### Test Case 3: Review Validation
1. Click "Validate" on another pending site
2. Click "Review" button
3. **Verify**: NO hierarchical panel appears
4. **Verify**: Submit button is enabled immediately
5. Add optional comments
6. Submit validation
7. **Verify**: Record moves to "Validated Sites" tab with "Needs Review" status
8. **Verify**: In Google Sheets:
   - `validation_status` = "NEEDS_REVIEW"
   - `is_correct` = "UNCLEAR"
   - `final_classification` = (empty)
   - `land_cover_group` = (empty)
   - `main_crop_type` = (empty)

#### Test Case 4: Level 1 Options are Country-Specific
1. Validate a site from Guatemala (GTM)
2. **Verify**: Level 1 dropdown contains: cropland, grassland, forest, settlement, shrubland, bare_soil, water, wetland, arable_land, other
3. Validate a site from Tunisia (TUN)
4. **Verify**: Level 1 dropdown contains: cropland, grassland, forest, maquis_garrigue, bare_soil, water, settlement, wetland, other
5. **Note**: Options come from `crops.json` for each country

---

## 🔧 Troubleshooting

### Issue 1: Container fails to start
```bash
# Check Docker logs
docker logs land-cover-validation

# Common causes:
# - Port 3000 already in use
# - Missing environment variables
# - Invalid credentials.json

# Solution: Check logs and fix identified issue
```

### Issue 2: "Correct Category" dropdown still appears
```bash
# This means old code is still running
# Solution: Force rebuild without cache
docker build --no-cache -t land-cover-validation:latest .
docker stop land-cover-validation
docker rm land-cover-validation
# Then start container again
```

### Issue 3: Level 1 dropdown is empty
```bash
# Check if crops.json is loaded correctly
docker exec land-cover-validation cat /app/validation_dashboard/crops.json

# Check server logs for JSON parsing errors
docker logs land-cover-validation | grep "crops"

# Solution: Verify crops.json syntax and rebuild
```

### Issue 4: Validation saves fail
```bash
# Check Google Sheets API credentials
docker exec land-cover-validation ls -la /app/secrets/credentials.json

# Check environment variables
docker exec land-cover-validation env | grep SPREADSHEET

# Check server logs for API errors
docker logs land-cover-validation | grep "Error"
```

### Issue 5: Changes not visible after deployment
```bash
# Clear browser cache
# Or open in incognito/private window

# Force refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

---

## 🔄 Rollback Procedure

If issues occur, you can rollback to the previous version:

### Local Rollback
```bash
git checkout HEAD~1
bash deploy_local.sh
```

### Server Rollback
```bash
# SSH to server
ssh ubuntu@your-server

# Find backup directory
ls -lt /home/ubuntu/backups/

# Restore files from backup
cd /home/ubuntu/Land-cover-validation
cp /home/ubuntu/backups/validation-YYYYMMDD_HHMMSS/validate.ejs views/
cp /home/ubuntu/backups/validation-YYYYMMDD_HHMMSS/server.js .

# Rebuild container
docker stop land-cover-validation
docker rm land-cover-validation
docker build -t land-cover-validation:latest .
docker run -d \
  --name land-cover-validation \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /home/ubuntu/Land-cover-validation/secrets:/app/secrets \
  -v /home/ubuntu/Land-cover-validation/public/photos:/app/public/photos \
  land-cover-validation:latest
```

---

## 📊 Expected Outcomes

After successful deployment:

✅ **UI Changes**:
- No "Correct Category" dropdown visible
- Hierarchical classification panel appears for both Correct/Incorrect
- Level 1 auto-selected when marking as Correct
- Level 1 empty (user chooses) when marking as Incorrect
- Submit enabled immediately for Review

✅ **Data Structure**:
- `corrected_classification` column no longer written to (remains for historical data)
- All new validations use `final_classification` from Level 1 hierarchical selection
- Consistent data structure for Correct and Incorrect validations

✅ **User Experience**:
- Simpler workflow with fewer steps
- Less cognitive load for validators
- Faster validation process
- More intuitive classification selection

✅ **Code Quality**:
- Removed redundant code
- Cleaner data model
- Better maintainability
- Country-specific options properly utilized

---

## 📞 Support

If you encounter issues:

1. Check logs: `docker logs land-cover-validation`
2. Review troubleshooting section above
3. Check GitHub Issues: https://github.com/SERVIR-Amazonia/Land-cover-validation/issues
4. Contact development team

---

## 📝 Deployment Checklist

Use this checklist to track deployment progress:

- [ ] **Local Testing**
  - [ ] Run `deploy_local.sh`
  - [ ] Test Correct validation workflow
  - [ ] Test Incorrect validation workflow
  - [ ] Test Review validation workflow
  - [ ] Verify data saves correctly to Google Sheets
  - [ ] Check all countries have correct Level 1 options

- [ ] **Git Repository**
  - [ ] Run `deploy_git.sh` or manual git commands
  - [ ] Verify commit created
  - [ ] Verify push to remote successful
  - [ ] Check GitHub repository for changes

- [ ] **Production Server**
  - [ ] Backup current deployment
  - [ ] Run `deploy_server.sh` or manual deployment
  - [ ] Verify container running
  - [ ] Check application responds
  - [ ] Test validation workflows on production
  - [ ] Verify Google Sheets integration works
  - [ ] Monitor for errors in first hour

- [ ] **Documentation**
  - [ ] README.md updated with new workflow
  - [ ] VALIDATION_LOGIC_EXPLAINED.md available
  - [ ] VALIDATION_FLOW_DIAGRAM.txt available
  - [ ] Team notified of changes

- [ ] **Validator Training** (if needed)
  - [ ] Update training materials
  - [ ] Notify validators of UI changes
  - [ ] Provide quick reference guide

---

**Deployment Date**: ___________________

**Deployed By**: ___________________

**Version**: 1.2.0

**Status**: ⬜ Local ⬜ Git ⬜ Production ⬜ Verified

---

<div align="center">

**Built with ❤️ for Sustainable Soil Management**

[⬆ Back to Top](#-deployment-instructions---validation-logic-update)

</div>
