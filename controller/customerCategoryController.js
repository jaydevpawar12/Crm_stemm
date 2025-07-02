const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

// Utility function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    // Convert snake_case to camelCase
    let camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    // Ensure first letter is lowercase
    camelKey = camelKey.replace(/^([A-Z])/, (match, letter) => letter.toLowerCase());
    // Explicit mappings for specific fields
    if (camelKey === 'companyid') camelKey = 'companyId';
    if (camelKey === 'customerCategoryId') camelKey = 'customerCategoryId';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Create Customer Category
exports.createCustomerCategory = async (req, res) => {
  const { name, companyId } = req.body;

  // Validate required fields
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Validate companyId if provided
  if (companyId && !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
  }

  try {
    const client = await pool.connect();
    try {
      // Check for existing name
      const nameCheck = await client.query('SELECT 1 FROM customercategory WHERE name = $1', [name]);
      if (nameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Name already exists' });
      }

      const result = await client.query(
        `INSERT INTO customercategory (name, companyid)
         VALUES ($1, $2)
         RETURNING *`,
        [name, companyId]
      );

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(201).json({
        status: true,
        data: camelCaseData,
        message: 'Customer category created successfully'
      });
    } catch (err) {
      console.error('Create customer category error:', err.stack);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate name', details: err.detail || 'Name already exists' });
      }
      res.status(500).json({ error: 'Failed to create customer category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get All Customer Categories
exports.getAllCustomerCategories = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const { companyId, search, page = 1, limit = 10 } = req.query;

      // Validate companyId if provided
      if (companyId && !companyId.trim()) {
        return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
      }

      // Validate search parameter
      if (search && typeof search !== 'string') {
        return res.status(400).json({ error: 'Invalid search parameter: Must be a string' });
      }

      // Validate pagination inputs
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
      }
      if (isNaN(limitNum) || limitNum < 1) {
        return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
      }

      const offset = (pageNum - 1) * limitNum;

      // Main query
      let query = `SELECT * FROM customercategory WHERE 1=1`;
      const values = [];
      let paramIndex = 1;

      if (companyId) {
        query += ` AND companyid = $${paramIndex}`;
        values.push(companyId);
        paramIndex++;
      }
      if (search) {
        query += ` AND LOWER(name) LIKE LOWER($${paramIndex})`;
        values.push(`%${search.trim()}%`);
        paramIndex++;
      }

      query += ` ORDER BY id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limitNum, offset);

      // Count query
      let countQuery = `SELECT COUNT(*) FROM customercategory WHERE 1=1`;
      const countValues = [];
      let countIndex = 1;

      if (companyId) {
        countQuery += ` AND companyid = $${countIndex}`;
        countValues.push(companyId);
        countIndex++;
      }
      if (search) {
        countQuery += ` AND LOWER(name) LIKE LOWER($${countIndex})`;
        countValues.push(`%${search.trim()}%`);
        countIndex++;
      }

      const [dataResult, countResult] = await Promise.all([
        client.query(query, values),
        client.query(countQuery, countValues)
      ]);

      const camelCaseRows = dataResult.rows.map(row => toCamelCase(row));
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
        message: 'Customer categories fetched successfully'
      });
    } catch (err) {
      console.error('Get customer categories error:', err.stack);
      res.status(500).json({ error: 'Failed to fetch customer categories', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get Customer Category by ID
exports.getCustomerCategoryById = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT * FROM customercategory WHERE id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer category not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Customer category fetched successfully'
      });
    } catch (err) {
      console.error('Get customer category by ID error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch customer category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Update Customer Category
exports.updateCustomerCategory = async (req, res) => {
  const { id } = req.params;
  const { name, companyId } = req.body;

  // Validate required fields
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  // Validate companyId if provided
  if (companyId && !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
  }

  try {
    const client = await pool.connect();
    try {
      // Check for existing name (excluding current record)
      const nameCheck = await client.query(
        `SELECT 1 FROM customercategory WHERE name = $1 AND id != $2`,
        [name, id]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Name already exists' });
      }

      const result = await client.query(
        `UPDATE customercategory
         SET name = $1, companyid = $2
         WHERE id = $3
         RETURNING *`,
        [name, companyId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer category not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Customer category updated successfully'
      });
    } catch (err) {
      console.error('Update customer category error:', err.stack);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate name', details: err.detail || 'Name already exists' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to update customer category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Patch Customer Category
exports.patchCustomerCategory = async (req, res) => {
  const { id } = req.params;
  const fields = Object.entries(req.body);

  // Validate that at least one field is provided
  if (fields.length === 0) {
    return res.status(400).json({ error: 'At least one field must be provided for update' });
  }

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  // Validate companyId if provided
  if (req.body.companyId && !req.body.companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
  }

  try {
    const client = await pool.connect();
    try {
      // Check for existing name if provided (excluding current record)
      if (req.body.name) {
        const nameCheck = await client.query(
          `SELECT 1 FROM customercategory WHERE name = $1 AND id != $2`,
          [req.body.name, id]
        );
        if (nameCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Name already exists' });
        }
      }

      const setString = fields.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
      const values = fields.map(([, value]) => value);

      const result = await client.query(
        `UPDATE customercategory SET ${setString} WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer category not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Customer category patched successfully'
      });
    } catch (err) {
      console.error('Patch customer category error:', err.stack);
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate name', details: err.detail || 'Name already exists' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to patch customer category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Delete Customer Category
exports.deleteCustomerCategory = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `DELETE FROM customercategory WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer category not found' });
      }

      res.status(200).json({
        status: true,
        message: 'Customer category deleted successfully'
      });
    } catch (err) {
      console.error('Delete customer category error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({
          error: 'Cannot delete customer category due to foreign key constraint',
          details: err.detail || 'Category is referenced by customer tags'
        });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to delete customer category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};