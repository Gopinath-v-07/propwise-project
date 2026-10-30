const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function setupDatabase() {
  try {
    console.log('Creating tables...');

    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('tenant', 'manager', 'staff')),
        specialty VARCHAR(50),
        phone VARCHAR(30),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
    `);

    // Maintenance requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER REFERENCES users(id),
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        property VARCHAR(100) DEFAULT 'The Franklin',
        category VARCHAR(50) DEFAULT 'Plumbing',
        priority VARCHAR(20) DEFAULT 'Medium',
        status VARCHAR(20) DEFAULT 'Open',
        assigned_staff_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS property VARCHAR(100) DEFAULT 'The Franklin';
      ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'Plumbing';
      ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium';
      ALTER TABLE maintenance_requests DROP CONSTRAINT IF EXISTS maintenance_requests_status_check;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS request_assignments (
        id SERIAL PRIMARY KEY,
        request_id INTEGER NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
        staff_id INTEGER NOT NULL REFERENCES users(id),
        assigned_by INTEGER REFERENCES users(id),
        assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        unassigned_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS request_assignments_request_idx ON request_assignments(request_id);
      CREATE INDEX IF NOT EXISTS request_assignments_staff_idx ON request_assignments(staff_id);
    `);

    console.log('Tables created successfully!');
  } catch (err) {
    console.error('Error creating tables:', err);
  } finally {
    pool.end();
  }
}

setupDatabase();
