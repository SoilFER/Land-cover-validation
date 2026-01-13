#!/usr/bin/env node

/**
 * ============================================
 * ADMIN USER INITIALIZATION SCRIPT
 * ============================================
 *
 * Creates the first admin user in the local JSON users database.
 * Run this script once after setting up authentication to create
 * your initial administrator account.
 *
 * Usage:
 *   node init-admin.js
 *
 * Requirements:
 *   - bcrypt installed (npm install)
 *   - ./secrets/ directory exists (will be created if not)
 *
 * Security:
 *   - Password is hashed with bcrypt (10 salt rounds)
 *   - Username is sanitized (lowercase, alphanumeric + underscore only)
 *   - No passwords are logged or stored in plain text
 *   - Users stored in ./secrets/users.json (not committed to git)
 */

const readline = require('readline');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Configuration (must match server.js)
const CONFIG = {
  USERS_DB_PATH: './secrets/users.json',
  BCRYPT_SALT_ROUNDS: 10
};

// Setup readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promisify readline question
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Read users from JSON file
 */
function readUsersDB() {
  try {
    if (!fs.existsSync(CONFIG.USERS_DB_PATH)) {
      return { users: {} };
    }
    const data = fs.readFileSync(CONFIG.USERS_DB_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading users database:', error.message);
    return { users: {} };
  }
}

/**
 * Write users to JSON file
 */
function writeUsersDB(db) {
  try {
    // Ensure secrets directory exists
    const secretsDir = path.dirname(CONFIG.USERS_DB_PATH);
    if (!fs.existsSync(secretsDir)) {
      fs.mkdirSync(secretsDir, { recursive: true });
      console.log(`✅ Created directory: ${secretsDir}`);
    }

    fs.writeFileSync(CONFIG.USERS_DB_PATH, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error writing users database:', error.message);
    throw error;
  }
}

/**
 * Check if user already exists
 */
function userExists(username) {
  const db = readUsersDB();
  const searchUsername = username.toLowerCase().trim();
  return !!db.users[searchUsername];
}

/**
 * Create admin user
 */
async function createAdminUser(userData) {
  const { username, password, email, full_name } = userData;

  // Sanitize username
  const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (sanitizedUsername !== username.toLowerCase()) {
    throw new Error('Username can only contain lowercase letters, numbers, and underscores');
  }

  // Hash password
  console.log('\n🔐 Hashing password...');
  const password_hash = await bcrypt.hash(password, CONFIG.BCRYPT_SALT_ROUNDS);

  // Read existing database
  const db = readUsersDB();

  // Create admin user object
  const newUser = {
    username: sanitizedUsername,
    password_hash,
    role: 'admin',
    email: email || '',
    full_name,
    countries: [], // Admin has access to all countries
    created_date: new Date().toISOString(),
    last_login: '',
    is_active: true
  };

  // Add to database
  db.users[sanitizedUsername] = newUser;

  // Write to file
  writeUsersDB(db);

  console.log(`✅ Created admin user: ${sanitizedUsername}`);
  return sanitizedUsername;
}

/**
 * Main function
 */
async function main() {
  console.log('============================================');
  console.log('  ADMIN USER INITIALIZATION');
  console.log('  (JSON File Storage)');
  console.log('============================================\n');

  try {
    // Check if users database exists
    const db = readUsersDB();
    const userCount = Object.keys(db.users).length;

    if (userCount > 0) {
      console.log(`⚠️  Warning: ${userCount} user(s) already exist in the database.`);
      const continueCreate = await question('Do you want to create another admin user? (yes/no): ');
      if (continueCreate.toLowerCase() !== 'yes' && continueCreate.toLowerCase() !== 'y') {
        console.log('❌ User creation cancelled');
        process.exit(0);
      }
    }

    console.log('\nCreating your admin user...\n');

    // Get user input
    const username = await question('Username (lowercase, alphanumeric + underscores): ');

    if (!username || username.trim() === '') {
      console.error('❌ Username cannot be empty');
      process.exit(1);
    }

    // Check if user already exists
    if (userExists(username)) {
      console.error(`❌ Error: User "${username}" already exists`);
      console.log('   If you need to reset the password, delete the user from ./secrets/users.json or use the admin panel.');
      process.exit(1);
    }

    const full_name = await question('Full Name (e.g., John Doe): ');

    if (!full_name || full_name.trim() === '') {
      console.error('❌ Full name cannot be empty');
      process.exit(1);
    }

    const email = await question('Email (optional, press Enter to skip): ');

    // Get password (note: visible in terminal - acceptable for init script)
    const password = await question('Password (minimum 8 characters): ');

    if (!password || password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    const password_confirm = await question('Confirm password: ');

    if (password !== password_confirm) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    console.log('\n📊 Summary:');
    console.log(`   Username:  ${username}`);
    console.log(`   Full Name: ${full_name}`);
    console.log(`   Email:     ${email || '(not provided)'}`);
    console.log(`   Role:      admin`);
    console.log(`   Storage:   ${CONFIG.USERS_DB_PATH}`);

    const confirm = await question('\nCreate this admin user? (yes/no): ');

    if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
      console.log('❌ User creation cancelled');
      process.exit(0);
    }

    // Create the user
    console.log('\n👤 Creating admin user...');
    const createdUsername = await createAdminUser({
      username,
      password,
      email,
      full_name
    });

    console.log('\n✅ Admin user created successfully!');
    console.log('\n============================================');
    console.log('  NEXT STEPS:');
    console.log('============================================');
    console.log('1. Start your server: npm start');
    console.log('2. Navigate to: http://localhost:3000/login');
    console.log(`3. Login with username: ${createdUsername}`);
    console.log('4. You can now create additional users via /users');
    console.log('\n📁 User database location: ' + path.resolve(CONFIG.USERS_DB_PATH));
    console.log('⚠️  Keep ./secrets/ directory secure (it contains password hashes)');
    console.log('============================================\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the script
main();
