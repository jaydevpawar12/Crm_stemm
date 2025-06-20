// const { initializePool } = require('../db');
const { pool } = require('../db');


exports.createSendEmail = async (req, res) => {
  const { name, customerId, createdById, subject, htmlContent, from, to, ccRecipients, bccRecipients, attachmentUrls } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO public.SendEmails (name, customerId, createdById, subject, htmlContent, "from", "to", ccRecipients, bccRecipients, attachmentUrls)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          name,
          customerId,
          createdById,
          subject,
          htmlContent,
          from,
          JSON.stringify(to ? to.split(',').map(email => email.trim()) : []),
          ccRecipients ? JSON.stringify(ccRecipients.split(',').map(email => email.trim())) : null,
          bccRecipients ? JSON.stringify(bccRecipients.split(',').map(email => email.trim())) : null,
          attachmentUrls ? JSON.stringify(attachmentUrls.split(',').map(url => url.trim())) : null
        ]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create send email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllSendEmails = async (req, res) => {
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.SendEmails ORDER BY createdOn DESC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get send emails error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getSendEmailById = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.SendEmails WHERE Id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Send email not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get send email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateSendEmail = async (req, res) => {
  const { id } = req.params;
  const { name, customerId, createdById, subject, htmlContent, from, to, ccRecipients, bccRecipients, attachmentUrls } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE public.SendEmails
         SET name = $1, customerId = $2, createdById = $3, subject = $4, htmlContent = $5, "from" = $6,
             "to" = $7, ccRecipients = $8, bccRecipients = $9, attachmentUrls = $10
         WHERE Id = $11
         RETURNING *`,
        [
          name,
          customerId,
          createdById,
          subject,
          htmlContent,
          from,
          JSON.stringify(to ? to.split(',').map(email => email.trim()) : []),
          ccRecipients ? JSON.stringify(ccRecipients.split(',').map(email => email.trim())) : null,
          bccRecipients ? JSON.stringify(bccRecipients.split(',').map(email => email.trim())) : null,
          attachmentUrls ? JSON.stringify(attachmentUrls.split(',').map(url => url.trim())) : null,
          id
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Send email not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update send email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteSendEmail = async (req, res) => {
  const { id } = req.params;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM public.SendEmails WHERE Id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Send email not found' });
      }
      res.json({ message: 'Send email deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete send email error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};