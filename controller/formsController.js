// const { initializePool } = require('../db');
  const { pool } = require('../db');


exports.createForm = async (req, res) => {
  const { formname, formtype, createdbyid, customerid, isleadform } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO public.forms (formname, formtype, createdbyid, customerid, isleadform)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [formname, formtype, createdbyid, customerid, isleadform]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllForms = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.forms ORDER BY createdat DESC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get forms error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getFormById = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.forms WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateForm = async (req, res) => {
  const { id } = req.params;
  const { formname, formtype, customerid, isleadform } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE public.forms
         SET formname = $1, formtype = $2, customerid = $3, isleadform = $4
         WHERE id = $5
         RETURNING *`,
        [formname, formtype, customerid, isleadform, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteForm = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM public.forms WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form not found' });
      }
      res.json({ message: 'Form deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete form error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};