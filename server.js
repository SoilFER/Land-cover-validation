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
const session = require('express-session');
const bcrypt = require('bcrypt');

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
  CROPS_PATH: './crops.json',
  // Path to users database (JSON file)
  USERS_DB_PATH: './secrets/users.json',
  // Session configuration
  SESSION_SECRET: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  SESSION_TIMEOUT: parseInt(process.env.SESSION_TIMEOUT) || 28800000, // 8 hours default
  BCRYPT_SALT_ROUNDS: 10
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

// Trust proxy (required for Traefik/Cloudflare)
app.set('trust proxy', 1);

// Session middleware (MUST be before routes)
// Security: httpOnly prevents XSS, secure flag for HTTPS, session timeout configured
app.use(session({
  secret: CONFIG.SESSION_SECRET,
  resave: false, // Don't save session if unmodified
  saveUninitialized: false, // Don't create session until something stored
  cookie: {
    secure: false, // Set to false when behind reverse proxy (Traefik handles HTTPS)
    httpOnly: true, // Prevents client-side JS access to cookies (XSS protection)
    maxAge: CONFIG.SESSION_TIMEOUT, // 8 hours default
    sameSite: 'lax' // Changed from 'strict' to 'lax' to allow redirects
  },
  proxy: true // Trust the reverse proxy (Traefik)
}));

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
// USER DATABASE (JSON FILE STORAGE)
// ============================================

/**
 * Read users from JSON file
 * @returns {Object} Users object with username as keys
 */
function readUsersDB() {
  try {
    if (!fs.existsSync(CONFIG.USERS_DB_PATH)) {
      // Create empty users file if it doesn't exist
      const emptyDB = { users: {} };
      fs.writeFileSync(CONFIG.USERS_DB_PATH, JSON.stringify(emptyDB, null, 2));
      return emptyDB;
    }
    const data = fs.readFileSync(CONFIG.USERS_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users database:', error);
    return { users: {} };
  }
}

/**
 * Write users to JSON file
 * @param {Object} db - Users database object
 */
function writeUsersDB(db) {
  try {
    fs.writeFileSync(CONFIG.USERS_DB_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error writing users database:', error);
    throw error;
  }
}

// ============================================
// USER AUTHENTICATION HELPERS
// ============================================

/**
 * Hash password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, CONFIG.BCRYPT_SALT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

/**
 * Get user by username
 * @param {string} username - Username (case-insensitive)
 * @returns {Object|null} User object or null
 */
function getUserByUsername(username) {
  const db = readUsersDB();
  const searchUsername = username.toLowerCase().trim();
  const user = db.users[searchUsername];

  if (!user || !user.is_active) {
    return null;
  }

  return user;
}

/**
 * Get all users (Admin only)
 * @returns {Array} Array of user objects
 */
function getAllUsers() {
  const db = readUsersDB();
  return Object.values(db.users);
}

/**
 * Create new user
 * @param {Object} userData - User data (username, password, role, email, full_name, countries)
 * @returns {Object} Created user object
 */
async function createUser(userData) {
  const { username, password, role, email, full_name, countries } = userData;

  // Validation
  if (!username || !password || !role || !full_name) {
    throw new Error('Username, password, role, and full_name are required');
  }

  // Validate role
  const validRoles = ['admin', 'validator', 'viewer'];
  if (!validRoles.includes(role.toLowerCase())) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  // Sanitize username (lowercase, alphanumeric + underscore only)
  const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (sanitizedUsername !== username.toLowerCase()) {
    throw new Error('Username can only contain lowercase letters, numbers, and underscores');
  }

  // Check if user already exists
  const db = readUsersDB();
  if (db.users[sanitizedUsername]) {
    throw new Error('Username already exists');
  }

  // Hash password
  const password_hash = await hashPassword(password);

  // Create user object
  const newUser = {
    username: sanitizedUsername,
    password_hash,
    role: role.toLowerCase(),
    email: email || '',
    full_name,
    countries: countries || [], // Array of country codes (for validators)
    created_date: new Date().toISOString(),
    last_login: '',
    is_active: true
  };

  // Save to database
  db.users[sanitizedUsername] = newUser;
  writeUsersDB(db);

  console.log(`Created user: ${sanitizedUsername} (${role})`);

  // Return user without password_hash
  const { password_hash: _, ...userWithoutPassword } = newUser;
  return userWithoutPassword;
}

/**
 * Update user
 * @param {string} username - Username to update
 * @param {Object} updates - Fields to update (role, email, full_name, countries, is_active)
 * @returns {Object} Updated user object
 */
function updateUser(username, updates) {
  const db = readUsersDB();
  const searchUsername = username.toLowerCase().trim();

  if (!db.users[searchUsername]) {
    throw new Error('User not found');
  }

  // Update allowed fields
  const allowedUpdates = ['role', 'email', 'full_name', 'countries', 'is_active'];
  for (const [field, value] of Object.entries(updates)) {
    if (allowedUpdates.includes(field) && value !== undefined) {
      db.users[searchUsername][field] = value;
    }
  }

  writeUsersDB(db);
  console.log(`Updated user: ${username}`);

  // Return user without password_hash
  const { password_hash, ...userWithoutPassword } = db.users[searchUsername];
  return userWithoutPassword;
}

/**
 * Update last login timestamp
 * @param {string} username - Username
 */
function updateLastLogin(username) {
  try {
    const db = readUsersDB();
    const searchUsername = username.toLowerCase().trim();

    if (db.users[searchUsername]) {
      db.users[searchUsername].last_login = new Date().toISOString();
      writeUsersDB(db);
    }
  } catch (error) {
    console.error('Error updating last login:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Reset user password
 * @param {string} username - Username
 * @param {string} newPassword - New plain text password
 */
async function resetUserPassword(username, newPassword) {
  const db = readUsersDB();
  const searchUsername = username.toLowerCase().trim();

  if (!db.users[searchUsername]) {
    throw new Error('User not found');
  }

  const password_hash = await hashPassword(newPassword);
  db.users[searchUsername].password_hash = password_hash;

  writeUsersDB(db);
  console.log(`Reset password for user: ${username}`);
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

/**
 * Middleware: Require user to be authenticated
 * If not authenticated, automatically login as guest viewer
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }

  // Auto-login as guest viewer for unauthenticated users
  req.session.user = {
    username: 'guest',
    role: 'viewer',
    email: '',
    full_name: 'Guest Viewer',
    countries: [],
    is_guest: true // Flag to identify guest sessions
  };

  console.log('Guest viewer auto-logged in');
  return next();
}

/**
 * Middleware: Require specific role(s)
 * @param {Array<string>} roles - Allowed roles (e.g., ['admin', 'validator'])
 * @returns {Function} Middleware function
 */
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.status(401).send('Unauthorized');
    }

    const userRole = req.session.user.role.toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());

    if (allowedRoles.includes(userRole)) {
      return next();
    }

    res.status(403).send('Forbidden: Insufficient permissions');
  };
}

/**
 * Middleware: Attach user to res.locals for views
 * Makes user data available in all EJS templates
 */
function attachUserToLocals(req, res, next) {
  res.locals.user = req.session.user || null;
  next();
}

/**
 * Middleware: Check if user has access to specific country
 * For validators: Only allow access to their assigned countries
 * For admin: Allow access to all countries
 * @param {string} countryCode - Country code from request (e.g., 'GTM')
 * @returns {boolean} True if user has access
 */
function hasCountryAccess(user, countryCode) {
  if (!user) return false;
  if (user.role === 'admin') return true; // Admin has access to all countries
  if (user.role === 'validator') {
    // Validator can only access their assigned countries
    return user.countries && user.countries.includes(countryCode);
  }
  return false; // Viewer has no edit access
}

/**
 * Middleware: Require country access for validation routes
 * Validates that user can edit data for specific country
 */
function requireCountryAccess(req, res, next) {
  const user = req.session.user;
  if (!user) {
    return res.status(401).send('Unauthorized');
  }

  // Get country code from various sources
  let countryCode = req.body.country_code || req.query.country_code;

  // If not provided, try to get from record UUID (requires fetching the record)
  if (!countryCode && req.params.uuid) {
    // We'll validate country access in the route handler itself
    // by fetching the record first
    return next();
  }

  // Admin always has access
  if (user.role === 'admin') {
    return next();
  }

  // Validator needs country assignment
  if (user.role === 'validator') {
    if (!countryCode) {
      // Will validate in route handler after fetching record
      return next();
    }

    if (hasCountryAccess(user, countryCode)) {
      return next();
    }

    return res.status(403).send('Forbidden: You do not have access to validate records for this country');
  }

  // Viewer has no edit access
  return res.status(403).send('Forbidden: Viewers cannot validate or edit records');
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
// AUTHENTICATION ROUTES
// ============================================

// GET /login - Login page
app.get('/login', (req, res) => {
  // If guest user, destroy session to allow real login
  if (req.session && req.session.user && req.session.user.is_guest) {
    req.session.destroy((err) => {
      if (err) console.error('Error destroying guest session:', err);
      const error = req.query.error;
      return res.render('login', { error });
    });
    return;
  }

  // If already logged in as real user, redirect to dashboard
  if (req.session && req.session.user) {
    return res.redirect('/');
  }

  const error = req.query.error;
  res.render('login', { error });
});

// POST /login - Process login
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Input validation
    if (!username || !password) {
      return res.redirect('/login?error=' + encodeURIComponent('Username and password are required'));
    }

    // Fetch user from database
    const user = getUserByUsername(username);

    if (!user) {
      console.warn(`Login attempt for non-existent user: ${username}`);
      // Generic error message to prevent username enumeration
      return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);

    if (!isPasswordValid) {
      console.warn(`Failed login attempt for user: ${username}`);
      return res.redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
    }

    // Regenerate session ID to prevent session fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.redirect('/login?error=' + encodeURIComponent('Login error. Please try again.'));
      }

      // Store user in session (exclude password_hash for security)
      req.session.user = {
        username: user.username,
        role: user.role,
        email: user.email,
        full_name: user.full_name,
        countries: user.countries || [] // Include assigned countries for validators
      };

      // Update last login timestamp (non-critical, don't wait)
      updateLastLogin(user.username);

      console.log(`User logged in: ${user.username} (${user.role})`);

      // Redirect to original URL or dashboard
      const returnTo = req.session.returnTo || '/';
      delete req.session.returnTo;
      res.redirect(returnTo);
    });

  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/login?error=' + encodeURIComponent('An error occurred. Please try again.'));
  }
});

// GET /logout - Destroy session and redirect to login
app.get('/logout', (req, res) => {
  const username = req.session?.user?.username || 'unknown';

  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    console.log(`User logged out: ${username}`);
    res.redirect('/login');
  });
});

// ============================================
// USER MANAGEMENT ROUTES (Admin only)
// ============================================

// GET /users - User management page (Admin only)
app.get('/users', attachUserToLocals, requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const users = await getAllUsers();
    const success = req.query.success;
    const error = req.query.error;

    res.render('users', {
      users,
      success,
      error
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Error loading users');
  }
});

// POST /users/create - Create new user (Admin only)
app.post('/users/create', attachUserToLocals, requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { username, password, role, email, full_name, countries } = req.body;

    // Input validation
    if (!username || !password || !role || !full_name) {
      return res.redirect('/users?error=' + encodeURIComponent('Username, password, role, and full name are required'));
    }

    // Password length validation
    if (password.length < 8) {
      return res.redirect('/users?error=' + encodeURIComponent('Password must be at least 8 characters'));
    }

    // Parse countries (comma-separated string to array)
    const countriesArray = countries ? countries.split(',').map(c => c.trim().toUpperCase()).filter(c => c) : [];

    await createUser({ username, password, role, email, full_name, countries: countriesArray });

    res.redirect('/users?success=' + encodeURIComponent(`User "${username}" created successfully`));
  } catch (error) {
    console.error('Error creating user:', error);
    res.redirect('/users?error=' + encodeURIComponent(error.message));
  }
});

// POST /users/update - Update user (Admin only)
app.post('/users/update', attachUserToLocals, requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { username, role, email, full_name, is_active, countries } = req.body;

    if (!username) {
      return res.redirect('/users?error=' + encodeURIComponent('Username is required'));
    }

    const updates = {};
    if (role) updates.role = role;
    if (email !== undefined) updates.email = email;
    if (full_name) updates.full_name = full_name;
    if (is_active !== undefined) updates.is_active = is_active === 'true' || is_active === true;
    if (countries !== undefined) {
      // Parse countries (comma-separated string to array)
      updates.countries = countries ? countries.split(',').map(c => c.trim().toUpperCase()).filter(c => c) : [];
    }

    updateUser(username, updates);

    res.redirect('/users?success=' + encodeURIComponent(`User "${username}" updated successfully`));
  } catch (error) {
    console.error('Error updating user:', error);
    res.redirect('/users?error=' + encodeURIComponent(error.message));
  }
});

// POST /users/reset-password - Reset user password (Admin only)
app.post('/users/reset-password', attachUserToLocals, requireAuth, requireRole(['admin']), async (req, res) => {
  try {
    const { username, new_password } = req.body;

    if (!username || !new_password) {
      return res.redirect('/users?error=' + encodeURIComponent('Username and new password are required'));
    }

    if (new_password.length < 8) {
      return res.redirect('/users?error=' + encodeURIComponent('Password must be at least 8 characters'));
    }

    await resetUserPassword(username, new_password);

    res.redirect('/users?success=' + encodeURIComponent(`Password reset for user "${username}"`));
  } catch (error) {
    console.error('Error resetting password:', error);
    res.redirect('/users?error=' + encodeURIComponent(error.message));
  }
});

// ============================================
// DASHBOARD ROUTES
// ============================================

// GET / - Listado
app.get('/', attachUserToLocals, requireAuth, async (req, res) => {
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
app.get('/validated', attachUserToLocals, requireAuth, async (req, res) => {
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

// GET /validate/:uuid - View validation page (all authenticated users can view, but only admin/validator can submit)
app.get('/validate/:uuid', attachUserToLocals, requireAuth, async (req, res) => {
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

    // Country-based access control: Only enforce for validators (viewers/guests can see all countries)
    const recordCountryCode = safeGet(record, colIndex, 'country_code');
    if (req.session.user.role === 'validator' && !hasCountryAccess(req.session.user, recordCountryCode)) {
      return res.status(403).send(`Forbidden: You do not have access to validate records for ${recordCountryCode}`);
    }

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

// POST /save - Guardar Validación (Validator and Admin only)
app.post('/save', attachUserToLocals, requireAuth, requireRole(['admin', 'validator']), async (req, res) => {
  try {
    const {
      rowNumber,
      validation,
      correctedClassification,
      mainCropType,
      comments,
      returnPerPage
    } = req.body;

    // Prevent guest users from saving validations (additional check)
    if (req.session.user.is_guest) {
      return res.status(403).send('Guest users cannot save validations. Please login with credentials.');
    }

    // Get validator name from session instead of form
    const validatorName = req.session.user.full_name;

    if (!rowNumber || !validation) return res.status(400).send('Missing required fields');

    const auth = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth });

    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!1:1`
    });
    const colIndex = mapHeaders(headerResponse.data.values[0]);

    // Fetch row for original classification and country code
    const rowResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      range: `${CONFIG.SHEET_NAME}!${rowNumber}:${rowNumber}`
    });
    const currentRow = rowResponse.data.values[0];
    const landCoverTypes = safeGet(currentRow, colIndex, 'land_cover_types');
    const primaryClassification = safeGet(currentRow, colIndex, 'primary_classification');
    const countryCode = safeGet(currentRow, colIndex, 'country_code');

    // Country-based access control: Check if user has access to this record's country
    if (!hasCountryAccess(req.session.user, countryCode)) {
      return res.status(403).send(`Forbidden: You do not have access to save validations for ${countryCode}`);
    }

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