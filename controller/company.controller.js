const { initializePool } = require('../db');

exports.createCompany = async (req, res) => {
  const {
    companyName, companyEmail, companyPhone, companyLogo,
    adminId, validityUpto, GSTNumber, companyAddress,
    termsAndCondition, enquiryLink
  } = req.body;

  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO companies (
          companyName, companyEmail, companyPhone, companyLogo,
          adminId, validityUpto, GSTNumber, companyAddress,
          termsAndCondition, enquiryLink
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [
          companyName, companyEmail, companyPhone, companyLogo,
          adminId, validityUpto, GSTNumber, companyAddress,
          termsAndCondition, enquiryLink
        ]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getCompanies = async (req, res) => {
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM companies');
      res.status(200).json(result.rows);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getCompanyById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM companies WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateCompany = async (req, res) => {
  const { id } = req.params;
  const {
    companyName, companyEmail, companyPhone, companyLogo,
    adminId, validityUpto, GSTNumber, companyAddress,
    termsAndCondition, enquiryLink
  } = req.body;

  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE companies SET
          companyName = $1,
          companyEmail = $2,
          companyPhone = $3,
          companyLogo = $4,
          adminId = $5,
          validityUpto = $6,
          GSTNumber = $7,
          companyAddress = $8,
          termsAndCondition = $9,
          enquiryLink = $10
        WHERE id = $11 RETURNING *`,
        [
          companyName, companyEmail, companyPhone, companyLogo,
          adminId, validityUpto, GSTNumber, companyAddress,
          termsAndCondition, enquiryLink, id
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteCompany = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM companies WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Company not found' });
      }
      res.status(200).json({ message: 'Company deleted successfully' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};