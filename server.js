// ============================================
// VALIDATION DASHBOARD - HYBRID ARCHITECTURE
// With HTTP Upload API for n8n Integration
// ============================================

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { google } = require('googleapis');
const multer = require('multer');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// CONFIGURACIÓN
// ============================================
const CONFIG = {
  SPREADSHEET_ID: '1CjJmjtnN7sss7ZH1-ZzcALRPLq6VSbMx6-5mXg0HFoM',
  SHEET_NAME: 'LandCoverV2',
  CREDENTIALS_PATH: './secrets/credentials.json',
  // Ruta interna donde Docker montó el volumen ./shared_photos
  LOCAL_PHOTOS_PATH: '/app/public/photos',
  // API Key para autenticación de uploads (leer desde env)
  API_KEY: process.env.API_KEY || 'your-secure-api-key-here',
  // Path to crops configuration
  CROPS_PATH: './crops.json'
};

// ============================================
// LOAD CROPS DATA
// ============================================
let CROPS_DATA = {};
try {
  const cropsRaw = fs.readFileSync(CONFIG.CROPS_PATH, 'utf8');
  // Parse NDJSON (newline-delimited JSON)
  const cropsLines = cropsRaw.trim().split('\n');
  cropsLines.forEach(line => {
    const entry = JSON.parse(line);
    CROPS_DATA[entry.Country] = entry.crops;
  });
  console.log('Crops data loaded:', Object.keys(CROPS_DATA));
} catch (error) {
  console.error('Error loading crops.json:', error.message);
}

// ============================================
// MULTER CONFIGURATION (File Upload Handler)
// ============================================

// Verify photos directory exists (should be created by Dockerfile and mounted as volume)
if (!fs.existsSync(CONFIG.LOCAL_PHOTOS_PATH)) {
  console.warn(`Photos directory not found: ${CONFIG.LOCAL_PHOTOS_PATH} - may need volume mount`);
} else {
  console.log(`Serving local photos from: ${CONFIG.LOCAL_PHOTOS_PATH}`);
}

// Configuración de almacenamiento
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, CONFIG.LOCAL_PHOTOS_PATH);
  },
  filename: (req, file, cb) => {
    // Usar el nombre proporcionado en el request, o generar uno único
    const customFilename = req.body.filename || req.query.filename;
    if (customFilename) {
      // Sanitizar el nombre del archivo
      const sanitized = customFilename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
      cb(null, sanitized);
    } else {
      // Generar nombre único con timestamp
      const ext = path.extname(file.originalname) || '.jpg';
      const uniqueName = `upload_${Date.now()}${ext}`;
      cb(null, uniqueName);
    }
  }
});

// Filtro para solo aceptar imágenes
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, WEBP allowed.`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});

// ============================================
// MIDDLEWARE
// ============================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Servir archivos estáticos desde /photos
app.use('/photos', express.static(CONFIG.LOCAL_PHOTOS_PATH));

// ============================================
// API KEY MIDDLEWARE
// ============================================
function validateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required. Use x-api-key header or api_key query param.'
    });
  }

  if (apiKey !== CONFIG.API_KEY) {
    console.warn(`Invalid API key attempt: ${apiKey.substring(0, 8)}...`);
    return res.status(403).json({
      success: false,
      error: 'Invalid API key'
    });
  }

  next();
}

// ============================================
// GOOGLE AUTH (SHEETS + DRIVE)
// ============================================
let authClient = null;

async function getAuthClient() {
  if (authClient) return authClient;
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: CONFIG.CREDENTIALS_PATH,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.readonly'
      ]
    });
    authClient = await auth.getClient();
    console.log('Google Auth Client initialized');
    return authClient;
  } catch (error) {
    console.error('Auth Error:', error);
    throw error;
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function mapHeaders(headers) {
  const colIndex = {};
  headers.forEach((header, index) => {
    const original = String(header).trim();
    if (original) {
      colIndex[original] = index;
      const normalized = original.toLowerCase().replace(/\s+/g, '_');
      colIndex[normalized] = index;
    }
  });
  return colIndex;
}

function safeGet(row, colIndex, columnName, defaultValue = '') {
  const index = colIndex[columnName];
  if (index === undefined || index === null) return defaultValue;
  const value = row[index];
  return (value === undefined || value === null || value === '') ? defaultValue : value;
}

// LÓGICA HÍBRIDA INTELIGENTE
function processImageLink(rawValue) {
  if (!rawValue) return null;
  const str = String(rawValue).trim();
  if (!str) return null;

  // CASO A: IMAGEN LOCAL (Nuevo sistema)
  if (!str.startsWith('http') && (str.match(/\.(jpg|jpeg|png|webp)$/i))) {
    return `/photos/${str}`;
  }

  // CASO B: LEGACY (Google Drive)
  let fileId = null;
  const patterns = [
    /drive\.google\.com\/file\/d\/([-_\w]+)/,
    /drive\.google\.com\/open\?id=([-_\w]+)/,
    /drive\.google\.com\/uc\?id=([-_\w]+)/,
    /id=([-_\w]+)/
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match && match[1]) {
      fileId = match[1];
      break;
    }
  }

  if (!fileId && str.length > 20 && !str.includes('/') && !str.includes('.')) {
    fileId = str;
  }

  if (fileId) {
    return `/proxy-image/${fileId}`;
  }

  return str;
}

// ============================================
// API ROUTES - IMAGE UPLOAD
// ============================================

/**
 * POST /api/upload
 * Upload a single image file
 *
 * Headers:
 *   x-api-key: your-api-key
 *
 * Body (multipart/form-data):
 *   image: [file]
 *   filename: desired_filename.jpg (optional)
 *
 * Response:
 *   { success: true, filename: "saved_filename.jpg", path: "/photos/saved_filename.jpg" }
 */
app.post('/api/upload', validateApiKey, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided. Use "image" as the field name.'
      });
    }

    const savedFilename = req.file.filename;
    console.log(`[UPLOAD] Saved: ${savedFilename} (${req.file.size} bytes)`);

    res.json({
      success: true,
      filename: savedFilename,
      path: `/photos/${savedFilename}`,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/upload-batch
 * Upload multiple images at once
 *
 * Body (multipart/form-data):
 *   images: [files] (up to 10)
 */
app.post('/api/upload-batch', validateApiKey, upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No image files provided'
      });
    }

    const results = req.files.map(file => ({
      filename: file.filename,
      path: `/photos/${file.filename}`,
      size: file.size
    }));

    console.log(`[BATCH UPLOAD] Saved ${results.length} files`);

    res.json({
      success: true,
      count: results.length,
      files: results
    });

  } catch (error) {
    console.error('[BATCH UPLOAD ERROR]', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/photos
 * List all photos in the storage directory
 */
app.get('/api/photos', validateApiKey, (req, res) => {
  try {
    const files = fs.readdirSync(CONFIG.LOCAL_PHOTOS_PATH);
    const photos = files
      .filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f))
      .map(filename => ({
        filename,
        path: `/photos/${filename}`,
        url: `${req.protocol}://${req.get('host')}/photos/${filename}`
      }));

    res.json({
      success: true,
      count: photos.length,
      photos
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/photos/:filename
 * Delete a specific photo
 */
app.delete('/api/photos/:filename', validateApiKey, (req, res) => {
  try {
    const { filename } = req.params;
    const sanitized = filename.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const filePath = path.join(CONFIG.LOCAL_PHOTOS_PATH, sanitized);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

    fs.unlinkSync(filePath);
    console.log(`[DELETE] Removed: ${sanitized}`);

    res.json({
      success: true,
      deleted: sanitized
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// LEGACY ROUTES - DRIVE PROXY
// ============================================

app.get('/proxy-image/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params;
    const auth = await getAuthClient();
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    const imgBuffer = Buffer.from(response.data);

    res.writeHead(200, {
      'Content-Type': 'image/jpeg',
      'Content-Length': imgBuffer.length,
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(imgBuffer);

  } catch (error) {
    console.error(`Proxy Error (${req.params.fileId}):`, error.message);
    res.status(404).send('Not found');
  }
});

// ============================================
// DASHBOARD ROUTES
// ============================================

// GET / - Listado
app.get('/', async (req, res) => {
  try {
    const countryFilter = req.query.country || 'ALL';
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 20;

    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!A:ZZ`
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return res.render('index', { records: [], stats: {}, countryFilter, pagination: {} });

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const colIndex = mapHeaders(headers);

    let allRecords = dataRows.map((row, index) => ({
      rowNumber: index + 2,
      uuid: safeGet(row, colIndex, 'uuid'),
      countryCode: safeGet(row, colIndex, 'country_code'),
      siteId: safeGet(row, colIndex, 'site_id'),
      province: safeGet(row, colIndex, 'province'),
      primaryClass: safeGet(row, colIndex, 'land_cover_types') || safeGet(row, colIndex, 'primary_classification'),
      uniqueClassifications: safeGet(row, colIndex, 'unique_classifications'),
      classificationCount: safeGet(row, colIndex, 'classification_count', 0),
      componentCount: safeGet(row, colIndex, 'component_count', 0),
      validationStatus: safeGet(row, colIndex, 'validation_status'),
      photoSatellite: processImageLink(safeGet(row, colIndex, 'photo_satellite'))
    }));

    // Filter by country if selected
    if (countryFilter !== 'ALL') {
      allRecords = allRecords.filter(r => r.countryCode === countryFilter);
    }

    const pendingRecords = allRecords.filter(r => r.validationStatus === 'PENDING');

    const total = allRecords.length;
    const pending = pendingRecords.length;
    const validated = total - pending;
    const progress = total > 0 ? Math.round((validated / total) * 100) : 0;

    // Pagination
    const totalPages = Math.ceil(pendingRecords.length / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedRecords = pendingRecords.slice(startIndex, endIndex);

    res.render('index', {
      records: paginatedRecords,
      stats: { total, pending, validated, progress },
      countryFilter,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        perPage: perPage,
        totalRecords: pendingRecords.length,
        startIndex: startIndex + 1,
        endIndex: Math.min(endIndex, pendingRecords.length)
      },
      viewMode: 'pending'
    });

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// GET /validated - Show validated sites
app.get('/validated', async (req, res) => {
  try {
    const countryFilter = req.query.country || 'ALL';
    const page = parseInt(req.query.page) || 1;
    const perPage = parseInt(req.query.per_page) || 20;

    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!A:ZZ`
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return res.render('index', { records: [], stats: {}, countryFilter, pagination: {}, viewMode: 'validated' });

    const headers = rows[0];
    const dataRows = rows.slice(1);
    const colIndex = mapHeaders(headers);

    let allRecords = dataRows.map((row, index) => ({
      rowNumber: index + 2,
      uuid: safeGet(row, colIndex, 'uuid'),
      countryCode: safeGet(row, colIndex, 'country_code'),
      siteId: safeGet(row, colIndex, 'site_id'),
      province: safeGet(row, colIndex, 'province'),
      primaryClass: safeGet(row, colIndex, 'land_cover_types') || safeGet(row, colIndex, 'primary_classification'),
      finalClassification: safeGet(row, colIndex, 'final_classification'),
      validationStatus: safeGet(row, colIndex, 'validation_status'),
      validationDate: safeGet(row, colIndex, 'validation_date'),
      validatorName: safeGet(row, colIndex, 'validator_name'),
      isCorrect: safeGet(row, colIndex, 'is_correct'),
      photoSatellite: processImageLink(safeGet(row, colIndex, 'photo_satellite'))
    }));

    // Filter by country if selected
    if (countryFilter !== 'ALL') {
      allRecords = allRecords.filter(r => r.countryCode === countryFilter);
    }

    // Filter only validated records (VALIDATED, CORRECTED, NEEDS_REVIEW)
    const validatedRecords = allRecords.filter(r =>
      r.validationStatus === 'VALIDATED' ||
      r.validationStatus === 'CORRECTED' ||
      r.validationStatus === 'NEEDS_REVIEW'
    );

    // Sort by validation_date DESC (most recent first)
    validatedRecords.sort((a, b) => {
      const dateA = a.validationDate ? new Date(a.validationDate) : new Date(0);
      const dateB = b.validationDate ? new Date(b.validationDate) : new Date(0);
      return dateB - dateA;
    });

    const total = allRecords.length;
    const pending = allRecords.filter(r => r.validationStatus === 'PENDING').length;
    const validated = validatedRecords.length;
    const progress = total > 0 ? Math.round((validated / total) * 100) : 0;

    // Pagination
    const totalPages = Math.ceil(validatedRecords.length / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedRecords = validatedRecords.slice(startIndex, endIndex);

    res.render('index', {
      records: paginatedRecords,
      stats: { total, pending, validated, progress },
      countryFilter,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        perPage: perPage,
        totalRecords: validatedRecords.length,
        startIndex: startIndex + 1,
        endIndex: Math.min(endIndex, validatedRecords.length)
      },
      viewMode: 'validated'
    });

  } catch (error) {
    console.error('Error fetching validated data:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// GET /validate/:uuid - Formulario
app.get('/validate/:uuid', async (req, res) => {
  try {
    const { uuid } = req.params;
    const { per_page } = req.query;
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!A:ZZ`
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    const dataRows = rows.slice(1);
    const colIndex = mapHeaders(headers);

    let record = null;
    let rowNumber = null;

    for (let i = 0; i < dataRows.length; i++) {
      // Use loose comparison or strict? Original was strict.
      if (safeGet(dataRows[i], colIndex, 'uuid') === uuid) {
        record = dataRows[i];
        rowNumber = i + 2;
        break;
      }
    }

    if (!record) return res.status(404).send('Record not found');

    const getComp = (n) => ({
      classification: safeGet(record, colIndex, `comp${n}_classification`),
      percentage: safeGet(record, colIndex, `comp${n}_percentage`),
      details: safeGet(record, colIndex, `comp${n}_details`)
    });

    const countryCode = safeGet(record, colIndex, 'country_code');
    const landCoverTypes = safeGet(record, colIndex, 'land_cover_types');

    const recordData = {
      rowNumber,
      uuid: safeGet(record, colIndex, 'uuid'),
      countryCode: countryCode,
      siteId: safeGet(record, colIndex, 'site_id'),
      psuId: safeGet(record, colIndex, 'psu_id'),
      province: safeGet(record, colIndex, 'province'),
      surveyor: safeGet(record, colIndex, 'surveyor'),
      surveyDate: safeGet(record, colIndex, 'survey_date'),
      latitude: safeGet(record, colIndex, 'latitude'),
      longitude: safeGet(record, colIndex, 'longitude'),
      landform: safeGet(record, colIndex, 'landform'),
      primaryClass: landCoverTypes || safeGet(record, colIndex, 'primary_classification'),
      uniqueClassifications: safeGet(record, colIndex, 'unique_classifications'),
      classificationCount: safeGet(record, colIndex, 'classification_count', 0),
      componentCount: safeGet(record, colIndex, 'component_count', 0),
      totalCoverage: safeGet(record, colIndex, 'total_coverage_percent', 0),

      comp1: getComp(1),
      comp2: getComp(2),
      comp3: getComp(3),
      comp4: getComp(4),

      photoSatellite: processImageLink(safeGet(record, colIndex, 'photo_satellite')),
      photoNorth: processImageLink(safeGet(record, colIndex, 'photo_north')),
      photoEast: processImageLink(safeGet(record, colIndex, 'photo_east')),
      photoSouth: processImageLink(safeGet(record, colIndex, 'photo_south')),
      photoWest: processImageLink(safeGet(record, colIndex, 'photo_west')),

      surveyorComments: safeGet(record, colIndex, 'surveyor_comments'),
      comments: safeGet(record, colIndex, 'validator_comments') || safeGet(record, colIndex, 'comments'),

      // Existing validation data (for edit mode)
      existingValidation: {
        status: safeGet(record, colIndex, 'validation_status'),
        isCorrect: safeGet(record, colIndex, 'is_correct'),
        correctedClassification: safeGet(record, colIndex, 'corrected_classification'),
        finalClassification: safeGet(record, colIndex, 'final_classification'),
        mainCropType: safeGet(record, colIndex, 'main_crop_type'),
        validatorName: safeGet(record, colIndex, 'validator_name'),
        validationDate: safeGet(record, colIndex, 'validation_date')
      }
    };

    // Get crops for this country
    const crops = CROPS_DATA[countryCode] || [];

    // Determine if this is edit mode (record has been validated)
    const isEditMode = recordData.existingValidation.status &&
                       recordData.existingValidation.status !== 'PENDING';

    res.render('validate', {
      record: recordData,
      crops: crops,
      isEditMode: isEditMode,
      perPage: per_page || '20'
    });

  } catch (error) {
    console.error('Error fetching record:', error);
    res.status(500).send(`Error: ${error.message}`);
  }
});

// POST /save - Guardar Validación
app.post('/save', async (req, res) => {
  try {
    const {
      rowNumber,
      validation,
      correctedClassification,
      mainCropType,
      comments,
      validatorName,
      returnPerPage
    } = req.body;

    if (!rowNumber || !validation || !validatorName) return res.status(400).send('Missing required fields');

    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!1:1`
    });
    const colIndex = mapHeaders(headerResponse.data.values[0]);

    // Fetch row for original classification
    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!${rowNumber}:${rowNumber}`
    });
    const currentRow = rowResponse.data.values[0];
    const landCoverTypes = safeGet(currentRow, colIndex, 'land_cover_types');
    const primaryClassification = safeGet(currentRow, colIndex, 'primary_classification');
    const countryCode = safeGet(currentRow, colIndex, 'country_code');

    let validationStatus = 'PENDING';
    let isCorrect = '';
    let finalClassification = '';

    if (validation === 'correct') {
      validationStatus = 'VALIDATED';
      isCorrect = 'YES';
      // When marking as correct, use land_cover_types if available, otherwise primary_classification
      // In your workflow, the classification data goes to primary_classification
      finalClassification = landCoverTypes || primaryClassification;

      // Data quality check: at least one classification field should have a value
      if (!finalClassification) {
        console.error(`CRITICAL DATA QUALITY ISSUE: Both land_cover_types and primary_classification are empty for row ${rowNumber}`);
        throw new Error(`Cannot validate as correct: No classification found in row ${rowNumber}. Please fix source data.`);
      }
    } else if (validation === 'incorrect') {
      validationStatus = 'CORRECTED';
      isCorrect = 'NO';
      // When marking as incorrect, validator provides correct classification
      finalClassification = correctedClassification;

      // Validation: correctedClassification must be provided when marking incorrect
      if (!finalClassification) {
        console.error(`ERROR: No corrected classification provided for row ${rowNumber}`);
        throw new Error('Corrected classification is required when marking as incorrect');
      }
    } else if (validation === 'unclear') {
      validationStatus = 'NEEDS_REVIEW';
      isCorrect = 'UNCLEAR';
      // When marking as unclear/review, final_classification remains empty (this is correct)
      finalClassification = '';
    }

    function getColumnLetter(index) {
      let letter = '';
      while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
      }
      return letter;
    }

    const updates = [
      { col: 'validation_status', value: validationStatus },
      { col: 'is_correct', value: isCorrect },
      { col: 'final_classification', value: finalClassification },
      { col: 'main_crop_type', value: mainCropType || '' },
      { col: 'corrected_classification', value: correctedClassification || '' },
      { col: 'validator_comments', value: comments || '' },
      { col: 'validator_name', value: validatorName },
      { col: 'validation_date', value: new Date().toISOString() }
    ];

    for (const update of updates) {
      const columnIndex = colIndex[update.col];
      if (columnIndex !== undefined) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: CONFIG.SPREADSHEET_ID,
          range: `${CONFIG.SHEET_NAME}!${getColumnLetter(columnIndex)}${rowNumber}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[update.value]] }
        });
      }
    }

    console.log(`Saved row ${rowNumber}: ${validationStatus}`);

    // Redirect back to list with same country filter and per_page setting
    const redirectParams = new URLSearchParams();
    if (countryCode) {
      redirectParams.append('country', countryCode);
    }
    // Use returnPerPage if provided, otherwise default to 20
    const perPage = returnPerPage || '20';
    redirectParams.append('per_page', perPage);

    const redirectUrl = `/?${redirectParams.toString()}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('Save Error:', error);
    res.status(500).send(`Error saving: ${error.message}`);
  }
});

// Health check
app.get('/health', (req, res) => res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  photosPath: CONFIG.LOCAL_PHOTOS_PATH,
  apiKeyConfigured: CONFIG.API_KEY !== 'ymT/DcHV8pk8qiEHQ/bBknTDWNgOJhiMAVaYOSCbjYg='
}));

// Error handler for multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ success: false, error: 'File too large. Max 10MB.' });
    }
    return res.status(400).json({ success: false, error: error.message });
  }
  next(error);
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
  console.log(`Validation Dashboard running on port ${PORT}`);
  console.log(`Serving local photos from: ${CONFIG.LOCAL_PHOTOS_PATH}`);
  console.log(`API Upload endpoint: POST /api/upload`);
  console.log(`API Key configured: ${CONFIG.API_KEY !== 'ymT/DcHV8pk8qiEHQ/bBknTDWNgOJhiMAVaYOSCbjYg=' ? 'Yes' : 'No (using default)'}`);
});