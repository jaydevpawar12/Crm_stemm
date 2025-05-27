// const { initializePool } = require('../db');
const { pool } = require('../db');

// Create User

exports.createUser = async (req, res) => {
  const {
    name, email, password_hash, role_id, phone, countryCode, dialCode,
    employeeId, employeeType, fcmToken, gender, imageUrl, departmentId,
    designation, reportingmanagerid, crossreportingmanagerid, addharcard,
    pancard, otherdocument
  } = req.body;

  if (!name || !email || !password_hash) {
    return res.status(400).json({ error: 'Name, email, and password_hash are required' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate reportingmanagerid
      if (reportingmanagerid) {
        const managerCheck = await client.query(
          'SELECT 1 FROM users WHERE id = $1',
          [reportingmanagerid]
        );
        if (managerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid reportingmanagerid: User does not exist' });
        }
      }

      // Validate crossreportingmanagerid
      if (crossreportingmanagerid) {
        const crossManagerCheck = await client.query(
          'SELECT 1 FROM users WHERE id = $1',
          [crossreportingmanagerid]
        );
        if (crossManagerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid crossreportingmanagerid: User does not exist' });
        }
      }

      const result = await client.query(
        `INSERT INTO users (
          name, email, password_hash, role_id, phone, countrycode, dialcode,
          employeeid, employeetype, fcmtoken, gender, imageurl, departmentid,
          designation, reportingmanagerid, crossreportingmanagerid, addharcard,
          pancard, otherdocument
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING *`,
        [
          name, email, password_hash, role_id, phone, countryCode, dialCode,
          employeeId, employeeType, fcmToken, gender, imageUrl, departmentId,
           designation, reportingmanagerid, crossreportingmanagerid, addharcard, pancard, otherdocument
        ]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create user error:', err);
    if (err.code === '23503') { // Foreign key violation
      return res.status(400).json({ error: 'Invalid foreign key value' });
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Get All Users
// exports.getAllUsers = async (req, res) => {
//   try {
//     const client = await pool.connect();
//     try {
//       const result = await client.query(`
//         SELECT 
//           u1.*,
//           u2.name AS reportingmanagername,
//           u3.name AS crossreportingmanagername
//         FROM users u1
//         LEFT JOIN users u2 ON u1.reportingmanagerid = u2.id
//         LEFT JOIN users u3 ON u1.crossreportingmanagerid = u3.id
//       `);
//       const users = result.rows;
//       const totalCount = users.length;
//       res.status(200).json({
//         success: true,
//         data: { users, totalCount },
//         message: "Fetch successfully"
//       });
//     } finally {
//       client.release();
//     }
//   } catch (err) {
//     console.error('Get All Users Error:', err);
//     res.status(500).json({ error: 'Internal Server Error' });
//   }
// };

exports.getAllUsers = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Extract query parameters
      const { reportingmanagerid, departmentid } = req.query;

      // Validate reportingmanagerid format
      // const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      // if (reportingmanagerid && !uuidRegex.test(reportingmanagerid)) {
      //   return res.status(400).json({ error: 'Invalid reportingmanagerid format: Must be a valid UUID' });
      // }

      // Base query
      let query = `
        SELECT 
          u1.*,
          u2.name AS reportingmanagername,
          u3.name AS crossreportingmanagername
        FROM users u1
        LEFT JOIN users u2 ON u1.reportingmanagerid = u2.id
        LEFT JOIN users u3 ON u1.crossreportingmanagerid = u3.id
        WHERE 1=1
      `;

      // Array to hold query parameters
      const queryParams = [];
      let paramIndex = 1;

      // Add filter for reportingmanagerid if provided
      if (reportingmanagerid) {
        query += ` AND (u1.reportingmanagerid = $${paramIndex} OR u1.crossreportingmanagerid = $${paramIndex})`;
        queryParams.push(reportingmanagerid);
        paramIndex++;
      }

      // Add filter for departmentid if provided
      if (departmentid) {
        query += ` AND u1.departmentid = $${paramIndex}`;
        queryParams.push(departmentid);
        paramIndex++;
      }

      // Execute the query
      const result = await client.query(query, queryParams);
      const users = result.rows;
      const totalCount = users.length;

      res.status(200).json({
        success: true,
        data: { users, totalCount },
        message: "Fetch successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get All Users Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



exports.getAllReportingManagers = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT u.*, r.name as role_name FROM users u INNER JOIN roles r ON r.id = u.role_id WHERE r.name IN ($1, $2)',
      ['Admin', 'Manager']
    );

    const managers = result.rows;

    if (managers.length === 0) {
      return res.json({
        success: false,
        data: [],
        message: "Reporting Managers not found"
      });
    }

    return res.json({
      success: true,
      data: managers,
      message: "All Managers fetched successfully"
    });
  } catch (error) {
    console.error('GetAllReportingManagers Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Get Single User
exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
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
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE users SET ${setString} WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update User Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// Delete User
exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      res.json({ message: 'User deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};