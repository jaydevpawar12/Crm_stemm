const { pool } = require('../db');

// Create Subcategory
exports.createSubcategory = async (req, res) => {
  const { name, categoryId, stageId } = req.body;
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
        'SELECT 1 FROM stage WHERE id = $1 AND categoryId = $2',
        [stageId, categoryId]
      );
      if (!stageCheck.rowCount) {
        return res.status(400).json({ error: 'Stage does not belong to the given category' });
      }

      const result = await client.query(
        'INSERT INTO subcategory (id, name, categoryId, stageId) VALUES (gen_random_uuid(), $1, $2, $3) RETURNING *',
        [name, categoryId, stageId]
      );

      // res.status(201).json(result.rows[0]);
            res.status(201).json({
              status: true,
              data: result.rows[0],
              message: 'SubCategory Create successfully'
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
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM subcategory');
      // res.json(result.rows);
      res.status(201).json({
              status: true,
              data: {dataList:result.rows},
              message: 'SubCategory Fetch successfully'
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
      // res.json(result.rows[0]);
      res.status(201).json({
              status: true,
              data: result.rows[0],
              message: 'SubCategory Fetch successfully'
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
  const { name, categoryId, stageId } = req.body;
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
        'SELECT 1 FROM stage WHERE id = $1 AND categoryId = $2',
        [stageId, categoryId]
      );
      if (!stageCheck.rowCount) {
        return res.status(400).json({ error: 'Stage does not belong to the given category' });
      }

      const result = await client.query(
        'UPDATE subcategory SET name = $1, categoryId = $2, stageId = $3 WHERE id = $4 RETURNING *',
        [name, categoryId, stageId, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: 'Subcategory not found' });
      // res.json(result.rows[0]);
       res.status(201).json({
              status: true,
              data: result.rows[0],
              message: 'SubCategory Update successfully'
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
      res.json({ message: 'Subcategory deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete Subcategory Error:', err);
    res.status(500).json({ error: err.message });
  }
};
    