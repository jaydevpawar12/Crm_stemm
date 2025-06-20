// const { initializePool } = require('../db');
  const { pool } = require('../db');


exports.createFormField = async (req, res) => {
  const {
    formid, customerid, label, type, required, mincharacters, maxcharacters, validator,
    value, startdate, enddate, options, fieldorder
  } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO public.formfields (
          formid, customerid, label, type, required, mincharacters, maxcharacters, validator,
          value, startdate, enddate, options, fieldorder
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          formid, customerid, label, type, required, mincharacters, maxcharacters, validator,
          value, startdate, enddate, JSON.stringify(options), fieldorder
        ]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create form field error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllFormFields = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.formfields ORDER BY fieldorder ASC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get form fields error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getFormFieldById = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.formfields WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form field not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get form field error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateFormField = async (req, res) => {
  const { id } = req.params;
  const {
    formid, customerid, label, type, required, mincharacters, maxcharacters, validator,
    value, startdate, enddate, options, fieldorder
  } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE public.formfields
         SET formid = $1, customerid = $2, label = $3, type = $4, required = $5,
             mincharacters = $6, maxcharacters = $7, validator = $8, value = $9,
             startdate = $10, enddate = $11, options = $12, fieldorder = $13
         WHERE id = $14
         RETURNING *`,
        [
          formid, customerid, label, type, required, mincharacters, maxcharacters, validator,
          value, startdate, enddate, JSON.stringify(options), fieldorder, id
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form field not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update form field error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteFormField = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM public.formfields WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form field not found' });
      }
      res.json({ message: 'Form field deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete form field error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};