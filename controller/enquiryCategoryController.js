const pool = require('../db');

exports.createEnquiryCategory = async (req, res) => {
  const { createdById, companyId, name, categoryType } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO enquiryCategory (createdById, companyId, name, categoryType)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [createdById, companyId, name, categoryType]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllEnquiryCategories = async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM enquiryCategory`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getEnquiryCategoryById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`SELECT * FROM enquiryCategory WHERE id = $1`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateEnquiryCategory = async (req, res) => {
  const { id } = req.params;
  const { name, categoryType } = req.body;
  try {
    const result = await pool.query(
      `UPDATE enquiryCategory SET name = $1, categoryType = $2 WHERE id = $3 RETURNING *`,
      [name, categoryType, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEnquiryCategory = async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`DELETE FROM enquiryCategory WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
