const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Connection with the database
// Enter your database you want to use
const dbConfig = {
  host: 'localhost',
  user: 'YourRoot',
  password: 'Your database password!',
  database: 'your database name',
};

// Parsing functions for cookies
function parseCookies(req) {
  const list = {};
  const rc = req.headers.cookie;
  if (!rc) return list;
  rc.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    list[parts.shift().trim()] = decodeURI(parts.join('='));
  });
  return list;
}

// Sessions in memory
const sessions = {};

// Generates sessions
function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Register function
async function registerUser(req, res) {
  const {
    first_name,
    last_name,
    email,
    password,
    confirm_password,
    captcha_answer,
    captcha_sum
  } = req.body;

  if (!first_name || !last_name || !email || !password || !confirm_password || !captcha_answer || !captcha_sum) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Missing required fields');
  }

  if (password !== confirm_password) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Passwords do not match');
  }

  if (!email.match(/^\S+@\S+\.\S+$/)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Invalid email format');
  }

  if (parseInt(captcha_answer) !== parseInt(captcha_sum)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('The CAPTCHA answer is incorrect');
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      await connection.end();
      return res.end('Email already registered');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await connection.execute(
      'INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)',
      [first_name, last_name, email, hashedPassword]
    );

    await connection.end();

    res.writeHead(302, { Location: '/reg_success.html' });
    res.end();
  } catch (err) {
    console.error('Database error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

// Login function
async function loginUser(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return serveLoginWithError(res, 'Please enter both email and password.');
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (rows.length === 0) {
      await connection.end();
      return serveLoginWithError(res, 'Invalid email or password.');
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    await connection.end();

    if (!passwordMatch) {
      return serveLoginWithError(res, 'Invalid email or password.');
    }

    const sessionId = generateSessionId();
    sessions[sessionId] = { email: user.email, userId: user.id };

    res.writeHead(302, {
      'Set-Cookie': `sessionId=${sessionId}; HttpOnly`,
      'Location': '/log_success.html',
    });
    res.end();

  } catch (err) {
    console.error('Login error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

// Returns to login.html if the input is incorrect
function serveLoginWithError(res, errorMessage) {
  const loginPath = path.join(__dirname, '../public/login.html');
  fs.readFile(loginPath, 'utf8', (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Could not load login page');
    }

    const updatedHtml = data.replace(
      '</form>',
      `<p class="error-message">${errorMessage}</p></form>`
    );

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(updatedHtml);
  });
}

// Logout function
function logoutUser(req, res) {
  const cookies = parseCookies(req);
  const sessionId = cookies.sessionId;

  if (sessionId && sessions[sessionId]) {
    delete sessions[sessionId];
  }

  res.writeHead(302, {
    'Set-Cookie': 'sessionId=; HttpOnly; Max-Age=0',
    'Location': '/index.html'
  });
  res.end();
}

// ========== NEW: Get User Profile ==========
async function getUserProfile(userId) {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      'SELECT first_name, last_name FROM users WHERE id = ?',
      [userId]
    );
    await connection.end();
    if (rows.length === 0) {
      throw new Error('User not found');
    }
    return rows[0];
  } catch (err) {
    console.error('getUserProfile error:', err);
    throw err;
  }
}

// Update profile function
async function updateProfile(req, res, sessions) {
  try {
    const cookies = parseCookies(req);
    const sessionId = cookies.sessionId;
    if (!sessionId || !sessions[sessionId]) {
      res.writeHead(401, { 'Content-Type': 'text/plain' });
      return res.end('Unauthorized');
    }
    const userId = sessions[sessionId].userId;

    const {
      first_name,
      last_name,
      password,
      confirm_password
    } = req.body;

    if (!first_name || !last_name) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      return res.end('First name and last name are required');
    }

    if (password && password.length > 0) {
      if (password.length < 6) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('New password must be at least 6 characters');
      }
      if (password !== confirm_password) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        return res.end('Passwords do not match');
      }
    }

    const connection = await mysql.createConnection(dbConfig);

    if (password && password.length > 0) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await connection.execute(
        'UPDATE users SET first_name = ?, last_name = ?, password_hash = ? WHERE id = ?',
        [first_name, last_name, hashedPassword, userId]
      );
    } else {
      await connection.execute(
        'UPDATE users SET first_name = ?, last_name = ? WHERE id = ?',
        [first_name, last_name, userId]
      );
    }

    await connection.end();

    res.writeHead(302, { Location: '/edit_success.html' });
    res.end();

  } catch (err) {
    console.error('updateProfile error:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

//Validation functions
function validateRegistration(data) {
  const { first_name, last_name, email, password, confirm_password } = data;

  /* If you want to see the values, uncomment this
  console.log(data.first_name);
  console.log(data.last_name);
  console.log(data.email);
  console.log(data.password);
  console.log(data.confirm_password);
  */

  if (!first_name || !last_name) {
    return 'Name fields required';
  }

  if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
    return 'Invalid email';
  }

  if (!password || password.length < 6) {
    return 'Password too short';
  }

  if (password !== confirm_password) {
    return 'Passwords do not match';
  }

  return null; // Valid
}

function validateProfileEdit(data) {
  const { first_name, last_name, password, confirm_password } = data;

  /* If you want to see the values, uncomment this
  console.log(data.first_name);
  console.log(data.last_name);
  console.log(data.password);
  console.log(data.confirm_password);
  */

  if (!first_name || !last_name) {
    return 'First name and last name are required';
  }

  if (password && password.length > 0) {
    if (password.length < 6) {
      return 'New password must be at least 6 characters';
    }
  }

  if (password !== confirm_password) {
      return 'Passwords do not match';
  }

  return null; // Valid
}

function validateLoginInput(data) {
  const {email, password} = data;

  /* If you want to see the values, uncomment this
  console.log(data.email);
  console.log(data.password);
  */

  if (!email || !email.match(/^\S+@\S+\.\S+$/)) {
    return 'invalid email';
  }
  if (!password || password.length < 6) {
    return 'password too short';
  }

  return null;
}

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  updateProfile,
  getUserProfile,
  parseCookies,
  sessions,
  validateRegistration,
  validateProfileEdit,
  validateLoginInput
};
