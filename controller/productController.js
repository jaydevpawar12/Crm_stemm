const validator = require('validator');
const xss = require('xss');
// const { initializePool } = require('../db');
const { pool } = require('../db');


exports.createProduct = async (req, res) => {
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, catalogueId
  } = req.body;

  // Required field validation
  if (!productCode || !productName || !categoryId || !price || !gstPercentage || !createdById || !catalogueId) {
    return res.status(400).json({ error: 'productCode, productName, categoryId, price, gstPercentage, createdById, and catalogueId are required' });
  }

  // UUID validation
  if (!validator.isUUID(categoryId)) {
    return res.status(400).json({ error: 'categoryId must be a valid UUID' });
  }
  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }
  if (!validator.isUUID(catalogueId)) {
    return res.status(400).json({ error: 'catalogueId must be a valid UUID' });
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

  // Numeric validation
  // if (isNaN(price) || price <= 0) {
  //   return res.status(400).json({ error: 'price must be a positive number' });
  // }
  // if (isNaN(gstPercentage) || gstPercentage < 0 || gstPercentage > 100) {
  //   return res.status(400).json({ error: 'gstPercentage must be between 0 and 100' });
  // }

  // HSN code validation (6-8 digits)
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

  // Sanitize string inputs
  const sanitizedProductCode = xss(productCode);
  const sanitizedProductName = xss(productName);
  const sanitizedBrand = brand ? xss(brand) : null;
  const sanitizedHsnCode = hsnCode ? xss(hsnCode) : null;
  const sanitizedProductImages = productImages ? productImages.map(img => xss(img)) : null;

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

      // Verify categoryId exists in product_categories table
      const categoryCheck = await client.query(
        'SELECT 1 FROM product_categories WHERE id = $1',
        [categoryId]
      );
      if (categoryCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid categoryId: category does not exist' });
      }

      // Verify catalogueId exists in productcatalogues table
      const catalogueCheck = await client.query(
        'SELECT 1 FROM productcatalogues WHERE id = $1',
        [catalogueId]
      );
      if (catalogueCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid catalogueId: catalogue does not exist' });
      }

      // Check for duplicate productCode for the same user
      const duplicateCheck = await client.query(
        'SELECT 1 FROM products WHERE createdById = $1 AND productCode = $2',
        [createdById, sanitizedProductCode]
      );
      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Product code already exists for this user' });
      }

      const result = await client.query(
        `INSERT INTO products (
          productCode, productName, categoryId, brand, price,
          gstPercentage, hsnCode, productImages, createdById, catalogueId
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          sanitizedProductCode, sanitizedProductName, categoryId, sanitizedBrand, price,
          gstPercentage, sanitizedHsnCode, JSON.stringify(sanitizedProductImages),
          createdById, catalogueId
        ]
      );

      // res.status(201).json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product created successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ ALL
exports.getAllProducts = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      // Extract query parameters
      const { categoryid, catalogueid, page = 1, limit = 10 } = req.query;

      // UUID validation regex
      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

      // Validate categoryid format
      if (categoryid && !uuidRegex.test(categoryid)) {
        return res.status(400).json({ error: 'Invalid categoryid format: Must be a valid UUID' });
      }

      // Validate catalogueid format
      if (catalogueid && !uuidRegex.test(catalogueid)) {
        return res.status(400).json({ error: 'Invalid catalogueid format: Must be a valid UUID' });
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

      // Base query for fetching products
      let query = `
        SELECT 
          p.*,
          u.name AS createdby_name,
          pc.catalogueName AS catalogue_name,
          cat.categoryName AS category_name
        FROM public.products p
        LEFT JOIN public.users u ON p.createdbyid = u.id
        LEFT JOIN public.productcatalogues pc ON p.catalogueid = pc.id
        LEFT JOIN public.product_categories cat ON p.categoryid = cat.id
        WHERE 1=1
      `;

      // Array to hold query parameters
      const queryParams = [];
      let paramIndex = 1;

      // Add filter for categoryid if provided
      if (categoryid) {
        query += ` AND p.categoryid = $${paramIndex}::uuid `;
        queryParams.push(categoryid);
        paramIndex++;
      }

      // Add filter for catalogueid if provided
      if (catalogueid) {
        query += ` AND p.catalogueid = $${paramIndex}::uuid `;
        queryParams.push(catalogueid);
        paramIndex++;
      }

      // Add pagination
      query += ` ORDER BY p.createdon DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limitNum, offset);

      // Query to get total count
      let countQuery = `
        SELECT COUNT(*) 
        FROM public.products p
        WHERE 1=1
      `;
      const countParams = [];
      let countParamIndex = 1;

      if (categoryid) {
        countQuery += ` AND p.categoryid = $${countParamIndex}::uuid `;
        countParams.push(categoryid);
        countParamIndex++;
      }
      if (catalogueid) {
        countQuery += ` AND p.catalogueid = $${countParamIndex}::uuid `;
        countParams.push(catalogueid);
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
        success: true,
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
    console.error('Get products error:', err);
    if (err.code === '22023') {
      return res.status(400).json({ error: 'Invalid UUID format in query parameters' });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
};


exports.getProductById = async (req, res) => {
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
        `
        SELECT 
          p.*,
          u.name AS createdby_name,
          pc.catalogueName AS catalogue_name,
          cat.categoryName AS category_name
        FROM public.products p
        LEFT JOIN public.users u ON p.createdbyid = u.id
        LEFT JOIN public.productcatalogues pc ON p.catalogueid = pc.id
        LEFT JOIN public.product_categories cat ON p.categoryid = cat.id
        WHERE p.id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Product not found' });
      }

      // res.status(200).json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// UPDATE
exports.updateProduct = async (req, res) => {
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, catalogueId
  } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE products SET 
          productCode = $1, productName = $2, categoryId = $3, brand = $4, price = $5,
          gstPercentage = $6, hsnCode = $7, productImages = $8, createdById = $9, catalogueId = $10
        WHERE id = $11 RETURNING *`,
        [
          productCode, productName, categoryId, brand, price,
          gstPercentage, hsnCode, JSON.stringify(productImages),
          createdById, catalogueId, req.params.id
        ]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
      // res.status(200).json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product update successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE
exports.deleteProduct = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
      res.status(200).json({ message: 'Product deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};