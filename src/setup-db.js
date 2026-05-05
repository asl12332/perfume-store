require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function setupDatabase() {
  console.log('🔧 جاري إنشاء قاعدة البيانات...');
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Categories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100),
        description TEXT,
        image_url VARCHAR(255)
      );
    `);

    // Products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(150) NOT NULL,
        name_ar VARCHAR(150),
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        stock INTEGER DEFAULT 0,
        category_id INTEGER REFERENCES categories(id),
        image_url VARCHAR(255),
        brand VARCHAR(100),
        volume_ml INTEGER,
        is_featured BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Orders table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        total_amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        shipping_address TEXT,
        phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // Order items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER REFERENCES orders(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER NOT NULL,
        price DECIMAL(10,2) NOT NULL
      );
    `);

    // Cart table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cart (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        product_id INTEGER REFERENCES products(id),
        quantity INTEGER DEFAULT 1,
        UNIQUE(user_id, product_id)
      );
    `);

    console.log('✅ تم إنشاء الجداول بنجاح');

    // Insert admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await pool.query(`
      INSERT INTO users (name, email, password, role)
      VALUES ('المدير', 'admin@perfume.com', $1, 'admin')
      ON CONFLICT (email) DO NOTHING;
    `, [hashedPassword]);

    // Insert categories
    await pool.query(`
      INSERT INTO categories (name, name_ar, description) VALUES
      ('Men', 'رجالي', 'عطور رجالية فاخرة'),
      ('Women', 'نسائي', 'عطور نسائية رقيقة'),
      ('Unisex', 'للجنسين', 'عطور مشتركة'),
      ('Oud', 'عود', 'عطور العود الأصيلة')
      ON CONFLICT DO NOTHING;
    `);

    // Insert sample products
    await pool.query(`
      INSERT INTO products (name, name_ar, description, price, stock, category_id, brand, volume_ml, is_featured, image_url) VALUES
      ('Royal Oud', 'رويال عود', 'عطر عود ملكي فاخر بنكهة شرقية أصيلة', 450.00, 50, 4, 'Arabian Oud', 100, true, '/images/oud1.jpg'),
      ('Rose Noir', 'روز نوار', 'عطر ورد أسود غامض وساحر', 320.00, 30, 2, 'Maison', 75, true, '/images/rose1.jpg'),
      ('Blue Ocean', 'بلو أوشن', 'عطر أزرق منعش للرجل العصري', 280.00, 45, 1, 'Azzaro', 100, false, '/images/blue1.jpg'),
      ('Saffron Dreams', 'أحلام الزعفران', 'مزيج الزعفران والعنبر الشرقي', 520.00, 20, 3, 'Lattafa', 100, true, '/images/saffron1.jpg'),
      ('Jasmine Night', 'ليلة الياسمين', 'عبق الياسمين في ليالي الصيف', 290.00, 35, 2, 'Chanel', 50, false, '/images/jasmine1.jpg'),
      ('Desert Rose', 'وردة الصحراء', 'رائحة الورد في قلب الصحراء', 380.00, 25, 3, 'Amouage', 100, true, '/images/desert1.jpg')
      ON CONFLICT DO NOTHING;
    `);

    console.log('✅ تم إضافة البيانات التجريبية');
    console.log('\n📋 بيانات الدخول:');
    console.log('   الإدارة: admin@perfume.com / admin123');
    console.log('\n🚀 شغّل المتجر: npm run dev');

  } catch (err) {
    console.error('❌ خطأ:', err.message);
  } finally {
    await pool.end();
  }
}

setupDatabase();
