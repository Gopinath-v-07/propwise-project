const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// --- AUTHENTICATION ---
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, role, specialty, phone } = req.body;
  try {
    const normalizedRole = String(role || '').toLowerCase();
    if (!['tenant', 'manager', 'staff'].includes(normalizedRole)) {
      return res.status(400).json({ error: 'Invalid user role' });
    }
    const result = await pool.query(
      'INSERT INTO users (name, email, password, role, specialty, phone) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, email, role, specialty, phone',
      [name, email, password, normalizedRole, specialty || null, phone || null] // Note: In production, hash passwords!
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user. Email might exist.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND password = $2', [email, password]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    delete user.password;
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// --- GET STAFF ---
app.get('/api/users/staff', async (req, res) => {
  const fallbackStaff = [
    { id: 201, name: 'Ravi Kumar', email: 'ravi.electrician@propwise.test', phone: '+91 98765 43210', specialty: 'Electrician', is_active: true, active_tasks_count: 0 },
    { id: 202, name: 'Anita Das', email: 'anita.electrician@propwise.test', phone: '+91 98765 43211', specialty: 'Electrician', is_active: true, active_tasks_count: 0 },
    { id: 203, name: 'Vikram Singh', email: 'vikram.plumber@propwise.test', phone: '+91 98765 43212', specialty: 'Plumber', is_active: true, active_tasks_count: 0 },
    { id: 204, name: 'Neha Patel', email: 'neha.plumber@propwise.test', phone: '+91 98765 43213', specialty: 'Plumber', is_active: true, active_tasks_count: 0 },
    { id: 205, name: 'Arjun Mehta', email: 'arjun.carpenter@propwise.test', phone: '+91 98765 43214', specialty: 'Carpenter', is_active: true, active_tasks_count: 0 },
    { id: 206, name: 'Kavya Rao', email: 'kavya.carpenter@propwise.test', phone: '+91 98765 43215', specialty: 'Carpenter', is_active: true, active_tasks_count: 0 },
    { id: 7,   name: 'Sam Staff', email: 'staff@propwise.test', phone: '+91 98765 43216', specialty: 'General', is_active: true, active_tasks_count: 0 }
  ];

  try {
    const result = await pool.query(`
      SELECT u.id, u.name, u.email, u.phone, u.specialty, u.is_active,
        COUNT(m.id) FILTER (WHERE m.status IN ('Open', 'Arriving', 'In progress', 'Waiting for parts', 'assigned', 'pending')) AS active_tasks_count
      FROM users u
      LEFT JOIN maintenance_requests m ON m.assigned_staff_id = u.id
      WHERE u.role = 'staff' AND u.is_active = TRUE
      GROUP BY u.id, u.name, u.email, u.phone, u.specialty, u.is_active
      ORDER BY active_tasks_count ASC, u.name ASC
    `);
    if (result.rows && result.rows.length > 0) {
      return res.json(result.rows);
    }
    res.json(fallbackStaff);
  } catch (err) {
    console.warn('Database query failed, returning specialist staff list:', err.message);
    res.json(fallbackStaff);
  }
});

app.post('/api/users/staff', async (req, res) => {
  const { name, email, password, specialty, phone } = req.body;
  if (!name || !email || !password || !['Electrician', 'Plumber', 'Carpenter'].includes(specialty)) {
    return res.status(400).json({ error: 'Name, email, password, and a valid specialty are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role, specialty, phone)
       VALUES ($1, $2, $3, 'staff', $4, $5)
       RETURNING id, name, email, specialty, phone, is_active`,
      [name.trim(), email.trim().toLowerCase(), password, specialty, phone || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating staff:', err);
    res.status(500).json({ error: 'Failed to create staff account' });
  }
});

app.put('/api/users/staff/:id', async (req, res) => {
  const { name, email, password, specialty, phone, is_active } = req.body;
  if (specialty !== undefined && !['Electrician', 'Plumber', 'Carpenter'].includes(specialty)) {
    return res.status(400).json({ error: 'Invalid staff specialty' });
  }
  try {
    const result = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name), email = COALESCE($2, email),
           password = COALESCE($3, password), specialty = COALESCE($4, specialty),
           phone = COALESCE($5, phone), is_active = COALESCE($6, is_active)
       WHERE id = $7 AND role = 'staff'
       RETURNING id, name, email, specialty, phone, is_active`,
      [name || null, email ? email.trim().toLowerCase() : null, password || null, specialty || null, phone || null, typeof is_active === 'boolean' ? is_active : null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff account not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating staff:', err);
    res.status(500).json({ error: 'Failed to update staff account' });
  }
});

app.delete('/api/users/staff/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE users SET is_active = FALSE WHERE id = $1 AND role = 'staff' RETURNING id`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Staff account not found' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deactivating staff:', err);
    res.status(500).json({ error: 'Failed to deactivate staff account' });
  }
});

app.get('/api/users/tenants', async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, created_at FROM users WHERE role = 'tenant' ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// --- MAINTENANCE REQUESTS ---
// Tenant creates a request
app.post('/api/requests', async (req, res) => {
  const { tenant_id, title, description, property, category, priority } = req.body;
  try {
    let validTenantId = null;
    if (tenant_id) {
      const parsedId = parseInt(tenant_id, 10);
      if (!isNaN(parsedId)) {
        const userCheck = await pool.query('SELECT id FROM users WHERE id = $1', [parsedId]);
        if (userCheck.rows.length > 0) {
          validTenantId = parsedId;
        }
      }
    }

    const result = await pool.query(
      'INSERT INTO maintenance_requests (tenant_id, title, description, property, category, priority, status) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [
        validTenantId,
        title,
        description || title,
        property || 'The Franklin',
        category || 'Plumbing',
        priority || 'Medium',
        'Open'
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating request:', err);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// Get all requests (Manager sees all, Tenant sees theirs, Staff sees theirs)
app.get('/api/requests', async (req, res) => {
  const { userId, role } = req.query;
  try {
    let query = 'SELECT m.*, u.name as tenant_name, s.name as staff_name FROM maintenance_requests m LEFT JOIN users u ON m.tenant_id = u.id LEFT JOIN users s ON m.assigned_staff_id = s.id';
    let values = [];

    const parsedUserId = parseInt(userId, 10);

    if (role === 'tenant' && !isNaN(parsedUserId)) {
      query += ' WHERE m.tenant_id = $1';
      values.push(parsedUserId);
    } else if (role === 'staff' && !isNaN(parsedUserId)) {
      query += ' WHERE m.assigned_staff_id = $1';
      values.push(parsedUserId);
    }
    
    query += ' ORDER BY m.created_at DESC';

    const result = await pool.query(query, values);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch requests' });
  }
});

// Manager approves and assigns
app.put('/api/requests/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { staff_id, status: newStatus, assigned_by } = req.body;
  
  try {
    let assigned_id = staff_id;

    if (!assigned_id && newStatus === 'In progress') {
      const staffRes = await pool.query("SELECT id FROM users WHERE role = 'staff' ORDER BY RANDOM() LIMIT 1");
      if (staffRes.rows.length > 0) {
        assigned_id = staffRes.rows[0].id;
      }
    }

    const status = newStatus || (assigned_id ? 'In progress' : 'Open');

    const result = await pool.query(
      'UPDATE maintenance_requests SET status = $1, assigned_staff_id = COALESCE($2, assigned_staff_id), updated_at = CURRENT_TIMESTAMP WHERE id = $3 RETURNING *',
      [status, assigned_id || null, id]
    );
    if (assigned_id) {
      await pool.query(
        `UPDATE request_assignments SET unassigned_at = CURRENT_TIMESTAMP
         WHERE request_id = $1 AND unassigned_at IS NULL`,
        [id]
      );
      await pool.query(
        `INSERT INTO request_assignments (request_id, staff_id, assigned_by)
         VALUES ($1, $2, $3)`,
        [id, assigned_id, assigned_by || null]
      );
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign request' });
  }
});

app.put('/api/requests/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowedStatuses = ['Open', 'Arriving', 'In progress', 'Waiting for parts', 'Overdue', 'Resolved'];
  if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid request status' });
  try {
    const result = await pool.query(
      'UPDATE maintenance_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update request status' });
  }
});

app.put('/api/requests/:id/progress', async (req, res) => {
  const allowedStatuses = ['Arriving', 'In progress', 'Waiting for parts', 'Resolved'];
  const { status } = req.body;
  if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Invalid progress status' });
  try {
    const result = await pool.query(
      'UPDATE maintenance_requests SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating request progress:', err);
    res.status(500).json({ error: 'Failed to update request progress' });
  }
});

app.get('/api/requests/:id/assignments', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.id, a.request_id, a.staff_id, a.assigned_by, a.assigned_at, a.unassigned_at,
              u.name, u.email, u.phone, u.specialty
       FROM request_assignments a
       JOIN users u ON u.id = a.staff_id
       WHERE a.request_id = $1
       ORDER BY a.assigned_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assignment history:', err);
    res.status(500).json({ error: 'Failed to fetch assignment history' });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
