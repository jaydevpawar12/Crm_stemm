// const { initializePool } = require('../db');
const { pool } = require('../db');
const { validate: isUUID } = require('uuid');


exports.createForm = async (req, res) => {
  const { id, formName, formType, createdById, customerId, isLeadForm = false, companyId } = req.body;

  // Validate required fields
  if (!formName) return res.status(400).json({ error: 'Form name is required' });
  if (!formType) return res.status(400).json({ error: 'Form type is required' });
  if (!createdById) return res.status(400).json({ error: 'Created by ID is required' });
  if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });
  if (!companyId) return res.status(400).json({ error: 'Company ID is required' });

  // Validate UUID fields
  if (id && !isUUID(id)) return res.status(400).json({ error: 'Invalid form ID: Must be a valid UUID' });
  if (!isUUID(createdById)) return res.status(400).json({ error: 'Invalid createdById: Must be a valid UUID' });
  if (!isUUID(customerId)) return res.status(400).json({ error: 'Invalid customerId: Must be a valid UUID' });

  // Validate formType
  if (!['survey', 'feedback', 'registration'].includes(formType)) {
    return res.status(400).json({ error: 'Invalid formType: Must be survey, feedback, or registration' });
  }

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      // Validate createdById exists in users table
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdById]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid createdById: User does not exist' });
      }

      // Validate customerId exists in customers table
      const customerCheck = await client.query('SELECT 1 FROM customers WHERE id = $1', [customerId]);
      if (customerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid customerId: Customer does not exist' });
      }

      const result = await client.query(
        `INSERT INTO public.forms (id, formName, formType, createdById, customerId, isLeadForm, companyId)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [id || null, formName, formType, createdById, customerId, isLeadForm, companyId]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error('Create form error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation (e.g., duplicate id)' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for UUID or other field' });
      }
      res.status(500).json({ error: 'Failed to create form', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.getAllForms = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM public.forms ORDER BY createdAt DESC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get forms error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.getFormById = async (req, res) => {
  const { id } = req.params;

  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form ID: Must be a valid UUID' });

  try {
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
    console.error('Get form error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

exports.updateForm = async (req, res) => {
  const { id } = req.params;
  const { formName, formType, customerId, isLeadForm, companyId } = req.body;

  // Validate required fields
  if (!formName) return res.status(400).json({ error: 'Form name is required' });
  if (!formType) return res.status(400).json({ error: 'Form type is required' });
  if (!customerId) return res.status(400).json({ error: 'Customer ID is required' });
  if (!companyId) return res.status(400).json({ error: 'Company ID is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form ID: Must be a valid UUID' });
  if (!isUUID(customerId)) return res.status(400).json({ error: 'Invalid customerId: Must be a valid UUID' });

  // Validate formType
  if (!['survey', 'feedback', 'registration'].includes(formType)) {
    return res.status(400).json({ error: 'Invalid formType: Must be survey, feedback, or registration' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate customerId exists in customers table
      const customerCheck = await client.query('SELECT 1 FROM customers WHERE id = $1', [customerId]);
      if (customerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid customerId: Customer does not exist' });
      }

      const result = await client.query(
        `UPDATE public.forms
         SET formName = $1, formType = $2, customerId = $3, isLeadForm = $4, companyId = $5
         WHERE id = $6
         RETURNING *`,
        [formName, formType, customerId, isLeadForm, companyId, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Form not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      console.error('Update form error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
      }
      res.status(500).json({ error: 'Failed to update form', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.deleteForm = async (req, res) => {
  const { id } = req.params;

  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid form ID: Must be a valid UUID' });

  try {
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
    console.error('Delete form error:', err.stack);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};