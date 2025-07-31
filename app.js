const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const app = express();
const db = new sqlite3.Database('./finance.db');

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'secreta123',
  resave: false,
  saveUninitialized: true
}));

// View Engine
app.set('view engine', 'ejs');

// Criação das tabelas
const createTables = () => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    password TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS finances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    date TEXT,
    description TEXT,
    category TEXT,
    type TEXT,
    fixed INTEGER,
    paid INTEGER,
    amount REAL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);
};

createTables();

// Rotas
app.get('/', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');

  const { startDate, endDate } = req.query;
  let query = `SELECT * FROM finances WHERE user_id = ?`;
  let params = [req.session.userId];

  if (startDate && endDate) {
    query += ` AND date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }

  db.all(query, params, (err, rows) => {
    const entradas = rows.filter(r => r.type === 'entrada');
    const saidas = rows.filter(r => r.type === 'saida');
    const totalEntradas = entradas.reduce((sum, e) => sum + e.amount, 0);
    const totalSaidas = saidas.reduce((sum, s) => sum + s.amount, 0);
    const saldo = totalEntradas - totalSaidas;

    res.render('index', {
      username: req.session.username,
      registros: rows,
      totalEntradas,
      totalSaidas,
      saldo,
      startDate,
      endDate
    });
  });
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (user && bcrypt.compareSync(password, user.password)) {
      req.session.userId = user.id;
      req.session.username = user.username;
      res.redirect('/');
    } else {
      res.send('Login inválido.');
    }
  });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const hash = bcrypt.hashSync(password, 10);
  db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], function () {
    res.redirect('/login');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.post('/add', (req, res) => {
  const { date, description, category, type, fixed, paid, amount } = req.body;
  db.run(`INSERT INTO finances (user_id, date, description, category, type, fixed, paid, amount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [req.session.userId, date, description, category, type, fixed ? 1 : 0, paid ? 1 : 0, parseFloat(amount)], () => {
      res.redirect('/');
    });
});

app.get('/edit/:id', (req, res) => {
  db.get(`SELECT * FROM finances WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId], (err, row) => {
    if (row) {
      res.render('edit', { registro: row });
    } else {
      res.redirect('/');
    }
  });
});

app.post('/edit/:id', (req, res) => {
  const { date, description, category, type, fixed, paid, amount } = req.body;
  db.run(`UPDATE finances SET date = ?, description = ?, category = ?, type = ?, fixed = ?, paid = ?, amount = ?
          WHERE id = ? AND user_id = ?`,
    [date, description, category, type, fixed ? 1 : 0, paid ? 1 : 0, parseFloat(amount), req.params.id, req.session.userId],
    () => {
      res.redirect('/');
    });
});

app.post('/delete/:id', (req, res) => {
  db.run(`DELETE FROM finances WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId], () => {
    res.redirect('/');
  });
});

app.post('/toggle-paid/:id', (req, res) => {
  db.get(`SELECT paid FROM finances WHERE id = ? AND user_id = ?`, [req.params.id, req.session.userId], (err, row) => {
    const newPaid = row.paid ? 0 : 1;
    db.run(`UPDATE finances SET paid = ? WHERE id = ?`, [newPaid, req.params.id], () => {
      res.redirect('/');
    });
  });
});

// Porta
app.listen(3000, () => console.log('Servidor rodando em http://localhost:3000'));

/* === views/login.ejs, views/register.ejs, views/index.ejs, views/edit.ejs ===
   === public/style.css ===
   serão fornecidos em seguida com design atrativo */