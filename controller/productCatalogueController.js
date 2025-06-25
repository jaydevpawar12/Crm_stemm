// const { initializePool } = require('../db');
  const { pool } = require('../db');


const validator = require('validator');
const xss = require('xss');

exports.createProductCatalogue = async (req, res) => {
  const { createdById, link, image, catalogueName } = req.body;

  // Input validation
  if (!createdById || !link || !catalogueName) {
    return res.status(400).json({ error: 'createdById, link, and catalogueName are required' });
  }

  // Validate data types and formats
if (!validator.isUUID(createdById)) {
  return res.status(400).json({ error: 'createdById must be a valid UUID' });
}

  if (!validator.isURL(link, { require_protocol: true })) {
    return res.status(400).json({ error: 'link must be a valid URL with protocol (http:// or https://)' });
  }

  if (image && !validator.isURL(image, { require_protocol: true })) {
    return res.status(400).json({ error: 'image must be a valid URL with protocol if provided' });
  }

  if (!validator.isLength(catalogueName, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'catalogueName must be between 1 and 255 characters' });
  }

  // Sanitize inputs to prevent XSS
  const sanitizedCatalogueName = xss(catalogueName);
  const sanitizedLink = xss(link);
  const sanitizedImage = image ? xss(image) : null;

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

      // Check for duplicate catalogue name for the same user
      const duplicateCheck = await client.query(
        'SELECT 1 FROM productcatalogues WHERE createdById = $1 AND catalogueName = $2',
        [createdById, sanitizedCatalogueName]
      );

      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Catalogue name already exists for this user' });
      }

      const result = await client.query(
        `INSERT INTO productcatalogues (createdById, link, image, catalogueName)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [createdById, sanitizedLink, sanitizedImage, sanitizedCatalogueName]
      );

      // res.status(201).json(result.rows[0]);
      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product Catalouge Fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create product catalogue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};



// READ ALL
exports.getAllProductCatalogues = async (req, res) => {
  // Extract and validate pagination parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!Number.isInteger(page) || page < 1) {
    return res.status(400).json({ error: 'page must be a positive integer' });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ error: 'limit must be a positive integer between 1 and 100' });
  }

  const offset = (page - 1) * limit;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();

    try {
      // Query to get catalogues, user names, and product counts
      const result = await client.query(
        `SELECT 
          pc.id, 
          pc.createdById, 
          u.name AS createdByName, 
          pc.createdOn, 
          pc.link, 
          pc.image, 
          pc.catalogueName,
          (SELECT COUNT(*) FROM products p WHERE p.catalogueId = pc.id) AS productCount
        FROM productcatalogues pc
        LEFT JOIN users u ON pc.createdById = u.id
        ORDER BY pc.createdOn DESC
        LIMIT $1 OFFSET $2`,
        [limit, offset]
      );

      // Get total count for pagination metadata
      const totalCountResult = await client.query('SELECT COUNT(*) FROM productcatalogues');
      const totalItems = parseInt(totalCountResult.rows[0].count);
      const totalPages = Math.ceil(totalItems / limit);

      res.json({
        status:true,
        data: result.rows,
        pagination: {
          page,
          limit,
          totalItems,
          totalPages
        }
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get product catalogues error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ ONE
exports.getProductCatalogueById = async (req, res) => {
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
          pc.createdOn, 
          pc.link, 
          pc.image, 
          pc.catalogueName,
          (SELECT COUNT(*) FROM products p WHERE p.catalogueId = pc.id) AS productCount
        FROM productcatalogues pc
        LEFT JOIN users u ON pc.createdById = u.id
        WHERE pc.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Catalogue not found' });
      }

      // res.json(result.rows[0]);
      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product Catalouge Fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get product catalogue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// UPDATE
exports.updateProductCatalogue = async (req, res) => {
  const { id } = req.params;
  const { link, image, catalogueName } = req.body;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE productcatalogues
         SET link = $1, image = $2, catalogueName = $3
         WHERE id = $4 RETURNING *`,
        [link, image, catalogueName, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Catalogue not found' });
      // res.json(result.rows[0]);
      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Product Catalouge Update successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update product catalogue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE
exports.deleteProductCatalogue = async (req, res) => {
  const { id } = req.params;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM productcatalogues WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Catalogue not found' });
      res.json({ message: 'Catalogue deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete product catalogue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};