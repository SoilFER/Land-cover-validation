# Kobo Toolbox Data Examples

This folder contains **toy examples** (anonymized and simplified) based on real KoboToolbox data structures used in the Land Cover Validation System.

## ⚠️ Important Note

These are **NOT real data** - all values have been anonymized, simplified, and modified to protect sensitive information while preserving the essential structure needed for development and testing.

## File Descriptions

### Guatemala (GTM) Examples

1. **`gtm-array-based.json`** - Most common structure (>95% of records)
   - Uses array-based `landcover_description` with multiple components
   - Primary classification at site level
   - Supports up to 4 vegetation components per site

2. **`gtm-flat-structure.json`** - Alternative structure (<5% of records)
   - Flat dominant landcover structure
   - Single component with percentage ranges
   - Optional secondary vegetation

### Tunisia (TUN) Examples

3. **`tun-vegetated.json`** - Vegetated land with percentages
   - Uses `cultivated_arable_land_group` for all vegetation types (natural/cultivated)
   - Percentage ranges by vegetation type (herbaceous/shrubs/trees)
   - Includes plant height, water supply, frequency

4. **`tun-non-vegetated.json`** - Non-vegetated surfaces
   - Uses `artificial_surfaces_group`
   - **No percentage fields** (intentional design difference)
   - Includes natural vs artificial surface types

5. **`tun-secondary-vegetation.json`** - Multiple vegetation layers
   - Primary vegetation component
   - Secondary vegetation layer (optional)
   - Third vegetation layer (optional)
   - Each with separate percentage fields

## Key Structural Differences

### GTM vs TUN

| Feature | Guatemala (GTM) | Tunisia (TUN) |
|---------|----------------|---------------|
| **Structure** | Array or Flat | Always Flat |
| **Percentage Format** | Direct numbers or ranges | Always ranges (e.g., "10_20") |
| **Vegetation Groups** | Mixed paths | Always `cultivated_arable_land_group` |
| **Non-vegetated** | Has percentage fields | **NO percentage fields** |
| **Components** | Up to 4 | Up to 3 (main + secondary + third) |

## Usage

These examples can be used for:
- Testing transformation scripts (`n8n/scripts/`)
- Understanding data structure variations
- Unit testing
- Documentation

## Processing Scripts

- **GTM**: Use `n8n/scripts/gtm_comprehensive_FINAL.js`
- **TUN**: Use `n8n/scripts/tun_comprehensive_FINAL.js`

## Real Data

Real data is stored in:
- KoboToolbox API (requires authentication)
- Google Sheets (processed data)
- **NOT in this repository** (privacy/size constraints)
