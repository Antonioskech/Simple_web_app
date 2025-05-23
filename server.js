require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const {
  registerUser,
  loginUser,
  logoutUser,
  updateProfile,
  sessions,
  parseCookies
} = require('./controllers/authController');

// DB config for profile fetch
const dbConfig = {
  host: 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE
};

// Check if a user is logged in using sessions
function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return cookies.sessionId && sessions[cookies.sessionId];
}

// Utility function for static files
function serveStaticFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('File not found');
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Dynamic serving of edit.html with pre-filled data
async function serveEditPage(req, res) {
  const cookies = parseCookies(req);
  const session = sessions[cookies.sessionId];
  if (!session) {
    res.writeHead(302, { Location: '/login.html' });
    return res.end();
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute('SELECT first_name, last_name FROM users WHERE id = ?', [session.userId]);
    await connection.end();

    if (rows.length === 0) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('User data not found');
    }

    const user = rows[0];

    fs.readFile(path.join(__dirname, 'public/edit.html'), 'utf8', (err, data) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        return res.end('Failed to load edit page');
      }

      let page = data.replace('id="first_name" name="first_name"', `id="first_name" name="first_name" value="${user.first_name}"`);
      page = page.replace('id="last_name" name="last_name"', `id="last_name" name="last_name" value="${user.last_name}"`);

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(page);
    });

  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

// Creating the server
const server = http.createServer((req, res) => {
  const { method, url } = req;
  const parsedUrl = new URL(url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (method === 'GET') {
    if (pathname === '/' || pathname === '/index.html') {
      return serveStaticFile(res, path.join(__dirname, 'public/index.html'), 'text/html');
    }
    else if (pathname === '/register.html') {
      return serveStaticFile(res, path.join(__dirname, 'public/register.html'), 'text/html');
    }
    else if (pathname === '/login.html') {
      return serveStaticFile(res, path.join(__dirname, 'public/login.html'), 'text/html');
    }
    else if (pathname === '/edit.html' || pathname === '/edit') {
      if (!isAuthenticated(req)) {
        res.writeHead(302, { Location: '/login.html' });
        return res.end();
      }
      return serveEditPage(req, res);
    }
    else if (pathname === '/styles.css') {
      return serveStaticFile(res, path.join(__dirname, 'public/styles.css'), 'text/css');
    }
    else if (pathname === '/reg_success.html') {
      return serveStaticFile(res, path.join(__dirname, 'public/reg_success.html'), 'text/html');
    }
    else if (pathname === '/log_success.html') {
      return serveStaticFile(res, path.join(__dirname, 'public/log_success.html'), 'text/html');
    }
    else if (pathname === '/edit_success.html') {
      return serveStaticFile(res, path.join(__dirname, 'public/edit_success.html'), 'text/html');
    }
    else {
      res.writeHead(404);
      return res.end('Not Found');
    }
  }

  if (method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      const params = new URLSearchParams(body);
      req.body = {};
      for (const [k, v] of params.entries()) {
        req.body[k] = v;
      }

      if (pathname === '/register') {
        return registerUser(req, res);
      } else if (pathname === '/login') {
        return loginUser(req, res);
      } else if (pathname === '/logout') {
        return logoutUser(req, res);
      } else if (pathname === '/edit') {
        if (!isAuthenticated(req)) {
          res.writeHead(401, { 'Content-Type': 'text/plain' });
          return res.end('Unauthorized');
        }
        return updateProfile(req, res, sessions);
      } else {
        res.writeHead(404);
        return res.end('Not found');
      }
    });
  }
});

// start the server
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}/`);
});
