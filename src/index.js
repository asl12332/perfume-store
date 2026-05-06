require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');
const app = express();
const PORT = process.env.PORT || 3000;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
async function setupDatabase() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, email VARCHAR(150) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(20) DEFAULT 'customer', created_at TIMESTAMP DEFAULT NOW());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, name_ar VARCHAR(100));`);
    await pool.query(`CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL, name_ar VARCHAR(150), description TEXT, price DECIMAL(10,2) NOT NULL, stock INTEGER DEFAULT 0, category_id INTEGER REFERENCES categories(id), brand VARCHAR(100), volume_ml INTEGER, is_featured BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), total_amount DECIMAL(10,2) NOT NULL, status VARCHAR(50) DEFAULT 'pending', shipping_address TEXT, phone VARCHAR(20), created_at TIMESTAMP DEFAULT NOW());`);
    await pool.query(`CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER REFERENCES orders(id), product_id INTEGER REFERENCES products(id), quantity INTEGER NOT NULL, price DECIMAL(10,2) NOT NULL);`);
    await pool.query(`CREATE TABLE IF NOT EXISTS cart (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), product_id INTEGER REFERENCES products(id), quantity INTEGER DEFAULT 1, UNIQUE(user_id, product_id));`);
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash('admin123', 10);
    await pool.query(`INSERT INTO users (name, email, password, role) VALUES ('المدير', 'admin@perfume.com', $1, 'admin') ON CONFLICT (email) DO NOTHING;`, [hashed]);
    await pool.query(`INSERT INTO categories (name, name_ar) VALUES ('Men', 'رجالي'), ('Women', 'نسائي'), ('Unisex', 'للجنسين'), ('Oud', 'عود') ON CONFLICT DO NOTHING;`);
    await pool.query(`INSERT INTO products (name, name_ar, description, price, stock, category_id, brand, volume_ml, is_featured) VALUES ('Royal Oud', 'رويال عود', 'عطر عود ملكي', 450.00, 50, 4, 'Arabian Oud', 100, true), ('Rose Noir', 'روز نوار', 'عطر ورد', 320.00, 30, 2, 'Maison', 75, true), ('Blue Ocean', 'بلو أوشن', 'عطر منعش', 280.00, 45, 1, 'Azzaro', 100, false), ('Saffron Dreams', 'أحلام الزعفران', 'زعفران وعنبر', 520.00, 20, 3, 'Lattafa', 100, true) ON CONFLICT DO NOTHING;`);
    console.log('✅ قاعدة البيانات جاهزة');
  } catch (err) { console.error('خطأ:', err.message); }
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({ secret: process.env.SESSION_SECRET || 'secret', resave: false, saveUninitialized: false, cookie: { maxAge: 7*24*60*60*1000 } }));
app.use((req, res, next) => { res.locals.user = req.session.userId ? { id: req.session.userId, name: req.session.userName, role: req.session.role } : null; next(); });
app.locals.pool = pool;
app.use('/auth', require('./routes/auth'));
app.use('/store', require('./routes/store'));
app.use('/admin', require('./routes/admin'));
app.get('/', (req, res) => res.redirect('/store'));
setupDatabase().then(() => { app.listen(PORT, () => console.log(`✅ شغال: http://localhost:${PORT}`)); });