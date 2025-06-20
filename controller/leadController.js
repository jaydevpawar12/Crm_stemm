// const { initializePool } = require('../db');
const { pool } = require('../db');


// CREATE
exports.createLead = async (req, res) => {
  const {
    customer_id,
    source,
    status,
    assigned_to,
    notes,
    leadName,
    updatedById,
    stage,
    subCategory,
    isClose,
    isCompleted
  } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO leads
          (customer_id, source, status, assigned_to, notes, leadName, updatedById, stage, subCategory, isClose, isCompleted)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [customer_id, source, status, assigned_to, notes, leadName, updatedById, stage, subCategory, isClose, isCompleted]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create lead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ ALL
exports.getAllLeads = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      // Extract query parameters
      const {
        customer_id,
        assigned_to,
        updatedbyid,
        status,
        stage,
        page = 1,
        limit = 10
      } = req.query;

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
          u1.name AS assigned_to_name,
          u2.name AS updatedby_name,
          c.name AS customer_name
        FROM leads
        LEFT JOIN users u1 ON leads.assigned_to = u1.id
        LEFT JOIN users u2 ON leads.updatedbyid = u2.id
        LEFT JOIN customers c ON leads.customer_id = c.id
        WHERE 1=1
      `;
      let conditions = [];
      let values = [];
      let paramIndex = 1;

      if (assigned_to) {
        query += ` AND leads.assigned_to = $${paramIndex}`;
        values.push(assigned_to);
        paramIndex++;
      }

      if (customer_id) {
        query += ` AND leads.customer_id = $${paramIndex}`;
        values.push(customer_id);
        paramIndex++;
      }

      if (updatedbyid) {
        query += ` AND leads.updatedbyid = $${paramIndex}`;
        values.push(updatedbyid);
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

      // Add pagination
      query += ` ORDER BY leads.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      values.push(limitNum, offset);

      // Total count query
      let countQuery = `
        SELECT COUNT(*) FROM leads WHERE 1=1
      `;
      let countConditions = [];
      let countValues = [];
      let countIndex = 1;

      if (assigned_to) {
        countQuery += ` AND assigned_to = $${countIndex}`;
        countValues.push(assigned_to);
        countIndex++;
      }

      if (customer_id) {
        countQuery += ` AND customer_id = $${countIndex}`;
        countValues.push(customer_id);
        countIndex++;
      }

      if (updatedbyid) {
        countQuery += ` AND updatedbyid = $${countIndex}`;
        countValues.push(updatedbyid);
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

      // Execute both queries
      const [dataResult, countResult] = await Promise.all([
        client.query(query, values),
        client.query(countQuery, countValues)
      ]);

      const totalCount = parseInt(countResult.rows[0].count, 10);
      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        data: dataResult.rows,
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
    console.error('Get leads error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};


// READ ONE
exports.getLeadById = async (req, res) => {
  const { id } = req.params;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM leads WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get lead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// UPDATE
exports.updateLead = async (req, res) => {
  const { id } = req.params;
  const {
    source,
    status,
    assigned_to,
    notes,
    leadName,
    updatedById,
    updatedOn,
    stage,
    subCategory,
    isClose,
    isCompleted
  } = req.body;

  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE leads
         SET source = $1, status = $2, assigned_to = $3, notes = $4, leadName = $5,
             updatedById = $6, updatedOn = $7, stage = $8, subCategory = $9, isClose = $10, isCompleted = $11
         WHERE id = $12 RETURNING *`,
        [source, status, assigned_to, notes, leadName, updatedById, updatedOn, stage, subCategory, isClose, isCompleted, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update lead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE
exports.deleteLead = async (req, res) => {
  const { id } = req.params;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM leads WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
      res.json({ message: 'Lead deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete lead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};