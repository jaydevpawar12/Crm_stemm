const pool = require('../db');

// CREATE
exports.createContact = async (req, res) => {
  const { customerId, name, email, phone } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO customer_addition_contacts (customerId, name, email, phone)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [customerId, name, email, phone]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ all contacts for a customer
exports.getContactsByCustomer = async (req, res) => {
  const { customerId } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM customer_addition_contacts WHERE customerId = $1`,
      [customerId]
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ single contact by ID
exports.getContactById = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT * FROM customer_addition_contacts WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching contact by ID:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// UPDATE
exports.updateContact = async (req, res) => {
  const { id } = req.params;
  const { name, email, phone } = req.body;

  try {
    const result = await pool.query(
      `UPDATE customer_addition_contacts
       SET name = $1, email = $2, phone = $3
       WHERE id = $4 RETURNING *`,
      [name, email, phone, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE
exports.deleteContact = async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `DELETE FROM customer_addition_contacts WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(200).json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
