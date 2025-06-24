// const { initializePool } = require('../db');
// const { initializePool } = require('../db');
const { pool } = require('../db');
const { validate: isUUID } = require('uuid'); // Add uuid package for validation



// Create Department
exports.createDepartment = async (req, res) => {
  const { name, createById, companyId } = req.body;

  // Validate required fields
  if (!name) return res.status(400).json({ status: false, error: 'Name is required' });
  if (!createById) return res.status(400).json({ status: false, error: 'createById is required' });
  if (!companyId) return res.status(400).json({ status: false, error: 'companyId is required' });

  // Validate UUID fields
  if (!isUUID(createById)) return res.status(400).json({ status: false, error: 'Invalid createById: Must be a valid UUID' });

  // Validate name format (e.g., max length, no special characters)
  if (name.length > 100) return res.status(400).json({ status: false, error: 'Name must not exceed 100 characters' });
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) return res.status(400).json({ status: false, error: 'Invalid name: Only alphanumeric, spaces, hyphens, and underscores allowed' });

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      // Validate createById exists in users table
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createById]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ status: false, error: 'Invalid createById: User does not exist' });
      }

      // Validate companyId exists in companies table (assuming companies table exists)
      // const companyCheck = await client.query('SELECT 1 FROM companies WHERE id = $1', [companyId]);
      // if (companyCheck.rows.length === 0) {
      //   return res.status(400).json({ status: false, error: 'Invalid companyId: Company does not exist' });
      // }

      const result = await client.query(
        'INSERT INTO department ( name, createById, companyId) VALUES ($1, $2, $3) RETURNING *',
        [ name, createById, companyId]
      );

      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Department created successfully'
      });
    } catch (err) {
      console.error('Create department error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ status: false, error: 'Invalid foreign key value', details: err.detail });
      }
      if (err.code === '23505') {
        return res.status(400).json({ status: false, error: 'Duplicate key value', details: err.detail });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ status: false, error: 'Invalid data type', details: err.detail });
      }
      res.status(500).json({ status: false, error: 'Failed to create department', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ status: false, error: 'Failed to connect to database', details: err.message });
  }
};

// Get All Departments
exports.getAllDepartments = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Extract query parameters
      const { companyId, page = 1, limit = 10 } = req.query;

      // Validate UUID for companyId if provided
      if (companyId && !isUUID(companyId)) {
        return res.status(400).json({ status: false, error: 'Invalid companyId format: Must be a valid UUID' });
      }

      // Convert page and limit to integers and ensure they are positive
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ status: false, error: 'Invalid page number: Must be a positive integer' });
      }
      if (isNaN(limitNum) || limitNum < 1) {
        return res.status(400).json({ status: false, error: 'Invalid limit: Must be a positive integer' });
      }

      // Calculate offset for pagination
      const offset = (pageNum - 1) * limitNum;

      // Base query for fetching departments
      let query = `
        SELECT 
          d.*,
          u.name AS created_by_name,
          c.name AS company_name
        FROM department d
        LEFT JOIN users u ON d.createById = u.id
        LEFT JOIN companies c ON d.companyId = c.id
        WHERE 1=1
      `;

      // Array to hold query parameters
      const queryParams = [];
      let paramIndex = 1;

      // Add filter for companyId if provided
      if (companyId) {
        query += ` AND d.companyId = $${paramIndex}::uuid `;
        queryParams.push(companyId);
        paramIndex++;
      }

      // Add pagination
      query += ` ORDER BY d.id LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limitNum, offset);

      // Query to get total count
      let countQuery = `
        SELECT COUNT(*) 
        FROM department d
        WHERE 1=1
      `;
      const countParams = [];
      let countParamIndex = 1;

      if (companyId) {
        countQuery += ` AND d.companyId = $${countParamIndex}::uuid `;
        countParams.push(companyId);
        countParamIndex++;
      }

      // Execute queries
      const [result, countResult] = await Promise.all([
        client.query(query, queryParams),
        client.query(countQuery, countParams)
      ]);

      const departments = result.rows;
      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.status(200).json({
        status: true,
        data: {
          departments,
          totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum)
        },
        message: 'Fetched successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get All Departments Error:', err.stack);
    if (err.code === '22023') {
      return res.status(400).json({ status: false, error: 'Invalid UUID format in query parameters' });
    }
    res.status(500).json({ status: false, error: 'Internal Server Error', details: err.message });
  }
};

// Get Department By ID
exports.getDepartmentById = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) return res.status(400).json({ status: false, error: 'Invalid department ID: Must be a valid UUID' });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          d.*,
          u.name AS created_by_name,
          c.name AS company_name
        FROM department d
        LEFT JOIN users u ON d.createById = u.id
        LEFT JOIN companies c ON d.companyId = c.id
        WHERE d.id = $1
        `,
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ status: false, error: 'Department not found' });
      }
      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Department fetched successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get Department Error:', err.stack);
    if (err.code === '22P02') {
      return res.status(400).json({ status: false, error: 'Invalid UUID format', details: err.detail });
    }
    res.status(500).json({ status: false, error: 'Failed to fetch department', details: err.message });
  }
};

// Update Department
exports.updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, createById, companyId } = req.body;

  // Validate UUID
  if (!isUUID(id)) return res.status(400).json({ status: false, error: 'Invalid department ID: Must be a valid UUID' });

  // Validate fields if provided
  if (name) {
    if (name.length > 100) return res.status(400).json({ status: false, error: 'Name must not exceed 100 characters' });
    if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) return res.status(400).json({ status: false, error: 'Invalid name: Only alphanumeric, spaces, hyphens, and underscores allowed' });
  }
  if (createById && !isUUID(createById)) return res.status(400).json({ status: false, error: 'Invalid createById: Must be a valid UUID' });
  if (companyId && !isUUID(companyId)) return res.status(400).json({ status: false, error: 'Invalid companyId: Must be a valid UUID' });

  // Ensure at least one field is provided for update
  if (!name && !createById && !companyId) {
    return res.status(400).json({ status: false, error: 'At least one field (name, createById, companyId) must be provided for update' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate createById exists in users table if provided
      if (createById) {
        const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createById]);
        if (userCheck.rows.length === 0) {
          return res.status(400).json({ status: false, error: 'Invalid createById: User does not exist' });
        }
      }

      // Validate companyId exists in companies table if provided
      if (companyId) {
        const companyCheck = await client.query('SELECT 1 FROM companies WHERE id = $1', [companyId]);
        if (companyCheck.rows.length === 0) {
          return res.status(400).json({ status: false, error: 'Invalid companyId: Company does not exist' });
        }
      }

      // Dynamically build the SET clause
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (name) {
        fields.push(`name = $${paramIndex}`);
        values.push(name);
        paramIndex++;
      }
      if (createById) {
        fields.push(`createById = $${paramIndex}`);
        values.push(createById);
        paramIndex++;
      }
      if (companyId) {
        fields.push(`companyId = $${paramIndex}`);
        values.push(companyId);
        paramIndex++;
      }

      const setString = fields.join(', ');
      values.push(id);

      const result = await client.query(
        `UPDATE department SET ${setString} WHERE id = $${paramIndex} RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ status: false, error: 'Department not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Department updated successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update Department Error:', err.stack);
    if (err.code === '23503') {
      return res.status(400).json({ status: false, error: 'Invalid foreign key value', details: err.detail });
    }
    if (err.code === '22P02') {
      return res.status(400).json({ status: false, error: 'Invalid UUID format', details: err.detail });
    }
    res.status(500).json({ status: false, error: 'Failed to update department', details: err.message });
  }
};

// Delete Department
exports.deleteDepartment = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) return res.status(400).json({ status: false, error: 'Invalid department ID: Must be a valid UUID' });

  try {
    const client = await pool.connect();
    try {
      // Check if department is referenced by users
      const userCheck = await client.query('SELECT 1 FROM users WHERE departmentid = $1 LIMIT 1', [id]);
      if (userCheck.rows.length > 0) {
        return res.status(400).json({ status: false, error: 'Cannot delete department: It is referenced by one or more users' });
      }

      const result = await client.query('DELETE FROM department WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ status: false, error: 'Department not found' });
      }

      res.status(200).json({
        status: true,
        data: null,
        message: 'Department deleted successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete Department Error:', err.stack);
    if (err.code === '22P02') {
      return res.status(400).json({ status: false, error: 'Invalid UUID format', details: err.detail });
    }
    res.status(500).json({ status: false, error: 'Failed to delete department', details: err.message });
  }
};