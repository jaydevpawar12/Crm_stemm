// const { initializePool } = require('../db');
const { pool } = require('../db');


exports.createNote = async (req, res) => {
  const { lead_id, content, created_by } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO public.notes (lead_id, content, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [lead_id, content, created_by]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllNotes = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.notes ORDER BY created_at DESC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get notes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getNoteById = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.notes WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateNote = async (req, res) => {
  const { id } = req.params;
  const { lead_id, content, created_by } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE public.notes
         SET lead_id = $1, content = $2, created_by = $3
         WHERE id = $4
         RETURNING *`,
        [lead_id, content, created_by, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteNote = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM public.notes WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }
      res.json({ message: 'Note deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete note error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};