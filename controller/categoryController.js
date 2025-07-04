// const { initializePool } = require('../db');
const { pool } = require('../db');

exports.createCategory = async (req, res) => {
  const { name } = req.body;
  try {
    const client = await pool.connect();
    try {
      const existing = await client.query('SELECT 1 FROM category WHERE name = $1', [name]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: `Category with name "${name}" already exists` });
      }
      const result = await client.query(
        'INSERT INTO category (id, name) VALUES (gen_random_uuid(), $1) RETURNING *',
        [name]
      );
      // res.status(201).json(result.rows[0]);
      res.status(201).json({
        status: true,
        data: result.rows[0] ,
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
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM category');
      // res.json(result.rows);
      res.status(201).json({
        status: true,
        data: { dataList: result.rows },
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
      // res.json(result.rows[0]);
      res.status(201).json({
        status: true,
        data: result.rows[0] ,
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
  const { name } = req.body;
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE category SET name = $1 WHERE id = $2 RETURNING *',
        [name, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: 'Category not found' });
      // res.json(result.rows[0]);
      res.status(201).json({
        status: true,
        data: result.rows[0] ,
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
      res.json({ message: 'Category deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete Category Error:', err);
    res.status(500).json({ error: err.message });
  }
};