require('dotenv').config();
const express = require('express');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Set locals middleware
app.use((req, res, next) => {
  res.locals.user = req.session.userId ? {
    id: req.session.userId,
    name: req.session.userName,
    role: req.session.role
  } : null;
  next();
});

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/store', require('./routes/store'));
app.use('/admin', require('./routes/admin'));

// Root redirect
app.get('/', (req, res) => res.redirect('/store'));

app.listen(PORT, () => {
  console.log('\n🌸 ====================================');
  console.log('   عطور الفاخرة - Luxury Perfume Store');
  console.log('====================================');
  console.log(`\n✅ السيرفر شغال على: http://localhost:${PORT}`);
  console.log('\n📌 الروابط:');
  console.log(`   المتجر:      http://localhost:${PORT}/store`);
  console.log(`   تسجيل دخول: http://localhost:${PORT}/auth/login`);
  console.log(`   لوحة تحكم:  http://localhost:${PORT}/admin/dashboard`);
  console.log('\n🔑 بيانات الإدارة:');
  console.log('   البريد:    admin@perfume.com');
  console.log('   كلمة المرور: admin123');
  console.log('\n====================================\n');
});
