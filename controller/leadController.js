const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

// Utility function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    // Convert snake_case to camelCase
    let camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    // Ensure consistent camelCase for specific fields
    if (camelKey === 'assignedtoName') camelKey = 'assignedToName';
    if (camelKey === 'updatedbyName') camelKey = 'updatedByName';
    if (camelKey === 'customerid') camelKey = 'customerId';
    if (camelKey === 'assignedto') camelKey = 'assignedTo';
    if (camelKey === 'updatedbyid') camelKey = 'updatedById';
    if (camelKey === 'createdat') camelKey = 'createdAt';
    if (camelKey === 'updatedon') camelKey = 'updatedOn';
    if (camelKey === 'leadname') camelKey = 'leadName';
    if (camelKey === 'isclose') camelKey = 'isClose';
    if (camelKey === 'iscompleted') camelKey = 'isCompleted';
    if (camelKey === 'isdeal') camelKey = 'isDeal';
    if (camelKey === 'companyid') camelKey = 'companyId';
    if (camelKey === 'closingdate') camelKey = 'closingDate';
    if (camelKey === 'categoryid') camelKey = 'categoryId';
    if (camelKey === 'stageid') camelKey = 'stageId';
    if (camelKey === 'subcategoryid') camelKey = 'subcategoryId';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

exports.createLead = async (req, res) => {
  const {
    customerId,
    source,
    status,
    assignedTo,
    notes,
    leadName,
    updatedById,
    categoryId,
    stageId,
    subcategoryId,
    isClose = false,
    isCompleted = false,
    phone,
    isDeal = false,
    companyId,
    closingDate
  } = req.body;

  // Validate UUID fields
  if (customerId && !isUUID(customerId)) {
    return res.status(400).json({ error: 'Invalid customerId: Must be a valid UUID' });
  }
  if (assignedTo && !isUUID(assignedTo)) {
    return res.status(400).json({ error: 'Invalid assignedTo: Must be a valid UUID' });
  }
  if (updatedById && !isUUID(updatedById)) {
    return res.status(400).json({ error: 'Invalid updatedById: Must be a valid UUID' });
  }
  if (categoryId && !isUUID(categoryId)) {
    return res.status(400).json({ error: 'Invalid categoryId: Must be a valid UUID' });
  }
  if (stageId && !isUUID(stageId)) {
    return res.status(400).json({ error: 'Invalid stageId: Must be a valid UUID' });
  }
  if (subcategoryId && !isUUID(subcategoryId)) {
    return res.status(400).json({ error: 'Invalid subcategoryId: Must be a valid UUID' });
  }

  // Validate phone format if provided
  if (phone && !/^\+?\d{10,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number: Must be 10-15 digits, optionally starting with +' });
  }

  // Validate companyId if provided
  if (companyId && !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
  }

  // Validate closingDate format if provided
  if (closingDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;
    if (!dateRegex.test(closingDate) || isNaN(Date.parse(closingDate))) {
      return res.status(400).json({ error: 'Invalid closingDate: Must be a valid ISO 8601 date (e.g., 2025-07-02T18:30:00Z)' });
    }
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys
      if (customerId) {
        const customerCheck = await client.query('SELECT 1 FROM customers WHERE id = $1', [customerId]);
        if (customerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid customerId: Customer does not exist' });
        }
      }
      if (assignedTo) {
        const assignedCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [assignedTo]);
        if (assignedCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assignedTo: User does not exist' });
        }
      }
      if (updatedById) {
        const updatedByCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [updatedById]);
        if (updatedByCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid updatedById: User does not exist' });
        }
      }
      if (categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId]);
        if (categoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid categoryId: Category does not exist' });
        }
      }
      if (stageId) {
        const stageCheck = await client.query('SELECT 1 FROM stage WHERE id = $1', [stageId]);
        if (stageCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid stageId: Stage does not exist' });
        }
      }
      if (subcategoryId) {
        const subcategoryCheck = await client.query('SELECT 1 FROM subcategory WHERE id = $1', [subcategoryId]);
        if (subcategoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid subcategoryId: Subcategory does not exist' });
        }
      }

      const result = await client.query(
        `INSERT INTO leads (
          customerid, source, status, assignedto, notes, leadname, updatedbyid,
          categoryid, stageid, subcategoryid, isclose, iscompleted, phone, isdeal, companyid, closingdate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          customerId, source, status, assignedTo, notes, leadName, updatedById,
          categoryId, stageId, subcategoryId, isClose, isCompleted, phone, isDeal, companyId, closingDate
        ]
      );

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(201).json({
        status: true,
        data: camelCaseData,
        message: 'Lead created successfully'
      });
    } catch (err) {
      console.error('Create lead error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail });
      }
      if (err.code === '22007') {
        return res.status(400).json({ error: 'Invalid closingDate format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to create lead', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
};

exports.getAllLeads = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Extract query parameters
      const {
        customerId,
        assignedTo,
        updatedById,
        status,
        categoryId,
        stageId,
        subcategoryId,
        companyId,
        search,
        page = 1,
        limit = 10,
        closingDateFrom,
        closingDateTo
      } = req.query;

      // Validate UUID fields
      if (customerId && !isUUID(customerId)) {
        return res.status(400).json({ error: 'Invalid customerId: Must be a valid UUID' });
      }
      if (assignedTo && !isUUID(assignedTo)) {
        return res.status(400).json({ error: 'Invalid assignedTo: Must be a valid UUID' });
      }
      if (updatedById && !isUUID(updatedById)) {
        return res.status(400).json({ error: 'Invalid updatedById: Must be a valid UUID' });
      }
      if (categoryId && !isUUID(categoryId)) {
        return res.status(400).json({ error: 'Invalid categoryId: Must be a valid UUID' });
      }
      if (stageId && !isUUID(stageId)) {
        return res.status(400).json({ error: 'Invalid stageId: Must be a valid UUID' });
      }
      if (subcategoryId && !isUUID(subcategoryId)) {
        return res.status(400).json({ error: 'Invalid subcategoryId: Must be a valid UUID' });
      }

      // Validate companyId
      if (companyId && !companyId.trim()) {
        return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
      }

      // Validate search parameter
      if (search && typeof search !== 'string') {
        return res.status(400).json({ error: 'Invalid search parameter: Must be a string' });
      }

      // Validate closingDateFrom and closingDateTo
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?)?$/;
      if (closingDateFrom && (!dateRegex.test(closingDateFrom) || isNaN(Date.parse(closingDateFrom)))) {
        return res.status(400).json({ error: 'Invalid closingDateFrom: Must be a valid ISO 8601 date (e.g., 2025-07-02 or 2025-07-02T00:00:00Z)' });
      }
      if (closingDateTo && (!dateRegex.test(closingDateTo) || isNaN(Date.parse(closingDateTo)))) {
        return res.status(400).json({ error: 'Invalid closingDateTo: Must be a valid ISO 8601 date (e.g., 2025-07-02 or 2025-07-02T23:59:59Z)' });
      }

      // Validate pagination inputs
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
      }
      if (isNaN(limitNum) || limitNum < 1) {
        return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
      }

      const offset = (pageNum - 1) * limitNum;

      // Base query with joins to get names for categoryId, stageId, and subcategoryId
      let query = `
        SELECT 
          leads.*,
          u1.name AS assignedto_name,
          u2.name AS updatedby_name,
          c.name AS customer_name,
          cat.name AS category_name,
          st.name AS stage_name,
          subcat.name AS subcategory_name
        FROM leads
        LEFT JOIN users u1 ON leads.assignedto = u1.id
        LEFT JOIN users u2 ON leads.updatedbyid = u2.id
        LEFT JOIN customers c ON leads.customerid = c.id
        LEFT JOIN category cat ON leads.categoryid = cat.id
        LEFT JOIN stage st ON leads.stageid = st.id
        LEFT JOIN subcategory subcat ON leads.subcategoryid = subcat.id
        WHERE 1=1
      `;
      const values = [];
      let paramIndex = 1;

      if (customerId) {
        query += ` AND leads.customerid = $${paramIndex}::uuid`;
        values.push(customerId);
        paramIndex++;
      }
      if (assignedTo) {
        query += ` AND leads.assignedto = $${paramIndex}::uuid`;
        values.push(assignedTo);
        paramIndex++;
      }
      if (updatedById) {
        query += ` AND leads.updatedbyid = $${paramIndex}::uuid`;
        values.push(updatedById);
        paramIndex++;
      }
      if (status) {
        query += ` AND leads.status = $${paramIndex}`;
        values.push(status);
        paramIndex++;
      }
      if (categoryId) {
        query += ` AND leads.categoryid = $${paramIndex}::uuid`;
        values.push(categoryId);
        paramIndex++;
      }
      if (stageId) {
        query += ` AND leads.stageid = $${paramIndex}::uuid`;
        values.push(stageId);
        paramIndex++;
      }
      if (subcategoryId) {
        query += ` AND leads.subcategoryid = $${paramIndex}::uuid`;
        values.push(subcategoryId);
        paramIndex++;
      }
      if (companyId) {
        query += ` AND leads.companyid = $${paramIndex}`;
        values.push(companyId);
        paramIndex++;
      }
      if (search) {
        query += ` AND LOWER(leads.leadname) LIKE LOWER($${paramIndex})`;
        values.push(`%${search.trim()}%`);
        paramIndex++;
      }
      if (closingDateFrom) {
        query += ` AND leads.closingdate >= $${paramIndex}`;
        values.push(closingDateFrom);
        paramIndex++;
      }
      if (closingDateTo) {
        query += ` AND leads.closingdate <= $${paramIndex}`;
        values.push(closingDateTo);
        paramIndex++;
      }

      // Add pagination
      query += ` ORDER BY leads.createdat DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limitNum, offset);

      // Total count query
      let countQuery = `SELECT COUNT(*) FROM leads WHERE 1=1`;
      const countValues = [];
      let countIndex = 1;

      if (customerId) {
        countQuery += ` AND customerid = $${countIndex}::uuid`;
        countValues.push(customerId);
        countIndex++;
      }
      if (assignedTo) {
        countQuery += ` AND assignedto = $${countIndex}::uuid`;
        countValues.push(assignedTo);
        countIndex++;
      }
      if (updatedById) {
        countQuery += ` AND updatedbyid = $${countIndex}::uuid`;
        countValues.push(updatedById);
        countIndex++;
      }
      if (status) {
        countQuery += ` AND status = $${countIndex}`;
        countValues.push(status);
        countIndex++;
      }
      if (categoryId) {
        countQuery += ` AND categoryid = $${countIndex}::uuid`;
        countValues.push(categoryId);
        countIndex++;
      }
      if (stageId) {
        countQuery += ` AND stageid = $${countIndex}::uuid`;
        countValues.push(stageId);
        countIndex++;
      }
      if (subcategoryId) {
        countQuery += ` AND subcategoryid = $${countIndex}::uuid`;
        countValues.push(subcategoryId);
        countIndex++;
      }
      if (companyId) {
        countQuery += ` AND companyid = $${countIndex}`;
        countValues.push(companyId);
        countIndex++;
      }
      if (search) {
        countQuery += ` AND LOWER(leadname) LIKE LOWER($${countIndex})`;
        countValues.push(`%${search.trim()}%`);
        countIndex++;
      }
      if (closingDateFrom) {
        countQuery += ` AND closingdate >= $${countIndex}`;
        countValues.push(closingDateFrom);
        countIndex++;
      }
      if (closingDateTo) {
        countQuery += ` AND closingdate <= $${countIndex}`;
        countValues.push(closingDateTo);
        countIndex++;
      }

      // Execute both queries
      const [dataResult, countResult] = await Promise.all([
        client.query(query, values),
        client.query(countQuery, countValues)
      ]);

      // Convert snake_case to camelCase for each row
      const camelCaseRows = dataResult.rows.map(row => toCamelCase(row));

      const totalCount = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        status: true,
        data: { dataList: camelCaseRows },
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages,
        message: "Leads fetched successfully"
      });
    } catch (err) {
      console.error('Get leads error:', err.stack);
      if (err.code === '22007') {
        return res.status(400).json({ error: 'Invalid date format in query parameters', details: err.message });
      }
      res.status(500).json({ error: 'Internal server error', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
};

exports.getLeadsByCompanyId = async (req, res) => {
  const { companyId } = req.params;

  // Validate companyId
  if (!companyId || !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          leads.*,
          u1.name AS assignedto_name,
          u2.name AS updatedby_name,
          c.name AS customer_name,
          cat.name AS category_name,
          st.name AS stage_name,
          subcat.name AS subcategory_name
        FROM leads
        LEFT JOIN users u1 ON leads.assignedto = u1.id
        LEFT JOIN users u2 ON leads.updatedbyid = u2.id
        LEFT JOIN customers c ON leads.customerid = c.id
        LEFT JOIN category cat ON leads.categoryid = cat.id
        LEFT JOIN stage st ON leads.stageid = st.id
        LEFT JOIN subcategory subcat ON leads.subcategoryid = subcat.id
        WHERE leads.companyid = $1
        ORDER BY leads.createdat DESC
        `,
        [companyId]
      );

      // Convert snake_case to camelCase for each row
      const camelCaseRows = result.rows.map(row => toCamelCase(row));

      res.status(200).json({
        status: true,
        data: camelCaseRows,
        message: "Leads fetched successfully"
      });
    } catch (err) {
      console.error('Get leads by companyId error:', err.stack);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
};

exports.getLeadById = async (req, res) => {
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
          leads.*,
          u1.name AS assignedto_name,
          u2.name AS updatedby_name,
          c.name AS customer_name,
          cat.name AS category_name,
          st.name AS stage_name,
          subcat.name AS subcategory_name
        FROM leads
        LEFT JOIN users u1 ON leads.assignedto = u1.id
        LEFT JOIN users u2 ON leads.updatedbyid = u2.id
        LEFT JOIN customers c ON leads.customerid = c.id
        LEFT JOIN category cat ON leads.categoryid = cat.id
        LEFT JOIN stage st ON leads.stageid = st.id
        LEFT JOIN subcategory subcat ON leads.subcategoryid = subcat.id
        WHERE leads.id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Lead fetched successfully'
      });
    } catch (err) {
      console.error('Get lead error:', err.stack);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
};

exports.updateLead = async (req, res) => {
  const { id } = req.params;
  const {
    customerId,
    source,
    status,
    assignedTo,
    notes,
    leadName,
    updatedById,
    updatedOn,
    categoryId,
    stageId,
    subcategoryId,
    isClose,
    isCompleted,
    phone,
    isDeal,
    companyId,
    closingDate
  } = req.body;

  // Validate UUID fields
  if (customerId && !isUUID(customerId)) {
    return res.status(400).json({ error: 'Invalid customerId: Must be a valid UUID' });
  }
  if (assignedTo && !isUUID(assignedTo)) {
    return res.status(400).json({ error: 'Invalid assignedTo: Must be a valid UUID' });
  }
  if (updatedById && !isUUID(updatedById)) {
    return res.status(400).json({ error: 'Invalid updatedById: Must be a valid UUID' });
  }
  if (categoryId && !isUUID(categoryId)) {
    return res.status(400).json({ error: 'Invalid categoryId: Must be a valid UUID' });
  }
  if (stageId && !isUUID(stageId)) {
    return res.status(400).json({ error: 'Invalid stageId: Must be a valid UUID' });
  }
  if (subcategoryId && !isUUID(subcategoryId)) {
    return res.status(400).json({ error: 'Invalid subcategoryId: Must be a valid UUID' });
  }
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  // Validate phone format if provided
  if (phone && !/^\+?\d{10,15}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number: Must be 10-15 digits, optionally starting with +' });
  }

  // Validate companyId if provided
  if (companyId && !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
  }

  // Validate closingDate format if provided
  if (closingDate) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;
    if (!dateRegex.test(closingDate) || isNaN(Date.parse(closingDate))) {
      return res.status(400).json({ error: 'Invalid closingDate: Must be a valid ISO 8601 date (e.g., 2025-07-02T18:30:00Z)' });
    }
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys
      if (customerId) {
        const customerCheck = await client.query('SELECT 1 FROM customers WHERE id = $1', [customerId]);
        if (customerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid customerId: Customer does not exist' });
        }
      }
      if (assignedTo) {
        const assignedCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [assignedTo]);
        if (assignedCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assignedTo: User does not exist' });
        }
      }
      if (updatedById) {
        const updatedByCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [updatedById]);
        if (updatedByCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid updatedById: User does not exist' });
        }
      }
      if (categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [categoryId]);
        if (categoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid categoryId: Category does not exist' });
        }
      }
      if (stageId) {
        const stageCheck = await client.query('SELECT 1 FROM stage WHERE id = $1', [stageId]);
        if (stageCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid stageId: Stage does not exist' });
        }
      }
      if (subcategoryId) {
        const subcategoryCheck = await client.query('SELECT 1 FROM subcategory WHERE id = $1', [subcategoryId]);
        if (subcategoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid subcategoryId: Subcategory does not exist' });
        }
      }

      const result = await client.query(
        `UPDATE leads
         SET customerid = $1, source = $2, status = $3, assignedto = $4, notes = $5,
             leadname = $6, updatedbyid = $7, updatedon = $8, categoryid = $9, stageid = $10,
             subcategoryid = $11, isclose = $12, iscompleted = $13, phone = $14, isdeal = $15,
             companyid = $16, closingdate = $17
         WHERE id = $18 RETURNING *`,
        [
          customerId, source, status, assignedTo, notes, leadName, updatedById,
          updatedOn, categoryId, stageId, subcategoryId, isClose, isCompleted, phone, isDeal,
          companyId, closingDate, id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);
      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Lead updated successfully'
      });
    } catch (err) {
      console.error('Update lead error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail });
      }
      if (err.code === '22007') {
        return res.status(400).json({ error: 'Invalid date format', details: err.message });
      }
      res.status(500).json({ error: 'Internal server error', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
};

exports.patchLead = async (req, res) => {
  const { id } = req.params;
  const fields = Object.entries(req.body);

  // Validate that at least one field is provided
  if (fields.length === 0) {
    return res.status(400).json({ error: 'At least one field must be provided for update' });
  }

  // Validate UUID fields if provided
  if (req.body.customerId && !isUUID(req.body.customerId)) {
    return res.status(400).json({ error: 'Invalid customerId: Must be a valid UUID' });
  }
  if (req.body.assignedTo && !isUUID(req.body.assignedTo)) {
    return res.status(400).json({ error: 'Invalid assignedTo: Must be a valid UUID' });
  }
  if (req.body.updatedById && !isUUID(req.body.updatedById)) {
    return res.status(400).json({ error: 'Invalid updatedById: Must be a valid UUID' });
  }
  if (req.body.categoryId && !isUUID(req.body.categoryId)) {
    return res.status(400).json({ error: 'Invalid categoryId: Must be a valid UUID' });
  }
  if (req.body.stageId && !isUUID(req.body.stageId)) {
    return res.status(400).json({ error: 'Invalid stageId: Must be a valid UUID' });
  }
  if (req.body.subcategoryId && !isUUID(req.body.subcategoryId)) {
    return res.status(400).json({ error: 'Invalid subcategoryId: Must be a valid UUID' });
  }
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  // Validate phone format if provided
  if (req.body.phone && !/^\+?\d{10,15}$/.test(req.body.phone)) {
    return res.status(400).json({ error: 'Invalid phone number: Must be 10-15 digits, optionally starting with +' });
  }

  // Validate companyId if provided
  if (req.body.companyId && !req.body.companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
  }

  // Validate closingDate format if provided
  if (req.body.closingDate) {
    const dateRegex = /^\ east{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})?$/;
    if (!dateRegex.test(req.body.closingDate) || isNaN(Date.parse(req.body.closingDate))) {
      return res.status(400).json({ error: 'Invalid closingDate: Must be a valid ISO 8601 date (e.g., 2025-07-02T18:30:00Z)' });
    }
  }

  try {
    const client = await pool.connect();
    try {
      // Validate foreign keys if provided
      if (req.body.customerId) {
        const customerCheck = await client.query('SELECT 1 FROM customers WHERE id = $1', [req.body.customerId]);
        if (customerCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid customerId: Customer does not exist' });
        }
      }
      if (req.body.ассignedTo) {
        const assignedCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.assignedTo]);
        if (assignedCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assignedTo: User does not exist' });
        }
      }
      if (req.body.updatedById) {
        const updatedByCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [req.body.updatedById]);
        if (updatedByCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid updatedById: User does not exist' });
        }
      }
      if (req.body.categoryId) {
        const categoryCheck = await client.query('SELECT 1 FROM category WHERE id = $1', [req.body.categoryId]);
        if (categoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid categoryId: Category does not exist' });
        }
      }
      if (req.body.stageId) {
        const stageCheck = await client.query('SELECT 1 FROM stage WHERE id = $1', [req.body.stageId]);
        if (stageCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid stageId: Stage does not exist' });
        }
      }
      if (req.body.subcategoryId) {
        const subcategoryCheck = await client.query('SELECT 1 FROM subcategory WHERE id = $1', [req.body.subcategoryId]);
        if (subcategoryCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid subcategoryId: Subcategory does not exist' });
        }
      }

      // Map camelCase to snake_case for database
      const snakeCaseFields = fields.map(([key, value]) => {
        let snakeKey = key;
        if (key === 'customerId') snakeKey = 'customerid';
        if (key === 'assignedTo') snakeKey = 'assignedto';
        if (key === 'updatedById') snakeKey = 'updatedbyid';
        if (key === 'leadName') snakeKey = 'leadname';
        if (key === 'isClose') snakeKey = 'isclose';
        if (key === 'isCompleted') snakeKey = 'iscompleted';
        if (key === 'isDeal') snakeKey = 'isdeal';
        if (key === 'companyId') snakeKey = 'companyid';
        if (key === 'updatedOn') snakeKey = 'updatedon';
        if (key === 'closingDate') snakeKey = 'closingdate';
        if (key === 'categoryId') snakeKey = 'categoryid';
        if (key === 'stageId') snakeKey = 'stageid';
        if (key === 'subcategoryId') snakeKey = 'subcategoryid';
        return [snakeKey, value];
      });

      const setString = snakeCaseFields.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
      const values = snakeCaseFields.map(([, value]) => value);

      const result = await client.query(
        `UPDATE leads SET ${setString} WHERE id = $${snakeCaseFields.length + 1} RETURNING *`,
        [...values, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
        message: 'Lead patched successfully'
      });
    } catch (err) {
      console.error('Patch lead error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail });
      }
      if (err.code === '22007') {
        return res.status(400).json({ error: 'Invalid date format', details: err.message });
      }
      res.status(500).json({ error: 'Internal server error', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
};

exports.deleteLead = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM leads WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      res.status(200).json({
        status: true,
        message: 'Lead deleted successfully'
      });
    } catch (err) {
      console.error('Delete lead error:', err.stack);
      res.status(500).json({ error: 'Internal server error', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
};

