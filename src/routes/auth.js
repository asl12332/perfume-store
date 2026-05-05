const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');

// GET Login page
router.get('/login', (req, res) => {
  const error = req.query.error;
  const msg = req.query.msg;
  res.send(renderLoginPage(error, msg));
});

// POST Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.redirect('/auth/login?error=البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.redirect('/auth/login?error=البريد الإلكتروني أو كلمة المرور غير صحيحة');
    }
    req.session.userId = user.id;
    req.session.userName = user.name;
    req.session.role = user.role;

    if (user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/store');
    }
  } catch (err) {
    res.redirect('/auth/login?error=حدث خطأ، حاول مجدداً');
  }
});

// GET Register page
router.get('/register', (req, res) => {
  res.send(renderRegisterPage());
});

// POST Register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
      [name, email, hashed]
    );
    res.redirect('/auth/login?msg=تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول');
  } catch (err) {
    if (err.code === '23505') {
      res.redirect('/auth/register?error=البريد الإلكتروني مستخدم مسبقاً');
    } else {
      res.redirect('/auth/register?error=حدث خطأ، حاول مجدداً');
    }
  }
});

// GET Logout
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

function renderLoginPage(error, msg) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>تسجيل الدخول - عطور</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: 'Tajawal', sans-serif;
  min-height: 100vh;
  background: #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.bg {
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(ellipse at 20% 50%, rgba(180,130,60,0.15) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(120,60,20,0.2) 0%, transparent 50%),
    radial-gradient(ellipse at 60% 80%, rgba(180,130,60,0.1) 0%, transparent 40%);
}
.particles {
  position: fixed;
  inset: 0;
  overflow: hidden;
}
.particle {
  position: absolute;
  width: 2px;
  height: 2px;
  background: rgba(200,160,80,0.4);
  border-radius: 50%;
  animation: float linear infinite;
}
@keyframes float {
  0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { transform: translateY(-100px) rotate(720deg); opacity: 0; }
}
.container {
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 440px;
  padding: 20px;
}
.logo {
  text-align: center;
  margin-bottom: 40px;
}
.logo-icon {
  width: 70px;
  height: 70px;
  margin: 0 auto 16px;
  background: linear-gradient(135deg, #c9a84c, #8b5e1a);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  box-shadow: 0 0 40px rgba(201,168,76,0.4);
}
.logo h1 {
  font-size: 28px;
  font-weight: 700;
  color: #c9a84c;
  letter-spacing: 2px;
}
.logo p {
  color: rgba(255,255,255,0.4);
  font-size: 13px;
  margin-top: 4px;
}
.card {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 20px;
  padding: 40px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.tabs {
  display: flex;
  margin-bottom: 32px;
  background: rgba(0,0,0,0.3);
  border-radius: 10px;
  padding: 4px;
}
.tab {
  flex: 1;
  padding: 10px;
  text-align: center;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: rgba(255,255,255,0.5);
  transition: all 0.3s;
  text-decoration: none;
}
.tab.active {
  background: linear-gradient(135deg, #c9a84c, #8b5e1a);
  color: white;
}
.form-group {
  margin-bottom: 20px;
}
label {
  display: block;
  color: rgba(255,255,255,0.7);
  font-size: 14px;
  margin-bottom: 8px;
}
input {
  width: 100%;
  padding: 14px 16px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  color: white;
  font-family: 'Tajawal', sans-serif;
  font-size: 15px;
  transition: all 0.3s;
  outline: none;
}
input:focus {
  border-color: #c9a84c;
  background: rgba(201,168,76,0.05);
  box-shadow: 0 0 0 3px rgba(201,168,76,0.1);
}
input::placeholder { color: rgba(255,255,255,0.25); }
.btn {
  width: 100%;
  padding: 15px;
  background: linear-gradient(135deg, #c9a84c, #8b5e1a);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 16px;
  font-weight: 600;
  font-family: 'Tajawal', sans-serif;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 8px;
  letter-spacing: 1px;
}
.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(201,168,76,0.3);
}
.alert {
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 20px;
  font-size: 14px;
  text-align: center;
}
.alert-error { background: rgba(220,50,50,0.15); border: 1px solid rgba(220,50,50,0.3); color: #ff6b6b; }
.alert-success { background: rgba(50,180,80,0.15); border: 1px solid rgba(50,180,80,0.3); color: #5de084; }
.admin-hint {
  margin-top: 20px;
  padding: 14px;
  background: rgba(201,168,76,0.08);
  border: 1px solid rgba(201,168,76,0.2);
  border-radius: 10px;
  text-align: center;
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}
.admin-hint span { color: #c9a84c; font-weight: 600; }
</style>
</head>
<body>
<div class="bg"></div>
<div class="particles" id="particles"></div>
<div class="container">
  <div class="logo">
    <div class="logo-icon">🌸</div>
    <h1>عطور الفاخرة</h1>
    <p>LUXURY PERFUMES</p>
  </div>
  <div class="card">
    <div class="tabs">
      <a href="/auth/login" class="tab active">تسجيل الدخول</a>
      <a href="/auth/register" class="tab">حساب جديد</a>
    </div>
    ${error ? `<div class="alert alert-error">${error}</div>` : ''}
    ${msg ? `<div class="alert alert-success">${msg}</div>` : ''}
    <form method="POST" action="/auth/login">
      <div class="form-group">
        <label>البريد الإلكتروني</label>
        <input type="email" name="email" placeholder="example@email.com" required>
      </div>
      <div class="form-group">
        <label>كلمة المرور</label>
        <input type="password" name="password" placeholder="••••••••" required>
      </div>
      <button type="submit" class="btn">دخول ← </button>
    </form>
    <div class="admin-hint">
      حساب الإدارة: <span>admin@perfume.com</span> / <span>admin123</span>
    </div>
  </div>
</div>
<script>
const p = document.getElementById('particles');
for (let i = 0; i < 30; i++) {
  const d = document.createElement('div');
  d.className = 'particle';
  d.style.cssText = \`left:\${Math.random()*100}%;width:\${Math.random()*3+1}px;height:\${Math.random()*3+1}px;animation-duration:\${Math.random()*15+10}s;animation-delay:\${Math.random()*10}s;\`;
  p.appendChild(d);
}
</script>
</body>
</html>`;
}

function renderRegisterPage(error) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>حساب جديد - عطور</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Tajawal', sans-serif; min-height: 100vh; background: #0a0a0a; display: flex; align-items: center; justify-content: center; }
.bg { position: fixed; inset: 0; background: radial-gradient(ellipse at 20% 50%, rgba(180,130,60,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(120,60,20,0.2) 0%, transparent 50%); }
.container { position: relative; z-index: 10; width: 100%; max-width: 440px; padding: 20px; }
.logo { text-align: center; margin-bottom: 40px; }
.logo-icon { width: 70px; height: 70px; margin: 0 auto 16px; background: linear-gradient(135deg, #c9a84c, #8b5e1a); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; box-shadow: 0 0 40px rgba(201,168,76,0.4); }
.logo h1 { font-size: 28px; font-weight: 700; color: #c9a84c; }
.logo p { color: rgba(255,255,255,0.4); font-size: 13px; margin-top: 4px; }
.card { background: rgba(255,255,255,0.04); backdrop-filter: blur(20px); border: 1px solid rgba(201,168,76,0.2); border-radius: 20px; padding: 40px; }
.tabs { display: flex; margin-bottom: 32px; background: rgba(0,0,0,0.3); border-radius: 10px; padding: 4px; }
.tab { flex: 1; padding: 10px; text-align: center; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; color: rgba(255,255,255,0.5); transition: all 0.3s; text-decoration: none; }
.tab.active { background: linear-gradient(135deg, #c9a84c, #8b5e1a); color: white; }
.form-group { margin-bottom: 20px; }
label { display: block; color: rgba(255,255,255,0.7); font-size: 14px; margin-bottom: 8px; }
input { width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: white; font-family: 'Tajawal', sans-serif; font-size: 15px; transition: all 0.3s; outline: none; }
input:focus { border-color: #c9a84c; box-shadow: 0 0 0 3px rgba(201,168,76,0.1); }
input::placeholder { color: rgba(255,255,255,0.25); }
.btn { width: 100%; padding: 15px; background: linear-gradient(135deg, #c9a84c, #8b5e1a); border: none; border-radius: 10px; color: white; font-size: 16px; font-weight: 600; font-family: 'Tajawal', sans-serif; cursor: pointer; transition: all 0.3s; margin-top: 8px; }
.btn:hover { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(201,168,76,0.3); }
.alert { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; text-align: center; }
.alert-error { background: rgba(220,50,50,0.15); border: 1px solid rgba(220,50,50,0.3); color: #ff6b6b; }
</style>
</head>
<body>
<div class="bg"></div>
<div class="container">
  <div class="logo">
    <div class="logo-icon">🌸</div>
    <h1>عطور الفاخرة</h1>
    <p>LUXURY PERFUMES</p>
  </div>
  <div class="card">
    <div class="tabs">
      <a href="/auth/login" class="tab">تسجيل الدخول</a>
      <a href="/auth/register" class="tab active">حساب جديد</a>
    </div>
    ${error ? `<div class="alert alert-error">${error}</div>` : ''}
    <form method="POST" action="/auth/register">
      <div class="form-group">
        <label>الاسم الكامل</label>
        <input type="text" name="name" placeholder="محمد أحمد" required>
      </div>
      <div class="form-group">
        <label>البريد الإلكتروني</label>
        <input type="email" name="email" placeholder="example@email.com" required>
      </div>
      <div class="form-group">
        <label>كلمة المرور</label>
        <input type="password" name="password" placeholder="••••••••" minlength="6" required>
      </div>
      <button type="submit" class="btn">إنشاء الحساب ←</button>
    </form>
  </div>
</div>
</body>
</html>`;
}

module.exports = router;
