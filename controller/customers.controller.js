const pool = require('../db');

// Create Customer
exports.createCustomer = async (req, res) => {
  try {
    const {
      name, email, phone, address, website, created_by,
      companyname, locationaddress, location_lat, location_long,
      locationname, customercode, assigntoid, imageurl
    } = req.body;

    const result = await pool.query(
      `INSERT INTO customers (
        name, email, phone, address, website, created_by,
        companyname, locationaddress, location_lat, location_long,
        locationname, customercode, assigntoid, imageurl
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [name, email, phone, address, website, created_by,
       companyname, locationaddress, location_lat, location_long,
       locationname, customercode, assigntoid, imageurl]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get All Customers
exports.getCustomers = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers');
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get Customer by ID
exports.getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Get customer by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update Customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, email, phone, address, website, created_by,
      companyname, locationaddress, location_lat, location_long,
      locationname, customercode, assigntoid, imageurl
    } = req.body;

    const result = await pool.query(
      `UPDATE customers SET
        name=$1, email=$2, phone=$3, address=$4, website=$5, created_by=$6,
        companyname=$7, locationaddress=$8, location_lat=$9, location_long=$10,
        locationname=$11, customercode=$12, assigntoid=$13, imageurl=$14
      WHERE id = $15 RETURNING *`,
      [name, email, phone, address, website, created_by,
       companyname, locationaddress, location_lat, location_long,
       locationname, customercode, assigntoid, imageurl, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Delete Customer
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
