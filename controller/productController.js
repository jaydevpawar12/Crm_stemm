const validator = require('validator');
const xss = require('xss');
// const { initializePool } = require('../db');
const { pool } = require('../db');


// Create Product
exports.createProduct = async (req, res) => {
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, companyId
  } = req.body;

  // Required field validation
  if (!productCode || !productName || !createdById || !companyId) {
    return res.status(400).json({ error: 'productCode, productName, createdById, and companyId are required' });
  }

  // UUID validation
  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }
  if (categoryId && !validator.isUUID(categoryId)) {
    return res.status(400).json({ error: 'categoryId must be a valid UUID' });
  }

  // String length validation
  if (!validator.isLength(productCode, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'productCode must be between 1 and 50 characters' });
  }
  if (!validator.isLength(productName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'productName must be between 1 and 255 characters' });
  }
  if (brand && !validator.isLength(brand, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'brand must be between 1 and 100 characters if provided' });
  }

  // HSN code validation
  if (hsnCode && !/^\d{6,8}$/.test(hsnCode)) {
    return res.status(400).json({ error: 'hsnCode must be a 6-8 digit number if provided' });
  }

  // Product images validation
  if (productImages) {
    if (!Array.isArray(productImages)) {
      return res.status(400).json({ error: 'productImages must be an array' });
    }
    for (const image of productImages) {
      if (!validator.isURL(image, { require_protocol: true })) {
        return res.status(400).json({ error: 'Each productImages entry must be a valid URL with protocol' });
      }
    }
  }

  // Sanitize inputs
  const sanitizedProductCode = xss(productCode);
  const sanitizedProductName = xss(productName);
  const sanitizedBrand = brand ? xss(brand) : null;
  const sanitizedHsnCode = hsnCode ? xss(hsnCode) : null;
  const sanitizedProductImages = productImages ? productImages.map(img => xss(img)) : null;
  const sanitizedPrice = price ? xss(price) : null;
  const sanitizedGstPercentage = gstPercentage ? xss(gstPercentage) : null;
  const sanitizedCompanyId = xss(companyId);

  try {
    const client = await pool.connect();
    try {
      // Verify createdById exists in users table
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      // Verify categoryId exists if provided
      if (categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM product_categories WHERE id = $1', [categoryId]);
        if (categoryCheck.rowCount === 0) {
          return res.status(400).json({ error: 'Invalid categoryId: category does not exist' });
        }
      }

      // Check for duplicate productCode for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM products WHERE companyId = $1 AND productCode = $2',
        [sanitizedCompanyId, sanitizedProductCode]
      );
      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Product code already exists for this company' });
      }

      const result = await client.query(
        `INSERT INTO products (
          productCode, productName, categoryId, brand, price,
          gstPercentage, hsnCode, productImages, createdById, companyId
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          sanitizedProductCode, sanitizedProductName, categoryId, sanitizedBrand, sanitizedPrice,
          sanitizedGstPercentage, sanitizedHsnCode, sanitizedProductImages, createdById, sanitizedCompanyId
        ]
      );

      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product created successfully'
      });
    } catch (err) {
      console.error('Create product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
      }
      res.status(500).json({ error: 'Failed to create product', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get All Products
exports.getAllProducts = async (req, res) => {
  const { categoryId, companyId, search, page = 1, limit = 10 } = req.query;

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
  }
  if (isNaN(limitNum) || limitNum < 1) {
    return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
  }

  // UUID validation
  if (categoryId && !validator.isUUID(categoryId)) {
    return res.status(400).json({ error: 'Invalid categoryId format: Must be a valid UUID' });
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
          p.*,
          u.name AS createdByName,
          pc.categoryName
        FROM public.products p
        LEFT JOIN public.users u ON p.createdById = u.id
        LEFT JOIN public.product_categories pc ON p.categoryId = pc.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) FROM public.products WHERE 1=1`;
      const queryParams = [];
      const countParams = [];
      let paramIndex = 1;

      if (categoryId) {
        query += ` AND p.categoryId = $${paramIndex}::uuid`;
        countQuery += ` AND categoryId = $${paramIndex}::uuid`;
        queryParams.push(categoryId);
        countParams.push(categoryId);
        paramIndex++;
      }

      if (companyId) {
        query += ` AND p.companyId = $${paramIndex}`;
        countQuery += ` AND companyId = $${paramIndex}`;
        queryParams.push(companyId);
        countParams.push(companyId);
        paramIndex++;
      }

      if (sanitizedSearch) {
        query += ` AND p.productName ILIKE $${paramIndex}`;
        countQuery += ` AND productName ILIKE $${paramIndex}`;
        queryParams.push(`%${sanitizedSearch}%`);
        countParams.push(`%${sanitizedSearch}%`);
        paramIndex++;
      }

      query += ` ORDER BY p.createdOn DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
        message: 'Products fetched successfully'
      });
    } catch (err) {
      console.error('Get products error:', err.stack);
      if (err.code === '22023' || err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format in query parameters', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch products', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get Product by ID
exports.getProductById = async (req, res) => {
  const { id } = req.params;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          p.*,
          u.name AS createdByName,
          pc.categoryName
        FROM public.products p
        LEFT JOIN public.users u ON p.createdById = u.id
        LEFT JOIN public.product_categories pc ON p.categoryId = pc.id
        WHERE p.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product fetched successfully'
      });
    } catch (err) {
      console.error('Get product error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch product', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Update Product
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, companyId
  } = req.body;

  if (!productCode || !productName || !createdById || !companyId) {
    return res.status(400).json({ error: 'productCode, productName, createdById, and companyId are required' });
  }

  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }
  if (categoryId && !validator.isUUID(categoryId)) {
    return res.status(400).json({ error: 'categoryId must be a valid UUID' });
  }

  if (!validator.isLength(productCode, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'productCode must be between 1 and 50 characters' });
  }
  if (!validator.isLength(productName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'productName must be between 1 and 255 characters' });
  }
  if (brand && !validator.isLength(brand, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'brand must be between 1 and 100 characters if provided' });
  }

  if (hsnCode && !/^\d{6,8}$/.test(hsnCode)) {
    return res.status(400).json({ error: 'hsnCode must be a 6-8 digit number if provided' });
  }

  if (productImages) {
    if (!Array.isArray(productImages)) {
      return res.status(400).json({ error: 'productImages must be an array' });
    }
    for (const image of productImages) {
      if (!validator.isURL(image, { require_protocol: true })) {
        return res.status(400).json({ error: 'Each productImages entry must be a valid URL with protocol' });
      }
    }
  }

  const sanitizedProductCode = xss(productCode);
  const sanitizedProductName = xss(productName);
  const sanitizedBrand = brand ? xss(brand) : null;
  const sanitizedHsnCode = hsnCode ? xss(hsnCode) : null;
  const sanitizedProductImages = productImages ? productImages.map(img => xss(img)) : null;
  const sanitizedPrice = price ? xss(price) : null;
  const sanitizedGstPercentage = gstPercentage ? xss(gstPercentage) : null;
  const sanitizedCompanyId = xss(companyId);

  try {
    const client = await pool.connect();
    try {
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      if (categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM product_categories WHERE id = $1', [categoryId]);
        if (categoryCheck.rowCount === 0) {
          return res.status(400).json({ error: 'Invalid categoryId: category does not exist' });
        }
      }

      const result = await client.query(
        `UPDATE products SET 
          productCode = $1, productName = $2, categoryId = $3, brand = $4, price = $5,
          gstPercentage = $6, hsnCode = $7, productImages = $8, createdById = $9, companyId = $10
        WHERE id = $11 RETURNING *`,
        [
          sanitizedProductCode, sanitizedProductName, categoryId, sanitizedBrand, sanitizedPrice,
          sanitizedGstPercentage, sanitizedHsnCode, sanitizedProductImages, createdById, sanitizedCompanyId, id
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product updated successfully'
      });
    } catch (err) {
      console.error('Update product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
      }
      res.status(500).json({ error: 'Failed to update product', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Delete Product
exports.deleteProduct = async (req, res) => {
  const { id } = req.params;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }
      res.status(200).json({
        status: true,
        message: 'Product deleted successfully'
      });
    } catch (err) {
      console.error('Delete product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete product due to foreign key constraint', details: 'Product is referenced by productcatalogues' });
      }
      res.status(500).json({ error: 'Failed to delete product', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};