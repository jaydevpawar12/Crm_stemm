const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

exports.createNote = async (req, res) => {
  const { leadId, content, createdBy } = req.body;

  // Validate required fields
  if (!leadId) {
    return res.status(400).json({ error: 'leadId is required' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content is required and cannot be empty' });
  }
  if (!createdBy) {
    return res.status(400).json({ error: 'createdBy is required' });
  }

  // Validate UUID fields
  if (!isUUID(leadId)) {
    return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });
  }
  if (!isUUID(createdBy)) {
    return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  }


  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys
      const leadCheck = await client.query('SELECT 1 FROM leads WHERE id = $1', [leadId]);
      if (leadCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid leadId: Lead does not exist' });
      }

      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
      }

      const result = await client.query(
        `INSERT INTO public.notes (leadId, content, createdBy)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [leadId, content, createdBy]
      );

      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Note created successfully'
      });
    } catch (err) {
      console.error('Create note error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Lead or user does not exist' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid UUID format' });
      }
      res.status(500).json({ error: 'Failed to create note', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.getAllNotes = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Extract query parameters for filtering
      const { leadId, createdBy, page = 1, limit = 10 } = req.query;

      // Validate UUID fields if provided
      if (leadId && !isUUID(leadId)) {
        return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });
      }
      if (createdBy && !isUUID(createdBy)) {
        return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
      }

      // Validate pagination inputs
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'Invalid page number: must be a positive integer' });
      }
      if (isNaN(limitNum) || limitNum < 1) {
        return res.status(400).json({ error: 'Invalid limit: must be a positive integer' });
      }

      const offset = (pageNum - 1) * limitNum;

      // Base query with joins for user and lead names
      let query = `
        SELECT 
          n.*,
          u.name AS createdBy_name,
          l.leadName AS lead_name
        FROM public.notes n
        LEFT JOIN public.users u ON n.createdBy = u.id
        LEFT JOIN public.leads l ON n.leadId = l.id
        WHERE 1=1
      `;
      const values = [];
      let paramIndex = 1;

      if (leadId) {
        query += ` AND n.leadId = $${paramIndex}::uuid`;
        values.push(leadId);
        paramIndex++;
      }
      if (createdBy) {
        query += ` AND n.createdBy = $${paramIndex}::uuid`;
        values.push(createdBy);
        paramIndex++;
      }

      // Add pagination
      query += ` ORDER BY n.createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limitNum, offset);

      // Total count query
      let countQuery = `SELECT COUNT(*) FROM public.notes WHERE 1=1`;
      const countValues = [];
      let countIndex = 1;

      if (leadId) {
        countQuery += ` AND leadId = $${countIndex}::uuid`;
        countValues.push(leadId);
        countIndex++;
      }
      if (createdBy) {
        countQuery += ` AND createdBy = $${countIndex}::uuid`;
        countValues.push(createdBy);
        countIndex++;
      }

      // Execute both queries
      const [dataResult, countResult] = await Promise.all([
        client.query(query, values),
        client.query(countQuery, countValues)
      ]);

      const totalCount = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        status: true,
        data: {dataList:dataResult.rows},
        pagination: {
          page: pageNum,
          limit: limitNum,
          totalCount,
          totalPages
        },
        message: 'Notes fetched successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get notes error:', err.stack);
    if (err.code === '22P02') {
      return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid UUID format' });
    }
    res.status(500).json({ error: 'Failed to fetch notes', details: err.message });
  }
};

exports.getNotesByLeadId = async (req, res) => {
  const { leadId } = req.params;

  // Validate UUID
  if (!isUUID(leadId)) {
    return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate lead existence
      const leadCheck = await client.query('SELECT 1 FROM leads WHERE id = $1', [leadId]);
      if (leadCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const result = await client.query(
        `
        SELECT 
          n.*,
          u.name AS createdBy_name,
          l.leadName AS lead_name
        FROM public.notes n
        LEFT JOIN public.users u ON n.createdBy = u.id
        LEFT JOIN public.leads l ON n.leadId = l.id
        WHERE n.leadId = $1
        ORDER BY n.createdAt DESC
        `,
        [leadId]
      );

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Notes fetched successfully'
      });
    } catch (err) {
      console.error('Get notes by leadId error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid UUID format' });
      }
      res.status(500).json({ error: 'Failed to fetch notes', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.getNoteById = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          n.*,
          u.name AS createdBy_name,
          l.leadName AS lead_name
        FROM public.notes n
        LEFT JOIN public.users u ON n.createdBy = u.id
        LEFT JOIN public.leads l ON n.leadId = l.id
        WHERE n.id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Note fetched successfully'
      });
    } catch (err) {
      console.error('Get note error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid UUID format' });
      }
      res.status(500).json({ error: 'Failed to fetch note', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.updateNote = async (req, res) => {
  const { id } = req.params;
  const { leadId, content, createdBy } = req.body;

  // Validate required fields
  if (!leadId) {
    return res.status(400).json({ error: 'leadId is required' });
  }
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'content is required and cannot be empty' });
  }
  if (!createdBy) {
    return res.status(400).json({ error: 'createdBy is required' });
  }

  // Validate UUID fields
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }
  if (!isUUID(leadId)) {
    return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });
  }
  if (!isUUID(createdBy)) {
    return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  }

  // Validate content length
  if (content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: `content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys
      const leadCheck = await client.query('SELECT 1 FROM leads WHERE id = $1', [leadId]);
      if (leadCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid leadId: Lead does not exist' });
      }

      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
      }

      const result = await client.query(
        `UPDATE public.notes
         SET leadId = $1, content = $2, createdBy = $3
         WHERE id = $4
         RETURNING *`,
        [leadId, content, createdBy, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Note updated successfully'
      });
    } catch (err) {
      console.error('Update note error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Lead or user does not exist' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid UUID format' });
      }
      res.status(500).json({ error: 'Failed to update note', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.patchNote = async (req, res) => {
  const { id } = req.params;
  const fields = Object.entries(req.body);

  // Validate that at least one field is provided
  if (fields.length === 0) {
    return res.status(400).json({ error: 'At least one field must be provided for update' });
  }

  // Validate UUID fields if provided
  if (req.body.leadId && !isUUID(req.body.leadId)) {
    return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });
  }
  if (req.body.createdBy && !isUUID(req.body.createdBy)) {
    return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  }
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  // Validate content if provided
  if (req.body.content && !req.body.content.trim()) {
    return res.status(400).json({ error: 'content cannot be empty' });
  }
  if (req.body.content && req.body.content.length > MAX_CONTENT_LENGTH) {
    return res.status(400).json({ error: `content exceeds maximum length of ${MAX_CONTENT_LENGTH} characters` });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys if provided
      if (req.body.leadId) {
        const leadCheck = await client.query('SELECT 1 FROM leads WHERE id = $1', [req.body.leadId]);
        if (leadCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid leadId: Lead does not exist' });
        }
      }
      if (req.body.createdBy) {
        const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.createdBy]);
        if (userCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
        }
      }

      const setString = fields.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
      const values = fields.map(([, value]) => value);

      const result = await client.query(
        `UPDATE public.notes
         SET ${setString}
         WHERE id = $${fields.length + 1}
         RETURNING *`,
        [...values, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Note patched successfully'
      });
    } catch (err) {
      console.error('Patch note error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Lead or user does not exist' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid UUID format' });
      }
      res.status(500).json({ error: 'Failed to patch note', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

exports.deleteNote = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM public.notes WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Note not found' });
      }

      res.status(200).json({
        status: true,
        message: 'Note deleted successfully'
      });
    } catch (err) {
      console.error('Delete note error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid UUID format' });
      }
      res.status(500).json({ error: 'Failed to delete note', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};