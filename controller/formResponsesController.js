// const { initializePool } = require('../db');
  const { pool } = require('../db');


exports.createFormResponse = async (req, res) => {
  const { formid, formfieldid, userid, responsevalue } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO public.formresponses (formid, formfieldid, userid, responsevalue)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [formid, formfieldid, userid, responsevalue]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create form response error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllFormResponses = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.formresponses ORDER BY submittedat DESC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get form responses error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getFormResponseById = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.formresponses WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form response not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get form response error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateFormResponse = async (req, res) => {
  const { id } = req.params;
  const { formid, formfieldid, userid, responsevalue } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE public.formresponses
         SET formid = $1, formfieldid = $2, userid = $3, responsevalue = $4
         WHERE id = $5
         RETURNING *`,
        [formid, formfieldid, userid, responsevalue, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form response not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update form response error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteFormResponse = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM public.formresponses WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form response not found' });
      }
      res.json({ message: 'Form response deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete form response error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};