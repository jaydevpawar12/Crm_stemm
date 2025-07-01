const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

// Utility function to convert snake_case to camelCase

const toCamelCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    // Convert snake_case to camelCase
    let camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    // Ensure consistent camelCase for specific fields
    camelKey = camelKey.replace(/^([A-Z])/, (match, letter) => letter.toLowerCase()); // Ensure first letter is lowercase
    if (camelKey === 'roleId') camelKey = 'roleId';
    if (camelKey === 'reportingmanagerid') camelKey = 'reportingManagerId';
    if (camelKey === 'crossreportingmanagerid') camelKey = 'crossReportingManagerId';
    if (camelKey === 'departmentid') camelKey = 'departmentId';
    if (camelKey === 'employeeid') camelKey = 'employeeId';
    if (camelKey === 'employeetype') camelKey = 'employeeType';
    if (camelKey === 'fcmtoken') camelKey = 'fcmToken';
    if (camelKey === 'imageurl') camelKey = 'imageUrl';
    if (camelKey === 'addharcard') camelKey = 'aadharCard';
    if (camelKey === 'pancard') camelKey = 'panCard';
    if (camelKey === 'otherdocument') camelKey = 'otherDocument';
    if (camelKey === 'secretkey') camelKey = 'secretKey';
    if (camelKey === 'isnewuser') camelKey = 'isNewUser';
    if (camelKey === 'emailverify') camelKey = 'emailVerify';
    if (camelKey === 'isuserdisabled') camelKey = 'isUserDisabled';
    if (camelKey === 'webaccess') camelKey = 'webAccess';
    if (camelKey === 'mobileaccess') camelKey = 'mobileAccess';
    if (camelKey === 'deviceid') camelKey = 'deviceId';
    if (camelKey === 'devicename') camelKey = 'deviceName';
    if (camelKey === 'companyid') camelKey = 'companyId';
    if (camelKey === 'companyname') camelKey = 'companyName';
    if (camelKey === 'reportingmanagername') camelKey = 'reportingManagerName';
    if (camelKey === 'crossreportingmanagername') camelKey = 'crossReportingManagerName';
    if (camelKey === 'departmentname') camelKey = 'departmentName';
    if (camelKey === 'roleName') camelKey = 'roleName';
    if (camelKey === 'countrycode') camelKey = 'countryCode';
    if (camelKey === 'dialcode') camelKey = 'dialCode';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};


exports.createUser = async (req, res) => {
  const {
    id, name, email, roleId, phone, countryCode, dialCode,
    employeeId, employeeType, fcmToken, gender, imageUrl, departmentId,
    designation, reportingManagerId, crossReportingManagerId, aadharCard,
    panCard, otherDocument, secretKey, isNewUser = true, emailVerify = false,
    isUserDisabled = false, webAccess = true, mobileAccess = true,
    deviceId, deviceName, companyId, companyName
  } = req.body;

  // Validate required fields
  if (!id) return res.status(400).json({ error: 'User ID is required' });
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!email) return res.status(400).json({ error: 'Email is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid user ID: Must be a valid UUID' });
  if (roleId && !isUUID(roleId)) return res.status(400).json({ error: 'Invalid roleId: Must be a valid UUID' });
  if (reportingManagerId && !isUUID(reportingManagerId)) return res.status(400).json({ error: 'Invalid reportingManagerId: Must be a valid UUID' });
  if (crossReportingManagerId && !isUUID(crossReportingManagerId)) return res.status(400).json({ error: 'Invalid crossReportingManagerId: Must be a valid UUID' });
  if (departmentId && !isUUID(departmentId)) return res.status(400).json({ error: 'Invalid departmentId: Must be a valid UUID' });

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  // Validate other fields
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  if (countryCode && !/^[A-Z]{2}$/.test(countryCode)) return res.status(400).json({ error: 'Invalid country code: Must be 2-letter ISO code' });
  if (dialCode && !/^\+\d{1,4}$/.test(dialCode)) return res.status(400).json({ error: 'Invalid dial code: Must start with + followed by 1-4 digits' });

  try {
    const client = await pool.connect();
    try {
      // Validate reportingManagerId
      if (reportingManagerId) {
        const managerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [reportingManagerId]);
        if (managerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid reportingManagerId: User does not exist' });
        }
      }

      // Validate crossReportingManagerId
      if (crossReportingManagerId) {
        const crossManagerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [crossReportingManagerId]);
        if (crossManagerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid crossReportingManagerId: User does not exist' });
        }
      }

      // Validate roleId exists in roles table
      if (roleId) {
        const roleCheck = await client.query('SELECT 1 FROM roles WHERE id = $1', [roleId]);
        if (roleCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid roleId: Role does not exist' });
        }
      }

      // Validate departmentId exists in departments table
      if (departmentId) {
        const deptCheck = await client.query('SELECT 1 FROM department WHERE id = $1', [departmentId]);
        if (deptCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid departmentId: Department does not exist' });
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
          id, name, email, roleId, phone, countryCode, dialCode,
          employeeId, employeeType, fcmToken, gender, imageUrl, departmentId,
          designation, reportingManagerId, crossReportingManagerId, aadharCard,
          panCard, otherDocument, secretKey, isNewUser, emailVerify, isUserDisabled,
          webAccess, mobileAccess, deviceId, deviceName, companyId, companyName
        ]
      );

      // Convert snake_case to camelCase for the response data
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
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
      const { reportingManagerId, departmentId, companyId, page = 1, limit = 10, search } = req.query;

      // Validate UUID fields
      if (reportingManagerId && !isUUID(reportingManagerId)) {
        return res.status(400).json({ error: 'Invalid reportingManagerId format: Must be a valid UUID' });
      }
      if (departmentId && !isUUID(departmentId)) {
        return res.status(400).json({ error: 'Invalid departmentId format: Must be a valid UUID' });
      }
      if (companyId && !companyId.trim()) {
        return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
      }
      if (search && typeof search !== 'string') {
        return res.status(400).json({ error: 'Invalid search parameter: Must be a string' });
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
          u2.name AS-reportingmanagername,
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

      // Add filter for reportingManagerId if provided
      if (reportingManagerId) {
        query += ` AND u1.reportingmanagerid = $${paramIndex}::uuid `;
        queryParams.push(reportingManagerId);
        paramIndex++;
      }

      // Add filter for departmentId if provided
      if (departmentId) {
        query += ` AND u1.departmentid = $${paramIndex}::uuid `;
        queryParams.push(departmentId);
        paramIndex++;
      }

      // Add filter for companyId if provided
      if (companyId) {
        query += ` AND u1.companyid = $${paramIndex} `;
        queryParams.push(companyId);
        paramIndex++;
      }

      // Add search filter for name if provided
      if (search) {
        query += ` AND LOWER(u1.name) LIKE LOWER($${paramIndex}) `;
        queryParams.push(`%${search.trim()}%`);
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

      if (reportingManagerId) {
        countQuery += ` AND u1.reportingmanagerid = $${countParamIndex}::uuid `;
        countParams.push(reportingManagerId);
        countParamIndex++;
      }
      if (departmentId) {
        countQuery += ` AND u1.departmentid = $${countParamIndex}::uuid `;
        countParams.push(departmentId);
        countParamIndex++;
      }
      if (companyId) {
        countQuery += ` AND u1.companyid = $${countParamIndex} `;
        countParams.push(companyId);
        countParamIndex++;
      }

      if (search) {
        countQuery += ` AND LOWER(u1.name) LIKE LOWER($${countParamIndex}) `;
        countParams.push(`%${search.trim()}%`);
        countParamIndex++;
      }

      // Execute queries
      const [result, countResult] = await Promise.all([
        client.query(query, queryParams),
        client.query(countQuery, countParams)
      ]);

      // Convert snake_case to camelCase for each row
      const camelCaseRows = result.rows.map(row => toCamelCase(row));

      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.status(200).json({
        status: true,
        data: {
          dataList: camelCaseRows,
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
  const { companyId } = req.params;

  // Validate companyId (string, non-empty)
  if (!companyId || !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
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
        [companyId]
      );

      // Convert snake_case to camelCase for each row
      const camelCaseRows = result.rows.map(row => toCamelCase(row));

      res.status(200).json({
        status: true,
        data: { dataList: camelCaseRows },
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

    // Convert snake_case to camelCase for each row
    const camelCaseRows = result.rows.map(row => toCamelCase(row));

    if (camelCaseRows.length === 0) {
      return res.json({
        status: false,
        data: [],
        message: "Reporting Managers not found"
      });
    }

    return res.json({
      status: true,
      data: camelCaseRows,
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

      // Convert snake_case to camelCase for the response data
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
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

      // Convert snake_case to camelCase for each row
      const camelCaseRows = result.rows.map(row => toCamelCase(row));

      res.status(200).json({
        status: true,
        data: { user: camelCaseRows },
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

exports.updateUser = async (req, res) => {
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
  if (req.body.countryCode && !/^[A-Z]{2}$/.test(req.body.countryCode)) {
    return res.status(400).json({ error: 'Invalid country code: Must be 2-letter ISO code' });
  }
  if (req.body.dialCode && !/^\+\d{1,4}$/.test(req.body.dialCode)) {
    return res.status(400).json({ error: 'Invalid dial code: Must start with + followed by 1-4 digits' });
  }

  if (req.body.roleId && !isUUID(req.body.roleId)) {
    return res.status(400).json({ error: 'Invalid roleId: Must be a valid UUID' });
  }
  if (req.body.reportingManagerId && !isUUID(req.body.reportingManagerId)) {
    return res.status(400).json({ error: 'Invalid reportingManagerId: Must be a valid UUID' });
  }
  if (req.body.crossReportingManagerId && !isUUID(req.body.crossReportingManagerId)) {
    return res.status(400).json({ error: 'Invalid crossReportingManagerId: Must be a valid UUID' });
  }
  if (req.body.departmentId && !isUUID(req.body.departmentId)) {
    return res.status(400).json({ error: 'Invalid departmentId: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys if provided
      if (req.body.reportingManagerId) {
        const managerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.reportingManagerId]);
        if (managerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid reportingManagerId: User does not exist' });
        }
      }
      if (req.body.crossReportingManagerId) {
        const crossManagerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.crossReportingManagerId]);
        if (crossManagerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid crossReportingManagerId: User does not exist' });
        }
      }
      if (req.body.roleId) {
        const roleCheck = await client.query('SELECT 1 FROM roles WHERE id = $1', [req.body.roleId]);
        if (roleCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid roleId: Role does not exist' });
        }
      }
      if (req.body.departmentId) {
        const deptCheck = await client.query('SELECT 1 FROM department WHERE id = $1', [req.body.departmentId]);
        if (deptCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid departmentId: Department does not exist' });
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

      // Convert snake_case to camelCase for the response data
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
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
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
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
  if (req.body.countryCode && !/^[A-Z]{2}$/.test(req.body.countryCode)) {
    return res.status(400).json({ error: 'Invalid country code: Must be 2-letter ISO code' });
  }
  if (req.body.dialCode && !/^\+\d{1,4}$/.test(req.body.dialCode)) {
    return res.status(400).json({ error: 'Invalid dial code: Must start with + followed by 1-4 digits' });
  }

  if (req.body.roleId && !isUUID(req.body.roleId)) {
    return res.status(400).json({ error: 'Invalid roleId: Must be a valid UUID' });
  }
  if (req.body.reportingManagerId && !isUUID(req.body.reportingManagerId)) {
    return res.status(400).json({ error: 'Invalid reportingManagerId: Must be a valid UUID' });
  }
  if (req.body.crossReportingManagerId && !isUUID(req.body.crossReportingManagerId)) {
    return res.status(400).json({ error: 'Invalid crossReportingManagerId: Must be a valid UUID' });
  }
  if (req.body.departmentId && !isUUID(req.body.departmentId)) {
    return res.status(400).json({ error: 'Invalid departmentId: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys if provided
      if (req.body.reportingManagerId) {
        const managerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.reportingManagerId]);
        if (managerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid reportingManagerId: User does not exist' });
        }
      }
      if (req.body.crossReportingManagerId) {
        const crossManagerCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.crossReportingManagerId]);
        if (crossManagerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid crossReportingManagerId: User does not exist' });
        }
      }
      if (req.body.roleId) {
        const roleCheck = await client.query('SELECT 1 FROM roles WHERE id = $1', [req.body.roleId]);
        if (roleCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid roleId: Role does not exist' });
        }
      }
      if (req.body.departmentId) {
        const deptCheck = await client.query('SELECT 1 FROM department WHERE id = $1', [req.body.departmentId]);
        if (deptCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid departmentId: Department does not exist' });
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

      // Convert snake_case to camelCase for the response data
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
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