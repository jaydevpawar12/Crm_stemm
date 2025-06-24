const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

exports.createUser = async (req, res) => {
  const {
    id, name, email, role_id, phone, countrycode, dialcode,
    employeeid, employeetype, fcmtoken, gender, imageurl, departmentid,
    designation, reportingmanagerid, crossreportingmanagerid, addharcard,
    pancard, otherdocument, secretkey, isnewuser = true, emailverify = false,
    isuserdisabled = false, webaccess = true, mobileaccess = true,
    deviceid, devicename, companyid, companyname
  } = req.body;

  // Validate required fields
  if (!id) return res.status(400).json({ error: 'User ID is required' });
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid user ID: Must be a valid UUID' });
  if (role_id && !isUUID(role_id)) return res.status(400).json({ error: 'Invalid role_id: Must be a valid UUID' });
  if (reportingmanagerid && !isUUID(reportingmanagerid)) return res.status(400).json({ error: 'Invalid reportingmanagerid: Must be a valid UUID' });
  if (crossreportingmanagerid && !isUUID(crossreportingmanagerid)) return res.status(400).json({ error: 'Invalid crossreportingmanagerid: Must be a valid UUID' });
  if (departmentid && !isUUID(departmentid)) return res.status(400).json({ error: 'Invalid departmentid: Must be a valid UUID' });

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  // Validate other fields
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  if (countrycode && !/^[A-Z]{2}$/.test(countrycode)) return res.status(400).json({ error: 'Invalid country code: Must be 2-letter ISO code' });
  if (dialcode && !/^\+\d{1,4}$/.test(dialcode)) return res.status(400).json({ error: 'Invalid dial code: Must start with + followed by 1-4 digits' });
  if (employeetype && !['office', 'field'].includes(employeetype)) return res.status(400).json({ error: 'Invalid employeetype: Must be office or field' });

  try {
    const client = await pool.connect();
    try {
      // Validate reportingmanagerid
      if (reportingmanagerid) {
        const managerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [reportingmanagerid]);
        if (managerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid reportingmanagerid: User does not exist' });
        }
      }

      // Validate crossreportingmanagerid
      if (crossreportingmanagerid) {
        const crossManagerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [crossreportingmanagerid]);
        if (crossManagerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid crossreportingmanagerid: User does not exist' });
        }
      }

      // Validate role_id exists in roles table
      if (role_id) {
        const roleCheck = await client.query('SELECT 1 FROM roles WHERE id = $1', [role_id]);
        if (roleCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid role_id: Role does not exist' });
        }
      }

      // Validate departmentid exists in departments table
      if (departmentid) {
        const deptCheck = await client.query('SELECT 1 FROM departments WHERE id = $1', [departmentid]);
        if (deptCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid departmentid: Department does not exist' });
        }
      }

      const result = await client.query(
        `INSERT INTO users (
          id, name, email, role_id, phone, countrycode, dialcode,
          employeeid, employeetype, fcmtoken, gender, imageurl, departmentid,
          designation, reportingmanagerid, crossreportingmanagerid, addharcard,
          pancard, otherdocument, secretkey, isnewuser, emailverify, isuserdisabled,
          webaccess, mobileaccess, deviceid, devicename, companyid, companyname   
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 
          $9, $10, $11, $12, $13, $14, 
          $15, $16, $17, $18, $19, $20,
          $21, $22, $23, $24, $25, $26, $27, $28, $29
        )
        RETURNING *`,
        [
          id, name, email, role_id, phone, countrycode, dialcode,
          employeeid, employeetype, fcmtoken, gender, imageurl, departmentid,
          designation, reportingmanagerid, crossreportingmanagerid, addharcard,
          pancard, otherdocument, secretkey, isnewuser, emailverify, isuserdisabled,
          webaccess, mobileaccess, deviceid, devicename, companyid, companyname
        ]
      );

      // const users = result.rows;
      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: "Fetched successfully"
      });
    } catch (err) {
      console.error('Create user error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation (e.g., duplicate email or id)' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for UUID or other field' });
      }
      res.status(500).json({ error: 'Failed to create user', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Extract query parameters
      const { reportingmanagerid, departmentid, companyid, page = 1, limit = 10 } = req.query;

      // UUID validation regex
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

      // Validate reportingmanagerid format
      if (reportingmanagerid && !uuidRegex.test(reportingmanagerid)) {
        return res.status(400).json({ error: 'Invalid reportingmanagerid format: Must be a valid UUID' });
      }

      // Validate departmentid format
      if (departmentid && !uuidRegex.test(departmentid)) {
        return res.status(400).json({ error: 'Invalid departmentid format: Must be a valid UUID' });
      }

      // Validate companyid format (string, non-empty)
      if (companyid && !companyid.trim()) {
        return res.status(400).json({ error: 'Invalid companyid: Must be a non-empty string' });
      }

      // Convert page and limit to integers and ensure they are positive
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
      }
      if (isNaN(limitNum) || limitNum < 1) {
        return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
      }

      // Calculate offset for pagination
      const offset = (pageNum - 1) * limitNum;

      // Base query for fetching users
      let query = `
        SELECT 
          u1.*,
          u2.name AS reportingmanagername,
          u3.name AS crossreportingmanagername,
          d.name AS departmentname
        FROM users u1
        LEFT JOIN users u2 ON u1.reportingmanagerid = u2.id
        LEFT JOIN users u3 ON u1.crossreportingmanagerid = u3.id
        LEFT JOIN department d ON u1.departmentid = d.id
        WHERE 1=1
      `;

      // Array to hold query parameters
      const queryParams = [];
      let paramIndex = 1;

      // Add filter for reportingmanagerid if provided
      if (reportingmanagerid) {
        query += ` AND u1.reportingmanagerid = $${paramIndex}::uuid `;
        queryParams.push(reportingmanagerid);
        paramIndex++;
      }

      // Add filter for departmentid if provided
      if (departmentid) {
        query += ` AND u1.departmentid = $${paramIndex}::uuid `;
        queryParams.push(departmentid);
        paramIndex++;
      }

      // Add filter for companyid if provided
      if (companyid) {
        query += ` AND u1.companyid = $${paramIndex} `;
        queryParams.push(companyid);
        paramIndex++;
      }

      // Add pagination
      query += ` ORDER BY u1.id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limitNum, offset);

      // Query to get total count
      let countQuery = `
        SELECT COUNT(*) 
        FROM users u1
        WHERE 1=1
      `;
      const countParams = [];
      let countParamIndex = 1;

      if (reportingmanagerid) {
        countQuery += ` AND u1.reportingmanagerid = $${countParamIndex}::uuid `;
        countParams.push(reportingmanagerid);
        countParamIndex++;
      }
      if (departmentid) {
        countQuery += ` AND u1.departmentid = $${countParamIndex}::uuid `;
        countParams.push(departmentid);
        countParamIndex++;
      }
      if (companyid) {
        countQuery += ` AND u1.companyid = $${countParamIndex} `;
        countParams.push(companyid);
        countParamIndex++;
      }

      // Execute queries
      const [result, countResult] = await Promise.all([
        client.query(query, queryParams),
        client.query(countQuery, countParams)
      ]);

      const dataList = result.rows;
      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.status(200).json({
        status: true,
        data: {
          dataList,
          totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum)
        },
        message: "Fetched successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get All Users Error:', err);
    if (err.code === '22023') {
      return res.status(400).json({ error: 'Invalid UUID format in query parameters' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getUsersByCompanyId = async (req, res) => {
  const { companyid } = req.params;

  // Validate companyid (string, non-empty)
  if (!companyid || !companyid.trim()) {
    return res.status(400).json({ error: 'Invalid companyid: Must be a non-empty string' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          u1.*,
          u2.name AS reportingmanagername,
          u3.name AS crossreportingmanagername,
          d.name AS departmentname
        FROM users u1
        LEFT JOIN users u2 ON u1.reportingmanagerid = u2.id
        LEFT JOIN users u3 ON u1.crossreportingmanagerid = u3.id
        LEFT JOIN department d ON u1.departmentid = d.id
        WHERE u1.companyid = $1
        ORDER BY u1.id
        `,
        [companyid]
      );

      const dataList = result.rows;
      res.status(200).json({
        status: true,
        data: { dataList },
        message: "Fetched successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get Users By CompanyId Error:', err);
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
      status: true,
      data: managers,
      message: "All Managers fetched successfully"
    });
  } catch (error) {
    console.error('GetAllReportingManagers Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getUserById = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM users WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
      // const user = result.rows;
      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: "Fetched successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get User Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getUserByEmailOrPhone = async (req, res) => {
  let { email, phone } = req.body;

  // Check if at least one parameter is provided
  if (!email && !phone) {
    return res.status(400).json({ error: 'At least one of email or phone is required' });
  }

  // Trim and decode phone to handle URL encoding
  if (phone) {
    phone = decodeURIComponent(phone.trim());
  }

  try {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM users WHERE FALSE';
      const values = [];
      let paramIndex = 1;

      if (email) {
        query += ` OR LOWER(email) = LOWER($${paramIndex})`;
        values.push(email.trim());
        paramIndex++;
      }

      if (phone) {
        query += ` OR phone = $${paramIndex}`;
        values.push(phone);
        paramIndex++;

        const digitsOnly = phone.replace(/\D/g, '');
        if (!phone.startsWith('+') && digitsOnly.length === 10) {
          query += ` OR phone = $${paramIndex}`;
          values.push(`+91${digitsOnly}`);
          paramIndex++;
          query += ` OR phone = $${paramIndex}`;
          values.push(digitsOnly);
          paramIndex++;
        }
      }

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows;
      res.status(200).json({
        status: true,
        data: { user },
        message: "Fetched successfully"
      });
    } catch (error) {
      console.error('Query execution error:', error);
      throw error;
    } finally {
      await client.release();
    }
  } catch (error) {
    console.error('Get user by email or phone error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateUser  = async (req, res) => {
  const { id } = req.params;
  const fields = Object.entries(req.body);

  // Validate that at least one field is provided
  if (fields.length === 0) {
    return res.status(400).json({ error: 'At least one field must be provided for update' });
  }

  // Prepare the SET clause and values for the update query
  const setString = fields.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
  const values = fields.map(([, value]) => value);

  // Validate fields if they are provided
  if (req.body.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
  }
  if (req.body.phone && !/^\d{10}$/.test(req.body.phone)) {
    return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  }
  if (req.body.countrycode && !/^[A-Z]{2}$/.test(req.body.countrycode)) {
    return res.status(400).json({ error: 'Invalid country code: Must be 2-letter ISO code' });
  }
  if (req.body.dialcode && !/^\+\d{1,4}$/.test(req.body.dialcode)) {
    return res.status(400).json({ error: 'Invalid dial code: Must start with + followed by 1-4 digits' });
  }
  if (req.body.employeetype && !['office', 'field'].includes(req.body.employeetype)) {
    return res.status(400).json({ error: 'Invalid employeetype: Must be office or field' });
  }
  if (req.body.role_id && !isUUID(req.body.role_id)) {
    return res.status(400).json({ error: 'Invalid role_id: Must be a valid UUID' });
  }
  if (req.body.reportingmanagerid && !isUUID(req.body.reportingmanagerid)) {
    return res.status(400).json({ error: 'Invalid reportingmanagerid: Must be a valid UUID' });
  }
  if (req.body.crossreportingmanagerid && !isUUID(req.body.crossreportingmanagerid)) {
    return res.status(400).json({ error: 'Invalid crossreportingmanagerid: Must be a valid UUID' });
  }
  if (req.body.departmentid && !isUUID(req.body.departmentid)) {
    return res.status(400).json({ error: 'Invalid departmentid: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys if provided
      if (req.body.reportingmanagerid) {
        const managerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.reportingmanagerid]);
        if (managerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid reportingmanagerid: User does not exist' });
        }
      }
      if (req.body.crossreportingmanagerid) {
        const crossManagerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.crossreportingmanagerid]);
        if (crossManagerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid crossreportingmanagerid: User does not exist' });
        }
      }
      if (req.body.role_id) {
        const roleCheck = await client.query('SELECT 1 FROM roles WHERE id = $1', [req.body.role_id]);
        if (roleCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid role_id: Role does not exist' });
        }
      }
      if (req.body.departmentid) {
        const deptCheck = await client.query('SELECT 1 FROM departments WHERE id = $1', [req.body.departmentid]);
        if (deptCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid departmentid: Department does not exist' });
        }
      }

      const result = await client.query(
        `UPDATE users SET ${setString} WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User  not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: "Updated successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update User Error:', err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
    }
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for UUID or other field' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.patchUser = async (req, res) => {
  const { id } = req.params;
  const fields = Object.entries(req.body);
  
  // Validate that at least one field is provided
  if (fields.length === 0) {
    return res.status(400).json({ error: 'At least one field must be provided for update' });
  }

  // Validate fields if they are provided
  if (req.body.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(req.body.email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
  }
  if (req.body.phone && !/^\d{10}$/.test(req.body.phone)) {
    return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  }
  if (req.body.countrycode && !/^[A-Z]{2}$/.test(req.body.countrycode)) {
    return res.status(400).json({ error: 'Invalid country code: Must be 2-letter ISO code' });
  }
  if (req.body.dialcode && !/^\+\d{1,4}$/.test(req.body.dialcode)) {
    return res.status(400).json({ error: 'Invalid dial code: Must start with + followed by 1-4 digits' });
  }
  if (req.body.employeetype && !['office', 'field'].includes(req.body.employeetype)) {
    return res.status(400).json({ error: 'Invalid employeetype: Must be office or field' });
  }
  if (req.body.role_id && !isUUID(req.body.role_id)) {
    return res.status(400).json({ error: 'Invalid role_id: Must be a valid UUID' });
  }
  if (req.body.reportingmanagerid && !isUUID(req.body.reportingmanagerid)) {
    return res.status(400).json({ error: 'Invalid reportingmanagerid: Must be a valid UUID' });
  }
  if (req.body.crossreportingmanagerid && !isUUID(req.body.crossreportingmanagerid)) {
    return res.status(400).json({ error: 'Invalid crossreportingmanagerid: Must be a valid UUID' });
  }
  if (req.body.departmentid && !isUUID(req.body.departmentid)) {
    return res.status(400).json({ error: 'Invalid departmentid: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys if provided
      if (req.body.reportingmanagerid) {
        const managerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.reportingmanagerid]);
        if (managerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid reportingmanagerid: User does not exist' });
        }
      }
      if (req.body.crossreportingmanagerid) {
        const crossManagerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.crossreportingmanagerid]);
        if (crossManagerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid crossreportingmanagerid: User does not exist' });
        }
      }
      if (req.body.role_id) {
        const roleCheck = await client.query('SELECT 1 FROM roles WHERE id = $1', [req.body.role_id]);
        if (roleCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid role_id: Role does not exist' });
        }
      }
      if (req.body.departmentid) {
        const deptCheck = await client.query('SELECT 1 FROM departments WHERE id = $1', [req.body.departmentid]);
        if (deptCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid departmentid: Department does not exist' });
        }
      }

      const setString = fields.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
      const values = fields.map(([, value]) => value);

      const result = await client.query(
        `UPDATE users SET ${setString} WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      // const user = result.rows;
      res.status(200).json({
        status: true,
        data:  result.rows[0],
        message: "Patched successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Patch User Error:', err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
    }
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for UUID or other field' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteUser = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM users WHERE id = $1', [id]);
      res.json({ status: true, message: 'User deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete User Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};