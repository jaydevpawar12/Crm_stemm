const validator = require('validator');
const xss = require('xss');
const { pool } = require('../db');

// Utility function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => toCamelCase(item));
  } else if (obj && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = typeof obj[key] === 'object' && obj[key] !== null 
        ? toCamelCase(obj[key]) 
        : obj[key];
      return acc;
    }, {});
  }
  return obj;
};

// Create Product Catalogue
exports.createProductCatalogue = async (req, res) => {
  const { createdById, exportUrl, image, catalogueName, companyId, productIds } = req.body;

  // Input validation
  if (!createdById || !catalogueName || !companyId || !productIds) {
    return res.status(400).json({ error: 'createdById, catalogueName, companyId, and productIds are required' });
  }

  // UUID validation
  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }

  // String length validation
  if (!validator.isLength(catalogueName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'catalogueName must be between 1 and 255 characters' });
  }
  if (!validator.isLength(companyId, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyId must be between 1 and 50 characters' });
  }

  // URL validation
  if (exportUrl && !validator.isURL(exportUrl, { require_protocol: true })) {
    return res.status(400).json({ error: 'exportUrl must be a valid URL with protocol if provided' });
  }
  if (image && !validator.isURL(image, { require_protocol: true })) {
    return res.status(400).json({ error: 'image must be a valid URL with protocol if provided' });
  }

  // Product IDs validation
  if (!Array.isArray(productIds) || productIds.length === 0) {
    return res.status(400).json({ error: 'productIds must be a non-empty array' });
  }
  for (const productId of productIds) {
    if (!validator.isUUID(productId)) {
      return res.status(400).json({ error: `Invalid productId: ${productId} must be a valid UUID` });
    }
  }

  // Sanitize inputs
  const sanitizedCatalogueName = xss(catalogueName.trim());
  const sanitizedExportUrl = exportUrl ? xss(exportUrl.trim()) : null;
  const sanitizedImage = image ? xss(image.trim()) : null;
  const sanitizedCompanyId = xss(companyId.trim());
  const sanitizedProductIds = productIds.map(id => xss(id.trim()));

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify createdById exists in users table
      const userCheck = await client.query('SELECT 1 FROM public.users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      // Verify productIds exist in products table and belong to the same company
      for (const productId of sanitizedProductIds) {
        const productCheck = await client.query(
          'SELECT 1 FROM public.products WHERE id = $1 AND companyid = $2',
          [productId, sanitizedCompanyId]
        );
        if (productCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid productId: ${productId} does not exist or does not belong to company ${sanitizedCompanyId}` });
        }
      }

      // Check for duplicate catalogueName for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.productcatalogues WHERE companyid = $1 AND cataloguename = $2',
        [sanitizedCompanyId, sanitizedCatalogueName]
      );
      if (duplicateCheck.rowCount > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Catalogue name already exists for this company' });
      }

      const result = await client.query(
        `INSERT INTO public.productcatalogues (createdbyid, exporturl, image, cataloguename, companyid, productids)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, createdbyid, createdon, exporturl, image, cataloguename, companyid, productids`,
        [createdById, sanitizedExportUrl, sanitizedImage, sanitizedCatalogueName, sanitizedCompanyId, sanitizedProductIds]
      );

      await client.query('COMMIT');

      res.status(201).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'Product catalogue created successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Create product catalogue error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdById does not exist in users table' });
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
  const { companyId, search, page = 1, limit = 10, sortBy = 'createdOn', sortOrder = 'DESC', createdById, fromDate, toDate } = req.query;

  // Validate pagination parameters
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: 'page must be a positive integer' });
  }
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({ error: 'limit must be a positive integer between 1 and 100' });
  }

  // Validate inputs
  if (search && !validator.isLength(search, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'search must be between 1 and 255 characters' });
  }
  if (companyId && !validator.isLength(companyId, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyId must be between 1 and 50 characters' });
  }
  if (createdById && !validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }
  if (fromDate && !validator.isISO8601(fromDate)) {
    return res.status(400).json({ error: 'fromDate must be a valid ISO 8601 date' });
  }
  if (toDate && !validator.isISO8601(toDate)) {
    return res.status(400).json({ error: 'toDate must be a valid ISO 8601 date' });
  }
  if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
    return res.status(400).json({ error: 'fromDate cannot be later than toDate' });
  }

  // Validate sort parameters
  const validSortFields = ['createdOn', 'catalogueName'];
  const validSortOrders = ['ASC', 'DESC'];
  if (!validSortFields.includes(sortBy)) {
    return res.status(400).json({ error: `sortBy must be one of: ${validSortFields.join(', ')}` });
  }
  if (!validSortOrders.includes(sortOrder.toUpperCase())) {
    return res.status(400).json({ error: 'sortOrder must be either ASC or DESC' });
  }

  // Sanitize inputs
  const sanitizedSearch = search ? xss(search.trim()) : null;
  const sanitizedCompanyId = companyId ? xss(companyId.trim()) : null;
  const sanitizedCreatedById = createdById ? xss(createdById.trim()) : null;
  const sanitizedSortBy = xss(sortBy.trim());
  const sanitizedSortOrder = xss(sortOrder.trim().toUpperCase());

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

      if (sanitizedCompanyId) {
        query += ` AND pc.companyid = $${paramIndex}`;
        countQuery += ` AND companyid = $${paramIndex}`;
        queryParams.push(sanitizedCompanyId);
        countParams.push(sanitizedCompanyId);
        paramIndex++;
      }

      if (sanitizedSearch) {
        query += ` AND pc.cataloguename ILIKE $${paramIndex}`;
        countQuery += ` AND cataloguename ILIKE $${paramIndex}`;
        queryParams.push(`%${sanitizedSearch}%`);
        countParams.push(`%${sanitizedSearch}%`);
        paramIndex++;
      }

      if (sanitizedCreatedById) {
        query += ` AND pc.createdbyid = $${paramIndex}`;
        countQuery += ` AND createdbyid = $${paramIndex}`;
        queryParams.push(sanitizedCreatedById);
        countParams.push(sanitizedCreatedById);
        paramIndex++;
      }

      if (fromDate) {
        query += ` AND pc.createdon >= $${paramIndex}`;
        countQuery += ` AND createdon >= $${paramIndex}`;
        queryParams.push(fromDate);
        countParams.push(fromDate);
        paramIndex++;
      }

      if (toDate) {
        query += ` AND pc.createdon <= $${paramIndex}`;
        countQuery += ` AND createdon <= $${paramIndex}`;
        queryParams.push(toDate);
        countParams.push(toDate);
        paramIndex++;
      }

      query += ` ORDER BY pc.${sanitizedSortBy} ${sanitizedSortOrder} LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(limitNum, offset);

      const [result, countResult] = await Promise.all([
        client.query(query, queryParams),
        client.query(countQuery, countParams)
      ]);

      const dataList = toCamelCase(result.rows);
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
        data: toCamelCase(result.rows[0]),
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

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  if (!createdById || !catalogueName || !companyId || !productIds) {
    return res.status(400).json({ error: 'createdById, catalogueName, companyId, and productIds are required' });
  }

  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }

  if (!validator.isLength(catalogueName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'catalogueName must be between 1 and 255 characters' });
  }
  if (!validator.isLength(companyId, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'companyId must be between 1 and 50 characters' });
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
      return res.status(400).json({ error: `Invalid productId: ${productId} must be a valid UUID` });
    }
  }

  const sanitizedCatalogueName = xss(catalogueName.trim());
  const sanitizedExportUrl = exportUrl ? xss(exportUrl.trim()) : null;
  const sanitizedImage = image ? xss(image.trim()) : null;
  const sanitizedCompanyId = xss(companyId.trim());
  const sanitizedProductIds = productIds.map(id => xss(id.trim()));

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify createdById exists in users table
      const userCheck = await client.query('SELECT 1 FROM public.users WHERE id = $1', [createdById]);
      if (userCheck.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      // Verify productIds exist in products table and belong to the same company
      for (const productId of sanitizedProductIds) {
        const productCheck = await client.query(
          'SELECT 1 FROM public.products WHERE id = $1 AND companyid = $2',
          [productId, sanitizedCompanyId]
        );
        if (productCheck.rowCount === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Invalid productId: ${productId} does not exist or does not belong to company ${sanitizedCompanyId}` });
        }
      }

      // Check for duplicate catalogueName for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.productcatalogues WHERE companyid = $1 AND cataloguename = $2 AND id != $3',
        [sanitizedCompanyId, sanitizedCatalogueName, id]
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
        [createdById, sanitizedExportUrl, sanitizedImage, sanitizedCatalogueName, sanitizedCompanyId, sanitizedProductIds, id]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Catalogue not found' });
      }

      await client.query('COMMIT');

      res.status(200).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'Product catalogue updated successfully'
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Update product catalogue error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'createdById does not exist in users table' });
      }
      if (err.code=== '23505') {
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
        data: toCamelCase(result.rows[0]),
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