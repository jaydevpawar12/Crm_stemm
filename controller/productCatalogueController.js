const { initializePool } = require('../db');

// CREATE
exports.createProductCatalogue = async (req, res) => {
  const { createdById, link, image, catalogueName } = req.body;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO productcatalogues (createdById, link, image, catalogueName)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [createdById, link, image, catalogueName]
      );
      res.status(201).json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create product catalogue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ ALL
exports.getAllProductCatalogues = async (req, res) => {
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM productcatalogues ORDER BY createdOn DESC');
      res.json(result.rows);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get product catalogues error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// READ ONE
exports.getProductCatalogueById = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('SELECT * FROM productcatalogues WHERE id = $1', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Catalogue not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get product catalogue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// UPDATE
exports.updateProductCatalogue = async (req, res) => {
  const { id } = req.params;
  const { link, image, catalogueName } = req.body;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE productcatalogues
         SET link = $1, image = $2, catalogueName = $3
         WHERE id = $4 RETURNING *`,
        [link, image, catalogueName, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Catalogue not found' });
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update product catalogue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE
exports.deleteProductCatalogue = async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM productcatalogues WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Catalogue not found' });
      res.json({ message: 'Catalogue deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete product catalogue error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};