const validator = require('validator');
const xss = require('xss');
const { pool } = require('../db');

// Create Product Category
exports.createCategory = async (req, res) => {
  const { categoryName, createdById } = req.body;

  // Input validation
  if (!categoryName || !createdById) {
    return res.status(400).json({ error: 'categoryName and createdById are required' });
  }

  // Validate data types and formats
  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }

  if (!validator.isLength(categoryName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'categoryName must be between 1 and 255 characters' });
  }

  // Sanitize inputs to prevent XSS
  const sanitizedCategoryName = xss(categoryName);

  try {
    const client = await pool.connect();
    try {
      // Verify createdById exists in users table
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      // Check for duplicate category name for the same user
      const duplicateCheck = await client.query(
        'SELECT 1 FROM product_categories WHERE createdById = $1 AND categoryName = $2',
        [createdById, sanitizedCategoryName]
      );
      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Category name already exists for this user' });
      }

      const result = await client.query(
        'INSERT INTO product_categories (categoryName, createdById) VALUES ($1, $2) RETURNING *',
        [sanitizedCategoryName, createdById]
      );

      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product category created successfully'
      });
    } catch (err) {
      console.error('Create category error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: 'createdById does not exist in users table' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: 'Unique constraint violation' });
      }
      res.status(500).json({ error: 'Failed to create category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get All Product Categories
exports.getAllCategories = async (req, res) => {
  const { search, page = 1, limit = 10 } = req.query;

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
  }
  if (isNaN(limitNum) || limitNum < 1) {
    return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
  }

  // Search parameter validation
  if (search && !validator.isLength(search, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'search must be between 1 and 255 characters' });
  }

  // Sanitize search input
  const sanitizedSearch = search ? xss(search) : null;

  try {
    const client = await pool.connect();
    try {
      const offset = (pageNum - 1) * limitNum;

      let query = `
        SELECT 
          pc.*,
          u.name AS createdByName
        FROM public.product_categories pc
        LEFT JOIN public.users u ON pc.createdById = u.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) FROM public.product_categories WHERE 1=1`;
      const queryParams = [];
      const countParams = [];
      let paramIndex = 1;

      if (sanitizedSearch) {
        query += ` AND pc.categoryName ILIKE $${paramIndex}`;
        countQuery += ` AND categoryName ILIKE $${paramIndex}`;
        queryParams.push(`%${sanitizedSearch}%`);
        countParams.push(`%${sanitizedSearch}%`);
        paramIndex++;
      }

      query += ` ORDER BY pc.createdOn DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limitNum, offset);

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
        message: 'Product categories fetched successfully'
      });
    } catch (err) {
      console.error('Get categories error:', err.stack);
      if (err.code === '22023' || err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format in query parameters', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch categories', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get Product Category by ID
exports.getCategoryById = async (req, res) => {
  const { id } = req.params;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          pc.id, 
          pc.createdById, 
          u.name AS createdByName, 
          pc.categoryName,
          pc.createdOn
        FROM product_categories pc
        LEFT JOIN users u ON pc.createdById = u.id
        WHERE pc.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product category fetched successfully'
      });
    } catch (err) {
      console.error('Get category error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Update Product Category
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { categoryName, createdById } = req.body;

  if (!categoryName || !createdById) {
    return res.status(400).json({ error: 'categoryName and createdById are required' });
  }

  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }

  if (!validator.isLength(categoryName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'categoryName must be between 1 and 255 characters' });
  }

  const sanitizedCategoryName = xss(categoryName);

  try {
    const client = await pool.connect();
    try {
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      const result = await client.query(
        'UPDATE product_categories SET categoryName = $1, createdById = $2 WHERE id = $3 RETURNING *',
        [sanitizedCategoryName, createdById, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product category updated successfully'
      });
    } catch (err) {
      console.error('Update category error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: 'createdById does not exist in users table' });
      }
      res.status(500).json({ error: 'Failed to update category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Delete Product Category
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM product_categories WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.status(200).json({
        status: true,
        message: 'Category deleted successfully'
      });
    } catch (err) {
      console.error('Delete category error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete category due to foreign key constraint', details: 'Category is referenced by products' });
      }
      res.status(500).json({ error: 'Failed to delete category', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};