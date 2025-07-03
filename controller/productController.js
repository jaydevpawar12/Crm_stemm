const validator = require('validator');
const xss = require('xss');
const { pool } = require('../db');

// Create Product
exports.createProduct = async (req, res) => {
  const {
    productcode, productname, categoryid, brand, price,
    gstpercentage, hsncode, productimages, createdbyid, companyid
  } = req.body;

  // Required field validation
  if (!productcode || !productname || !createdbyid || !companyid) {
    return res.status(400).json({ error: 'productcode, productname, createdbyid, and companyid are required' });
  }

  // UUID validation
  if (!validator.isUUID(createdbyid)) {
    return res.status(400).json({ error: 'createdbyid must be a valid UUID' });
  }
  if (categoryid && !validator.isUUID(categoryid)) {
    return res.status(400).json({ error: 'categoryid must be a valid UUID' });
  }

  // String length validation
  if (!validator.isLength(productcode, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'productcode must be between 1 and 50 characters' });
  }
  if (!validator.isLength(productname, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'productname must be between 1 and 255 characters' });
  }
  if (brand && !validator.isLength(brand, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'brand must be between 1 and 100 characters if provided' });
  }
  if (companyid && !validator.isLength(companyid, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyid must be between 1 and 50 characters' });
  }

  // HSN code validation
  if (hsncode && !/^\d{6,8}$/.test(hsncode)) {
    return res.status(400).json({ error: 'hsncode must be a 6-8 digit number if provided' });
  }

  // Price and GST percentage validation
  if (price && !validator.isDecimal(price.toString(), { min: 0 })) {
    return res.status(400).json({ error: 'price must be a valid non-negative decimal number if provided' });
  }
  if (gstpercentage && !validator.isDecimal(gstpercentage.toString(), { min: 0, max: 100 })) {
    return res.status(400).json({ error: 'gstpercentage must be a valid decimal number between 0 and 100 if provided' });
  }

  // Product images validation
  if (productimages) {
    if (!Array.isArray(productimages)) {
      return res.status(400).json({ error: 'productimages must be an array' });
    }
    for (const image of productimages) {
      if (!validator.isURL(image, { require_protocol: true })) {
        return res.status(400).json({ error: 'Each productimages entry must be a valid URL with protocol' });
      }
    }
  }

  // Sanitize inputs
  const sanitizedProductcode = xss(productcode.trim());
  const sanitizedProductname = xss(productname.trim());
  const sanitizedBrand = brand ? xss(brand.trim()) : null;
  const sanitizedHsncode = hsncode ? xss(hsncode.trim()) : null;
  const sanitizedProductimages = productimages ? productimages.map(img => xss(img.trim())) : null;
  const sanitizedPrice = price ? xss(price.toString().trim()) : null;
  const sanitizedGstpercentage = gstpercentage ? xss(gstpercentage.toString().trim()) : null;
  const sanitizedCompanyid = xss(companyid.trim());

  try {
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query('BEGIN');

      // Verify createdbyid exists in users table
      const userCheck = await client.query('SELECT 1 FROM public.users WHERE id = $1', [createdbyid]);
      if (userCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid createdbyid: user does not exist' });
      }

      // Verify categoryid exists if provided
      if (categoryid) {
        const categoryCheck = await client.query('SELECT 1 FROM public.productcategories WHERE id = $1', [categoryid]);
        if (categoryCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid categoryid: category does not exist' });
        }
      }

      // Check for duplicate productcode for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.products WHERE companyid = $1 AND productcode = $2',
        [sanitizedCompanyid, sanitizedProductcode]
      );
      if (duplicateCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Product code already exists for this company' });
      }

      const result = await client.query(
        `INSERT INTO public.products (
          productcode, productname, categoryid, brand, price,
          gstpercentage, hsncode, productimages, createdbyid, companyid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, productcode, productname, categoryid, brand, price,
                  gstpercentage, hsncode, productimages, createdbyid, companyid, createdon`,
        [
          sanitizedProductcode, sanitizedProductname, categoryid, sanitizedBrand, sanitizedPrice,
          sanitizedGstpercentage, sanitizedHsncode, sanitizedProductimages, createdbyid, sanitizedCompanyid
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product created successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdbyid or categoryid does not exist' });
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
  const { categoryid, companyid, search, page = 1, limit = 10 } = req.query;

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ error: 'Invalid limit: Must be a positive integer not exceeding 100' });
  }

  // UUID validation
  if (categoryid && !validator.isUUID(categoryid)) {
    return res.status(400).json({ error: 'Invalid categoryid format: Must be a valid UUID' });
  }

  // Search parameter validation
  if (search && !validator.isLength(search, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'search must be between 1 and 255 characters' });
  }

  // Sanitize inputs
  const sanitizedSearch = search ? xss(search.trim()) : null;
  const sanitizedCompanyid = companyid ? xss(companyid.trim()) : null;

  try {
    const client = await pool.connect();
    try {
      const offset = (pageNum - 1) * limitNum;

      let query = `
        SELECT 
          p.id, p.productcode, p.productname, p.categoryid, p.brand, p.price,
          p.gstpercentage, p.hsncode, p.productimages, p.createdbyid, p.companyid, p.createdon,
          u.name AS createdbyname,
          pc.categoryname
        FROM public.products p
        LEFT JOIN public.users u ON p.createdbyid = u.id
        LEFT JOIN public.productcategories pc ON p.categoryid = pc.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) FROM public.products WHERE 1=1`;
      const queryParams = [];
      const countParams = [];
      let paramIndex = 1;

      if (categoryid) {
        query += ` AND p.categoryid = $${paramIndex}::uuid`;
        countQuery += ` AND categoryid = $${paramIndex}::uuid`;
        queryParams.push(categoryid);
        countParams.push(categoryid);
        paramIndex++;
      }

      if (sanitizedCompanyid) {
        query += ` AND p.companyid = $${paramIndex}`;
        countQuery += ` AND companyid = $${paramIndex}`;
        queryParams.push(sanitizedCompanyid);
        countParams.push(sanitizedCompanyid);
        paramIndex++;
      }

      if (sanitizedSearch) {
        query += ` AND p.productname ILIKE $${paramIndex}`;
        countQuery += ` AND productname ILIKE $${paramIndex}`;
        queryParams.push(`%${sanitizedSearch}%`);
        countParams.push(`%${sanitizedSearch}%`);
        paramIndex++;
      }

      query += ` ORDER BY p.createdon DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
          p.id, p.productcode, p.productname, p.categoryid, p.brand, p.price,
          p.gstpercentage, p.hsncode, p.productimages, p.createdbyid, p.companyid, p.createdon,
          u.name AS createdbyname,
          pc.categoryname
        FROM public.products p
        LEFT JOIN public.users u ON p.createdbyid = u.id
        LEFT JOIN public.productcategories pc ON p.categoryid = pc.id
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
    productcode, productname, categoryid, brand, price,
    gstpercentage, hsncode, productimages, createdbyid, companyid
  } = req.body;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  if (!productcode || !productname || !createdbyid || !companyid) {
    return res.status(400).json({ error: 'productcode, productname, createdbyid, and companyid are required' });
  }

  if (!validator.isUUID(createdbyid)) {
    return res.status(400).json({ error: 'createdbyid must be a valid UUID' });
  }
  if (categoryid && !validator.isUUID(categoryid)) {
    return res.status(400).json({ error: 'categoryid must be a valid UUID' });
  }

  if (!validator.isLength(productcode, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'productcode must be between 1 and 50 characters' });
  }
  if (!validator.isLength(productname, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'productname must be between 1 and 255 characters' });
  }
  if (brand && !validator.isLength(brand, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'brand must be between 1 and 100 characters if provided' });
  }
  if (!validator.isLength(companyid, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyid must be between 1 and 50 characters' });
  }

  if (hsncode && !/^\d{6,8}$/.test(hsncode)) {
    return res.status(400).json({ error: 'hsncode must be a 6-8 digit number if provided' });
  }

  if (price && !validator.isDecimal(price.toString(), { min: 0 })) {
    return res.status(400).json({ error: 'price must be a valid non-negative decimal number if provided' });
  }
  if (gstpercentage && !validator.isDecimal(gstpercentage.toString(), { min: 0, max: 100 })) {
    return res.status(400).json({ error: 'gstpercentage must be a valid decimal number between 0 and 100 if provided' });
  }

  if (productimages) {
    if (!Array.isArray(productimages)) {
      return res.status(400).json({ error: 'productimages must be an array' });
    }
    for (const image of productimages) {
      if (!validator.isURL(image, { require_protocol: true })) {
        return res.status(400).json({ error: 'Each productimages entry must be a valid URL with protocol' });
      }
    }
  }

  const sanitizedProductcode = xss(productcode.trim());
  const sanitizedProductname = xss(productname.trim());
  const sanitizedBrand = brand ? xss(brand.trim()) : null;
  const sanitizedHsncode = hsncode ? xss(hsncode.trim()) : null;
  const sanitizedProductimages = productimages ? productimages.map(img => xss(img.trim())) : null;
  const sanitizedPrice = price ? xss(price.toString().trim()) : null;
  const sanitizedGstpercentage = gstpercentage ? xss(gstpercentage.toString().trim()) : null;
  const sanitizedCompanyid = xss(companyid.trim());

  try {
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query('BEGIN');

      // Verify createdbyid exists in users table
      const userCheck = await client.query('SELECT 1 FROM public.users WHERE id = $1', [createdbyid]);
      if (userCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid createdbyid: user does not exist' });
      }

      // Verify categoryid exists if provided
      if (categoryid) {
        const categoryCheck = await client.query('SELECT 1 FROM public.productcategories WHERE id = $1', [categoryid]);
        if (categoryCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid categoryid: category does not exist' });
        }
      }

      // Check for duplicate productcode for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.products WHERE companyid = $1 AND productcode = $2 AND id != $3',
        [sanitizedCompanyid, sanitizedProductcode, id]
      );
      if (duplicateCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Product code already exists for this company' });
      }

      const result = await client.query(
        `UPDATE public.products SET 
          productcode = $1, productname = $2, categoryid = $3, brand = $4, price = $5,
          gstpercentage = $6, hsncode = $7, productimages = $8, createdbyid = $9, companyid = $10
        WHERE id = $11
        RETURNING id, productcode, productname, categoryid, brand, price,
                  gstpercentage, hsncode, productimages, createdbyid, companyid, createdon`,
        [
          sanitizedProductcode, sanitizedProductname, categoryid, sanitizedBrand, sanitizedPrice,
          sanitizedGstpercentage, sanitizedHsncode, sanitizedProductimages, createdbyid, sanitizedCompanyid, id
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      await client.query('COMMIT');

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product updated successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Update product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdbyid or categoryid does not exist' });
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
      // Start transaction
      await client.query('BEGIN');

      const result = await client.query(
        `DELETE FROM public.products WHERE id = $1
        RETURNING id, productcode, productname, categoryid, brand, price,
                  gstpercentage, hsncode, productimages, createdbyid, companyid, createdon`,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      await client.query('COMMIT');

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product deleted successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Delete product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete product due to foreign key constraint', details: err.detail || 'Product is referenced by other records' });
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