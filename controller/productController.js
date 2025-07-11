const validator = require('validator');
const xss = require('xss');
const { pool } = require('../db');

// Utility function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    let camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    camelKey = camelKey.replace(/^([A-Z])/, (match, letter) => letter.toLowerCase());
    // Explicit mappings for specific fields
    if (camelKey === 'productcode') camelKey = 'productCode';
    if (camelKey === 'productname') camelKey = 'productName';
    if (camelKey === 'categoryid') camelKey = 'categoryId';
    if (camelKey === 'createdbyid') camelKey = 'createdById';
    if (camelKey === 'createdon') camelKey = 'createdOn';
    if (camelKey === 'companyid') camelKey = 'companyId';
    if (camelKey === 'gstpercentage') camelKey = 'gstPercentage';
    if (camelKey === 'hsncode') camelKey = 'hsnCode';
    if (camelKey === 'productimages') camelKey = 'productImages';
    if (camelKey === 'createdByName') camelKey = 'createdByName';
    if (camelKey === 'categoryName') camelKey = 'categoryName';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

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
  // if (!validator.isLength(productCode, { min: 1, max: 50 })) {
  //   return res.status(400).json({ error: 'productCode must be between 1 and 50 characters' });
  // }
  // if (!validator.isLength(productName, { min: 1, max: 255 })) {
  //   return res.status(400).json({ error: 'productName must be between 1 and 255 characters' });
  // }
  // if (brand && !validator.isLength(brand, { min: 1, max: 100 })) {
  //   return res.status(400).json({ error: 'brand must be between 1 and 100 characters if provided' });
  // }
  // if (!validator.isLength(companyId, { min: 1, max: 50 })) {
  //   return res.status(400).json({ error: 'companyId must be between 1 and 50 characters' });
  // }

  // HSN code validation
  if (hsnCode && !/^\d{6,8}$/.test(hsnCode)) {
    return res.status(400).json({ error: 'hsnCode must be a 6-8 digit number if provided' });
  }

  // Price and GST percentage validation
  if (price && !validator.isDecimal(price.toString(), { min: 0 })) {
    return res.status(400).json({ error: 'price must be a valid non-negative decimal number if provided' });
  }
  if (gstPercentage && !validator.isDecimal(gstPercentage.toString(), { min: 0, max: 100 })) {
    return res.status(400).json({ error: 'gstPercentage must be a valid decimal number between 0 and 100 if provided' });
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
  const sanitizedProductCode = xss(productCode.trim());
  const sanitizedProductName = xss(productName.trim());
  const sanitizedBrand = brand ? xss(brand.trim()) : null;
  const sanitizedHsnCode = hsnCode ? xss(hsnCode.trim()) : null;
  const sanitizedProductImages = productImages ? productImages.map(img => xss(img.trim())) : null;
  const sanitizedPrice = price ? xss(price.toString().trim()) : null;
  const sanitizedGstPercentage = gstPercentage ? xss(gstPercentage.toString().trim()) : null;
  const sanitizedCompanyId = xss(companyId.trim());

  try {
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query('BEGIN');

      // Verify createdById exists in users table
      const userCheck = await client.query('SELECT 1 FROM public.users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      // Verify categoryId exists if provided
      if (categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM public.product_categories WHERE id = $1', [categoryId]);
        if (categoryCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid categoryId: category does not exist' });
        }
      }

      // Check for duplicate product code for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.products WHERE companyid = $1 AND productcode = $2',
        [sanitizedCompanyId, sanitizedProductCode]
      );
      if (duplicateCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Product code already exists for this company' });
      }

      const result = await client.query(
        `INSERT INTO public.products (
          productcode, productname, categoryid, brand, price,
          gstpercentage, hsncode, productimages, createdbyid, companyid, createdon
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING id, productcode, productname, categoryid, brand, price,
                  gstpercentage, hsncode, productimages, createdbyid, companyid, createdon`,
        [
          sanitizedProductCode, sanitizedProductName, categoryId, sanitizedBrand, sanitizedPrice,
          sanitizedGstPercentage, sanitizedHsnCode, sanitizedProductImages, createdById, sanitizedCompanyId
        ]
      );

      await client.query('COMMIT');

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(201).json({
        status: true,
        data: camelCaseData,
        message: 'Product created successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdById or categoryId does not exist' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
      }
      if (err.code === '42703') {
        return res.status(500).json({ error: 'Database schema error: column not found', details: err.message });
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
  const { categoryId, companyId, brand, hsnCode, createdById, createdOnFrom, createdOnTo, search, page = 1, limit = 10 } = req.query;

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
  if (categoryId && !validator.isUUID(categoryId)) {
    return res.status(400).json({ error: 'Invalid categoryId format: Must be a valid UUID' });
  }
  if (createdById && !validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'Invalid createdById format: Must be a valid UUID' });
  }

  // String length validation
  if (companyId && !validator.isLength(companyId, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyId must be between 1 and 50 characters if provided' });
  }
  if (brand && !validator.isLength(brand, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'brand must be between 1 and 100 characters if provided' });
  }
  if (hsnCode && !/^\d{6,8}$/.test(hsnCode)) {
    return res.status(400).json({ error: 'hsnCode must be a 6-8 digit number if provided' });
  }
  if (search && !validator.isLength(search, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'search must be between 1 and 255 characters' });
  }

  // Date validation
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?)?$/;
  if (createdOnFrom && (!dateRegex.test(createdOnFrom) || isNaN(Date.parse(createdOnFrom)))) {
    return res.status(400).json({ error: 'Invalid createdOnFrom: Must be a valid ISO 8601 date (e.g., 2025-07-02 or 2025-07-02T00:00:00Z)' });
  }
  if (createdOnTo && (!dateRegex.test(createdOnTo) || isNaN(Date.parse(createdOnTo)))) {
    return res.status(400).json({ error: 'Invalid createdOnTo: Must be a valid ISO 8601 date (e.g., 2025-07-02 or 2025-07-02T23:59:59Z)' });
  }

  // Sanitize inputs
  const sanitizedSearch = search ? xss(search.trim()) : null;
  const sanitizedCompanyId = companyId ? xss(companyId.trim()) : null;
  const sanitizedBrand = brand ? xss(brand.trim()) : null;
  const sanitizedHsnCode = hsnCode ? xss(hsnCode.trim()) : null;

  try {
    const client = await pool.connect();
    try {
      // Validate createdById exists if provided
      if (createdById) {
        const userCheck = await client.query('SELECT 1 FROM public.users WHERE id = $1', [createdById]);
        if (userCheck.rowCount === 0) {
          return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
        }
      }

      // Validate categoryId exists if provided
      if (categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM public.product_categories WHERE id = $1', [categoryId]);
        if (categoryCheck.rowCount === 0) {
          return res.status(400).json({ error: 'Invalid categoryId: category does not exist' });
        }
      }

      const offset = (pageNum - 1) * limitNum;

      let query = `
        SELECT 
          p.id, p.productcode, p.productname, p.categoryid, p.brand, p.price,
          p.gstpercentage, p.hsncode, p.productimages, p.createdbyid, p.companyid, p.createdon,
          u.name AS createdbyname,
          pc.categoryname
        FROM public.products p
        LEFT JOIN public.users u ON p.createdbyid = u.id
        LEFT JOIN public.product_categories pc ON p.categoryid = pc.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) FROM public.products WHERE 1=1`;
      const queryParams = [];
      const countParams = [];
      let paramIndex = 1;

      if (categoryId) {
        query += ` AND p.categoryid = $${paramIndex}::uuid`;
        countQuery += ` AND categoryid = $${paramIndex}::uuid`;
        queryParams.push(categoryId);
        countParams.push(categoryId);
        paramIndex++;
      }
      if (sanitizedCompanyId) {
        query += ` AND p.companyid = $${paramIndex}`;
        countQuery += ` AND companyid = $${paramIndex}`;
        queryParams.push(sanitizedCompanyId);
        countParams.push(sanitizedCompanyId);
        paramIndex++;
      }
      if (sanitizedBrand) {
        query += ` AND p.brand ILIKE $${paramIndex}`;
        countQuery += ` AND brand ILIKE $${paramIndex}`;
        queryParams.push(`%${sanitizedBrand}%`);
        countParams.push(`%${sanitizedBrand}%`);
        paramIndex++;
      }
      if (sanitizedHsnCode) {
        query += ` AND p.hsncode = $${paramIndex}`;
        countQuery += ` AND hsncode = $${paramIndex}`;
        queryParams.push(sanitizedHsnCode);
        countParams.push(sanitizedHsnCode);
        paramIndex++;
      }
      if (createdById) {
        query += ` AND p.createdbyid = $${paramIndex}::uuid`;
        countQuery += ` AND createdbyid = $${paramIndex}::uuid`;
        queryParams.push(createdById);
        countParams.push(createdById);
        paramIndex++;
      }
      if (createdOnFrom) {
        query += ` AND p.createdon >= $${paramIndex}`;
        countQuery += ` AND createdon >= $${paramIndex}`;
        queryParams.push(createdOnFrom);
        countParams.push(createdOnFrom);
        paramIndex++;
      }
      if (createdOnTo) {
        query += ` AND p.createdon <= $${paramIndex}`;
        countQuery += ` AND createdon <= $${paramIndex}`;
        queryParams.push(createdOnTo);
        countParams.push(createdOnTo);
        paramIndex++;
      }
      if (sanitizedSearch) {
        query += ` AND (p.productname ILIKE $${paramIndex} OR p.productcode ILIKE $${paramIndex})`;
        countQuery += ` AND (productname ILIKE $${paramIndex} OR productcode ILIKE $${paramIndex})`;
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

      // Convert snake_case to camelCase
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
        message: 'Products fetched successfully'
      });
    } catch (err) {
      console.error('Get products error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format in query parameters', details: err.message });
      }
      if (err.code === '22007') {
        return res.status(400).json({ error: 'Invalid date format in query parameters', details: err.message });
      }
      if (err.code === '42703') {
        return res.status(500).json({ error: 'Database schema error: column not found', details: err.message });
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
        LEFT JOIN public.product_categories pc ON p.categoryid = pc.id
        WHERE p.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Product fetched successfully'
      });
    } catch (err) {
      console.error('Get product error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      if (err.code === '42703') {
        return res.status(500).json({ error: 'Database schema error: column not found', details: err.message });
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

// Update Product (PUT - Full Update)
exports.updateProduct = async (req, res) => {
  const { id } = req.params;
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, companyId
  } = req.body;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

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
  if (!validator.isLength(companyId, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyId must be between 1 and 50 characters' });
  }

  if (hsnCode && !/^\d{6,8}$/.test(hsnCode)) {
    return res.status(400).json({ error: 'hsnCode must be a 6-8 digit number if provided' });
  }

  if (price && !validator.isDecimal(price.toString(), { min: 0 })) {
    return res.status(400).json({ error: 'price must be a valid non-negative decimal number if provided' });
  }
  if (gstPercentage && !validator.isDecimal(gstPercentage.toString(), { min: 0, max: 100 })) {
    return res.status(400).json({ error: 'gstPercentage must be a valid decimal number between 0 and 100 if provided' });
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

  const sanitizedProductCode = xss(productCode.trim());
  const sanitizedProductName = xss(productName.trim());
  const sanitizedBrand = brand ? xss(brand.trim()) : null;
  const sanitizedHsnCode = hsnCode ? xss(hsnCode.trim()) : null;
  const sanitizedProductImages = productImages ? productImages.map(img => xss(img.trim())) : null;
  const sanitizedPrice = price ? xss(price.toString().trim()) : null;
  const sanitizedGstPercentage = gstPercentage ? xss(gstPercentage.toString().trim()) : null;
  const sanitizedCompanyId = xss(companyId.trim());

  try {
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query('BEGIN');

      // Verify createdById exists in users table
      const userCheck = await client.query('SELECT 1 FROM public.users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      // Verify categoryId exists if provided
      if (categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM public.product_categories WHERE id = $1', [categoryId]);
        if (categoryCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid categoryId: category does not exist' });
        }
      }

      // Check for duplicate product code for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.products WHERE companyid = $1 AND productcode = $2 AND id != $3',
        [sanitizedCompanyId, sanitizedProductCode, id]
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
          sanitizedProductCode, sanitizedProductName, categoryId, sanitizedBrand, sanitizedPrice,
          sanitizedGstPercentage, sanitizedHsnCode, sanitizedProductImages, createdById, sanitizedCompanyId, id
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      await client.query('COMMIT');

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Product updated successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Update product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdById or categoryId does not exist' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
      }
      if (err.code === '42703') {
        return res.status(500).json({ error: 'Database schema error: column not found', details: err.message });
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

// Patch Product (PATCH - Partial Update)
exports.patchProduct = async (req, res) => {
  const { id } = req.params;
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, companyId
  } = req.body;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  // Validate provided fields
  if (createdById && !validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }
  if (categoryId && !validator.isUUID(categoryId)) {
    return res.status(400).json({ error: 'categoryId must be a valid UUID' });
  }

  if (productCode && !validator.isLength(productCode, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'productCode must be between 1 and 50 characters if provided' });
  }
  if (productName && !validator.isLength(productName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'productName must be between 1 and 255 characters if provided' });
  }
  if (brand && !validator.isLength(brand, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'brand must be between 1 and 100 characters if provided' });
  }
  if (companyId && !validator.isLength(companyId, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyId must be between 1 and 50 characters if provided' });
  }

  if (hsnCode && !/^\d{6,8}$/.test(hsnCode)) {
    return res.status(400).json({ error: 'hsnCode must be a 6-8 digit number if provided' });
  }

  if (price && !validator.isDecimal(price.toString(), { min: 0 })) {
    return res.status(400).json({ error: 'price must be a valid non-negative decimal number if provided' });
  }
  if (gstPercentage && !validator.isDecimal(gstPercentage.toString(), { min: 0, max: 100 })) {
    return res.status(400).json({ error: 'gstPercentage must be a valid decimal number between 0 and 100 if provided' });
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

  // Sanitize inputs
  const sanitizedProductCode = productCode ? xss(productCode.trim()) : undefined;
  const sanitizedProductName = productName ? xss(productName.trim()) : undefined;
  const sanitizedBrand = brand ? xss(brand.trim()) : undefined;
  const sanitizedHsnCode = hsnCode ? xss(hsnCode.trim()) : undefined;
  const sanitizedProductImages = productImages ? productImages.map(img => xss(img.trim())) : undefined;
  const sanitizedPrice = price ? xss(price.toString().trim()) : undefined;
  const sanitizedGstPercentage = gstPercentage ? xss(gstPercentage.toString().trim()) : undefined;
  const sanitizedCompanyId = companyId ? xss(companyId.trim()) : undefined;

  try {
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query('BEGIN');

      // Verify createdById exists if provided
      if (createdById) {
        const userCheck = await client.query('SELECT 1 FROM public.users WHERE id = $1', [createdById]);
        if (userCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
        }
      }

      // Verify categoryId exists if provided
      if (categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM public.product_categories WHERE id = $1', [categoryId]);
        if (categoryCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid categoryId: category does not exist' });
        }
      }

      // Check for duplicate product code if provided
      if (sanitizedProductCode && sanitizedCompanyId) {
        const duplicateCheck = await client.query(
          'SELECT 1 FROM public.products WHERE companyid = $1 AND productcode = $2 AND id != $3',
          [sanitizedCompanyId, sanitizedProductCode, id]
        );
        if (duplicateCheck.rowCount > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Product code already exists for this company' });
        }
      }

      // Check if product exists
      const existing = await client.query('SELECT 1 FROM public.products WHERE id = $1', [id]);
      if (existing.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      // Build dynamic update query
      let setClauses = [];
      let values = [];
      let paramIndex = 1;

      if (sanitizedProductCode !== undefined) {
        setClauses.push(`productcode = $${paramIndex}`);
        values.push(sanitizedProductCode);
        paramIndex++;
      }
      if (sanitizedProductName !== undefined) {
        setClauses.push(`productname = $${paramIndex}`);
        values.push(sanitizedProductName);
        paramIndex++;
      }
      if (categoryId !== undefined) {
        setClauses.push(`categoryid = $${paramIndex}`);
        values.push(categoryId);
        paramIndex++;
      }
      if (sanitizedBrand !== undefined) {
        setClauses.push(`brand = $${paramIndex}`);
        values.push(sanitizedBrand);
        paramIndex++;
      }
      if (sanitizedPrice !== undefined) {
        setClauses.push(`price = $${paramIndex}`);
        values.push(sanitizedPrice);
        paramIndex++;
      }
      if (sanitizedGstPercentage !== undefined) {
        setClauses.push(`gstpercentage = $${paramIndex}`);
        values.push(sanitizedGstPercentage);
        paramIndex++;
      }
      if (sanitizedHsnCode !== undefined) {
        setClauses.push(`hsncode = $${paramIndex}`);
        values.push(sanitizedHsnCode);
        paramIndex++;
      }
      if (sanitizedProductImages !== undefined) {
        setClauses.push(`productimages = $${paramIndex}`);
        values.push(sanitizedProductImages);
        paramIndex++;
      }
      if (createdById !== undefined) {
        setClauses.push(`createdbyid = $${paramIndex}`);
        values.push(createdById);
        paramIndex++;
      }
      if (sanitizedCompanyId !== undefined) {
        setClauses.push(`companyid = $${paramIndex}`);
        values.push(sanitizedCompanyId);
        paramIndex++;
      }

      if (setClauses.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'No fields provided for update' });
      }

      values.push(id);
      const query = `
        UPDATE public.products
        SET ${setClauses.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id, productcode, productname, categoryid, brand, price,
                  gstpercentage, hsncode, productimages, createdbyid, companyid, createdon
      `;

      const result = await client.query(query, values);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Product not found' });
      }

      await client.query('COMMIT');

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Product updated successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Patch product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdById or categoryId does not exist' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
      }
      if (err.code === '42703') {
        return res.status(500).json({ error: 'Database schema error: column not found', details: err.message });
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

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Product deleted successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Delete product error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete product due to foreign key constraint', details: err.detail || 'Product is referenced by other records' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      if (err.code === '42703') {
        return res.status(500).json({ error: 'Database schema error: column not found', details: err.message });
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