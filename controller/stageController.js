const { pool } = require('../db');

// Create Stage
exports.createStage = async (req, res) => {
  const { name, categoryId } = req.body;
  try {
    const client = await pool.connect();
    try {
      const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId]);
      if (categoryCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Category not found' });
      }

      const result = await client.query(
        'INSERT INTO stage (id, name, categoryId) VALUES (gen_random_uuid(), $1, $2) RETURNING *',
        [name, categoryId]
      );
      res.status(201).json(result.rows[0]);
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
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM stage');
      res.json(result.rows);
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
      res.json(result.rows[0]);
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
  const { name, categoryId } = req.body;
  try {
    const client = await pool.connect();
    try {
      const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId]);
      if (categoryCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Category not found' });
      }

      const result = await client.query(
        'UPDATE stage SET name = $1, categoryId = $2 WHERE id = $3 RETURNING *',
        [name, categoryId, id]
      );
      if (!result.rows.length) return res.status(404).json({ message: 'Stage not found' });
      res.json(result.rows[0]);
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
      res.json({ message: 'Stage deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete Stage Error:', err);
    res.status(500).json({ error: err.message });
  }
};
