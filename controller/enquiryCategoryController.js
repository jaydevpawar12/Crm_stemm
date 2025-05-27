const { initializePool } = require('../db');

exports.createEnquiryCategory = async (req, res) => {
  const { createdById, companyId, name, categoryType } = req.body;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO enquiryCategory (createdById, companyId, name, categoryType)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [createdById, companyId, name, categoryType]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create enquiry category error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getAllEnquiryCategories = async (req, res) => {
  try {
    const pool = await initializePool();
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
    const pool = await initializePool();
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
    const pool = await initializePool();
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
    const pool = await initializePool();
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