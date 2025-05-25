const pool = require('../db');

exports.createInteraction = async (req, res) => {
  const {
    lead_id,
    interaction_type,
    notes,
    interaction_date,
    created_by,
    attachments // Should be an array
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO interactions (
         lead_id, interaction_type, notes, interaction_date, created_by, attachments
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [lead_id, interaction_type, notes, interaction_date || new Date(), created_by, attachments]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllInteractions = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM interactions ORDER BY interaction_date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getInteractionById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('SELECT * FROM interactions WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateInteraction = async (req, res) => {
  const { id } = req.params;
  const {
    lead_id,
    interaction_type,
    notes,
    interaction_date,
    created_by,
    attachments
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE interactions SET
        lead_id = $1,
        interaction_type = $2,
        notes = $3,
        interaction_date = $4,
        created_by = $5,
        attachments = $6
       WHERE id = $7 RETURNING *`,
      [lead_id, interaction_type, notes, interaction_date, created_by, attachments, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteInteraction = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM interactions WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Interaction not found' });
    }

    res.json({ message: 'Interaction deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
