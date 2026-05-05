const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireLogin } = require('../middleware/auth');

// GET Store homepage
router.get('/', async (req, res) => {
  try {
    const products = await db.query('SELECT p.*, c.name_ar as cat_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.is_featured DESC, p.created_at DESC');
    const categories = await db.query('SELECT * FROM categories');
    const featured = products.rows.filter(p => p.is_featured);
    res.send(renderStorePage(products.rows, categories.rows, featured, res.locals.user));
  } catch (err) {
    res.send('<h1>خطأ في تحميل المتجر</h1><p>' + err.message + '</p>');
  }
});

// GET Product details
router.get('/product/:id', async (req, res) => {
  try {
    const product = await db.query('SELECT p.*, c.name_ar as cat_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = $1', [req.params.id]);
    if (product.rows.length === 0) return res.redirect('/store');
    res.send(renderProductPage(product.rows[0], res.locals.user));
  } catch (err) {
    res.redirect('/store');
  }
});

// POST Add to cart
router.post('/cart/add', requireLogin, async (req, res) => {
  const { product_id, quantity = 1 } = req.body;
  try {
    await db.query(`
      INSERT INTO cart (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id) DO UPDATE SET quantity = cart.quantity + $3
    `, [req.session.userId, product_id, quantity]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET Cart
router.get('/cart', requireLogin, async (req, res) => {
  try {
    const items = await db.query(`
      SELECT c.id, c.quantity, p.name_ar, p.name, p.price, p.image_url, p.id as product_id
      FROM cart c JOIN products p ON c.product_id = p.id
      WHERE c.user_id = $1
    `, [req.session.userId]);
    res.send(renderCartPage(items.rows, res.locals.user));
  } catch (err) {
    res.redirect('/store');
  }
});

// POST Checkout
router.post('/checkout', requireLogin, async (req, res) => {
  const { address, phone } = req.body;
  try {
    const items = await db.query(`
      SELECT c.quantity, p.price, p.id as product_id FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = $1
    `, [req.session.userId]);
    if (items.rows.length === 0) return res.redirect('/store/cart');
    const total = items.rows.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    const order = await db.query(
      'INSERT INTO orders (user_id, total_amount, shipping_address, phone) VALUES ($1, $2, $3, $4) RETURNING id',
      [req.session.userId, total, address, phone]
    );
    const orderId = order.rows[0].id;
    for (const item of items.rows) {
      await db.query('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ($1,$2,$3,$4)',
        [orderId, item.product_id, item.quantity, item.price]);
    }
    await db.query('DELETE FROM cart WHERE user_id = $1', [req.session.userId]);
    res.redirect('/store/order-success?id=' + orderId);
  } catch (err) {
    res.redirect('/store/cart');
  }
});

router.get('/order-success', requireLogin, (req, res) => {
  res.send(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تم الطلب</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Tajawal',sans-serif;background:#0a0a0a;color:white;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center}
.box{background:rgba(255,255,255,0.05);border:1px solid rgba(201,168,76,0.3);border-radius:20px;padding:60px 40px;max-width:500px}
.icon{font-size:60px;margin-bottom:20px}.title{font-size:28px;color:#c9a84c;margin-bottom:12px}.sub{color:rgba(255,255,255,0.5);margin-bottom:30px}
.btn{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#c9a84c,#8b5e1a);color:white;text-decoration:none;border-radius:10px;font-size:16px}
</style></head><body>
<div class="box"><div class="icon">✅</div><div class="title">تم تأكيد طلبك!</div>
<div class="sub">رقم الطلب: #${req.query.id}<br>سيتم التواصل معك قريباً لتأكيد التوصيل</div>
<a href="/store" class="btn">متابعة التسوق</a></div></body></html>`);
});

function renderStorePage(products, categories, featured, user) {
  const productCards = products.map(p => `
    <div class="product-card" onclick="location.href='/store/product/${p.id}'">
      <div class="product-img">${p.image_url ? `<img src="${p.image_url}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" alt="">` : ''}<div class="img-placeholder" style="display:${p.image_url ? 'none' : 'flex'}">🌸</div></div>
      ${p.is_featured ? '<div class="badge">مميز</div>' : ''}
      <div class="product-info">
        <div class="product-brand">${p.brand || ''}</div>
        <div class="product-name">${p.name_ar || p.name}</div>
        <div class="product-meta">${p.cat_name || ''} ${p.volume_ml ? '• ' + p.volume_ml + 'ml' : ''}</div>
        <div class="product-footer">
          <div class="product-price">${Number(p.price).toFixed(0)} ر.س</div>
          <button class="add-btn" onclick="event.stopPropagation();addToCart(${p.id})">+ سلة</button>
        </div>
      </div>
    </div>`).join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>عطور الفاخرة - المتجر</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --gold: #c9a84c; --dark-gold: #8b5e1a; --bg: #0a0a0a; --card: rgba(255,255,255,0.04); }
body { font-family: 'Tajawal', sans-serif; background: var(--bg); color: white; min-height: 100vh; }

/* NAV */
nav { background: rgba(10,10,10,0.95); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(201,168,76,0.15); padding: 0 40px; height: 70px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; }
.nav-brand { font-size: 22px; font-weight: 900; color: var(--gold); display: flex; align-items: center; gap: 10px; }
.nav-links { display: flex; gap: 20px; align-items: center; }
.nav-links a { color: rgba(255,255,255,0.7); text-decoration: none; font-size: 14px; transition: color 0.2s; }
.nav-links a:hover { color: var(--gold); }
.cart-btn { background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3); color: var(--gold); padding: 8px 18px; border-radius: 20px; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 14px; transition: all 0.2s; text-decoration: none; }
.cart-btn:hover { background: rgba(201,168,76,0.2); }

/* HERO */
.hero { padding: 100px 40px; text-align: center; position: relative; overflow: hidden; }
.hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at center, rgba(201,168,76,0.08) 0%, transparent 70%); }
.hero-tag { display: inline-block; background: rgba(201,168,76,0.1); border: 1px solid rgba(201,168,76,0.3); color: var(--gold); padding: 6px 20px; border-radius: 20px; font-size: 13px; margin-bottom: 24px; }
.hero h1 { font-size: clamp(36px, 6vw, 72px); font-weight: 900; line-height: 1.1; margin-bottom: 20px; background: linear-gradient(135deg, #fff 0%, #c9a84c 50%, #8b5e1a 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.hero p { font-size: 18px; color: rgba(255,255,255,0.5); max-width: 500px; margin: 0 auto; }

/* CATEGORIES */
.section { padding: 60px 40px; }
.section-title { font-size: 24px; font-weight: 700; margin-bottom: 30px; display: flex; align-items: center; gap: 12px; }
.section-title::after { content: ''; flex: 1; height: 1px; background: rgba(201,168,76,0.2); }
.cats { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; }
.cat-chip { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); padding: 10px 22px; border-radius: 25px; cursor: pointer; white-space: nowrap; font-family: 'Tajawal', sans-serif; font-size: 14px; color: rgba(255,255,255,0.7); transition: all 0.2s; }
.cat-chip:hover, .cat-chip.active { background: rgba(201,168,76,0.15); border-color: var(--gold); color: var(--gold); }

/* PRODUCTS GRID */
.products-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
.product-card { background: var(--card); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; overflow: hidden; cursor: pointer; transition: all 0.3s; position: relative; }
.product-card:hover { transform: translateY(-6px); border-color: rgba(201,168,76,0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
.product-img { height: 200px; background: rgba(255,255,255,0.03); position: relative; overflow: hidden; }
.product-img img { width: 100%; height: 100%; object-fit: cover; }
.img-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 60px; background: linear-gradient(135deg, rgba(201,168,76,0.05), rgba(139,94,26,0.1)); }
.badge { position: absolute; top: 10px; right: 10px; background: linear-gradient(135deg, #c9a84c, #8b5e1a); color: white; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.product-info { padding: 16px; }
.product-brand { font-size: 11px; color: var(--gold); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
.product-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
.product-meta { font-size: 12px; color: rgba(255,255,255,0.4); margin-bottom: 14px; }
.product-footer { display: flex; align-items: center; justify-content: space-between; }
.product-price { font-size: 20px; font-weight: 700; color: var(--gold); }
.add-btn { background: linear-gradient(135deg, #c9a84c, #8b5e1a); border: none; color: white; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Tajawal', sans-serif; font-size: 13px; font-weight: 600; transition: all 0.2s; }
.add-btn:hover { opacity: 0.85; transform: scale(1.05); }

/* TOAST */
.toast { position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); background: rgba(30,30,30,0.95); border: 1px solid rgba(201,168,76,0.4); color: white; padding: 14px 28px; border-radius: 30px; font-size: 15px; transition: all 0.4s; z-index: 999; white-space: nowrap; }
.toast.show { transform: translateX(-50%) translateY(0); }

footer { border-top: 1px solid rgba(255,255,255,0.05); padding: 40px; text-align: center; color: rgba(255,255,255,0.3); font-size: 14px; }
</style>
</head>
<body>
<nav>
  <div class="nav-brand">🌸 عطور الفاخرة</div>
  <div class="nav-links">
    ${user ? `<span>مرحباً، ${user.name}</span>` : ''}
    ${user ? `<a href="/store/cart" class="cart-btn">🛒 السلة</a>` : '<a href="/auth/login" class="cart-btn">تسجيل الدخول</a>'}
    ${user?.role === 'admin' ? '<a href="/admin/dashboard" class="cart-btn">لوحة التحكم</a>' : ''}
    ${user ? '<a href="/auth/logout">خروج</a>' : ''}
  </div>
</nav>

<div class="hero">
  <div class="hero-tag">✨ عطور فاخرة أصيلة</div>
  <h1>اكتشف عالم<br>العطور الراقية</h1>
  <p>مجموعة مختارة من أفخر العطور العالمية والشرقية</p>
</div>

<div class="section">
  <div class="section-title">التصنيفات</div>
  <div class="cats">
    <button class="cat-chip active" onclick="filterCat('all', this)">الكل</button>
    ${categories.map(c => `<button class="cat-chip" onclick="filterCat('${c.id}', this)" data-cat="${c.id}">${c.name_ar}</button>`).join('')}
  </div>
</div>

<div class="section" style="padding-top:0">
  <div class="section-title">المنتجات</div>
  <div class="products-grid" id="products-grid">
    ${productCards}
  </div>
</div>

<footer>جميع الحقوق محفوظة © عطور الفاخرة 2024</footer>
<div class="toast" id="toast"></div>

<script>
const allProducts = ${JSON.stringify(products)};
function filterCat(catId, el) {
  document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  const grid = document.getElementById('products-grid');
  const filtered = catId === 'all' ? allProducts : allProducts.filter(p => p.category_id == catId);
  grid.innerHTML = filtered.map(p => \`
    <div class="product-card" onclick="location.href='/store/product/\${p.id}'">
      <div class="product-img"><div class="img-placeholder">🌸</div></div>
      \${p.is_featured ? '<div class="badge">مميز</div>' : ''}
      <div class="product-info">
        <div class="product-brand">\${p.brand || ''}</div>
        <div class="product-name">\${p.name_ar || p.name}</div>
        <div class="product-meta">\${p.cat_name || ''} \${p.volume_ml ? '• ' + p.volume_ml + 'ml' : ''}</div>
        <div class="product-footer">
          <div class="product-price">\${Number(p.price).toFixed(0)} ر.س</div>
          <button class="add-btn" onclick="event.stopPropagation();addToCart(\${p.id})">+ سلة</button>
        </div>
      </div>
    </div>\`).join('');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function addToCart(id) {
  ${user ? `
  const r = await fetch('/store/cart/add', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:id,quantity:1})});
  const data = await r.json();
  if(data.success) showToast('✅ تم الإضافة إلى السلة');
  else showToast('❌ حدث خطأ');
  ` : `showToast('يرجى تسجيل الدخول أولاً'); setTimeout(()=>location.href='/auth/login',1500);`}
}
</script>
</body>
</html>`;
}

function renderProductPage(p, user) {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${p.name_ar || p.name} - عطور الفاخرة</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}:root{--gold:#c9a84c;--dark-gold:#8b5e1a}
body{font-family:'Tajawal',sans-serif;background:#0a0a0a;color:white;min-height:100vh}
nav{background:rgba(10,10,10,0.95);backdrop-filter:blur(20px);border-bottom:1px solid rgba(201,168,76,0.15);padding:0 40px;height:70px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.nav-brand{font-size:22px;font-weight:900;color:var(--gold);text-decoration:none}
.nav-links{display:flex;gap:20px;align-items:center}.nav-links a{color:rgba(255,255,255,0.7);text-decoration:none;font-size:14px}
.back-btn{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:white;padding:8px 18px;border-radius:20px;cursor:pointer;font-family:'Tajawal',sans-serif;font-size:14px;text-decoration:none}
.product-detail{max-width:1000px;margin:60px auto;padding:0 40px;display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}
.product-image{background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:24px;height:400px;display:flex;align-items:center;justify-content:center;font-size:100px}
.product-brand{font-size:13px;color:var(--gold);text-transform:uppercase;letter-spacing:2px;margin-bottom:12px}
.product-name{font-size:36px;font-weight:900;margin-bottom:16px;line-height:1.2}
.product-desc{color:rgba(255,255,255,0.6);font-size:16px;line-height:1.8;margin-bottom:30px}
.product-tags{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:30px}
.tag{background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.2);color:rgba(255,255,255,0.7);padding:6px 16px;border-radius:20px;font-size:13px}
.product-price{font-size:42px;font-weight:900;color:var(--gold);margin-bottom:8px}
.price-label{color:rgba(255,255,255,0.4);font-size:14px;margin-bottom:30px}
.buy-btn{width:100%;padding:18px;background:linear-gradient(135deg,#c9a84c,#8b5e1a);border:none;color:white;font-size:18px;font-weight:700;font-family:'Tajawal',sans-serif;border-radius:14px;cursor:pointer;transition:all 0.3s;margin-bottom:12px}
.buy-btn:hover{transform:translateY(-2px);box-shadow:0 15px 40px rgba(201,168,76,0.3)}
.stock{color:${p.stock > 0 ? '#5de084' : '#ff6b6b'};font-size:14px;margin-bottom:20px}
.toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(100px);background:rgba(30,30,30,0.95);border:1px solid rgba(201,168,76,0.4);color:white;padding:14px 28px;border-radius:30px;font-size:15px;transition:all 0.4s;z-index:999}
.toast.show{transform:translateX(-50%) translateY(0)}
@media(max-width:700px){.product-detail{grid-template-columns:1fr;gap:30px}.product-image{height:250px}}
</style>
</head>
<body>
<nav>
  <a href="/store" class="nav-brand">🌸 عطور الفاخرة</a>
  <div class="nav-links">
    <a href="/store" class="back-btn">← العودة للمتجر</a>
    ${user ? `<a href="/store/cart">🛒 السلة</a>` : '<a href="/auth/login">دخول</a>'}
  </div>
</nav>
<div class="product-detail">
  <div class="product-image">🌸</div>
  <div>
    <div class="product-brand">${p.brand || ''}</div>
    <h1 class="product-name">${p.name_ar || p.name}</h1>
    <p class="product-desc">${p.description || 'عطر فاخر من أرقى المنتجات العطرية'}</p>
    <div class="product-tags">
      ${p.cat_name ? `<span class="tag">🏷️ ${p.cat_name}</span>` : ''}
      ${p.volume_ml ? `<span class="tag">💧 ${p.volume_ml}ml</span>` : ''}
      ${p.is_featured ? `<span class="tag">⭐ مميز</span>` : ''}
    </div>
    <div class="product-price">${Number(p.price).toFixed(0)} ر.س</div>
    <div class="price-label">السعر شامل الضريبة</div>
    <div class="stock">${p.stock > 0 ? `✅ متوفر (${p.stock} قطعة)` : '❌ غير متوفر'}</div>
    ${p.stock > 0 ? `<button class="buy-btn" onclick="addToCart(${p.id})">🛒 إضافة إلى السلة</button>` : ''}
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2500);}
async function addToCart(id){
  ${user ? `const r=await fetch('/store/cart/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:id,quantity:1})});const d=await r.json();if(d.success)showToast('✅ تم الإضافة إلى السلة');else showToast('❌ حدث خطأ');` : `showToast('يرجى تسجيل الدخول');setTimeout(()=>location.href='/auth/login',1500);`}
}
</script>
</body>
</html>`;
}

function renderCartPage(items, user) {
  const total = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"><title>سلة التسوق</title>
<link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Tajawal',sans-serif;background:#0a0a0a;color:white;min-height:100vh}
nav{background:rgba(10,10,10,0.95);border-bottom:1px solid rgba(201,168,76,0.15);padding:0 40px;height:70px;display:flex;align-items:center;justify-content:space-between}
.nav-brand{font-size:22px;font-weight:900;color:#c9a84c;text-decoration:none}
.container{max-width:800px;margin:40px auto;padding:0 40px}
h1{font-size:30px;font-weight:900;margin-bottom:30px;color:#c9a84c}
.cart-item{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:20px}
.item-info h3{font-size:18px;margin-bottom:4px}.item-info p{color:rgba(255,255,255,0.5);font-size:14px}
.item-price{font-size:20px;font-weight:700;color:#c9a84c}
.summary{background:rgba(201,168,76,0.06);border:1px solid rgba(201,168,76,0.2);border-radius:16px;padding:30px;margin-top:30px}
.summary h2{font-size:22px;margin-bottom:20px}
.total-row{display:flex;justify-content:space-between;margin-bottom:12px;font-size:16px}
.total-price{font-size:30px;font-weight:900;color:#c9a84c}
input,textarea{width:100%;padding:12px 16px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:white;font-family:'Tajawal',sans-serif;font-size:15px;margin-bottom:12px;outline:none}
input:focus,textarea:focus{border-color:#c9a84c}
.btn{width:100%;padding:16px;background:linear-gradient(135deg,#c9a84c,#8b5e1a);border:none;color:white;font-size:18px;font-weight:700;font-family:'Tajawal',sans-serif;border-radius:12px;cursor:pointer;margin-top:8px}
.empty{text-align:center;padding:80px;color:rgba(255,255,255,0.4);font-size:18px}
.back{color:#c9a84c;text-decoration:none;font-size:14px}
</style>
</head>
<body>
<nav>
  <a href="/store" class="nav-brand">🌸 عطور الفاخرة</a>
  <a href="/store" style="color:rgba(255,255,255,0.6);text-decoration:none;font-size:14px">← العودة للمتجر</a>
</nav>
<div class="container">
  <h1>🛒 سلة التسوق</h1>
  ${items.length === 0 ? '<div class="empty">السلة فارغة<br><br><a href="/store" class="back">تصفح المنتجات</a></div>' : `
    ${items.map(i => `
      <div class="cart-item">
        <div style="font-size:40px">🌸</div>
        <div class="item-info" style="flex:1">
          <h3>${i.name_ar || i.name}</h3>
          <p>الكمية: ${i.quantity}</p>
        </div>
        <div class="item-price">${(i.price * i.quantity).toFixed(0)} ر.س</div>
      </div>`).join('')}
    <div class="summary">
      <h2>ملخص الطلب</h2>
      <div class="total-row"><span>المجموع</span><span class="total-price">${total.toFixed(0)} ر.س</span></div>
      <hr style="border-color:rgba(255,255,255,0.1);margin:20px 0">
      <h3 style="margin-bottom:16px">بيانات التوصيل</h3>
      <form method="POST" action="/store/checkout">
        <input type="text" name="phone" placeholder="رقم الجوال" required>
        <textarea name="address" placeholder="عنوان التوصيل التفصيلي" rows="3" required></textarea>
        <button type="submit" class="btn">تأكيد الطلب ✓</button>
      </form>
    </div>
  `}
</div>
</body>
</html>`;
}

module.exports = router;
