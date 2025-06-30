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
    if (camelKey === 'subcategory') camelKey = 'subCategory';
    if (camelKey === 'isclose') camelKey = 'isClose';
    if (camelKey === 'iscompleted') camelKey = 'isCompleted';
    if (camelKey === 'isdeal') camelKey = 'isDeal';
    if (camelKey === 'companyid') camelKey = 'companyId';
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
    stage,
    subCategory,
    isClose = false,
    isCompleted = false,
    phone,
    isDeal = false,
    companyId
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

  // Validate phone format if provided
  if (phone && !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  }

  // Validate companyId if provided
  if (companyId && !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
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

      const result = await client.query(
        `INSERT INTO leads (
          customerId, source, status, assignedTo, notes, leadName, updatedById,
          stage, subCategory, isClose, isCompleted, phone, isDeal, companyId
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          customerId, source, status, assignedTo, notes, leadName, updatedById,
          stage, subCategory, isClose, isCompleted, phone, isDeal, companyId
        ]
      );

      res.status(201).json({
        status: true,
        data: result.rows[0],
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
      res.status(500).json({ error: 'Failed to create lead', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database' });
  }
};

// exports.getAllLeads = async (req, res) => {
//   try {
//     const client = await pool.connect();
//     try {
//       // Extract query parameters
//       const {
//         customerId,
//         assignedTo,
//         updatedById,
//         status,
//         stage,
//         companyId,
//         search,
//         page = 1,
//         limit = 10
//       } = req.query;

//       // Validate UUID fields
//       if (customerId && !isUUID(customerId)) {
//         return res.status(400).json({ error: 'Invalid customerId: Must be a valid UUID' });
//       }
//       if (assignedTo && !isUUID(assignedTo)) {
//         return res.status(400).json({ error: 'Invalid assignedTo: Must be a valid UUID' });
//       }
//       if (updatedById && !isUUID(updatedById)) {
//         return res.status(400).json({ error: 'Invalid updatedById: Must be a valid UUID' });
//       }

//       // Validate companyId
//       if (companyId && !companyId.trim()) {
//         return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
//       }

//       // Validate search parameter
//       if (search && typeof search !== 'string') {
//         return res.status(400).json({ error: 'Invalid search parameter: Must be a string' });
//       }

//       // Validate pagination inputs
//       const pageNum = parseInt(page, 10);
//       const limitNum = parseInt(limit, 10);
//       if (isNaN(pageNum) || pageNum < 1) {
//         return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
//       }
//       if (isNaN(limitNum) || limitNum < 1) {
//         return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
//       }

//       const offset = (pageNum - 1) * limitNum;

//       // Base query
//       let query = `
//         SELECT 
//           leads.*,
//           u1.name AS assignedTo_name,
//           u2.name AS updatedBy_name,
//           c.name AS customer_name
//         FROM leads
//         LEFT JOIN users u1 ON leads.assignedTo = u1.id
//         LEFT JOIN users u2 ON leads.updatedById = u2.id
//         LEFT JOIN customers c ON leads.customerId = c.id
//         WHERE 1=1
//       `;
//       const values = [];
//       let paramIndex = 1;

//       if (customerId) {
//         query += ` AND leads.customerId = $${paramIndex}::uuid`;
//         values.push(customerId);
//         paramIndex++;
//       }
//       if (assignedTo) {
//         query += ` AND leads.assignedTo = $${paramIndex}::uuid`;
//         values.push(assignedTo);
//         paramIndex++;
//       }
//       if (updatedById) {
//         query += ` AND leads.updatedById = $${paramIndex}::uuid`;
//         values.push(updatedById);
//         paramIndex++;
//       }
//       if (status) {
//         query += ` AND leads.status = $${paramIndex}`;
//         values.push(status);
//         paramIndex++;
//       }
//       if (stage) {
//         query += ` AND leads.stage = $${paramIndex}`;
//         values.push(stage);
//         paramIndex++;
//       }
//       if (companyId) {
//         query += ` AND leads.companyId = $${paramIndex}`;
//         values.push(companyId);
//         paramIndex++;
//       }
//       if (search) {
//         query += ` AND LOWER(leads.name) LIKE LOWER($${paramIndex})`;
//         values.push(`%${search.trim()}%`);
//         paramIndex++;
//       }

//       // Add pagination
//       query += ` ORDER BY leads.createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
//       values.push(limitNum, offset);

//       // Total count query
//       let countQuery = `SELECT COUNT(*) FROM leads WHERE 1=1`;
//       const countValues = [];
//       let countIndex = 1;

//       if (customerId) {
//         countQuery += ` AND customerId = $${countIndex}::uuid`;
//         countValues.push(customerId);
//         countIndex++;
//       }
//       if (assignedTo) {
//         countQuery += ` AND assignedTo = $${countIndex}::uuid`;
//         countValues.push(assignedTo);
//         countIndex++;
//       }
//       if (updatedById) {
//         countQuery += ` AND updatedById = $${countIndex}::uuid`;
//         countValues.push(updatedById);
//         countIndex++;
//       }
//       if (status) {
//         countQuery += ` AND status = $${countIndex}`;
//         countValues.push(status);
//         countIndex++;
//       }
//       if (stage) {
//         countQuery += ` AND stage = $${countIndex}`;
//         countValues.push(stage);
//         countIndex++;
//       }
//       if (companyId) {
//         countQuery += ` AND companyId = $${countIndex}`;
//         countValues.push(companyId);
//         countIndex++;
//       }
//       if (search) {
//         countQuery += ` AND LOWER(name) LIKE LOWER($${countIndex})`;
//         countValues.push(`%${search.trim()}%`);
//         countIndex++;
//       }

//       // Execute both queries
//       const [dataResult, countResult] = await Promise.all([
//         client.query(query, values),
//         client.query(countQuery, countValues)
//       ]);

//       const totalCount = parseInt(countResult.rows[0].count, 10);
//       const totalPages = Math.ceil(totalCount / limitNum);

//       res.status(200).json({
//         status: true,
//         data: { dataList: dataResult.rows },
//         page: pageNum,
//         limit: limitNum,
//         totalCount,
//         totalPages,
//         message: "Leads fetched successfully"
//       });
//     } finally {
//       client.release();
//     }
//   } catch (err) {
//     console.error('Get leads error:', err.stack);
//     res.status(500).json({ error: 'Internal server error' });
//   }
// };


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
        stage,
        companyId,
        search,
        page = 1,
        limit = 10
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

      // Validate companyId
      if (companyId && !companyId.trim()) {
        return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
      }

      // Validate search parameter
      if (search && typeof search !== 'string') {
        return res.status(400).json({ error: 'Invalid search parameter: Must be a string' });
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

      // Base query
      let query = `
        SELECT 
          leads.*,
          u1.name AS assignedto_name,
          u2.name AS updatedby_name,
          c.name AS customer_name
        FROM leads
        LEFT JOIN users u1 ON leads.assignedTo = u1.id
        LEFT JOIN users u2 ON leads.updatedById = u2.id
        LEFT JOIN customers c ON leads.customerId = c.id
        WHERE 1=1
      `;
      const values = [];
      let paramIndex = 1;

      if (customerId) {
        query += ` AND leads.customerId = $${paramIndex}::uuid`;
        values.push(customerId);
        paramIndex++;
      }
      if (assignedTo) {
        query += ` AND leads.assignedTo = $${paramIndex}::uuid`;
        values.push(assignedTo);
        paramIndex++;
      }
      if (updatedById) {
        query += ` AND leads.updatedById = $${paramIndex}::uuid`;
        values.push(updatedById);
        paramIndex++;
      }
      if (status) {
        query += ` AND leads.status = $${paramIndex}`;
        values.push(status);
        paramIndex++;
      }
      if (stage) {
        query += ` AND leads.stage = $${paramIndex}`;
        values.push(stage);
        paramIndex++;
      }
      if (companyId) {
        query += ` AND leads.companyId = $${paramIndex}`;
        values.push(companyId);
        paramIndex++;
      }
      if (search) {
        query += ` AND LOWER(leads.leadName) LIKE LOWER($${paramIndex})`;
        values.push(`%${search.trim()}%`);
        paramIndex++;
      }

      // Add pagination
      query += ` ORDER BY leads.createdAt DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limitNum, offset);

      // Total count query
      let countQuery = `SELECT COUNT(*) FROM leads WHERE 1=1`;
      const countValues = [];
      let countIndex = 1;

      if (customerId) {
        countQuery += ` AND customerId = $${countIndex}::uuid`;
        countValues.push(customerId);
        countIndex++;
      }
      if (assignedTo) {
        countQuery += ` AND assignedTo = $${countIndex}::uuid`;
        countValues.push(assignedTo);
        countIndex++;
      }
      if (updatedById) {
        countQuery += ` AND updatedById = $${countIndex}::uuid`;
        countValues.push(updatedById);
        countIndex++;
      }
      if (status) {
        countQuery += ` AND status = $${countIndex}`;
        countValues.push(status);
        countIndex++;
      }
      if (stage) {
        countQuery += ` AND stage = $${countIndex}`;
        countValues.push(stage);
        countIndex++;
      }
      if (companyId) {
        countQuery += ` AND companyId = $${countIndex}`;
        countValues.push(companyId);
        countIndex++;
      }
      if (search) {
        countQuery += ` AND LOWER(leadName) LIKE LOWER($${countIndex})`;
        countValues.push(`%${search.trim()}%`);
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
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get leads error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
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
          u1.name AS assignedTo_name,
          u2.name AS updatedBy_name,
          c.name AS customer_name
        FROM leads
        LEFT JOIN users u1 ON leads.assignedTo = u1.id
        LEFT JOIN users u2 ON leads.updatedById = u2.id
        LEFT JOIN customers c ON leads.customerId = c.id
        WHERE leads.companyId = $1
        ORDER BY leads.createdAt DESC
        `,
        [companyId]
      );

      res.status(200).json({
        status: true,
        data: {dataList:result.rows[0]},
        message: "Leads fetched successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get leads by companyId error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
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
          u1.name AS assignedTo_name,
          u2.name AS updatedBy_name,
          c.name AS customer_name
        FROM leads
        LEFT JOIN users u1 ON leads.assignedTo = u1.id
        LEFT JOIN users u2 ON leads.updatedById = u2.id
        LEFT JOIN customers c ON leads.customerId = c.id
        WHERE leads.id = $1
        `,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Lead fetched successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get lead error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
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
    stage,
    subCategory,
    isClose,
    isCompleted,
    phone,
    isDeal,
    companyId
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
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  // Validate phone format if provided
  if (phone && !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  }

  // Validate companyId if provided
  if (companyId && !companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
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

      const result = await client.query(
        `UPDATE leads
         SET customerId = $1, source = $2, status = $3, assignedTo = $4, notes = $5,
             leadName = $6, updatedById = $7, updatedOn = $8, stage = $9, subCategory = $10,
             isClose = $11, isCompleted = $12, phone = $13, isDeal = $14, companyId = $15
         WHERE id = $16 RETURNING *`,
        [
          customerId, source, status, assignedTo, notes, leadName, updatedById,
          updatedOn, stage, subCategory, isClose, isCompleted, phone, isDeal, companyId, id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Lead updated successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update lead error:', err.stack);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail });
    }
    res.status(500).json({ error: 'Internal server error' });
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
  if (!isUUID(id)) {
    return res.status(400).json({ error: 'Invalid id: Must be a valid UUID' });
  }

  // Validate phone format if provided
  if (req.body.phone && !/^\d{10}$/.test(req.body.phone)) {
    return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  }

  // Validate companyId if provided
  if (req.body.companyId && !req.body.companyId.trim()) {
    return res.status(400).json({ error: 'Invalid companyId: Must be a non-empty string' });
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
      if (req.body.assignedTo) {
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

      const setString = fields.map(([key], idx) => `${key} = $${idx + 1}`).join(', ');
      const values = fields.map(([, value]) => value);

      const result = await client.query(
        `UPDATE leads SET ${setString} WHERE id = $${fields.length + 1} RETURNING *`,
        [...values, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Lead not found' });
      }

        res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Lead patched successfully',
      })
      
    } catch (err) {
      console.error('Patch lead error:', err);
      if (err.code === '23503') {
        return res.json({ error: 'Invalid foreign key value', details: err.detail });
      }
      if (err.code === '23505') {
        return res.json({ error: 'Duplicate key value', details: err.detail });
      }
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Patch lead error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }

}
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
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete lead error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
};