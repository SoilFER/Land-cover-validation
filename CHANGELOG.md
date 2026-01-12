# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-01-12

### Added
- Initial release of Land Cover Validation System
- Multi-country support (GTM, TUN active; HND, MOZ, GHA, ZMB, KEN planned)
- Web-based validation dashboard with Express.js and EJS
- Interactive maps integration (Mapbox GL JS + ArcGIS/Esri)
- Google Sheets integration for data storage and collaboration
- n8n workflow automation for daily data extraction
- Country-specific transformation scripts (GTM, TUN)
- Photo upload API with authentication
- Pagination support (20/50/100 records per page)
- Country filtering across 7 countries
- Two-tab interface: Pending Validations vs Validated Sites
- Edit mode for re-validating already-processed sites
- Comprehensive documentation (README, DEPLOYMENT, TROUBLESHOOTING, API)
- Docker and Docker Compose support
- Traefik reverse proxy integration
- Health check endpoint
- Example data structures (5 toy examples)
- Creative Commons BY 4.0 license

### Features by Country

**Guatemala (GTM):**
- Array-based and flat structure support
- Up to 4 vegetation components per site
- Direct percentage values and range parsing
- Localized crop dropdown (Maíz, Frijol, etc.)

**Tunisia (TUN):**
- Flat structure with 3 components (main, secondary, third)
- Percentage range parsing ("90_100" → 100)
- Vegetated vs non-vegetated vs water handling
- Localized crop dropdown (wheat, olives, etc.)

### Technical Debt
- Manual testing only (automated tests needed)
- Photo storage on local filesystem (consider cloud storage)
- No user authentication yet (planned for v2.0)
- Limited error handling in n8n scripts

### Known Issues
- Large photo files (>5MB) may timeout on slow connections
- Satellite imagery may not load in some regions
- Google Sheets API rate limits not explicitly handled

---

## [Unreleased]

### Planned Features
- User authentication and role-based access
- Automated tests (unit, integration, E2E)
- Cloud photo storage (S3, Google Cloud Storage)
- Offline mode for dashboard
- Export validated data (CSV, GeoJSON)
- Advanced filtering (date range, surveyor, validation status)
- Bulk validation operations
- Honduras (HND) country support
- Mozambique (MOZ) country support
- Ghana (GHA) country support
- Zambia (ZMB) country support
- Kenya (KEN) country support

---

## Version History

- **1.0.0** (2026-01-12) - Initial public release
- **0.9.0** (2026-01-10) - Beta testing with validators
- **0.5.0** (2025-12-20) - Alpha release (internal testing)
- **0.1.0** (2025-11-01) - Proof of concept

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to propose changes to this project.
