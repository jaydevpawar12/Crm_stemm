const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

exports.createFormField = async (req, res) => {
  const {
     formId, label, type, required, minCharacters, maxCharacters, validator,
    value, startDate, endDate, options, fieldOrder, companyId
  } = req.body;

  // Validate required fields
  if (!formId) return res.status(400).json({ error: 'Form ID is required' });
  if (!label) return res.status(400).json({ error: 'Label is required' });
  if (!type) return res.status(400).json({ error: 'Type is required' });
  if (required === undefined) return res.status(400).json({ error: 'Required field is required' });
  if (!fieldOrder && fieldOrder !== 0) return res.status(400).json({ error: 'Field order is required' });

  // Validate UUID fields
  if (!isUUID(formId)) return res.status(400).json({ error: 'Invalid formId: Must be a valid UUID' });

  // Validate type
  if (!['text', 'number', 'date', 'select', 'checkbox', 'radio'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type: Must be text, number, date, select, checkbox, or radio' });
  }

  // Validate minCharacters and maxCharacters
  if (minCharacters !== null && (!Number.isInteger(minCharacters) || minCharacters < 0)) {
    return res.status(400).json({ error: 'Invalid minCharacters: Must be a non-negative integer or null' });
  }
  if (maxCharacters !== null && (!Number.isInteger(maxCharacters) || maxCharacters <= 0)) {
    return res.status(400).json({ error: 'Invalid maxCharacters: Must be a positive integer or null' });
  }
  if (minCharacters !== null && maxCharacters !== null && minCharacters > maxCharacters) {
    return res.status(400).json({ error: 'minCharacters cannot be greater than maxCharacters' });
  }

  // Validate dates
  if (startDate && isNaN(Date.parse(startDate))) {
    return res.status(400).json({ error: 'Invalid startDate: Must be a valid date' });
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return res.status(400).json({ error: 'Invalid endDate: Must be a valid date' });
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ error: 'startDate cannot be later than endDate' });
  }

  // Validate options as valid JSON
  if (options !== undefined && options !== null) {
    try {
      JSON.stringify(options);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid options: Must be valid JSON' });
    }
  }

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      // Validate formId exists in forms table
      const formCheck = await client.query('SELECT 1 FROM forms WHERE id = $1', [formId]);
      if (formCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid formId: Form does not exist' });
      }

      

      const result = await client.query(
        `INSERT INTO public.formfields (
           formId, label, type, required, minCharacters, maxCharacters, validator,
          value, startDate, endDate, options, fieldOrder, companyId
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          formId, label, type, required, minCharacters, maxCharacters, validator,
          value, startDate, endDate, options ? JSON.stringify(options) : null, fieldOrder, companyId
        ]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create form field error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation (e.g., duplicate id)' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for UUID or other field' });
      }
      res.status(500).json({ error: 'Failed to create form field', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.getAllFormFields = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.formfields ORDER BY fieldOrder ASC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get form fields error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.getFormFieldById = async (req, res) => {
  const { id } = req.params;

  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form field ID: Must be a valid UUID' });

  try {
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
    console.error('Get form field error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.updateFormField = async (req, res) => {
  const { id } = req.params;
  const {
    formId, label, type, required, minCharacters, maxCharacters, validator,
    value, startDate, endDate, options, fieldOrder, companyId
  } = req.body;

  // Validate required fields
  if (!formId) return res.status(400).json({ error: 'Form ID is required' });
  if (!label) return res.status(400).json({ error: 'Label is required' });
  if (!type) return res.status(400).json({ error: 'Type is required' });
  if (required === undefined) return res.status(400).json({ error: 'Required field is required' });
  if (!fieldOrder && fieldOrder !== 0) return res.status(400).json({ error: 'Field order is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form field ID: Must be a valid UUID' });
  if (!isUUID(formId)) return res.status(400).json({ error: 'Invalid formId: Must be a valid UUID' });

  // Validate type
  if (!['text', 'number', 'date', 'select', 'checkbox', 'radio'].includes(type)) {
    return res.status(400).json({ error: 'Invalid type: Must be text, number, date, select, checkbox, or radio' });
  }

  // Validate minCharacters and maxCharacters
  if (minCharacters !== null && (!Number.isInteger(minCharacters) || minCharacters < 0)) {
    return res.status(400).json({ error: 'Invalid minCharacters: Must be a non-negative integer or null' });
  }
  if (maxCharacters !== null && (!Number.isInteger(maxCharacters) || maxCharacters <= 0)) {
    return res.status(400).json({ error: 'Invalid maxCharacters: Must be a positive integer or null' });
  }
  if (minCharacters !== null && maxCharacters !== null && minCharacters > maxCharacters) {
    return res.status(400).json({ error: 'minCharacters cannot be greater than maxCharacters' });
  }

  // Validate dates
  if (startDate && isNaN(Date.parse(startDate))) {
    return res.status(400).json({ error: 'Invalid startDate: Must be a valid date' });
  }
  if (endDate && isNaN(Date.parse(endDate))) {
    return res.status(400).json({ error: 'Invalid endDate: Must be a valid date' });
  }
  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ error: 'startDate cannot be later than endDate' });
  }

  // Validate options as valid JSON
  if (options !== undefined && options !== null) {
    try {
      JSON.stringify(options);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid options: Must be valid JSON' });
    }
  }

  try {
    const client = await pool.connect();
    try {
      // Validate formId exists in forms table
      const formCheck = await client.query('SELECT 1 FROM forms WHERE id = $1', [formId]);
      if (formCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid formId: Form does not exist' });
      }

     

      const result = await client.query(
        `UPDATE public.formfields
         SET formId = $1,  label = $2, type = $3, required = $4,
             minCharacters = $5, maxCharacters = $6, validator = $7, value = $8,
             startDate = $9, endDate = $10, options = $11, fieldOrder = $12, companyId = $13
         WHERE id = $14
         RETURNING *`,
        [
          formId, label, type, required, minCharacters, maxCharacters, validator,
          value, startDate, endDate, options ? JSON.stringify(options) : null, fieldOrder, companyId, id
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form field not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update form field error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
      }
      res.status(500).json({ error: 'Failed to update form field', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.deleteFormField = async (req, res) => {
  const { id } = req.params;

  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form field ID: Must be a valid UUID' });

  try {
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
    console.error('Delete form field error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};