const { pool } = require('../db');

const toCamelCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    // Convert snake_case to camelCase
    let camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    // Ensure first letter is lowercase
    camelKey = camelKey.replace(/^([A-Z])/, (match, letter) => letter.toLowerCase());
    // Explicit mappings for specific fields
    if (camelKey === 'companyid') camelKey = 'companyId';
    if (camelKey === 'customerCategoryId') camelKey = 'customerCategoryId';
    if (camelKey === 'imageurl') camelKey = 'imageUrl';
    if (camelKey === 'categoryid') camelKey = 'categoryId';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Create Stage
exports.createStage = async (req, res) => {
  const { name, categoryId, imageUrl, companyId } = req.body;
  try {
    const client = await pool.connect();
    try {
      const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId]);
      if (categoryCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Category not found' });
      }

      const result = await client.query(
        'INSERT INTO stage (id, name, categoryid, imageurl, companyid) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *',
        [name, categoryId, imageUrl, companyId]
      );
      res.status(201).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'Stage created successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create Stage Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get All Stages
exports.getAllStages = async (req, res) => {
  const { companyId } = req.query; // Get companyId from query parameters
  try {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM stage';
      let params = [];
      if (companyId) {
        query += ' WHERE companyid = $1';
        params.push(companyId);
      }
      const result = await client.query(query, params);
      res.status(200).json({
        status: true,
        data: { dataList: result.rows.map(toCamelCase) }, // Apply toCamelCase to each row
        message: 'Stage fetched successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get All Stages Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get Stage by ID
exports.getStageById = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM stage WHERE id = $1', [id]);
      if (!result.rows.length) return res.status(404).json({ message: 'Stage not found' });
      res.status(200).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'Stage fetched successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get Stage Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update Stage
exports.updateStage = async (req, res) => {
  const { id } = req.params;
  const { name, categoryId, imageUrl, companyId } = req.body;
  try {
    const client = await pool.connect();
    try {
      const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId]);
      if (categoryCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Category not found' });
      }

      const result = await client.query(
        'UPDATE stage SET name = $1, categoryid = $2, imageurl = $3, companyid = $4 WHERE id = $5 RETURNING *',
        [name, categoryId, imageUrl, companyId, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: 'Stage not found' });
      res.status(200).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'Stage updated successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update Stage Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete Stage
exports.deleteStage = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM stage WHERE id = $1 RETURNING *', [id]);
      if (!result.rows.length) return res.status(404).json({ message: 'Stage not found' });
      res.status(200).json({ message: 'Stage deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete Stage Error:', err);
    res.status(500).json({ error: err.message });
  }
};