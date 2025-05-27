const { initializePool } = require('../db');

exports.createProspect = async (req, res) => {
  const {
    name, email, phone, countryCode, dialCode, bill_no, date,
    prospect_type, enquiryCategoryId, productsCategory, customerId
  } = req.body;

  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO prospects (
          name, email, phone, countryCode, dialCode, bill_no, date,
          prospect_type, enquiryCategoryId, productsCategory, customerId
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [name, email, phone, countryCode, dialCode, bill_no, date, prospect_type, enquiryCategoryId, JSON.stringify(productsCategory), customerId]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create prospect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllProspects = async (req, res) => {
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM prospects ORDER BY date DESC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get prospects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getProspectById = async (req, res) => {
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM prospects WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get prospect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateProspect = async (req, res) => {
  const {
    name, email, phone, countryCode, dialCode, bill_no, date,
    prospect_type, enquiryCategoryId, productsCategory, customerId
  } = req.body;

  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE prospects SET 
          name = $1, email = $2, phone = $3, countryCode = $4, dialCode = $5,
          bill_no = $6, date = $7, prospect_type = $8, enquiryCategoryId = $9,
          productsCategory = $10, customerId = $11
         WHERE id = $12 RETURNING *`,
        [name, email, phone, countryCode, dialCode, bill_no, date, prospect_type, enquiryCategoryId, JSON.stringify(productsCategory), customerId, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update prospect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteProspect = async (req, res) => {
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM prospects WHERE id = $1 RETURNING *', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
      res.json({ message: 'Prospect deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete prospect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateCustomerIdForProspect = async (req, res) => {
  const { customerId } = req.body;
  const { id } = req.params;

  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE prospects SET customerId = $1 WHERE id = $2 RETURNING *`,
        [customerId, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update prospect customerId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};