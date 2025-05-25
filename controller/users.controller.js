const {pool} = require('../db');

// Create User
exports.createUser = async (req, res) => {
  const {
    name, email, password_hash, role_id, phone, countryCode, dialCode,
    employeeId, employeeType, fcmToken, gender, imageUrl, departmentId,
    designation, ReportingManagerId, CrossReportingManagerId, addharcard,
    pancard, otherDocument
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO users (
        name, email, password_hash, role_id, phone, countryCode, dialCode,
        employeeId, employeeType, fcmToken, gender, imageUrl, departmentId,
        designation, reportingManagerId, crossReportingManagerId, addharcard,
        pancard, otherDocument
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,$19
      ) RETURNING *`,
      [
        name, email, password_hash, role_id, phone, countryCode, dialCode,
        employeeId, employeeType, fcmToken, gender, imageUrl, departmentId,
        designation, ReportingManagerId, CrossReportingManagerId, addharcard,
        pancard, otherDocument
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Create User Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get All Users
exports.getAllUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error('Get All Users Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get Single User
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get User Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Update User
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const fields = Object.entries(req.body);
  const setString = fields.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
  const values = fields.map(([, value]) => value);

  try {
    const result = await pool.query(
      `UPDATE users SET ${setString} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update User Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete User
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
