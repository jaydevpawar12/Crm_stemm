// const { initializePool } = require('../db');
  const { pool } = require('../db');


const validator = require('validator');
const xss = require('xss');

exports.createEnquiryCategory = async (req, res) => {
  const { createdById, companyId, name, categoryType } = req.body;

  // Input validation
  if (!createdById || !name || !categoryType || categoryType) {
    return res.status(400).json({ error: 'createdById, name,categoryType and categoryType are required' });
  }

  // Validate data types and formats
  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }

 

  if (!validator.isLength(name, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'name must be between 1 and 255 characters' });
  }

  if (!['Sales', 'Services'].includes(categoryType)) {
    return res.status(400).json({ error: 'categoryType must be either Sales or Services' });
  }

  // Sanitize inputs to prevent XSS
  const sanitizedName = xss(name);

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

      // Check for duplicate category name for the same company
      const duplicateCheck = await client.query(
        'SELECT 1 FROM enquirycategory WHERE companyId = $1 AND name = $2',
        [companyId || null, sanitizedName]
      );

      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Category name already exists for this company' });
      }

      const result = await client.query(
        `INSERT INTO enquirycategory (createdById, companyId, name, categoryType)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [createdById, companyId || null, sanitizedName, categoryType]
      );

      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create enquiry category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllEnquiryCategories = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(`SELECT * FROM enquiryCategory`);
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get enquiry categories error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getEnquiryCategoryById = async (req, res) => {
  const { id } = req.params;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(`SELECT * FROM enquiryCategory WHERE id = $1`, [id]);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get enquiry category error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateEnquiryCategory = async (req, res) => {
  const { id } = req.params;
  const { name, categoryType } = req.body;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE enquiryCategory SET name = $1, categoryType = $2 WHERE id = $3 RETURNING *`,
        [name, categoryType, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update enquiry category error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEnquiryCategory = async (req, res) => {
  const { id } = req.params;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(`DELETE FROM enquiryCategory WHERE id = $1 RETURNING *`, [id]);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      res.status(200).json({ message: 'Enquiry category deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete enquiry category error:', err);
    res.status(500).json({ error: err.message });
  }
};