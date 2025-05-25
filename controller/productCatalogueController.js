// productcatalogues/productCatalogueController.js
const pool = require('../db');

// CREATE
exports.createProductCatalogue = async (req, res) => {
  const { createdById, link, image, catalogueName } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO productcatalogues (createdById, link, image, catalogueName)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [createdById, link, image, catalogueName]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ALL
exports.getAllProductCatalogues = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM productcatalogues ORDER BY createdOn DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ONE
exports.getProductCatalogueById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM productcatalogues WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Catalogue not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
exports.updateProductCatalogue = async (req, res) => {
  const { id } = req.params;
  const { link, image, catalogueName } = req.body;
  try {
    const result = await pool.query(
      `UPDATE productcatalogues
       SET link = $1, image = $2, catalogueName = $3
       WHERE id = $4 RETURNING *`,
      [link, image, catalogueName, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Catalogue not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteProductCatalogue = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM productcatalogues WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Catalogue not found' });
    res.json({ message: 'Catalogue deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
