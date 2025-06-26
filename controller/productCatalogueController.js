// Create Product Catalogue
exports.createProductCatalogue = async (req, res) => {
  const { createdById, exportUrl, image, catalogueName, companyId, productIds } = req.body;

  // Input validation
  if (!createdById || !catalogueName || !companyId || !productIds) {
    return res.status(400).json({ error: 'createdById, catalogueName, companyId, and productIds are required' });
  }

  // Validate data types and formats
  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }

  if (!validator.isLength(catalogueName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'catalogueName must be between 1 and 255 characters' });
  }

  if (exportUrl && !validator.isURL(exportUrl, { require_protocol: true })) {
    return res.status(400).json({ error: 'exportUrl must be a valid URL with protocol if provided' });
  }

  if (image && !validator.isURL(image, { require_protocol: true })) {
    return res.status(400).json({ error: 'image must be a valid URL with protocol if provided' });
  }

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'productIds must be a non-empty array' });
  }

  for (const productId of productIds) {
    if (!validator.isUUID(productId)) {
      return res.status(400).json({ error: 'Each productId must be a valid UUID' });
    }
  }

  // Sanitize inputs
  const sanitizedCatalogueName = xss(catalogueName);
  const sanitizedExportUrl = exportUrl ? xss(exportUrl) : null;
  const sanitizedImage = image ? xss(image) : null;
  const sanitizedCompanyId = xss(companyId);

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      // Verify createdById exists in users table
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      // Verify productIds exist in products table
      for (const productId of productIds) {
        const productCheck = await client.query('SELECT 1 FROM products WHERE id = $1', [productId]);
        if (productCheck.rowCount === 0) {
          return res.status(400).json({ error: `Invalid productId: ${productId} does not exist` });
        }
      }

      // Check for duplicate catalogue name for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM productcatalogues WHERE companyId = $1 AND catalogueName = $2',
        [sanitizedCompanyId, sanitizedCatalogueName]
      );
      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Catalogue name already exists for this company' });
      }

      const result = await client.query(
        `INSERT INTO productcatalogues (createdById, exportUrl, image, catalogueName, companyId, productIds)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [createdById, sanitizedExportUrl, sanitizedImage, sanitizedCatalogueName, sanitizedCompanyId, productIds]
      );

      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product catalogue created successfully'
      });
    } catch (err) {
      console.error('Create product catalogue error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: 'createdById does not exist in users table' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: 'Unique constraint violation' });
      }
      res.status(500).json({ error: 'Failed to create product catalogue', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get All Product Catalogues
exports.getAllProductCatalogues = async (req, res) => {
  const { companyId, search, page = 1, limit = 10 } = req.query;

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: 'page must be a positive integer' });
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ error: 'limit must be a positive integer between 1 and 100' });
  }

  // Search parameter validation
  if (search && !validator.isLength(search, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'search must be between 1 and 255 characters' });
  }

  // Sanitize inputs
  const sanitizedSearch = search ? xss(search) : null;
  const sanitizedCompanyId = companyId ? xss(companyId) : null;

  try {
    const client = await pool.connect();
    try {
      const offset = (pageNum - 1) * limitNum;

      let query = `
        SELECT 
          pc.*,
          u.name AS createdByName
        FROM productcatalogues pc
        LEFT JOIN users u ON pc.createdById = u.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) FROM productcatalogues WHERE 1=1`;
      const queryParams = [];
      const countParams = [];
      let paramIndex = 1;

      if (sanitizedCompanyId) {
        query += ` AND pc.companyId = $${paramIndex}`;
        countQuery += ` AND companyId = $${paramIndex}`;
        queryParams.push(sanitizedCompanyId);
        countParams.push(sanitizedCompanyId);
        paramIndex++;
      }

      if (sanitizedSearch) {
        query += ` AND pc.catalogueName ILIKE $${paramIndex}`;
        countQuery += ` AND catalogueName ILIKE $${paramIndex}`;
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
        message: 'Product catalogues fetched successfully'
      });
    } catch (err) {
      console.error('Get product catalogues error:', err.stack);
      res.status(500).json({ error: 'Failed to fetch product catalogues', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get Product Catalogue by ID
exports.getProductCatalogueById = async (req, res) => {
  const { id } = req.params;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT 
          pc.*,
          u.name AS createdByName
        FROM productcatalogues pc
        LEFT JOIN users u ON pc.createdById = u.id
        WHERE pc.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product catalogue fetched successfully'
      });
    } catch (err) {
      console.error('Get product catalogue error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch product catalogue', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Update Product Catalogue
exports.updateProductCatalogue = async (req, res) => {
  const { id } = req.params;
  const { createdById, exportUrl, image, catalogueName, companyId, productIds } = req.body;

  if (!createdById || !catalogueName || !companyId || !productIds) {
    return res.status(400).json({ error: 'createdById, catalogueName, companyId, and productIds are required' });
  }

  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }

  if (!validator.isLength(catalogueName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'catalogueName must be between 1 and 255 characters' });
  }

  if (exportUrl && !validator.isURL(exportUrl, { require_protocol: true })) {
    return res.status(400).json({ error: 'exportUrl must be a valid URL with protocol if provided' });
  }

  if (image && !validator.isURL(image, { require_protocol: true })) {
    return res.status(400).json({ error: 'image must be a valid URL with protocol if provided' });
  }

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'productIds must be a non-empty array' });
  }

  for (const productId of productIds) {
    if (!validator.isUUID(productId)) {
      return res.status(400).json({ error: 'Each productId must be a valid UUID' });
    }
  }

  const sanitizedCatalogueName = xss(catalogueName);
  const sanitizedExportUrl = exportUrl ? xss(exportUrl) : null;
  const sanitizedImage = image ? xss(image) : null;
  const sanitizedCompanyId = xss(companyId);

  try {
    const client = await pool.connect();
    try {
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      for (const productId of productIds) {
        const productCheck = await client.query('SELECT 1 FROM products WHERE id = $1', [productId]);
        if (productCheck.rowCount === 0) {
          return res.status(400).json({ error: `Invalid productId: ${productId} does not exist` });
        }
      }

      const result = await client.query(
        `UPDATE productcatalogues
         SET createdById = $1, exportUrl = $2, image = $3, catalogueName = $4, companyId = $5, productIds = $6
         WHERE id = $7 RETURNING *`,
        [createdById, sanitizedExportUrl, sanitizedImage, sanitizedCatalogueName, sanitizedCompanyId, productIds, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product catalogue updated successfully'
      });
    } catch (err) {
      console.error('Update product catalogue error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: 'createdById does not exist in users table' });
      }
      res.status(500).json({ error: 'Failed to update product catalogue', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Delete Product Catalogue
exports.deleteProductCatalogue = async (req, res) => {
  const { id } = req.params;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM productcatalogues WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }
      res.status(200).json({
        status: true,
        message: 'Catalogue deleted successfully'
      });
    } catch (err) {
      console.error('Delete product catalogue error:', err.stack);
      res.status(500).json({ error: 'Failed to delete product catalogue', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};