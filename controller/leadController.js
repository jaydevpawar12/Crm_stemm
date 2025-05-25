// leads/leadController.js
const pool = require('../db');

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
    const result = await pool.query(
      `INSERT INTO leads
        (customer_id, source, status, assigned_to, notes, leadName, updatedById, stage, subCategory, isClose, isCompleted)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [customer_id, source, status, assigned_to, notes, leadName, updatedById, stage, subCategory, isClose, isCompleted]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ALL
exports.getAllLeads = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM leads ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ONE
exports.getLeadById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM leads WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const result = await pool.query(
      `UPDATE leads
       SET source = $1, status = $2, assigned_to = $3, notes = $4, leadName = $5,
           updatedById = $6, updatedOn = $7, stage = $8, subCategory = $9, isClose = $10, isCompleted = $11
       WHERE id = $12 RETURNING *`,
      [source, status, assigned_to, notes, leadName, updatedById, updatedOn, stage, subCategory, isClose, isCompleted, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteLead = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
