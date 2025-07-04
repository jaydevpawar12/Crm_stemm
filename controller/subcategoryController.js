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
    if (camelKey === 'categoryid') camelKey = 'categoryId';
    if (camelKey === 'stageid') camelKey = 'stageId';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Create Subcategory
exports.createSubcategory = async (req, res) => {
  const { name, categoryId, stageId, companyId } = req.body;
  try {
    const client = await pool.connect();
    try {
      // Check category exists
      const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId]);
      if (!categoryCheck.rowCount) {
        return res.status(400).json({ error: 'Category not found' });
      }

      // Check stage belongs to category
      const stageCheck = await client.query(
        'SELECT 1 FROM stage WHERE id = $1 AND categoryid = $2',
        [stageId, categoryId]
      );
      if (!stageCheck.rowCount) {
        return res.status(400).json({ error: 'Stage does not belong to the given category' });
      }

      const result = await client.query(
        'INSERT INTO subcategory (id, name, categoryid, stageid, companyid) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING *',
        [name, categoryId, stageId, companyId]
      );

      res.status(201).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'Subcategory created successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create Subcategory Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get All Subcategories
exports.getAllSubcategories = async (req, res) => {
  const { companyId } = req.query; // Get companyId from query parameters
  try {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM subcategory';
      let params = [];
      if (companyId) {
        query += ' WHERE companyid = $1';
        params.push(companyId);
      }
      const result = await client.query(query, params);
      res.status(200).json({
        status: true,
        data: { dataList: result.rows.map(toCamelCase) }, // Apply toCamelCase to each row
        message: 'Subcategory fetched successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get All Subcategories Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get Subcategory by ID
exports.getSubcategoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM subcategory WHERE id = $1', [id]);
      if (!result.rows.length) return res.status(404).json({ message: 'Subcategory not found' });
      res.status(200).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'Subcategory fetched successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get Subcategory Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update Subcategory
exports.updateSubcategory = async (req, res) => {
  const { id } = req.params;
  const { name, categoryId, stageId, companyId } = req.body;
  try {
    const client = await pool.connect();
    try {
      // Validate category
      const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId]);
      if (!categoryCheck.rowCount) {
        return res.status(400).json({ error: 'Category not found' });
      }

      // Validate stage belongs to category
      const stageCheck = await client.query(
        'SELECT 1 FROM stage WHERE id = $1 AND categoryid = $2',
        [stageId, categoryId]
      );
      if (!stageCheck.rowCount) {
        return res.status(400).json({ error: 'Stage does not belong to the given category' });
      }

      const result = await client.query(
        'UPDATE subcategory SET name = $1, categoryid = $2, stageid = $3, companyid = $4 WHERE id = $5 RETURNING *',
        [name, categoryId, stageId, companyId, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: 'Subcategory not found' });
      res.status(200).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'Subcategory updated successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update Subcategory Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete Subcategory
exports.deleteSubcategory = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM subcategory WHERE id = $1 RETURNING *', [id]);
      if (!result.rows.length) return res.status(404).json({ message: 'Subcategory not found' });
      res.status(200).json({ message: 'Subcategory deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete Subcategory Error:', err);
    res.status(500).json({ error: err.message });
  }
};