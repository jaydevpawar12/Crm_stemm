const validator = require('validator');
const xss = require('xss');
const { pool } = require('../db');

// Create Product Catalogue
exports.createProductCatalogue = async (req, res) => {
  const { createdbyid, exporturl, image, cataloguename, companyid, productids } = req.body;

  // Input validation
  if (!createdbyid || !cataloguename || !companyid || !productids) {
    return res.status(400).json({ error: 'createdbyid, cataloguename, companyid, and productids are required' });
  }

  // UUID validation
  if (!validator.isUUID(createdbyid)) {
    return res.status(400).json({ error: 'createdbyid must be a valid UUID' });
  }

  // String length validation
  if (!validator.isLength(cataloguename, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'cataloguename must be between 1 and 255 characters' });
  }
  if (!validator.isLength(companyid, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyid must be between 1 and 50 characters' });
  }

  // URL validation
  if (exporturl && !validator.isURL(exporturl, { require_protocol: true })) {
    return res.status(400).json({ error: 'exporturl must be a valid URL with protocol if provided' });
  }
  if (image && !validator.isURL(image, { require_protocol: true })) {
    return res.status(400).json({ error: 'image must be a valid URL with protocol if provided' });
  }

  // Product IDs validation
  if (!Array.isArray(productids) || productids.length === 0) {
    return res.status(400).json({ error: 'productids must be a non-empty array' });
  }
  for (const productid of productids) {
    if (!validator.isUUID(productid)) {
      return res.status(400).json({ error: `Invalid productid: ${productid} must be a valid UUID` });
    }
  }

  // Sanitize inputs
  const sanitizedCataloguename = xss(cataloguename.trim());
  const sanitizedExporturl = exporturl ? xss(exporturl.trim()) : null;
  const sanitizedImage = image ? xss(image.trim()) : null;
  const sanitizedCompanyid = xss(companyid.trim());
  const sanitizedProductids = productids.map(id => xss(id.trim()));

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

      // Verify productids exist in products table and belong to the same company
      for (const productid of sanitizedProductids) {
        const productCheck = await client.query(
          'SELECT 1 FROM public.products WHERE id = $1 AND companyid = $2',
          [productid, sanitizedCompanyid]
        );
        if (productCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid productid: ${productid} does not exist or does not belong to company ${sanitizedCompanyid}` });
        }
      }

      // Check for duplicate cataloguename for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.productcatalogues WHERE companyid = $1 AND cataloguename = $2',
        [sanitizedCompanyid, sanitizedCataloguename]
      );
      if (duplicateCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Catalogue name already exists for this company' });
      }

      const result = await client.query(
        `INSERT INTO public.productcatalogues (createdbyid, exporturl, image, cataloguename, companyid, productids)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, createdbyid, createdon, exporturl, image, cataloguename, companyid, productids`,
        [createdbyid, sanitizedExporturl, sanitizedImage, sanitizedCataloguename, sanitizedCompanyid, sanitizedProductids]
      );

      await client.query('COMMIT');

      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product catalogue created successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create product catalogue error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdbyid does not exist in users table' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
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
  const { companyid, search, page = 1, limit = 10 } = req.query;

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

  // Company ID validation
  if (companyid && !validator.isLength(companyid, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyid must be between 1 and 50 characters' });
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
          pc.id, pc.createdbyid, pc.createdon, pc.exporturl, pc.image, pc.cataloguename, pc.companyid, pc.productids,
          u.name AS createdbyname
        FROM public.productcatalogues pc
        LEFT JOIN public.users u ON pc.createdbyid = u.id
        WHERE 1=1
      `;
      let countQuery = `SELECT COUNT(*) FROM public.productcatalogues WHERE 1=1`;
      const queryParams = [];
      const countParams = [];
      let paramIndex = 1;

      if (sanitizedCompanyid) {
        query += ` AND pc.companyid = $${paramIndex}`;
        countQuery += ` AND companyid = $${paramIndex}`;
        queryParams.push(sanitizedCompanyid);
        countParams.push(sanitizedCompanyid);
        paramIndex++;
      }

      if (sanitizedSearch) {
        query += ` AND pc.cataloguename ILIKE $${paramIndex}`;
        countQuery += ` AND cataloguename ILIKE $${paramIndex}`;
        queryParams.push(`%${sanitizedSearch}%`);
        countParams.push(`%${sanitizedSearch}%`);
        paramIndex++;
      }

      query += ` ORDER BY pc.createdon DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
      if (err.code === '22023' || err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format in query parameters', details: err.message });
      }
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
          pc.id, pc.createdbyid, pc.createdon, pc.exporturl, pc.image, pc.cataloguename, pc.companyid, pc.productids,
          u.name AS createdbyname
        FROM public.productcatalogues pc
        LEFT JOIN public.users u ON pc.createdbyid = u.id
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
  const { createdbyid, exporturl, image, cataloguename, companyid, productids } = req.body;

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  if (!createdbyid || !cataloguename || !companyid || !productids) {
    return res.status(400).json({ error: 'createdbyid, cataloguename, companyid, and productids are required' });
  }

  if (!validator.isUUID(createdbyid)) {
    return res.status(400).json({ error: 'createdbyid must be a valid UUID' });
  }

  if (!validator.isLength(cataloguename, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'cataloguename must be between 1 and 255 characters' });
  }
  if (!validator.isLength(companyid, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyid must be between 1 and 50 characters' });
  }

  if (exporturl && !validator.isURL(exporturl, { require_protocol: true })) {
    return res.status(400).json({ error: 'exporturl must be a valid URL with protocol if provided' });
  }
  if (image && !validator.isURL(image, { require_protocol: true })) {
    return res.status(400).json({ error: 'image must be a valid URL with protocol if provided' });
  }

  if (!Array.isArray(productids) || productids.length === 0) {
    return res.status(400).json({ error: 'productids must be a non-empty array' });
  }
  for (const productid of productids) {
    if (!validator.isUUID(productid)) {
      return res.status(400).json({ error: `Invalid productid: ${productid} must be a valid UUID` });
    }
  }

  const sanitizedCataloguename = xss(cataloguename.trim());
  const sanitizedExporturl = exporturl ? xss(exporturl.trim()) : null;
  const sanitizedImage = image ? xss(image.trim()) : null;
  const sanitizedCompanyid = xss(companyid.trim());
  const sanitizedProductids = productids.map(id => xss(id.trim()));

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

      // Verify productids exist in products table and belong to the same company
      for (const productid of sanitizedProductids) {
        const productCheck = await client.query(
          'SELECT 1 FROM public.products WHERE id = $1 AND companyid = $2',
          [productid, sanitizedCompanyid]
        );
        if (productCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid productid: ${productid} does not exist or does not belong to company ${sanitizedCompanyid}` });
        }
      }

      // Check for duplicate cataloguename for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.productcatalogues WHERE companyid = $1 AND cataloguename = $2 AND id != $3',
        [sanitizedCompanyid, sanitizedCataloguename, id]
      );
      if (duplicateCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Catalogue name already exists for this company' });
      }

      const result = await client.query(
        `UPDATE public.productcatalogues
         SET createdbyid = $1, exporturl = $2, image = $3, cataloguename = $4, companyid = $5, productids = $6
         WHERE id = $7
         RETURNING id, createdbyid, createdon, exporturl, image, cataloguename, companyid, productids`,
        [createdbyid, sanitizedExporturl, sanitizedImage, sanitizedCataloguename, sanitizedCompanyid, sanitizedProductids, id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Catalogue not found' });
      }

      await client.query('COMMIT');

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product catalogue updated successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Update product catalogue error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdbyid does not exist in users table' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
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
      // Start transaction
      await client.query('BEGIN');

      const result = await client.query(
        `DELETE FROM public.productcatalogues WHERE id = $1
         RETURNING id, createdbyid, createdon, exporturl, image, cataloguename, companyid, productids`,
        [id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Catalogue not found' });
      }

      await client.query('COMMIT');

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Product catalogue deleted successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Delete product catalogue error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete catalogue due to foreign key constraint', details: err.detail || 'Catalogue is referenced by other records' });
      }
      res.status(500).json({ error: 'Failed to delete product catalogue', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};