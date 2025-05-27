// const { initializePool } = require('../db');
const { pool } = require('../db');


exports.createDepartment = async (req, res) => {
  const { name, createById } = req.body;

  if (!name || !createById) {
    return res.status(400).json({ error: 'Name and createById are required' });
  }

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        'INSERT INTO department (name, createById) VALUES ($1, $2) RETURNING *',
        [name, createById]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create department error:', err);
    res.status(500).json({ error: 'Failed to create department' });
  }
};

exports.getAllDepartments = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM department');
      res.status(200).json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get departments error:', err);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
};

exports.getDepartmentById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM department WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get department error:', err);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
};

exports.updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;

  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        'UPDATE department SET name = $1 WHERE id = $2 RETURNING *',
        [name, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update department error:', err);
    res.status(500).json({ error: 'Failed to update department' });
  }
};

exports.deleteDepartment = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM department WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Department not found' });
      }
      res.status(200).json({ message: 'Department deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete department error:', err);
    res.status(500).json({ error: 'Failed to delete department' });
  }
};