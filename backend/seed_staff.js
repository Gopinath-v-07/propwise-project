const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const staffMembers = [
  { name: 'Ravi Kumar', email: 'ravi.electrician@propwise.test', password: 'demo123', specialty: 'Electrician', phone: '+91 98765 43210', role: 'staff' },
  { name: 'Anita Das', email: 'anita.electrician@propwise.test', password: 'demo123', specialty: 'Electrician', phone: '+91 98765 43211', role: 'staff' },
  { name: 'Vikram Singh', email: 'vikram.plumber@propwise.test', password: 'demo123', specialty: 'Plumber', phone: '+91 98765 43212', role: 'staff' },
  { name: 'Neha Patel', email: 'neha.plumber@propwise.test', password: 'demo123', specialty: 'Plumber', phone: '+91 98765 43213', role: 'staff' },
  { name: 'Arjun Mehta', email: 'arjun.carpenter@propwise.test', password: 'demo123', specialty: 'Carpenter', phone: '+91 98765 43214', role: 'staff' },
  { name: 'Kavya Rao', email: 'kavya.carpenter@propwise.test', password: 'demo123', specialty: 'Carpenter', phone: '+91 98765 43215', role: 'staff' },
];

async function seedStaff() {
  try {
    console.log(`Seeding ${staffMembers.length} staff members into PostgreSQL database...`);
    for (const s of staffMembers) {
      await pool.query(
        `INSERT INTO users (name, email, password, role) 
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (email) DO UPDATE SET name = $1, password = $3, specialty = $5, phone = $6, is_active = TRUE`,
        [s.name, s.email, s.password, s.role, s.specialty, s.phone]
      );
      console.log(`✓ Seeded staff: ${s.name} (${s.email})`);
    }
    console.log(`\nAll ${staffMembers.length} staff members seeded successfully!`);
  } catch (err) {
    console.error('Error seeding staff:', err);
  } finally {
    pool.end();
  }
}

seedStaff();
