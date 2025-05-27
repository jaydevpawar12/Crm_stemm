const { initializePool } = require('../db');

// CREATE
exports.createProduct = async (req, res) => {
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, catalogueId
  } = req.body;

  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
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
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ ALL
exports.getAllProducts = async (req, res) => {
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM products');
      res.status(200).json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ ONE
exports.getProductById = async (req, res) => {
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
      res.status(200).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// UPDATE
exports.updateProduct = async (req, res) => {
  const {
    productCode, productName, categoryId, brand, price,
    gstPercentage, hsnCode, productImages, createdById, catalogueId
  } = req.body;

  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
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
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE
exports.deleteProduct = async (req, res) => {
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM products WHERE id = $1 RETURNING *', [req.params.id]);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
      res.status(200).json({ message: 'Product deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};