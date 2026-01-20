# 🔍 Land Cover Validation Process - Complete Logic Flow

## 📊 Visual Overview of Validation System

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION LIFECYCLE                             │
└─────────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐
   │ Google Sheets│  ← Contains all validation sites
   │ LandCoverV2  │
   └──────┬───────┘
          │
          │ Server fetches record by UUID
          ↓
   ┌──────────────────────────────┐
   │  GET /validate/:uuid          │  server.js Line 1115
   │  (Server Route)               │
   └──────────┬───────────────────┘
              │
              │ Load country-specific crops.json
              ↓
   ┌──────────────────────────────┐
   │  crops.json File              │
   │  CROPS_HIERARCHICAL[country]  │  ← Loaded at Line 42-49
   └──────────┬───────────────────┘
              │
              │ Pass data to template
              ↓
   ┌──────────────────────────────┐
   │  validate.ejs                 │
   │  (Frontend Template)          │
   └──────────┬───────────────────┘
              │
              │ User interacts with UI
              ↓
   ┌──────────────────────────────┐
   │  User Makes Decision          │
   │  (Correct/Incorrect/Review)   │
   └──────────┬───────────────────┘
              │
              │ Submit form
              ↓
   ┌──────────────────────────────┐
   │  POST /save                   │  server.js Line 1226
   │  (Save Validation)            │
   └──────────┬───────────────────┘
              │
              │ Update Google Sheets
              ↓
   ┌──────────────────────────────┐
   │  Validation Complete!         │
   │  Redirect to Dashboard        │
   └──────────────────────────────┘
```

---

## 🗂️ SOURCE FILES & RESPONSIBILITIES

### 1. **crops.json** - The Classification Database
**Location:** `validation_dashboard/crops.json`
**Purpose:** Stores all hierarchical land cover classifications for each country

```
┌─────────────────────────────────────────────────────────┐
│                    crops.json Structure                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  {                                                       │
│    "TUN": {                  ← COUNTRY CODE             │
│      "maquis_garrigue": {    ← LEVEL 1: Land Cover Class│
│        "label": "Maquis/Garrigue",  ← Display name      │
│        "level2": {           ← LEVEL 2: Subcategories   │
│          "other": {                                      │
│            "label": "Other",                             │
│            "level3": ["other"]  ← LEVEL 3: Details      │
│          }                                               │
│        }                                                 │
│      },                                                  │
│      "cropland": {                                       │
│        "label": "Cropland",                              │
│        "level2": {                                       │
│          "cereals": {                                    │
│            "label": "Cereals",                           │
│            "level3": ["wheat", "barley", "maize", ...]   │
│          },                                              │
│          "tree_crops": {                                 │
│            "label": "Tree Crops",                        │
│            "level3": ["olives", "date_palm", ...]        │
│          }                                               │
│        }                                                 │
│      }                                                   │
│    }                                                     │
│  }                                                       │
└─────────────────────────────────────────────────────────┘
```

**Loaded by:** `server.js` Lines 42-49
**Used by:** Passed to `validate.ejs` at Line 1206-1214

---

### 2. **server.js** - Backend Logic
**Location:** Root directory
**Key Functions:**

#### A. Load crops.json at Startup
```javascript
Lines 42-49:
┌──────────────────────────────────────────┐
│ let CROPS_HIERARCHICAL = {};              │
│ try {                                     │
│   const cropsRaw = fs.readFileSync(      │
│     CONFIG.CROPS_PATH, 'utf8'            │
│   );                                      │
│   CROPS_HIERARCHICAL = JSON.parse(...);   │
│ }                                         │
└──────────────────────────────────────────┘
         ↓
   Stored in memory as global variable
```

#### B. Serve Validation Page
```javascript
Lines 1115-1223: GET /validate/:uuid
┌─────────────────────────────────────────────┐
│ 1. Fetch all data from Google Sheets       │
│ 2. Find record by UUID                      │
│ 3. Extract country code from record         │
│ 4. Get crops data:                          │
│    cropsHierarchical = CROPS_HIERARCHICAL[  │
│      countryCode                            │
│    ] || {}                                  │
│ 5. Pass to template:                        │
│    res.render('validate', {                 │
│      record: recordData,                    │
│      cropsHierarchical: cropsHierarchical   │
│    });                                      │
└─────────────────────────────────────────────┘
```

#### C. Save Validation
```javascript
Lines 1226-1358: POST /save
┌─────────────────────────────────────────────┐
│ 1. Receive form data                        │
│ 2. Determine validation status:             │
│    - correct → VALIDATED                    │
│    - incorrect → CORRECTED                  │
│    - unclear → NEEDS_REVIEW                 │
│ 3. Update 9 columns in Google Sheets:       │
│    - validation_status                      │
│    - is_correct                             │
│    - final_classification                   │
│    - land_cover_group                       │
│    - main_crop_type                         │
│    - corrected_classification               │
│    - validator_comments                     │
│    - validator_name                         │
│    - validation_date                        │
└─────────────────────────────────────────────┘
```

---

### 3. **validate.ejs** - Frontend Template
**Location:** `views/validate.ejs`
**Key Sections:**

---

## 🎯 THE VALIDATION LOGIC - Step by Step

### STEP 1: User Opens Validation Page

```
USER CLICKS "Validate" button on dashboard
         ↓
GET /validate/:uuid?country=TUN&per_page=20
         ↓
┌────────────────────────────────────────────┐
│ Server.js Line 1115                        │
│ - Fetches Google Sheets data               │
│ - Extracts record by UUID                  │
│ - Gets country code: "TUN"                 │
│ - Loads: CROPS_HIERARCHICAL["TUN"]         │
│   └─ This contains ALL land cover          │
│      classes for Tunisia with 3 levels     │
└────────────────────────────────────────────┘
         ↓
Server renders validate.ejs with:
  - record: {site data, photos, classifications}
  - cropsHierarchical: {TUN's land cover structure}
```

---

### STEP 2: UI Displays in Browser

```
┌──────────────────────────────────────────────────────┐
│                 VALIDATION INTERFACE                  │
├──────────────────────────────────────────────────────┤
│                                                       │
│  CATEGORY: maquis_garrigue  ← record.primaryClass    │
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ ✓Correct │ │ ✗Incorrect│ │ ⚠Review │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                       │
│  [Hidden panels below, shown based on decision]      │
│                                                       │
└──────────────────────────────────────────────────────┘
```

**Code:** validate.ejs Lines 323-352

---

### STEP 3A: User Clicks "CORRECT" ✓

```javascript
validate.ejs Line 330:
onclick="setDecision('correct', this)"
         ↓
Function setDecision() Line 520:
┌──────────────────────────────────────────┐
│ 1. Set hidden input value = 'correct'    │
│ 2. Add blue ring to button               │
│ 3. Hide correction panel                 │
│ 4. Call checkCropRequirement()           │
└──────────────────────────────────────────┘
         ↓
Function checkCropRequirement() Line 547:
┌──────────────────────────────────────────┐
│ decision = 'correct'                     │
│ primaryClass = 'maquis_garrigue'         │
│                                          │
│ Logic:                                   │
│ if (decision === 'correct') {            │
│   showHierarchy = true;                  │
│   classToUse = primaryClass;             │
│ }                                        │
│                                          │
│ Result:                                  │
│ - Show hierarchical classification panel │
│ - Pre-select Level 1 = 'maquis_garrigue' │
│ - Disable submit button                  │
└──────────────────────────────────────────┘
         ↓
UI NOW SHOWS:
┌──────────────────────────────────────────┐
│ HIERARCHICAL CLASSIFICATION:             │
│                                          │
│ Level 1 - Land Cover Class:              │
│ [Maquis / Garrigue ▼] ← AUTO-SELECTED   │
│                                          │
│ Level 2 - Subcategory:                   │
│ [Select subcategory... ▼] ← EMPTY       │
│ (Hidden until Level 2 populated)         │
│                                          │
│ Level 3 - Detail:                        │
│ [Select detail... ▼] ← EMPTY            │
│ (Hidden until Level 3 populated)         │
│                                          │
│ [SUBMIT VALIDATION] ← DISABLED           │
└──────────────────────────────────────────┘
```

**Where does Level 1 dropdown come from?**

validate.ejs Lines 379-386:
```html
<select id="cropLevel1">
  <option value="">Select category...</option>
  <% Object.keys(cropsHierarchical).forEach(function(level1Key) { %>
    <option value="<%= level1Key %>">
      <%= cropsHierarchical[level1Key].label %>
    </option>
  <% }); %>
</select>
```

**Source:** `cropsHierarchical` object passed from server
**For TUN, this generates:**
```html
<option value="cropland">Cropland</option>
<option value="grassland">Grassland</option>
<option value="forest">Forest</option>
<option value="maquis_garrigue">Maquis/Garrigue</option>
<option value="bare_soil">Bare Soil</option>
<option value="water">Water</option>
<option value="settlement">Settlement</option>
<option value="wetland">Wetland</option>
<option value="other">Other</option>
```

---

### STEP 3B: User Clicks "INCORRECT" ✗

```javascript
validate.ejs Line 338:
onclick="setDecision('incorrect', this)"
         ↓
Function setDecision() Line 520:
┌──────────────────────────────────────────┐
│ decision = 'incorrect'                   │
│                                          │
│ Actions:                                 │
│ 1. Show correctionPanel                  │
│ 2. Make correctionSelect required        │
│ 3. Disable submit button                 │
└──────────────────────────────────────────┘
         ↓
UI NOW SHOWS:
┌──────────────────────────────────────────┐
│ CORRECT CATEGORY:                        │
│ [Select correct class... ▼]              │
│                                          │
│ Options (validate.ejs Lines 359-369):    │
│  - Cropland                              │
│  - Grassland                             │
│  - Forest                                │
│  - Shrubland                             │
│  - Bare Soil                             │
│  - Water                                 │
│  - Settlement                            │
│  - Wetland                               │
│  - Other                                 │
│                                          │
│ [SUBMIT VALIDATION] ← DISABLED           │
└──────────────────────────────────────────┘
```

**Where does "Correct Category" dropdown come from?**

validate.ejs Lines 358-370:
```html
<select id="correctionSelect" name="correctedClassification">
  <option value="">Select correct class...</option>
  <option value="cropland">Cropland</option>
  <option value="grassland">Grassland</option>
  <option value="forest">Forest</option>
  <option value="shrubland">Shrubland</option>
  <option value="bare_soil">Bare Soil</option>
  <option value="water">Water</option>
  <option value="settlement">Settlement</option>
  <option value="wetland">Wetland</option>
  <option value="other">Other</option>
</select>
```

**Source:** Hardcoded in template (standard land cover classes)
**Note:** These are NOT from crops.json - they are universal options

---

### STEP 4: User Selects Correct Category = "Grassland"

```javascript
validate.ejs Line 708:
correctionSelect.addEventListener('change', ...)
         ↓
Triggers checkCropRequirement() Line 547:
┌──────────────────────────────────────────┐
│ decision = 'incorrect'                   │
│ correctedClass = 'grassland'             │
│                                          │
│ Logic:                                   │
│ if (decision === 'incorrect' &&          │
│     correctedClass) {                    │
│   showHierarchy = true;                  │
│   classToUse = 'grassland';              │
│ }                                        │
│                                          │
│ Actions:                                 │
│ - Show hierarchical panel                │
│ - Pre-select Level 1 = 'grassland'       │
│ - Trigger Level 1 change event           │
└──────────────────────────────────────────┘
         ↓
UI NOW SHOWS:
┌──────────────────────────────────────────┐
│ CORRECT CATEGORY:                        │
│ [Grassland ▼] ← USER SELECTED            │
│                                          │
│ HIERARCHICAL CLASSIFICATION:             │
│                                          │
│ Level 1 - Land Cover Class:              │
│ [Grassland ▼] ← AUTO-SELECTED            │
│                                          │
│ Level 2 - Subcategory:                   │
│ [Select subcategory... ▼]                │
│                                          │
│ [SUBMIT VALIDATION] ← DISABLED           │
└──────────────────────────────────────────┘
```

---

### STEP 5: User Selects Level 2 (Cascading Logic)

```javascript
validate.ejs Line 619:
cropLevel1.addEventListener('change', ...)
         ↓
Level 1 Change Handler Line 619-650:
┌──────────────────────────────────────────────────┐
│ level1Value = 'grassland'                        │
│                                                  │
│ 1. Store value in hidden input:                 │
│    cropLevel1Value.value = 'grassland'           │
│                                                  │
│ 2. Access crops data:                            │
│    cropsHierarchicalData['grassland'].level2     │
│                                                  │
│ 3. For TUN Grassland, level2 contains:          │
│    {                                             │
│      "other": {                                  │
│        "label": "Other",                         │
│        "level3": ["other"]                       │
│      }                                           │
│    }                                             │
│                                                  │
│ 4. Populate Level 2 dropdown:                    │
│    <option value="other">Other</option>          │
│                                                  │
│ 5. Show Level 2 container                       │
└──────────────────────────────────────────────────┘
         ↓
UI NOW SHOWS:
┌──────────────────────────────────────────┐
│ Level 1: [Grassland ▼]                   │
│                                          │
│ Level 2 - Subcategory:                   │
│ [Select subcategory... ▼]                │
│  └─ Other                                │
│                                          │
│ Level 3: (Hidden)                        │
│                                          │
│ [SUBMIT VALIDATION] ← DISABLED           │
└──────────────────────────────────────────┘
```

**Where does Level 2 data come from?**

validate.ejs Line 545:
```javascript
const cropsHierarchicalData =
  <%- JSON.stringify(cropsHierarchical) %>;
```

This embeds the entire crops.json data for TUN into JavaScript:
```javascript
{
  "grassland": {
    "label": "Grassland",
    "level2": {
      "other": {
        "label": "Other",
        "level3": ["other"]
      }
    }
  },
  // ... all other TUN classes
}
```

---

### STEP 6: User Selects Level 2 = "Other"

```javascript
validate.ejs Line 653:
cropLevel2.addEventListener('change', ...)
         ↓
Level 2 Change Handler Line 653-686:
┌──────────────────────────────────────────────────┐
│ level1Value = 'grassland'                        │
│ level2Value = 'other'                            │
│                                                  │
│ 1. Store value in hidden input:                 │
│    cropLevel2Value.value = 'other'               │
│                                                  │
│ 2. Access crops data:                            │
│    cropsHierarchicalData['grassland']            │
│      .level2['other'].level3                     │
│                                                  │
│ 3. For TUN Grassland > Other, level3 is:        │
│    ["other"]                                     │
│                                                  │
│ 4. Populate Level 3 dropdown:                    │
│    level3Data.forEach(cropKey => {               │
│      option.value = cropKey;                     │
│      option.text = "Other"; // formatted         │
│      level3Select.appendChild(option);           │
│    });                                           │
│                                                  │
│ 5. Show Level 3 container                       │
└──────────────────────────────────────────────────┘
         ↓
UI NOW SHOWS:
┌──────────────────────────────────────────┐
│ Level 1: [Grassland ▼]                   │
│                                          │
│ Level 2: [Other ▼]                       │
│                                          │
│ Level 3 - Detail:                        │
│ [Select detail... ▼]                     │
│  └─ Other                                │
│                                          │
│ [SUBMIT VALIDATION] ← DISABLED           │
└──────────────────────────────────────────┘
```

**Where does Level 3 data come from?**

Same `cropsHierarchicalData` object:
```javascript
cropsHierarchicalData['grassland']
  .level2['other']
  .level3
// Returns: ["other"]
```

---

### STEP 7: User Selects Level 3 = "other"

```javascript
validate.ejs Line 689:
cropLevel3.addEventListener('change', ...)
         ↓
Level 3 Change Handler → updateSubmitButton() Line 693:
┌──────────────────────────────────────────┐
│ Check if Level 3 has a value:            │
│                                          │
│ if (level3Select.value) {                │
│   submitBtn.disabled = false; ✓          │
│ }                                        │
└──────────────────────────────────────────┘
         ↓
UI NOW SHOWS:
┌──────────────────────────────────────────┐
│ Level 1: [Grassland ▼]                   │
│ Level 2: [Other ▼]                       │
│ Level 3: [Other ▼]                       │
│                                          │
│ Validator Comments:                      │
│ [Optional notes...]                      │
│                                          │
│ Validator Name:                          │
│ [John Doe] ← Auto-filled from session    │
│                                          │
│ [SUBMIT VALIDATION] ← ENABLED ✓          │
└──────────────────────────────────────────┘
```

---

### STEP 8: User Clicks "SUBMIT VALIDATION"

```javascript
validate.ejs Line 733:
validationForm.addEventListener('submit', ...)
         ↓
Form submits to POST /save with data:
┌──────────────────────────────────────────┐
│ rowNumber: 123                           │
│ validation: 'incorrect'                  │
│ correctedClassification: 'grassland'     │
│ finalClassification: 'grassland'         │
│ landCoverGroup: 'other'                  │
│ mainCropType: 'other'                    │
│ comments: ''                             │
│ validatorName: 'John Doe'                │
└──────────────────────────────────────────┘
         ↓
Server.js Line 1226: POST /save
┌──────────────────────────────────────────┐
│ 1. Determine status:                     │
│    validation === 'incorrect'            │
│    → validationStatus = 'CORRECTED'      │
│    → isCorrect = 'NO'                    │
│                                          │
│ 2. Update Google Sheets (Lines 1316+):  │
│    - validation_status = 'CORRECTED'     │
│    - is_correct = 'NO'                   │
│    - final_classification = 'grassland'  │
│    - land_cover_group = 'other'          │
│    - main_crop_type = 'other'            │
│    - corrected_classification='grassland'│
│    - validator_comments = ''             │
│    - validator_name = 'John Doe'         │
│    - validation_date = '2026-01-20T...'  │
│                                          │
│ 3. Redirect to dashboard with success    │
└──────────────────────────────────────────┘
```

---

## 📋 SUMMARY: Data Sources for Each Dropdown

### 1. **"Correct Category" Dropdown**
- **Source:** Hardcoded in template
- **Location:** validate.ejs Lines 358-369
- **Purpose:** Standard land cover classes for correction
- **Options:** Fixed 9 options
```
Cropland, Grassland, Forest, Shrubland,
Bare Soil, Water, Settlement, Wetland, Other
```

### 2. **"Level 1 - Land Cover Class" Dropdown**
- **Source:** crops.json → cropsHierarchical object
- **Location:** validate.ejs Lines 379-386
- **Purpose:** Show all available land cover classes for country
- **Options:** Dynamic based on crops.json keys
```javascript
Object.keys(cropsHierarchical).forEach(...)
// For TUN: cropland, grassland, forest,
// maquis_garrigue, bare_soil, water, etc.
```

### 3. **"Level 2 - Subcategory" Dropdown**
- **Source:** crops.json → level2 object
- **Location:** validate.ejs Lines 636-642
- **Purpose:** Subcategories for selected Level 1
- **Options:** Dynamic based on Level 1 selection
```javascript
cropsHierarchicalData[level1Value].level2
// For grassland: {other: {...}}
// For cropland: {cereals: {...}, tree_crops: {...}, ...}
```

### 4. **"Level 3 - Detail" Dropdown**
- **Source:** crops.json → level3 array
- **Location:** validate.ejs Lines 672-677
- **Purpose:** Specific types for selected Level 2
- **Options:** Dynamic based on Level 2 selection
```javascript
cropsHierarchicalData[level1Value]
  .level2[level2Value].level3
// For cropland > cereals: ["wheat","barley","maize",...]
// For grassland > other: ["other"]
```

---

## 🔄 Complete Data Flow Diagram

```
┌────────────┐
│ crops.json │
│ (File)     │
└─────┬──────┘
      │ fs.readFileSync() at server startup
      ↓
┌─────────────────────────┐
│ CROPS_HIERARCHICAL      │ (Global variable in server.js)
│ {                       │
│   "TUN": {...},         │
│   "GTM": {...},         │
│   "HND": {...}          │
│ }                       │
└────────┬────────────────┘
         │
         │ GET /validate/:uuid
         │ Extract country code from record
         │ cropsHierarchical = CROPS_HIERARCHICAL[countryCode]
         ↓
┌─────────────────────────┐
│ validate.ejs            │
│ Server renders with:    │
│ - record (site data)    │
│ - cropsHierarchical     │
└────────┬────────────────┘
         │
         │ Template generates HTML with embedded JS
         ↓
┌─────────────────────────────────────────────┐
│ Browser JavaScript                          │
│ const cropsHierarchicalData = {embedded};   │
│                                             │
│ User interactions trigger:                  │
│ - setDecision()                             │
│ - checkCropRequirement()                    │
│ - Level 1 change → populate Level 2         │
│ - Level 2 change → populate Level 3         │
│ - Level 3 change → enable submit            │
└────────┬────────────────────────────────────┘
         │
         │ Form submission
         ↓
┌─────────────────────────┐
│ POST /save              │
│ - validation decision   │
│ - corrected class       │
│ - level 1/2/3 values    │
│ - comments              │
└────────┬────────────────┘
         │
         │ Update columns
         ↓
┌─────────────────────────┐
│ Google Sheets           │
│ LandCoverV2             │
│ - validation_status     │
│ - is_correct            │
│ - final_classification  │
│ - land_cover_group      │
│ - main_crop_type        │
│ - (6 more columns...)   │
└─────────────────────────┘
```

---

## 🎯 KEY TAKEAWAYS

1. **crops.json is loaded ONCE** at server startup into `CROPS_HIERARCHICAL`

2. **Two dropdown systems exist:**
   - "Correct Category" = Hardcoded in template (9 options)
   - "Hierarchical Classification" = Dynamic from crops.json (3 levels)

3. **Cascading logic:**
   - Level 1 selection → populates Level 2 options
   - Level 2 selection → populates Level 3 options
   - Level 3 selection → enables submit button

4. **Data is embedded in page:**
   - Server passes `cropsHierarchical` to template
   - Template embeds it as JavaScript object
   - Client-side JS uses it to populate dropdowns dynamically

5. **Submit button enabled only when:**
   - A decision is made (Correct/Incorrect/Review)
   - If Incorrect: corrected category selected
   - If hierarchical panel shown: Level 3 selected

6. **Country-specific:** Each country (TUN, GTM, HND) has different crops.json structure

---

## 🐛 Common Issues & Solutions

### Issue 1: Level 2 dropdown stays empty
**Cause:** crops.json syntax error or missing level2 data
**Solution:** Validate JSON structure for that country's land cover class

### Issue 2: Submit button always disabled
**Cause:** Level 3 not selected or JavaScript error
**Solution:** Open browser console, check for JS errors

### Issue 3: Wrong hierarchy shown for country
**Cause:** Country code mismatch between record and crops.json
**Solution:** Verify country_code in Google Sheets matches crops.json keys

---

## 📝 Form Field Mapping

| Frontend Field        | HTML Name              | Backend Variable         | Google Sheets Column      |
|-----------------------|------------------------|--------------------------|---------------------------|
| Decision buttons      | validation             | validation               | validation_status         |
| Correct Category      | correctedClassification| correctedClassification  | corrected_classification  |
| Level 1 dropdown      | (hidden)               | finalClassification      | final_classification      |
| Level 2 dropdown      | (hidden)               | landCoverGroup           | land_cover_group          |
| Level 3 dropdown      | mainCropType           | mainCropType             | main_crop_type            |
| Comments textarea     | comments               | comments                 | validator_comments        |
| Validator name        | validatorName          | validatorName            | validator_name            |

---

## 🔍 Example: Complete Flow for Cropland in Tunisia

```
User opens site with primary class = "cropland"
Country = TUN
         ↓
Server loads CROPS_HIERARCHICAL["TUN"]
         ↓
Template generates Level 1 options:
  - Cropland
  - Grassland
  - Forest
  - Maquis/Garrigue
  - ... (9 total)
         ↓
User clicks "Correct"
         ↓
Hierarchical panel shows
Level 1 auto-selected = "Cropland"
         ↓
Level 1 change triggers population of Level 2:
cropsHierarchicalData["cropland"].level2 contains:
  - cereals
  - tree_crops
  - legumes
  - vegetables
  - arable_land
  - other
         ↓
User selects Level 2 = "tree_crops"
         ↓
Level 2 change triggers population of Level 3:
cropsHierarchicalData["cropland"]
  .level2["tree_crops"].level3 contains:
  - olives
  - date_palm
  - apple
  - pear
  - peach
  - apricot
  - fig
  - pomegranate
  - grapevine
  - almond_trees
  - orange
  - lemon
  - mandarin
  - other
         ↓
User selects Level 3 = "olives"
         ↓
Submit button enabled
         ↓
User clicks SUBMIT
         ↓
POST /save with:
  validation = 'correct'
  finalClassification = 'cropland'
  landCoverGroup = 'tree_crops'
  mainCropType = 'olives'
         ↓
Google Sheets updated:
  validation_status = 'VALIDATED'
  is_correct = 'YES'
  final_classification = 'cropland'
  land_cover_group = 'tree_crops'
  main_crop_type = 'olives'
```

---

**END OF DOCUMENTATION**
