const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

exports.createFormResponse = async (req, res) => {
  const {  formId, formFieldId, userId, responseValue } = req.body;

  // Validate required fields
  if (!formId) return res.status(400).json({ error: 'Form ID is required' });
  if (!formFieldId) return res.status(400).json({ error: 'Form field ID is required' });
  if (!userId) return res.status(400).json({ error: 'User ID is required' });
  if (!responseValue) return res.status(400).json({ error: 'Response value is required' });

  // Validate UUID fields
  if (!isUUID(formId)) return res.status(400).json({ error: 'Invalid formId: Must be a valid UUID' });
  if (!isUUID(formFieldId)) return res.status(400).json({ error: 'Invalid formFieldId: Must be a valid UUID' });
  if (!isUUID(userId)) return res.status(400).json({ error: 'Invalid userId: Must be a valid UUID' });

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      // Validate formId exists in forms table
      const formCheck = await client.query('SELECT 1 FROM forms WHERE id = $1', [formId]);
      if (formCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid formId: Form does not exist' });
      }

      // Validate formFieldId exists in formfields table and belongs to formId
      const fieldCheck = await client.query('SELECT 1 FROM formfields WHERE id = $1 AND formId = $2', [formFieldId, formId]);
      if (fieldCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid formFieldId: Form field does not exist or does not belong to the specified form' });
      }

      // Validate userId exists in users table
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid userId: User does not exist' });
      }

      const result = await client.query(
        `INSERT INTO public.formresponses ( formId, formFieldId, userId, responseValue)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [ formId, formFieldId, userId, responseValue]
      );
      // res.status(201).json(result.rows[0]);
      const formResponses=result.rows
      res.status(200).json({
        status:true,
      data:{
        formResponses
      },
      message:" formResponses Create Successfully"
      })
    } catch (err) {
      console.error('Create form response error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation (e.g., duplicate id)' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for UUID or other field' });
      }
      res.status(500).json({ error: 'Failed to create form response', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.getAllFormResponses = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT fr.*, u.name AS user_name, f.formName AS form_name, ff.label AS field_label
        FROM public.formresponses fr
        LEFT JOIN public.users u ON fr.userid = u.id
        LEFT JOIN public.forms f ON fr.formid = f.id
        LEFT JOIN public.formfields ff ON fr.formfieldid = ff.id
        ORDER BY fr.submittedAt DESC
      `);
      // res.json(result.rows);
      const formResponses=result.rows
      res.status(200).json({
        status:true,
      data:{
        formResponses
      },
      message:" formResponses Fetch Successfully"
      })
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get form responses error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.getFormResponseById = async (req, res) => {
  const { id } = req.params;

  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form response ID: Must be a valid UUID' });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT fr.*, u.name AS user_name, f.formName AS form_name, ff.label AS field_label
        FROM public.formresponses fr
        LEFT JOIN public.users u ON fr.userid = u.id
        LEFT JOIN public.forms f ON fr.formid = f.id
        LEFT JOIN public.formfields ff ON fr.formfieldid = ff.id
        WHERE fr.id = $1
      `, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form response not found' });
      }
      // res.json(result.rows[0]);
      const formResponses=result.rows
      res.status(200).json({
        status:true,
      data:{
        formResponses
      },
      message:" formResponses fetch single  Successfully"
      })
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get form response error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.updateFormResponse = async (req, res) => {
  const { id } = req.params;
  const { formId, formFieldId, userId, responseValue } = req.body;

  // Validate required fields
  if (!formId) return res.status(400).json({ error: 'Form ID is required' });
  if (!formFieldId) return res.status(400).json({ error: 'Form field ID is required' });
  if (!userId) return res.status(400).json({ error: 'User ID is required' });
  if (!responseValue) return res.status(400).json({ error: 'Response value is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form response ID: Must be a valid UUID' });
  if (!isUUID(formId)) return res.status(400).json({ error: 'Invalid formId: Must be a valid UUID' });
  if (!isUUID(formFieldId)) return res.status(400).json({ error: 'Invalid formFieldId: Must be a valid UUID' });
  if (!isUUID(userId)) return res.status(400).json({ error: 'Invalid userId: Must be a valid UUID' });

  try {
    const client = await pool.connect();
    try {
      // Validate formId exists in forms table
      const formCheck = await client.query('SELECT 1 FROM forms WHERE id = $1', [formId]);
      if (formCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid formId: Form does not exist' });
      }

      // Validate formFieldId exists in formfields table and belongs to formId
      const fieldCheck = await client.query('SELECT 1 FROM formfields WHERE id = $1 AND formId = $2', [formFieldId, formId]);
      if (fieldCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid formFieldId: Form field does not exist or does not belong to the specified form' });
      }

      // Validate userId exists in users table
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid userId: User does not exist' });
      }

      const result = await client.query(
        `UPDATE public.formresponses
         SET formId = $1, formFieldId = $2, userId = $3, responseValue = $4
         WHERE id = $5
         RETURNING *`,
        [formId, formFieldId, userId, responseValue, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form response not found' });
      }
      // res.json(result.rows[0]);
      const formResponses=result.rows
      res.status(200).json({
        status:true,
      data:{
        formResponses
      },
      message:" formResponses update Successfully"
      })
    } catch (err) {
      console.error('Update form response error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
      }
      res.status(500).json({ error: 'Failed to update form response', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.deleteFormResponse = async (req, res) => {
  const { id } = req.params;

  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form response ID: Must be a valid UUID' });

  try {
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
    console.error('Delete form response error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};