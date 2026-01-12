# n8n Workflows and Scripts

This directory contains n8n workflow definitions and country-specific transformation scripts.

## Directory Structure

```
n8n/
├── workflows/           # n8n workflow JSON files
│   └── Land_Cover_GLOBALv2.json
├── scripts/            # Country-specific transformation scripts
│   ├── gtm_comprehensive_FINAL.js
│   └── tun_comprehensive_FINAL.js
└── nodes/              # Custom node configurations
    ├── photo_download_node.json
    └── photo_upload_node.json
```

## Workflows

### Land_Cover_GLOBALv2.json

Main workflow for processing land cover data from KoboToolbox.

**Schedule**: Daily at 21:00 UTC

**Steps**:
1. **Fetch Data** - Get recent submissions from Kobo API
2. **Transform** - Apply country-specific transformations
3. **Download Photos** - Fetch ground photos from Kobo
4. **Upload Photos** - Send photos to validation server
5. **Append to Sheets** - Add processed data to Google Sheets

**Required Credentials**:
- Kobo API Token
- Google Service Account (Sheets API)
- Validation Dashboard API Key

## Transformation Scripts

### GTM (Guatemala)

**File**: `scripts/gtm_comprehensive_FINAL.js`

**Handles**:
- Array-based structure (1578 records, 95% of data)
- Flat structure (8 records, 5% of data)
- Up to 4 components per site
- Direct percentage values (e.g., 70) and ranges (e.g., "50_60")

**Key Features**:
- Auto-detects array vs flat structure
- Extracts vegetation details (type, artificiality, category, crop)
- Parses complex nested paths
- Handles missing optional fields gracefully

### TUN (Tunisia)

**File**: `scripts/tun_comprehensive_FINAL.js`

**Handles**:
- Flat structure only
- Up to 3 components (main, secondary, third)
- Vegetated (with percentages), Non-vegetated (NO percentages), Water (NO percentages)
- Percentage ranges always use MAX value (e.g., "90_100" → 100)

**Key Features**:
- All vegetation data in `cultivated_arable_land_group` (regardless of natural/cultivated)
- Separate paths for vegetated vs non-vegetated vs water
- Secondary and third vegetation optional
- Plant height, water supply, frequency fields

## Usage in n8n

### 1. Import Workflow

1. Open n8n interface
2. **Workflows** → **Import from File**
3. Select `workflows/Land_Cover_GLOBALv2.json`

### 2. Configure Nodes

**Process KoboToolbox Data** (Code node):

For Guatemala:
```javascript
// Copy entire content from scripts/gtm_comprehensive_FINAL.js
// Paste into Code node
```

For Tunisia:
```javascript
// Copy entire content from scripts/tun_comprehensive_FINAL.js
// Paste into Code node
```

### 3. Set Configuration

**Set Config** node variables:

```javascript
{
  "country": "GTM",  // or "TUN"
  "upload_server": "https://validate.yourdomain.com",
  "api_key": "your-api-key",
  "spreadsheet_id": "your-sheet-id",
  "sheet_name": "LandCoverV2"
}
```

### 4. Test Workflow

1. Set date range to last 1-2 days
2. **Execute Workflow** manually
3. Check execution log
4. Verify Google Sheets updated
5. Verify photos uploaded

### 5. Activate Schedule

1. Edit **Schedule Trigger** node
2. Set: `0 21 * * *` (daily at 21:00 UTC)
3. **Activate** workflow

## Customization

### Adding a New Country

1. **Create transformation script**:
   ```bash
   cp scripts/gtm_comprehensive_FINAL.js scripts/xyz_comprehensive_FINAL.js
   ```

2. **Analyze Kobo form**:
   - Export sample JSON
   - Map field paths
   - Note percentage format

3. **Adapt script**:
   - Update field paths
   - Handle country-specific structures
   - Test with sample data

4. **Update workflow**:
   - Add country switch logic
   - Configure credentials
   - Test end-to-end

### Debugging

**Enable verbose logging**:
```javascript
// Add at top of script
const DEBUG = true;
function log(msg, data) {
  if (DEBUG) console.log(msg, JSON.stringify(data, null, 2));
}
```

**Common Issues**:

| Issue | Solution |
|-------|----------|
| "Cannot read property 'results'" | Check Kobo API response structure |
| "No items returned" | Verify date filter and Asset ID |
| "Photos not downloading" | Check attachment URLs and authentication |
| "Google Sheets append fails" | Verify service account permissions |

## Performance

- **GTM**: ~0.5s per record
- **TUN**: ~0.3s per record
- **Photo download**: ~2-5s per image (depends on size)
- **Batch size**: 50 records recommended

**Rate Limits**:
- Kobo API: No official limit (use reasonable delays)
- Google Sheets API: 100 requests/100s per user
- Photo upload: No limit (server-dependent)

## Testing

Test scripts outside n8n:

```javascript
// Node.js environment
const fs = require('fs');

// Load sample data
const sampleData = JSON.parse(fs.readFileSync('../../examples/kobo-data-samples/gtm-array-based.json'));

// Paste transformation script here
// ...

// Run
const result = processData(sampleData);
console.log(JSON.stringify(result, null, 2));
```

## Troubleshooting

See main [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) for common issues.

---

**Need Help?** Open an issue on GitHub or contact the team.
