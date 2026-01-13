# 🚀 Deployment Guide

Complete guide for deploying the Land Cover Validation System.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Production Deployment](#production-deployment)
- [n8n Workflow Setup](#n8n-workflow-setup)
- [Traefik Configuration](#traefik-configuration)
- [Post-Deployment Checks](#post-deployment-checks)

---

## Prerequisites

### Required Software

- **Node.js** ≥18.0.0
- **npm** ≥9.0.0
- **Docker** ≥20.10.0
- **Docker Compose** ≥2.0.0
- **Git**

### Required Services

- **Google Cloud Platform**:
  - Service Account with Sheets API enabled
  - OAuth credentials for Google Drive (optional, for legacy photos)
- **n8n Instance**: Cloud or self-hosted
- **Kobo Toolbox**: Access to FAO server API
- **Domain** (production): For SSL/TLS certificates

### Required Credentials

1. **Google Service Account** JSON file
2. **API Key** for photo uploads (generate: `openssl rand -base64 32`)
3. **Kobo API Token**
4. **n8n** credentials (if self-hosted)

---

## Local Development

### 1. Clone and Setup

```bash
git clone https://github.com/SoilFER/Land-cover-validation.git
cd Land-cover-validation

# Create environment file
cp .env.example .env

# Edit configuration
nano .env
```

### 2. Configure Environment

Edit `.env`:

```env
NODE_ENV=development
PORT=3000
API_KEY=your-generated-api-key-here
SPREADSHEET_ID=your-google-spreadsheet-id
SHEET_NAME=LandCoverV2
MAPBOX_TOKEN=your-mapbox-token
```

### 3. Add Credentials

```bash
# Create secrets directory
mkdir -p secrets

# Copy your Google Service Account credentials
cp /path/to/credentials.json ./secrets/credentials.json

# Secure permissions
chmod 600 ./secrets/credentials.json
```

### 4. Install and Run

```bash
# Install dependencies
npm install

# Start development server
npm start

# Or with auto-reload (if nodemon installed)
npm run dev
```

Access: `http://localhost:3000`

---

## Docker Deployment

### 1. Prepare Environment

```bash
# Ensure .env and secrets/credentials.json are configured
ls -la .env secrets/credentials.json
```

### 2. Build and Run

```bash
# Build the image
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f validation_dashboard

# Check health
curl http://localhost:3000/health
```

### 3. Docker Compose Configuration

The `docker-compose.yml` includes:

- **Health checks** (30s interval)
- **Volume mounts**: `./secrets` (read-only), `./shared_photos`
- **Environment variables**: PORT, NODE_ENV, API_KEY
- **Restart policy**: `unless-stopped`
- **Network**: Traefik integration

### 4. Managing the Container

```bash
# Stop
docker-compose stop

# Restart
docker-compose restart

# View logs
docker-compose logs -f

# Shell access
docker-compose exec validation_dashboard sh

# Remove (stops and deletes)
docker-compose down
```

---

## Production Deployment

### 1. Server Setup (Ubuntu 20.04+)

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt-get install docker-compose-plugin

# Verify
docker --version
docker compose version
```

### 2. Clone Repository

```bash
# Create project directory
sudo mkdir -p /opt/land-cover-validation
sudo chown $USER:$USER /opt/land-cover-validation
cd /opt/land-cover-validation

# Clone
git clone https://github.com/SoilFER/Land-cover-validation.git .
```

### 3. Configure for Production

```bash
# Environment
cp .env.example .env
nano .env
```

Set:
```env
NODE_ENV=production
PORT=3000
API_KEY=<secure-key-here>
```

```bash
# Credentials
mkdir -p secrets
# Upload credentials.json via scp or editor
nano secrets/credentials.json

# Permissions
chmod 600 secrets/credentials.json
chmod 600 .env
```

### 4. Deploy with Traefik

Update `docker-compose.yml` labels:

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.validation.rule=Host(`validate.yourdomain.com`)"
  - "traefik.http.routers.validation.entrypoints=websecure"
  - "traefik.http.routers.validation.tls=true"
  - "traefik.http.routers.validation.tls.certresolver=letsencrypt"
  - "traefik.http.services.validation.loadbalancer.server.port=3000"
```

```bash
# Start
docker-compose up -d --build

# Monitor
docker-compose logs -f
```

### 5. Firewall Configuration

```bash
# Allow HTTP/HTTPS (if using Traefik)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Or direct port (development)
sudo ufw allow 3000/tcp

# Enable firewall
sudo ufw enable
```

---

## n8n Workflow Setup

### 1. Import Workflow

1. Access your n8n instance
2. Go to **Workflows** → **Import from File**
3. Upload `n8n/workflows/Land_Cover_GLOBALv2.json`

### 2. Configure Credentials

**Kobo API:**
1. Add **HTTP Request** credential
2. URL: `https://kf.soilfer-data.fao.org/api/v2/`
3. Authentication: Header Auth
4. Header Name: `Authorization`
5. Header Value: `Token YOUR_KOBO_TOKEN`

**Google Sheets:**
1. Add **Google Service Account** credential
2. Upload `credentials.json`
3. Scopes: `https://www.googleapis.com/auth/spreadsheets`

**Photo Upload API:**
1. Add **HTTP Request** credential
2. URL: `https://validate.yourdomain.com/api/upload`
3. Authentication: Header Auth
4. Header Name: `x-api-key`
5. Header Value: `YOUR_API_KEY`

### 3. Update Workflow Nodes

**Get Recent Kobo Data** node:
- Update Asset ID for each country
- Adjust date filter (default: last 5 days)

**Set Config** node:
- `upload_server`: Your validation dashboard URL
- `api_key`: Your API key

**Process KoboToolbox Data** node:
- For GTM: Use code from `n8n/scripts/gtm_comprehensive_FINAL.js`
- For TUN: Use code from `n8n/scripts/tun_comprehensive_FINAL.js`

### 4. Test Workflow

1. **Trigger manually** with a small date range (1-2 days)
2. Check **Execution Log** for errors
3. Verify:
   - Data fetched from Kobo
   - Photos downloaded and uploaded
   - Rows appended to Google Sheets

### 5. Schedule Workflow

1. Edit **Schedule Trigger** node
2. Set: **Daily at 21:00 UTC** (or your preferred time)
3. **Activate** the workflow

---

## Traefik Configuration

If using Traefik as reverse proxy:

### 1. Traefik Setup

```yaml
# traefik/docker-compose.yml
version: '3.8'
services:
  traefik:
    image: traefik:v2.10
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./acme:/acme
    command:
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=your-email@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
```

### 2. Network Configuration

```bash
# Create external network
docker network create traefik-network

# Update validation docker-compose.yml
networks:
  default:
    name: traefik-network
    external: true
```

---

## Post-Deployment Checks

### 1. Health Check

```bash
curl https://validate.yourdomain.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-01-12T10:00:00.000Z",
  "photosPath": "/app/public/photos",
  "apiKeyConfigured": true
}
```

### 2. Dashboard Access

Visit: `https://validate.yourdomain.com`

Verify:
- Statistics load correctly
- Country filter works
- Records display with photos
- Maps render (Mapbox & Esri)

### 3. Validation Flow Test

1. Click **Validate** on a pending record
2. Check:
   - Site information displays
   - All 4 ground photos load
   - Maps show correct location
   - Component data is complete
3. Submit a test validation
4. Verify Google Sheets updated

### 4. Photo Upload Test

```bash
# Test API endpoint
curl -X POST https://validate.yourdomain.com/api/upload \
  -H "x-api-key: YOUR_API_KEY" \
  -F "image=@test_photo.jpg" \
  -F "filename=test_site_north.jpg"
```

Expected:
```json
{
  "success": true,
  "filename": "test_site_north.jpg",
  "path": "/photos/test_site_north.jpg",
  "size": 123456
}
```

### 5. Monitoring

```bash
# View logs
docker-compose logs -f validation_dashboard

# Check disk space (photos can grow large)
df -h

# Monitor photo storage
du -sh /opt/land-cover-validation/shared_photos
```

---

## Backup Procedures

### 1. Configuration Backup

```bash
# Backup config files
tar -czf config_backup_$(date +%Y%m%d).tar.gz \
  .env \
  docker-compose.yml \
  secrets/
```

### 2. Photos Backup

```bash
# Archive photos (can be large!)
tar -czf photos_backup_$(date +%Y%m%d).tar.gz shared_photos/

# Upload to cloud storage
gsutil cp photos_backup_*.tar.gz gs://your-backup-bucket/
```

### 3. Google Sheets Backup

- **Automatic**: Google Sheets maintains version history
- **Manual**: File → Download → Excel (.xlsx) - Weekly recommended

---

## Troubleshooting

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for common issues and solutions.

---

## Next Steps

After deployment:

1. ✅ **Configure n8n workflows** for all countries
2. ✅ **Train validators** on dashboard usage
3. ✅ **Set up monitoring** (logs, disk space, uptime)
4. ✅ **Schedule regular backups**
5. ✅ **Document country-specific workflows**

---

**Need Help?** Open an issue on GitHub or contact the team.
