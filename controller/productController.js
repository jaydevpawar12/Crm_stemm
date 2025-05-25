const pool = require('../db');

// CREATE
exports.createProduct = async (req, res) => {
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, catalogueId
  } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO products (
        productCode, productName, categoryId, brand, price,
        gstPercentage, hsnCode, productImages, createdById, catalogueId
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        productCode, productName, categoryId, brand, price,
        gstPercentage, hsnCode, JSON.stringify(productImages),
        createdById, catalogueId
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ALL
exports.getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products');
    res.status(200).json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// READ ONE
exports.getProductById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE
exports.updateProduct = async (req, res) => {
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, catalogueId
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE products SET 
        productCode = $1, productName = $2, categoryId = $3, brand = $4, price = $5,
        gstPercentage = $6, hsnCode = $7, productImages = $8, createdById = $9, catalogueId = $10
      WHERE id = $11 RETURNING *`,
      [
        productCode, productName, categoryId, brand, price,
        gstPercentage, hsnCode, JSON.stringify(productImages),
        createdById, catalogueId, req.params.id
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE
exports.deleteProduct = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
