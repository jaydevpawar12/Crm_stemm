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
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Create Category
exports.createCategory = async (req, res) => {
  const { name, companyId } = req.body;
  try {
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT 1 FROM category WHERE name = $1', [name]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: `Category with name "${name}" already exists` });
      }
      const result = await client.query(
        'INSERT INTO category (id, name, companyid) VALUES (gen_random_uuid(), $1, $2) RETURNING *',
        [name, companyId]
      );
      res.status(201).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'category created successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create Category Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get All Categories
exports.getAllCategories = async (req, res) => {
  const { companyId } = req.query; // Get companyId from query parameters
  try {
    const client = await pool.connect();
    try {
      let query = 'SELECT * FROM category';
      let params = [];
      if (companyId) {
        query += ' WHERE companyid = $1';
        params.push(companyId);
      }
      const result = await client.query(query, params);
      res.status(200).json({
        status: true,
        data: { dataList: result.rows.map(toCamelCase) }, // Apply toCamelCase to each row
        message: 'category fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get All Categories Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get Category by ID
exports.getCategoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM category WHERE id = $1', [id]);
      if (!result.rows.length) return res.status(404).json({ message: 'Category not found' });
      res.status(200).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'category fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get Category Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Update Category
exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, companyId } = req.body;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE category SET name = $1, companyid = $2 WHERE id = $3 RETURNING *',
        [name, companyId, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: 'Category not found' });
      res.status(200).json({
        status: true,
        data: toCamelCase(result.rows[0]),
        message: 'category update successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update Category Error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Delete Category
exports.deleteCategory = async (req, res) => {
  const { id } = req.params;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM category WHERE id = $1 RETURNING *', [id]);
      if (!result.rows.length) return res.status(404).json({ message: 'Category not found' });
      res.status(200).json({ message: 'Category deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete Category Error:', err);
    res.status(500).json({ error: err.message });
  }
};