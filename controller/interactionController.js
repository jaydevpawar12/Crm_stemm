const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

// Utility function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    let camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    camelKey = camelKey.replace(/^([A-Z])/, (match, letter) => letter.toLowerCase());
    // Explicit mappings for specific fields
    if (camelKey === 'createdBy') camelKey = 'createdBy';
    if (camelKey === 'companyId') camelKey = 'companyId';
    if (camelKey === 'companyName') camelKey = 'companyName';
    if (camelKey === 'assignedToName') camelKey = 'assignedToName';
    if (camelKey === 'createdByName') camelKey = 'createdByName';
    if (camelKey === 'secretkey') camelKey = 'secretKey';
    if (camelKey === 'isnewuser') camelKey = 'isNewUser';
    if (camelKey === 'tags') camelKey = 'tags';
    if (camelKey === 'category') camelKey = 'category';
    if (camelKey === 'leadId') camelKey = 'leadId';
    if (camelKey === 'interactionType') camelKey = 'interactionType';
    if (camelKey === 'interactionDate') camelKey = 'interactionDate';
    if (camelKey === 'attachmentType') camelKey = 'attachmentType';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Create Interaction
exports.createInteraction = async (req, res) => {
  const {
    leadId,
    interactionType,
    notes,
    companyId,
    interactionDate,
    createdBy,
    attachments,
    attachmentType
  } = req.body;

  // Validate required fields
  if (!createdBy) return res.status(400).json({ error: 'createdBy is required' });

  // Validate UUID fields
  if (createdBy && !isUUID(createdBy)) return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  if (leadId && !isUUID(leadId)) return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });

  // Validate attachments
  if (attachments && (!Array.isArray(attachments) || !attachments.every(item => typeof item === 'string'))) {
    return res.status(400).json({ error: 'Invalid attachments: Must be an array of strings' });
  }

  // Validate attachmentType
  if (attachmentType && typeof attachmentType !== 'string') {
    return res.status(400).json({ error: 'Invalid attachmentType: Must be a string' });
  }

  // Validate interactionDate if provided
  if (interactionDate && isNaN(Date.parse(interactionDate))) {
    return res.status(400).json({ error: 'Invalid interactionDate: Must be a valid date' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate createdBy exists
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
      }

      // Validate leadId exists if provided
      if (leadId) {
        const leadCheck = await client.query('SELECT 1 FROM leads WHERE id = $1', [leadId]);
        if (leadCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid leadId: Lead does not exist' });
        }
      }

      const result = await client.query(
        `INSERT INTO interactions (
           lead_id, interaction_type, notes, companyId, interaction_date, created_by, attachments, attachment_type
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [leadId, interactionType, notes, companyId, interactionDate || new Date(), createdBy, attachments, attachmentType]
      );

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(201).json({
        status: true,
        data: camelCaseData,
        message: 'Interaction created successfully'
      });
    } catch (err) {
      console.error('Create interaction error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to create interaction', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get All Interactions
exports.getAllInteractions = async (req, res) => {
  const { leadId, companyId, createdBy, interactionType, attachmentType, interactionDateFrom, interactionDateTo, page = 1, limit = 10 } = req.query;

  // Validate page and limit
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
  }
  if (isNaN(limitNum) || limitNum < 1) {
    return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
  }

  // Validate UUID fields
  if (leadId && !isUUID(leadId)) {
    return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });
  }
  if (createdBy && !isUUID(createdBy)) {
    return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  }

  // Validate companyId
  if (companyId && !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
  }

  // Validate interactionType
  if (interactionType && typeof interactionType !== 'string') {
    return res.status(400).json({ error: 'Invalid interactionType: Must be a string' });
  }

  // Validate attachmentType
  if (attachmentType && typeof attachmentType !== 'string') {
    return res.status(400).json({ error: 'Invalid attachmentType: Must be a string' });
  }

  // Validate interactionDateFrom and interactionDateTo
  const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?)?$/;
  if (interactionDateFrom && (!dateRegex.test(interactionDateFrom) || isNaN(Date.parse(interactionDateFrom)))) {
    return res.status(400).json({ error: 'Invalid interactionDateFrom: Must be a valid ISO 8601 date (e.g., 2025-07-02 or 2025-07-02T00:00:00Z)' });
  }
  if (interactionDateTo && (!dateRegex.test(interactionDateTo) || isNaN(Date.parse(interactionDateTo)))) {
    return res.status(400).json({ error: 'Invalid interactionDateTo: Must be a valid ISO 8601 date (e.g., 2025-07-02 or 2025-07-02T23:59:59Z)' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate leadId and companyId combination exists in leads table if either is provided
      if (leadId || companyId) {
        let leadCheckQuery = 'SELECT 1 FROM leads WHERE 1=1';
        let leadCheckValues = [];
        let paramIndex = 1;

        if (leadId) {
          leadCheckQuery += ` AND id = $${paramIndex}::uuid`;
          leadCheckValues.push(leadId);
          paramIndex++;
        }
        if (companyId) {
          leadCheckQuery += ` AND companyid = $${paramIndex}`;
          leadCheckValues.push(companyId);
          paramIndex++;
        }

        const leadCheck = await client.query(leadCheckQuery, leadCheckValues);
        if (leadCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid leadId or companyId: No matching lead found' });
        }
      }

      // Validate createdBy exists if provided
      if (createdBy) {
        const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
        if (userCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
        }
      }

      const offset = (pageNum - 1) * limitNum;

      // Main query
      let query = `
        SELECT 
          i.*,
          u.name AS created_by_name
        FROM interactions i
        LEFT JOIN users u ON i.created_by = u.id
        LEFT JOIN leads l ON i.lead_id = l.id
        WHERE 1=1
      `;
      let conditions = [];
      let values = [];
      let paramCount = 1;

      if (leadId) {
        conditions.push(`i.lead_id = $${paramCount}::uuid`);
        values.push(leadId);
        paramCount++;
      }
      if (companyId) {
        conditions.push(`i.companyId = $${paramCount}`);
        values.push(companyId);
        paramCount++;
      }
      if (createdBy) {
        conditions.push(`i.created_by = $${paramCount}::uuid`);
        values.push(createdBy);
        paramCount++;
      }
      if (interactionType) {
        conditions.push(`i.interaction_type = $${paramCount}`);
        values.push(interactionType);
        paramCount++;
      }
      if (attachmentType) {
        conditions.push(`i.attachment_type = $${paramCount}`);
        values.push(attachmentType);
        paramCount++;
      }
      if (interactionDateFrom) {
        conditions.push(`i.interaction_date >= $${paramCount}`);
        values.push(interactionDateFrom);
        paramCount++;
      }
      if (interactionDateTo) {
        conditions.push(`i.interaction_date <= $${paramCount}`);
        values.push(interactionDateTo);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' AND ' + conditions.join(' AND ');
      }

      query += ` ORDER BY i.interaction_date DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      values.push(limitNum, offset);

      // Count query
      let countQuery = `SELECT COUNT(*) FROM interactions i`;
      if (conditions.length > 0) {
        countQuery += ' WHERE ' + conditions.join(' AND ');
      }

      const [result, countResult] = await Promise.all([
        client.query(query, values),
        client.query(countQuery, values.slice(0, -2)) // Exclude limit and offset for count
      ]);

      // Convert snake_case to camelCase
      const camelCaseRows = result.rows.map(row => toCamelCase(row));

      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.status(200).json({
        status: true,
        data: {
          dataList: camelCaseRows,
          totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum)
        },
        message: 'Interactions fetched successfully'
      });
    } catch (err) {
      console.error('Get interactions error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      if (err.code === '22007') {
        return res.status(400).json({ error: 'Invalid date format in query parameters', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch interactions', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get Interaction By ID
exports.getInteractionById = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid interaction ID: Must be a valid UUID' });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          i.*,
          u.name AS created_by_name
        FROM interactions i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.id = $1
        `,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Interaction not found' });

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Interaction fetched successfully'
      });
    } catch (err) {
      console.error('Get interaction by ID error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch interaction', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Update Interaction (PUT - Full Update)
exports.updateInteraction = async (req, res) => {
  const { id } = req.params;
  const {
    leadId,
    interactionType,
    notes,
    companyId,
    interactionDate,
    createdBy,
    attachments,
    attachmentType
  } = req.body;

  // Validate required fields
  if (!createdBy) return res.status(400).json({ error: 'createdBy is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid interaction ID: Must be a valid UUID' });
  if (createdBy && !isUUID(createdBy)) return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  if (leadId && !isUUID(leadId)) return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });

  // Validate attachments
  if (attachments && (!Array.isArray(attachments) || !attachments.every(item => typeof item === 'string'))) {
    return res.status(400).json({ error: 'Invalid attachments: Must be an array of strings' });
  }

  // Validate attachmentType
  if (attachmentType && typeof attachmentType !== 'string') {
    return res.status(400).json({ error: 'Invalid attachmentType: Must be a string' });
  }

  // Validate interactionDate if provided
  if (interactionDate && isNaN(Date.parse(interactionDate))) {
    return res.status(400).json({ error: 'Invalid interactionDate: Must be a valid date' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate createdBy exists
      const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
      if (userCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
      }

      // Validate leadId exists if provided
      if (leadId) {
        const leadCheck = await client.query('SELECT 1 FROM leads WHERE id = $1', [leadId]);
        if (leadCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid leadId: Lead does not exist' });
        }
      }

      const result = await client.query(
        `
        UPDATE interactions SET
          lead_id = $1,
          interaction_type = $2,
          notes = $3,
          companyId = $4,
          interaction_date = $5,
          created_by = $6,
          attachments = $7,
          attachment_type = $8
        WHERE id = $9
        RETURNING *
        `,
        [leadId, interactionType, notes, companyId, interactionDate || new Date(), createdBy, attachments, attachmentType, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Interaction not found' });

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Interaction updated successfully'
      });
    } catch (err) {
      console.error('Update interaction error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to update interaction', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Patch Interaction (PATCH - Partial Update)
exports.patchInteraction = async (req, res) => {
  const { id } = req.params;
  const {
    leadId,
    interactionType,
    notes,
    companyId,
    interactionDate,
    createdBy,
    attachments,
    attachmentType
  } = req.body;

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid interaction ID: Must be a valid UUID' });
  if (createdBy && !isUUID(createdBy)) return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  if (leadId && !isUUID(leadId)) return res.status(400).json({ error: 'Invalid leadId: Must be a valid UUID' });

  // Validate attachments
  if (attachments && (!Array.isArray(attachments) || !attachments.every(item => typeof item === 'string'))) {
    return res.status(400).json({ error: 'Invalid attachments: Must be an array of strings' });
  }

  // Validate attachmentType
  if (attachmentType && typeof attachmentType !== 'string') {
    return res.status(400).json({ error: 'Invalid attachmentType: Must be a string' });
  }

  // Validate interactionDate if provided
  if (interactionDate && isNaN(Date.parse(interactionDate))) {
    return res.status(400).json({ error: 'Invalid interactionDate: Must be a valid date' });
  }

  try {
    const client = await pool.connect();
    try {
      // Validate createdBy exists if provided
      if (createdBy) {
        const userCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
        if (userCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
        }
      }

      // Validate leadId exists if provided
      if (leadId) {
        const leadCheck = await client.query('SELECT 1 FROM leads WHERE id = $1', [leadId]);
        if (leadCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid leadId: Lead does not exist' });
        }
      }

      // Check if interaction exists
      const existing = await client.query('SELECT * FROM interactions WHERE id = $1', [id]);
      if (existing.rows.length === 0) return res.status(404).json({ error: 'Interaction not found' });

      // Build dynamic query for partial update
      let setClauses = [];
      let values = [];
      let paramCount = 1;

      if (leadId !== undefined) {
        setClauses.push(`lead_id = $${paramCount}`);
        values.push(leadId);
        paramCount++;
      }
      if (interactionType !== undefined) {
        setClauses.push(`interaction_type = $${paramCount}`);
        values.push(interactionType);
        paramCount++;
      }
      if (notes !== undefined) {
        setClauses.push(`notes = $${paramCount}`);
        values.push(notes);
        paramCount++;
      }
      if (companyId !== undefined) {
        setClauses.push(`companyId = $${paramCount}`);
        values.push(companyId);
        paramCount++;
      }
      if (interactionDate !== undefined) {
        setClauses.push(`interaction_date = $${paramCount}`);
        values.push(interactionDate);
        paramCount++;
      }
      if (createdBy !== undefined) {
        setClauses.push(`created_by = $${paramCount}`);
        values.push(createdBy);
        paramCount++;
      }
      if (attachments !== undefined) {
        setClauses.push(`attachments = $${paramCount}`);
        values.push(attachments);
        paramCount++;
      }
      if (attachmentType !== undefined) {
        setClauses.push(`attachment_type = $${paramCount}`);
        values.push(attachmentType);
        paramCount++;
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No fields provided for update' });
      }

      values.push(id);
      const query = `
        UPDATE interactions
        SET ${setClauses.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *
      `;

      const result = await client.query(query, values);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Interaction not found' });

      // Convert snake_case to camelCase
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Interaction updated successfully'
      });
    } catch (err) {
      console.error('Patch interaction error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to update interaction', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Delete Interaction
exports.deleteInteraction = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid interaction ID: Must be a valid UUID' });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM interactions WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Interaction not found' });

      res.status(200).json({
        status: true,
        message: 'Interaction deleted successfully'
      });
    } catch (err) {
      console.error('Delete interaction error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete interaction due to foreign key constraint', details: err.detail || 'Interaction is referenced by other records' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to delete interaction', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};