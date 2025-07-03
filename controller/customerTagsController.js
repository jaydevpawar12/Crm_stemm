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
    if (camelKey === 'customercategoryid') camelKey = 'customerCategoryId';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Create Customer Tag
exports.createCustomerTag = async (req, res) => {
  const { name, customerCategoryId } = req.body;

  // Validate required fields
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Validate UUID for customerCategoryId if provided
  if (customerCategoryId && !isUUID(customerCategoryId)) {
    return res.status(400).json({ error: 'Invalid customerCategoryId: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Check for existing name
      const nameCheck = await client.query('SELECT 1 FROM customertags WHERE name = $1', [name]);
      if (nameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Name already exists' });
      }

      // Validate customerCategoryId if provided
      if (customerCategoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM customercategory WHERE id = $1', [customerCategoryId]);
        if (categoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid customerCategoryId: Customer category does not exist' });
        }
      }

      const result = await client.query(
        `INSERT INTO customertags (name, customercategoryid)
         VALUES ($1, $2)
         RETURNING *`,
        [name, customerCategoryId]
      );

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(201).json({
        status: true,
        data: camelCaseData,
        message: 'Customer tag created successfully'
      });
    } catch (err) {
      console.error('Create customer tag error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({
          error: 'Invalid foreign key value',
          details: err.detail || 'Invalid customerCategoryId'
        });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate name', details: err.detail || 'Name already exists' });
      }
      res.status(500).json({ error: 'Failed to create customer tag', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get All Customer Tags
exports.getAllCustomerTags = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const { customerCategoryId, search, page = 1, limit = 10 } = req.query;

      // Validate UUID for customerCategoryId if provided
      if (customerCategoryId && !isUUID(customerCategoryId)) {
        return res.status(400).json({ error: 'Invalid customerCategoryId: Must be a valid UUID' });
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
      let query = `
        SELECT 
          t.*,
          c.name AS category_name
        FROM customertags t
        LEFT JOIN customercategory c ON t.customercategoryid = c.id
        WHERE 1=1
      `;
      const values = [];
      let paramIndex = 1;

      if (customerCategoryId) {
        query += ` AND t.customercategoryid = $${paramIndex}::uuid`;
        values.push(customerCategoryId);
        paramIndex++;
      }
      if (search) {
        query += ` AND LOWER(t.name) LIKE LOWER($${paramIndex})`;
        values.push(`%${search.trim()}%`);
        paramIndex++;
      }

      query += ` ORDER BY t.id ASC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limitNum, offset);

      // Count query
      let countQuery = `SELECT COUNT(*) FROM customertags t WHERE 1=1`;
      const countValues = [];
      let countIndex = 1;

      if (customerCategoryId) {
        countQuery += ` AND t.customercategoryid = $${countIndex}::uuid`;
        countValues.push(customerCategoryId);
        countIndex++;
      }
      if (search) {
        countQuery += ` AND LOWER(t.name) LIKE LOWER($${countIndex})`;
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
        message: 'Customer tags fetched successfully'
      });
    } catch (err) {
      console.error('Get customer tags error:', err.stack);
      res.status(500).json({ error: 'Failed to fetch customer tags', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get Customer Tag by ID
exports.getCustomerTagById = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          t.*,
          c.name AS category_name
        FROM customertags t
        LEFT JOIN customercategory c ON t.customercategoryid = c.id
        WHERE t.id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer tag not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Customer tag fetched successfully'
      });
    } catch (err) {
      console.error('Get customer tag by ID error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch customer tag', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Update Customer Tag
exports.updateCustomerTag = async (req, res) => {
  const { id } = req.params;
  const { name, customerCategoryId } = req.body;

  // Validate required fields
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }
  if (customerCategoryId && !isUUID(customerCategoryId)) {
    return res.status(400).json({ error: 'Invalid customerCategoryId: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Check for existing name (excluding current record)
      const nameCheck = await client.query(
        `SELECT 1 FROM customertags WHERE name = $1 AND id != $2`,
        [name, id]
      );
      if (nameCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Name already exists' });
      }

      // Validate customerCategoryId if provided
      if (customerCategoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM customercategory WHERE id = $1', [customerCategoryId]);
        if (categoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid customerCategoryId: Customer category does not exist' });
        }
      }

      const result = await client.query(
        `UPDATE customertags
         SET name = $1, customercategoryid = $2
         WHERE id = $3
         RETURNING *`,
        [name, customerCategoryId, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer tag not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Customer tag updated successfully'
      });
    } catch (err) {
      console.error('Update customer tag error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({
          error: 'Invalid foreign key value',
          details: err.detail || 'Invalid customerCategoryId'
        });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate name', details: err.detail || 'Name already exists' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to update customer tag', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Patch Customer Tag
exports.patchCustomerTag = async (req, res) => {
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
  if (req.body.customerCategoryId && !isUUID(req.body.customerCategoryId)) {
    return res.status(400).json({ error: 'Invalid customerCategoryId: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Check for existing name if provided (excluding current record)
      if (req.body.name) {
        const nameCheck = await client.query(
          `SELECT 1 FROM customertags WHERE name = $1 AND id != $2`,
          [req.body.name, id]
        );
        if (nameCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Name already exists' });
        }
      }

      // Validate customerCategoryId if provided
      if (req.body.customerCategoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM customercategory WHERE id = $1', [req.body.customerCategoryId]);
        if (categoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid customerCategoryId: Customer category does not exist' });
        }
      }

      const setString = fields.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
      const values = fields.map(([, value]) => value);

      const result = await client.query(
        `UPDATE customertags SET ${setString} WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Customer tag not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Customer tag patched successfully'
      });
    } catch (err) {
      console.error('Patch customer tag error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({
          error: 'Invalid foreign key value',
          details: err.detail || 'Invalid customerCategoryId'
        });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate name', details: err.detail || 'Name already exists' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to patch customer tag', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Delete Customer Tag
exports.deleteCustomerTag = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Begin transaction
      await client.query('BEGIN');

      // Remove the tag ID from customers.tags array
      await client.query(
        `UPDATE customers 
         SET tags = array_remove(tags, $1)
         WHERE $1 = ANY(tags)`,
        [id]
      );

      // Delete the tag
      const result = await client.query(
        `DELETE FROM customertags WHERE id = $1 RETURNING *`,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Customer tag not found' });
      }

      // Commit transaction
      await client.query('COMMIT');

      res.status(200).json({
        status: true,
        message: 'Customer tag deleted successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Delete customer tag error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({
          error: 'Cannot delete customer tag due to foreign key constraint',
          details: err.detail || 'Tag is referenced by other records'
        });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to delete customer tag', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};