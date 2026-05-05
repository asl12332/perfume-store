const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

// Apply admin middleware to all routes
router.use(requireAdmin);

// GET Dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const [products, orders, users, revenue] = await Promise.all([
      db.query('SELECT COUNT(*) as count FROM products'),
      db.query('SELECT COUNT(*) as count FROM orders'),
      db.query('SELECT COUNT(*) as count FROM users WHERE role = $1', ['customer']),
      db.query("SELECT COALESCE(SUM(total_amount),0) as total FROM orders WHERE status != 'cancelled'")
    ]);
    const recentOrders = await db.query(`
      SELECT o.*, u.name as customer_name FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 5
    `);
    res.send(renderDashboard({
      products: products.rows[0].count,
      orders: orders.rows[0].count,
      users: users.rows[0].count,
      revenue: Number(revenue.rows[0].total).toFixed(0),
      recentOrders: recentOrders.rows
    }, req.session.userName));
  } catch (err) {
    res.send('<h1>خطأ: ' + err.message + '</h1>');
  }
});

// GET Products list
router.get('/products', async (req, res) => {
  const products = await db.query('SELECT p.*, c.name_ar as cat_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.created_at DESC');
  const categories = await db.query('SELECT * FROM categories');
  res.send(renderProductsAdmin(products.rows, categories.rows));
});

// POST Add product
router.post('/products/add', async (req, res) => {
  const { name, name_ar, description, price, stock, category_id, brand, volume_ml, is_featured } = req.body;
  await db.query(
    'INSERT INTO products (name, name_ar, description, price, stock, category_id, brand, volume_ml, is_featured) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [name, name_ar, description, price, stock, category_id || null, brand, volume_ml || null, is_featured === 'on']
  );
  res.redirect('/admin/products');
});

// POST Delete product
router.post('/products/delete/:id', async (req, res) => {
  await db.query('DELETE FROM products WHERE id = $1', [req.params.id]);
  res.redirect('/admin/products');
});

// GET Orders
router.get('/orders', async (req, res) => {
  const orders = await db.query(`
    SELECT o.*, u.name as customer_name, u.email as customer_email FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC
  `);
  res.send(renderOrdersAdmin(orders.rows));
});

// POST Update order status
router.post('/orders/status/:id', async (req, res) => {
  await db.query('UPDATE orders SET status = $1 WHERE id = $2', [req.body.status, req.params.id]);
  res.redirect('/admin/orders');
});

// GET Users
router.get('/users', async (req, res) => {
  const users = await db.query('SELECT * FROM users ORDER BY created_at DESC');
  res.send(renderUsersAdmin(users.rows));
});

function adminLayout(title, content, userName, activePage) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} - لوحة التحكم</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --gold: #c9a84c; --dark: #0a0a0a; --sidebar: #0f0f0f; --card: rgba(255,255,255,0.04); }
body { font-family: 'Tajawal', sans-serif; background: var(--dark); color: white; display: flex; min-height: 100vh; }

/* SIDEBAR */
.sidebar { width: 260px; background: var(--sidebar); border-left: 1px solid rgba(201,168,76,0.1); padding: 30px 0; position: fixed; top: 0; right: 0; height: 100vh; overflow-y: auto; z-index: 50; flex-shrink: 0; }
.sidebar-logo { padding: 0 24px 30px; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px; }
.sidebar-logo h2 { font-size: 20px; font-weight: 900; color: var(--gold); }
.sidebar-logo p { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 2px; }
.sidebar-user { padding: 16px 24px; margin-bottom: 10px; }
.sidebar-user .avatar { width: 44px; height: 44px; background: linear-gradient(135deg, #c9a84c, #8b5e1a); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 8px; }
.sidebar-user .name { font-size: 14px; font-weight: 600; }
.sidebar-user .role { font-size: 12px; color: var(--gold); }
.nav-item { display: flex; align-items: center; gap: 12px; padding: 13px 24px; color: rgba(255,255,255,0.6); text-decoration: none; font-size: 15px; transition: all 0.2s; border-right: 3px solid transparent; }
.nav-item:hover { background: rgba(255,255,255,0.03); color: white; }
.nav-item.active { background: rgba(201,168,76,0.08); color: var(--gold); border-right-color: var(--gold); }
.nav-item .icon { width: 20px; text-align: center; font-size: 18px; }
.nav-section { padding: 20px 24px 8px; font-size: 11px; color: rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 1px; }

/* MAIN */
.main { margin-right: 260px; flex: 1; padding: 0; }
.topbar { background: rgba(10,10,10,0.8); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05); padding: 0 40px; height: 65px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 40; }
.page-title { font-size: 20px; font-weight: 700; }
.topbar-actions { display: flex; gap: 12px; align-items: center; }
.btn-sm { padding: 8px 18px; border-radius: 8px; font-family: 'Tajawal', sans-serif; font-size: 13px; cursor: pointer; border: none; font-weight: 600; transition: all 0.2s; text-decoration: none; }
.btn-gold { background: linear-gradient(135deg, #c9a84c, #8b5e1a); color: white; }
.btn-outline { background: transparent; border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.7); }
.btn-outline:hover { border-color: var(--gold); color: var(--gold); }

.content { padding: 30px 40px; }

/* STATS */
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
.stat-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 24px; }
.stat-icon { font-size: 32px; margin-bottom: 12px; }
.stat-value { font-size: 32px; font-weight: 900; color: var(--gold); }
.stat-label { font-size: 14px; color: rgba(255,255,255,0.5); margin-top: 4px; }

/* TABLE */
.card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; margin-bottom: 24px; }
.card-header { padding: 20px 24px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: space-between; }
.card-title { font-size: 16px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; }
th { padding: 14px 20px; text-align: right; font-size: 12px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2); }
td { padding: 16px 20px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
tr:last-child td { border-bottom: none; }
tr:hover td { background: rgba(255,255,255,0.02); }

/* BADGES */
.badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.badge-pending { background: rgba(255,190,50,0.15); color: #ffc832; border: 1px solid rgba(255,190,50,0.3); }
.badge-processing { background: rgba(50,130,255,0.15); color: #5ab0ff; border: 1px solid rgba(50,130,255,0.3); }
.badge-delivered { background: rgba(50,200,80,0.15); color: #5de084; border: 1px solid rgba(50,200,80,0.3); }
.badge-cancelled { background: rgba(220,50,50,0.15); color: #ff6b6b; border: 1px solid rgba(220,50,50,0.3); }
.badge-admin { background: rgba(201,168,76,0.15); color: var(--gold); border: 1px solid rgba(201,168,76,0.3); }

/* FORM */
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-group { margin-bottom: 0; }
label { display: block; font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 6px; }
input[type=text], input[type=number], input[type=email], textarea, select {
  width: 100%; padding: 11px 14px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;
  color: white; font-family: 'Tajawal', sans-serif; font-size: 14px; outline: none; transition: border-color 0.2s;
}
input:focus, textarea:focus, select:focus { border-color: var(--gold); }
select option { background: #1a1a1a; color: white; }
.form-full { grid-column: 1/-1; }

/* MODAL */
.modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; align-items: center; justify-content: center; }
.modal-overlay.open { display: flex; }
.modal { background: #111; border: 1px solid rgba(201,168,76,0.2); border-radius: 20px; padding: 32px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; }
.modal h3 { font-size: 20px; font-weight: 700; margin-bottom: 24px; color: var(--gold); }
.modal-actions { display: flex; gap: 12px; margin-top: 24px; }
.btn-danger { background: rgba(220,50,50,0.2); border: 1px solid rgba(220,50,50,0.4); color: #ff6b6b; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 13px; }
</style>
</head>
<body>
<aside class="sidebar">
  <div class="sidebar-logo">
    <h2>🌸 عطور الفاخرة</h2>
    <p>لوحة التحكم</p>
  </div>
  <div class="sidebar-user">
    <div class="avatar">👤</div>
    <div class="name">${userName}</div>
    <div class="role">مدير النظام</div>
  </div>
  <div class="nav-section">القائمة الرئيسية</div>
  <a href="/admin/dashboard" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}"><span class="icon">📊</span> لوحة التحكم</a>
  <a href="/admin/products" class="nav-item ${activePage === 'products' ? 'active' : ''}"><span class="icon">🌸</span> المنتجات</a>
  <a href="/admin/orders" class="nav-item ${activePage === 'orders' ? 'active' : ''}"><span class="icon">📦</span> الطلبات</a>
  <a href="/admin/users" class="nav-item ${activePage === 'users' ? 'active' : ''}"><span class="icon">👥</span> المستخدمون</a>
  <div class="nav-section">أخرى</div>
  <a href="/store" class="nav-item"><span class="icon">🛍️</span> المتجر</a>
  <a href="/auth/logout" class="nav-item"><span class="icon">🚪</span> تسجيل الخروج</a>
</aside>
<main class="main">
  <div class="topbar">
    <div class="page-title">${title}</div>
    <div class="topbar-actions">
      <a href="/store" class="btn-sm btn-outline">🛍️ المتجر</a>
      <a href="/auth/logout" class="btn-sm btn-outline">خروج</a>
    </div>
  </div>
  <div class="content">${content}</div>
</main>
</body>
</html>`;
}

function renderDashboard(stats, userName) {
  const statusBadge = (s) => {
    const map = { pending: ['badge-pending', 'قيد الانتظار'], processing: ['badge-processing', 'قيد التجهيز'], delivered: ['badge-delivered', 'تم التوصيل'], cancelled: ['badge-cancelled', 'ملغي'] };
    const [cls, label] = map[s] || ['badge-pending', s];
    return `<span class="badge ${cls}">${label}</span>`;
  };
  const content = `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon">🌸</div><div class="stat-value">${stats.products}</div><div class="stat-label">إجمالي المنتجات</div></div>
      <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-value">${stats.orders}</div><div class="stat-label">إجمالي الطلبات</div></div>
      <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${stats.users}</div><div class="stat-label">العملاء المسجلون</div></div>
      <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${stats.revenue}</div><div class="stat-label">إجمالي الإيرادات (ر.س)</div></div>
    </div>
    <div class="card">
      <div class="card-header"><div class="card-title">آخر الطلبات</div><a href="/admin/orders" class="btn-sm btn-gold">عرض الكل</a></div>
      <table>
        <thead><tr><th>رقم الطلب</th><th>العميل</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${stats.recentOrders.map(o => `
            <tr>
              <td>#${o.id}</td>
              <td>${o.customer_name}</td>
              <td>${Number(o.total_amount).toFixed(0)} ر.س</td>
              <td>${statusBadge(o.status)}</td>
              <td>${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
            </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:rgba(255,255,255,0.3);padding:40px">لا توجد طلبات بعد</td></tr>'}
        </tbody>
      </table>
    </div>`;
  return adminLayout('لوحة التحكم', content, userName, 'dashboard');
}

function renderProductsAdmin(products, categories) {
  const content = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px">
      <div style="font-size:16px;color:rgba(255,255,255,0.5)">${products.length} منتج</div>
      <button class="btn-sm btn-gold" onclick="document.getElementById('addModal').classList.add('open')">+ إضافة منتج</button>
    </div>
    <div class="card">
      <table>
        <thead><tr><th>المنتج</th><th>العلامة</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>مميز</th><th>الإجراءات</th></tr></thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td><div style="font-weight:600">${p.name_ar || p.name}</div><div style="font-size:12px;color:rgba(255,255,255,0.4)">${p.name}</div></td>
              <td>${p.brand || '-'}</td>
              <td>${p.cat_name || '-'}</td>
              <td style="color:#c9a84c;font-weight:700">${Number(p.price).toFixed(0)} ر.س</td>
              <td>${p.stock}</td>
              <td>${p.is_featured ? '⭐' : '-'}</td>
              <td>
                <form method="POST" action="/admin/products/delete/${p.id}" style="display:inline" onsubmit="return confirm('حذف المنتج؟')">
                  <button type="submit" class="btn-danger">حذف</button>
                </form>
              </td>
            </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;padding:40px;color:rgba(255,255,255,0.3)">لا توجد منتجات</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="modal-overlay" id="addModal">
      <div class="modal">
        <h3>➕ إضافة منتج جديد</h3>
        <form method="POST" action="/admin/products/add">
          <div class="form-grid">
            <div class="form-group"><label>اسم المنتج (عربي)</label><input type="text" name="name_ar" required></div>
            <div class="form-group"><label>اسم المنتج (إنجليزي)</label><input type="text" name="name" required></div>
            <div class="form-group"><label>العلامة التجارية</label><input type="text" name="brand"></div>
            <div class="form-group"><label>التصنيف</label>
              <select name="category_id">
                <option value="">-- اختر --</option>
                ${categories.map(c => `<option value="${c.id}">${c.name_ar}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label>السعر (ر.س)</label><input type="number" name="price" step="0.01" required></div>
            <div class="form-group"><label>المخزون</label><input type="number" name="stock" value="0"></div>
            <div class="form-group"><label>الحجم (ml)</label><input type="number" name="volume_ml"></div>
            <div class="form-group"><label>مميز؟</label><input type="checkbox" name="is_featured" style="width:auto;margin-top:10px"></div>
            <div class="form-group form-full"><label>الوصف</label><textarea name="description" rows="3"></textarea></div>
          </div>
          <div class="modal-actions">
            <button type="submit" class="btn-sm btn-gold">حفظ المنتج</button>
            <button type="button" class="btn-sm btn-outline" onclick="document.getElementById('addModal').classList.remove('open')">إلغاء</button>
          </div>
        </form>
      </div>
    </div>`;
  return adminLayout('المنتجات', content, 'المدير', 'products');
}

function renderOrdersAdmin(orders) {
  const statusBadge = (s) => {
    const map = { pending: ['badge-pending', 'قيد الانتظار'], processing: ['badge-processing', 'قيد التجهيز'], delivered: ['badge-delivered', 'تم التوصيل'], cancelled: ['badge-cancelled', 'ملغي'] };
    const [cls, label] = map[s] || ['badge-pending', s];
    return `<span class="badge ${cls}">${label}</span>`;
  };
  const content = `
    <div class="card">
      <table>
        <thead><tr><th>رقم الطلب</th><th>العميل</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th><th>تحديث الحالة</th></tr></thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td>#${o.id}</td>
              <td><div>${o.customer_name}</div><div style="font-size:12px;color:rgba(255,255,255,0.4)">${o.customer_email}</div></td>
              <td style="color:#c9a84c;font-weight:700">${Number(o.total_amount).toFixed(0)} ر.س</td>
              <td>${statusBadge(o.status)}</td>
              <td>${new Date(o.created_at).toLocaleDateString('ar-SA')}</td>
              <td>
                <form method="POST" action="/admin/orders/status/${o.id}" style="display:flex;gap:8px">
                  <select name="status" style="padding:6px;font-size:12px">
                    <option value="pending" ${o.status==='pending'?'selected':''}>قيد الانتظار</option>
                    <option value="processing" ${o.status==='processing'?'selected':''}>قيد التجهيز</option>
                    <option value="delivered" ${o.status==='delivered'?'selected':''}>تم التوصيل</option>
                    <option value="cancelled" ${o.status==='cancelled'?'selected':''}>ملغي</option>
                  </select>
                  <button type="submit" class="btn-sm btn-gold" style="padding:6px 12px">حفظ</button>
                </form>
              </td>
            </tr>`).join('') || '<tr><td colspan="6" style="text-align:center;padding:40px;color:rgba(255,255,255,0.3)">لا توجد طلبات</td></tr>'}
        </tbody>
      </table>
    </div>`;
  return adminLayout('الطلبات', content, 'المدير', 'orders');
}

function renderUsersAdmin(users) {
  const content = `
    <div class="card">
      <table>
        <thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الدور</th><th>تاريخ التسجيل</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td style="font-weight:600">${u.name}</td>
              <td style="color:rgba(255,255,255,0.6)">${u.email}</td>
              <td>${u.role === 'admin' ? '<span class="badge badge-admin">مدير</span>' : '<span class="badge" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1)">عميل</span>'}</td>
              <td>${new Date(u.created_at).toLocaleDateString('ar-SA')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  return adminLayout('المستخدمون', content, 'المدير', 'users');
}

module.exports = router;
