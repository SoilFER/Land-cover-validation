# 🌍 Land Cover Validation System

> **Multi-country land cover classification validation system for the SoilFER Project**

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)

A comprehensive system for validating land cover classifications collected through field surveys across 7 countries. Automates data extraction from KoboToolbox, processes country-specific form structures, and provides a web-based validation dashboard with interactive maps and photo review.

---

## 📋 Table of Contents

- [Features](#-features)
- [System Architecture](#-system-architecture)
- [Countries Supported](#-countries-supported)
- [Quick Start](#-quick-start)
- [Documentation](#-documentation)
- [Contributing](#-contributing)
- [License](#-license)
- [Citation](#-citation)

---

## ✨ Features

### 🔄 Automated Data Pipeline
- **Daily extraction** from KoboToolbox API (configurable schedule)
- **Country-specific transformations** handling different form structures
- **Intelligent photo management** with HTTP upload and local storage
- **Google Sheets integration** for collaborative data management

### 🖥️ Validation Dashboard
- **Interactive maps** (Mapbox satellite + Esri HD imagery)
- **4-directional ground photos** (North, East, South, West)
- **Comprehensive site information** with GPS coordinates, landform, surveyor details
- **Multi-component classification** support (up to 4 vegetation layers)
- **3-level hierarchical classification** system for ALL land cover types:
  - Level 1: Primary land cover class (Cropland, Forest, Grassland, Settlement, Water, etc.)
  - Level 2: Subcategory (e.g., Natural/Artificial for grasslands, Cereals/Legumes for crops)
  - Level 3: Detailed classification (e.g., specific crop types, tree species)
- **Country-specific classification options** with localized terminology
- **Pagination & filtering** (20/50/100 records per page, 7 countries)
- **Edit mode** for re-validating already-processed sites
- **Two-tab interface**: Pending Validations vs Validated Sites

### 🔐 Authentication & Access Control
- **Guest Auto-Login**: Unauthenticated users get instant read-only access
- **Role-Based Access Control (RBAC)**: Admin, Validator, Viewer, Guest roles
- **Country-Based Access**: Validators restricted to assigned countries, viewers/guests see all
- **Secure Authentication**: bcrypt password hashing, httpOnly cookies, session regeneration
- **Session Management**: 8-hour timeout, proxy-aware (Traefik/Cloudflare)
- **User Management**: Admin panel for creating/editing users and permissions
- **View-Only Mode**: Guests can browse all data but cannot submit validations
- **Auto-filled Validator Names**: Automatically populated from session data

### 🌐 Multi-Country Support
- **Flexible data structures**: Array-based and flat schemas
- **Percentage handling**: Direct values and range parsing (e.g., "90_100" → 100)
- **Vegetation types**: Herbaceous, shrubs, trees with height/water supply
- **Non-vegetated surfaces**: Bare soil, water, artificial surfaces
- **Comprehensive hierarchical classification**:
  - **Guatemala (GTM)**: Detailed crop types (Granos, Agroforestal, Frutal, Agroindustrial), forest types (Natural: Mixto/Conífera/Latifoliado, Plantación: Pino/Teca/Ciprés), grasslands (Natural/Artificial), settlements (Invernadero/Huerto/Vivero)
  - **Honduras (HND)**: Same structure as Guatemala with country-specific variations
  - **Tunisia (TUN)**: Cereals, tree crops (olives, dates, citrus), legumes, vegetables with localized naming

---

## 🏗️ System Architecture

```
┌─────────────────┐
│  KoboToolbox    │  Field Data Collection (Mobile App)
│  (FAO Server)   │
└────────┬────────┘
         │ API Call (Daily 21:00 UTC)
         ▼
┌─────────────────┐
│   n8n Workflow  │  Automation Engine
│  (Cloud/Local)  │  • Fetch new submissions
└────────┬────────┘  • Transform data (country-specific)
         │           • Download photos
         ├────────────────────┬──────────────────┐
         ▼                    ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Google Sheets  │  │  Photo Storage  │  │  Validation     │
│   (Database)    │  │  (HTTP Upload)  │  │  Dashboard      │
│   66 columns    │  │  /photos/*.jpg  │  │  (Express.js)   │
└─────────────────┘  └─────────────────┘  └────────┬────────┘
                                                    ▼
                                           ┌─────────────────┐
                                           │   Validators    │
                                           │  (Web Browser)  │
                                           └─────────────────┘
```

**Technologies:**
- **Backend**: Node.js 18+, Express.js
- **Frontend**: EJS templates, Tailwind CSS
- **Maps**: Mapbox GL JS, ArcGIS/Esri API
- **Storage**: Google Sheets API, Local file system
- **Automation**: n8n (workflow orchestration)
- **Deployment**: Docker, Docker Compose, Traefik (reverse proxy)

---

## 🌎 Countries Supported

| Country | Code | Status | Form Structure | Records |
|---------|------|--------|----------------|---------|
| 🇬🇹 Guatemala | GTM | ✅ Active | Array + Flat | ~1,600 |
| 🇭🇳 Honduras | HND | 🔄 In Process | Array-based | ~1,300 |
| 🇹🇳 Tunisia | TUN | ✅ Active | Flat (3 components) | ~1,700 |
| 🇲🇿 Mozambique | MOZ | 🟡 Planned | TBD | - |
| 🇬🇭 Ghana | GHA | 🟡 Planned | TBD | - |
| 🇿🇲 Zambia | ZMB | 🟡 Planned | TBD | - |
| 🇰🇪 Kenya | KEN | 🟡 Planned | TBD | - |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18.0.0 or higher
- **Docker** & **Docker Compose** (for containerized deployment)
- **Google Cloud Service Account** with Sheets API access
- **n8n instance** (cloud or self-hosted)

### 1. Clone the Repository

```bash
git clone https://github.com/[your-username]/Land-cover-validation.git
cd Land-cover-validation
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

**Required variables:**
- `API_KEY`: Secure key for photo upload API
- `SPREADSHEET_ID`: Google Sheets ID
- `SHEET_NAME`: Sheet tab name (default: LandCoverV2)

### 3. Add Google Credentials

```bash
# Copy your service account credentials
cp /path/to/your/credentials.json ./secrets/credentials.json

# Ensure proper permissions
chmod 600 ./secrets/credentials.json
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Setup Authentication

**Generate a secure session secret:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Add to `.env` file:**

```bash
SESSION_SECRET=<paste-generated-secret-here>
SESSION_TIMEOUT=28800000  # 8 hours
```

**Create the first admin user:**

```bash
node init-admin.js
```

Follow the prompts to create your administrator account. See [SETUP-AUTH-REVISED.md](SETUP-AUTH-REVISED.md) for detailed authentication setup.

### 6. Run Locally (Development)

```bash
npm start
```

Dashboard available at: `http://localhost:3000` (automatically logs in as guest for viewing)

### 7. Deploy with Docker

```bash
# Build and run
docker-compose up -d --build

# Check logs
docker-compose logs -f validation_dashboard

# Health check
curl http://localhost:3000/health
```

---

## 📚 Documentation

### Core Documentation
- **[DEPLOYMENT.md](docs/DEPLOYMENT.md)** - Complete deployment guide
- **[API.md](docs/API.md)** - API endpoints and usage
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[SYSTEM_DOCUMENTATION.md](docs/SYSTEM_DOCUMENTATION.md)** - Comprehensive technical docs

### Authentication & User Management
- **[SETUP-AUTH-REVISED.md](SETUP-AUTH-REVISED.md)** - Quick setup guide for authentication (5 minutes)
- **[README-AUTH-REVISED.md](README-AUTH-REVISED.md)** - Complete authentication documentation

#### User Roles & Permissions

| Role | Access Level | Permissions |
|------|-------------|-------------|
| **Guest** | Read-only (all countries) | View dashboard, view site details, no validation |
| **Viewer** | Read-only (all countries) | View dashboard, view site details, no validation |
| **Validator** | Read-write (assigned countries) | Validate sites in assigned countries only |
| **Admin** | Full access (all countries) | Validate any site, manage users, full CRUD |

#### Guest Auto-Login Feature

Unauthenticated users are automatically logged in as "Guest Viewer" with read-only access:
- ✅ Browse all validation records across all countries
- ✅ View detailed site information, maps, and photos
- ✅ Access validated sites history
- ❌ Cannot submit validations (form hidden with "Login to Validate" button)
- 🔐 Click "Login with Credentials" in navbar to authenticate for validation privileges

### n8n Workflows
- **[n8n/README.md](n8n/README.md)** - Workflow setup and configuration
- **[n8n/scripts/](n8n/scripts/)** - Country-specific transformation scripts

### Examples
- **[examples/kobo-data-samples/](examples/kobo-data-samples/)** - Toy data examples (5 structures)

---

## 🔧 Configuration

### Google Sheets Schema

The system uses a **66-column schema** in Google Sheets:

**Key columns:**
- Metadata: `uuid`, `country_code`, `site_id`, `province`, `surveyor`
- Location: `latitude`, `longitude`, `elevation`, `landform`
- Classification: `land_cover_types`, `unique_classifications`, `component_count`
- Components (1-4): Each with `classification`, `percentage`, `details`
- Photos: `photo_north`, `photo_east`, `photo_south`, `photo_west`
- Validation: `validation_status`, `is_correct`, `final_classification`, `validator_name`

See [docs/SYSTEM_DOCUMENTATION.md](docs/SYSTEM_DOCUMENTATION.md) for complete schema.

### Country-Specific Processing

Each country requires a dedicated transformation script in `n8n/scripts/`:

**Guatemala (GTM):**
- Handles both array-based and flat structures
- Percentage: Direct numeric values
- Path variations for photos (landscape_description vs erosion_status)

**Tunisia (TUN):**
- Always flat structure with 3 possible components
- Percentage: Range format ("90_100" → uses MAX value)
- Vegetated: Has percentages, Non-vegetated: NO percentages

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Install dependencies
npm install

# Run in development mode (with auto-reload)
npm run dev

# Run tests (if available)
npm test
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit using conventional commits
6. Push and create a Pull Request

---

## 📄 License

This work is licensed under **Creative Commons Attribution 4.0 International (CC BY 4.0)**.

You are free to:
- ✅ **Share** — copy and redistribute
- ✅ **Adapt** — remix, transform, build upon
- ✅ **Commercial use** — use for commercial purposes

**Under the condition:**
- 📝 **Attribution** — You must give appropriate credit and cite this work

See [LICENSE](LICENSE) for full legal text.

---

## 📖 Citation

If you use this system in your research or project, please cite:

```bibtex
@software{landcover_validation_2026,
  title = {Land Cover Validation System},
  author = {SoilFER Project Team},
  year = {2026},
  url = {https://github.com/SoilFER/Land-cover-validation},
  license = {CC-BY-4.0}
}
```

**Plain text:**
```
Land Cover Validation System (SoilFER Project), 2026
https://github.com/[your-username]/Land-cover-validation
Licensed under CC BY 4.0
```

---

## 🙏 Acknowledgments

- **FAO** - KoboToolbox hosting and support
- **SoilFER Project** - Funding and field coordination
- **Field Surveyors** - Data collection teams across 7 countries
- **Validators** - Quality control and classification verification

---

## 📧 Contact & Support

- **Issues**: [GitHub Issues](https://github.com/SoilFER/Land-cover-validation/issues)
- **Discussions**: [GitHub Discussions](https://github.com/SoilFER/Land-cover-validation/discussions)
- **Email**: SoilFER@fao.org

---

## 🗺️ Project Status

- **Version**: 1.1.0
- **Status**: Active Development
- **Last Updated**: January 2026
- **Countries Live**: 2/7 (GTM, TUN)
- **Records Processed**: ~3,300+
- **Latest Feature**: 3-level hierarchical classification for all land cover types

## 📝 Changelog

### Version 1.1.0 (January 19, 2026)
**Feature: Universal Hierarchical Classification System**

- ✨ **Expanded hierarchical classification to ALL land cover types** (previously only Cropland)
- 🌳 **New classification levels**:
  - **Forests**: Natural (Mixto, Conífera, Latifoliado) / Plantación (Pino, Teca, Ciprés, Palo Blanco)
  - **Grasslands**: Natural / Artificial with subcategories
  - **Settlements**: Invernadero, Huerto, Vivero, and other types
  - **All other classes**: Water, Wetland, Bare Soil, Shrubland, Arable land, Other
- 🔄 **Dynamic UI updates**: System now automatically pre-selects Level 1 category based on primary or corrected classification
- 🌍 **Country-specific configurations**: Complete 3-level hierarchies for GTM, HND, and TUN
- 📊 **Enhanced data granularity**: More detailed classification for improved land cover analysis
- 🎯 **Improved user experience**: Clear labels ("Hierarchical Classification", "Land Cover Class", "Subcategory", "Detail")

**Technical Changes**:
- Updated `crops.json` with comprehensive structure for all 10 land cover classes
- Modified `validate.ejs` UI to support universal hierarchical selection
- Enhanced JavaScript logic to handle all land cover types dynamically
- Added automatic category pre-selection based on validation decision

---

<div align="center">

**Built with ❤️ for Sustainable Soil Management**

[⬆ Back to Top](#-land-cover-validation-system)

</div>
