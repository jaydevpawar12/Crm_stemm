// const { initializePool } = require('../db');
const { pool } = require('../db');


exports.createEmailTemplate = async (req, res) => {
  const { name, createdById, subject, content, customerId, type } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO public.EmailTemplates (name, createdById, subject, content, customerId, type)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [name, createdById, subject, content, customerId, type]
      );
      // res.status(201).json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'EmailTemplate created successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create email template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllEmailTemplates = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.EmailTemplates ORDER BY createdOn DESC');
      // res.json(result.rows);
       res.status(201).json({
        status: true,
        data:{ dataList:result.rows[0]},
        message: 'EmailTemplate Fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get email templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getEmailTemplateById = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.EmailTemplates WHERE Id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Email template not found' });
      }
      // res.json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'EmailTemplate Fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get email template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateEmailTemplate = async (req, res) => {
  const { id } = req.params;
  const { name, createdById, subject, content, customerId, type } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE public.EmailTemplates
         SET name = $1, createdById = $2, subject = $3, content = $4, customerId = $5, type = $6
         WHERE Id = $7
         RETURNING *`,
        [name, createdById, subject, content, customerId, type, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Email template not found' });
      }
      // res.json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'EmailTemplate update successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update email template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteEmailTemplate = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM public.EmailTemplates WHERE Id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Email template not found' });
      }
      res.json({ message: 'Email template deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete email template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};