// const { initializePool } = require('../db');
  const { pool } = require('../db');


const validator = require('validator');
const xss = require('xss');

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
    // const pool = await initializePool();
    const client = await pool.connect();

    try {
      // Verify createdById exists in users table
      const userCheck = await client.query(
        'SELECT 1 FROM users WHERE id = $1',
        [createdById]
      );

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

      // res.status(201).json(result.rows[0]);
      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product category create successfully'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};


exports.getAllCategories = async (req, res) => {
  try {
// const pool = await initializePool();
    const client = await pool.connect();   
     try {
      // Extract query parameters
      const { page = 1, limit = 10 } = req.query;

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

      // Base query for fetching categories
      let query = `
        SELECT 
          pc.*,
          u.name AS createdby_name
        FROM public.product_categories pc
        LEFT JOIN public.users u ON pc.createdbyid = u.id
        ORDER BY pc.createdon DESC
        LIMIT $1 OFFSET $2
      `;

      // Query to get total count
      let countQuery = `
        SELECT COUNT(*) 
        FROM public.product_categories
      `;

      // Execute queries
      const [result, countResult] = await Promise.all([
        client.query(query, [limitNum, offset]),
        client.query(countQuery)
      ]);

      const categories = result.rows;
      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.status(200).json({
        status: true,
        data: {
          categories,
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
    console.error('Error fetching categories:', err);
    if (err.code === '22023') {
      return res.status(400).json({ error: 'Invalid UUID format in query parameters' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getCategoryById = async (req, res) => {
  const { id } = req.params;

  // Validate id is a UUID
  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    // const pool = await initializePool();
    const client = await pool.connect();

    try {
      const result = await client.query(
        `SELECT 
          pc.id, 
          pc.createdById, 
          u.name AS createdByName, 
          pc.categoryName,
          (SELECT COUNT(*) FROM products p WHERE p.categoryId = pc.id) AS productCount
        FROM product_categories pc
        LEFT JOIN users u ON pc.createdById = u.id
        WHERE pc.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category Not Found' });
      }

      // res.status(200).json(result.rows[0]);
      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product category Fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { categoryName } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE product_categories SET categoryName = $1 WHERE id = $2 RETURNING *',
        [categoryName, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category Not Found' });
      }
      res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM product_categories WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.status(200).json({ message: 'Category deleted successfully' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};