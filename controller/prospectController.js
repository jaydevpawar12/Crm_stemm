const pool = require('../db');

exports.createProspect = async (req, res) => {
  const {
    name, email, phone, countryCode, dialCode, bill_no, date,
    prospect_type, enquiryCategoryId, productsCategory, customerId
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO prospects (
        name, email, phone, countryCode, dialCode, bill_no, date,
        prospect_type, enquiryCategoryId, productsCategory, customerId
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [name, email, phone, countryCode, dialCode, bill_no, date, prospect_type, enquiryCategoryId, productsCategory, customerId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllProspects = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prospects ORDER BY date DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getProspectById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM prospects WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateProspect = async (req, res) => {
  const {
    name, email, phone, countryCode, dialCode, bill_no, date,
    prospect_type, enquiryCategoryId, productsCategory, customerId
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE prospects SET 
        name = $1, email = $2, phone = $3, countryCode = $4, dialCode = $5,
        bill_no = $6, date = $7, prospect_type = $8, enquiryCategoryId = $9,
        productsCategory = $10, customerId = $11
       WHERE id = $12 RETURNING *`,
      [name, email, phone, countryCode, dialCode, bill_no, date, prospect_type, enquiryCategoryId, productsCategory, customerId, req.params.id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteProspect = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM prospects WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
    res.json({ message: 'Prospect deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE ONLY customerId
exports.updateCustomerIdForProspect = async (req, res) => {
  const { customerId } = req.body;
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE prospects SET customerId = $1 WHERE id = $2 RETURNING *`,
      [customerId, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
