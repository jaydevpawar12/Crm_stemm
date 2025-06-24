// const { initializePool } = require('../db');
const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

// Create Customer
exports.createCustomer = async (req, res) => {
  const {
    // Added to match user API's ID requirement
    name, email, phone, address, website, created_by,
    companyname, locationaddress, location_lat, location_long,
    locationname, customercode, assigntoid, imageurl
  } = req.body;

  // Validate required fields
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!created_by) return res.status(400).json({ error: 'Created_by is required' });

  // Validate UUID fields
  if (!isUUID(created_by)) return res.status(400).json({ error: 'Invalid created_by: Must be a valid UUID' });
  if (assigntoid && !isUUID(assigntoid)) return res.status(400).json({ error: 'Invalid assigntoid: Must be a valid UUID' });

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  // Validate other fields
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  if (website && !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(website)) return res.status(400).json({ error: 'Invalid website URL' });
  if (location_lat && (isNaN(location_lat) || location_lat < -90 || location_lat > 90)) return res.status(400).json({ error: 'Invalid latitude: Must be between -90 and 90' });
  if (location_long && (isNaN(location_long) || location_long < -180 || location_long > 180)) return res.status(400).json({ error: 'Invalid longitude: Must be between -180 and 180' });
  if (customercode && !/^[A-Z0-9]{3,10}$/.test(customercode)) return res.status(400).json({ error: 'Invalid customer code: Must be 3-10 alphanumeric characters' });

  try {
    const client = await pool.connect();
    try {
      // Validate created_by exists in users table
      console.log('created_by:', created_by);
      const creatorCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [created_by]);
      if (creatorCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid created_by: User does not exist' });
      }

      // Validate assigntoid exists in users table
      if (assigntoid) {
        const assigneeCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [assigntoid]);
        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assigntoid: User does not exist' });
        }
      }

      const result = await client.query(
        `INSERT INTO customers (
           name, email, phone, address, website, created_by,
          companyname, locationaddress, location_lat, location_long,
          locationname, customercode, assigntoid, imageurl
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *`,
        [ name, email, phone, address, website, created_by,
         companyname, locationaddress, location_lat, location_long,
         locationname, customercode, assigntoid, imageurl]
      );

      res.status(201).json({
        success: true,
        data:result.rows[0] ,
        message: 'Customer created successfully'
      });
    } catch (err) {
      console.error('Create customer error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation (e.g., duplicate email or id)' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for UUID or other field' });
      }
      res.status(500).json({ error: 'Failed to create customer', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Get All Customers
exports.getCustomers = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const { assigntoid, created_by, page = 1, limit = 10 } = req.query;

      // Validate page and limit
      const pageNum = parseInt(page, 10);
      const limitNum = parseInt(limit, 10);
      if (isNaN(pageNum) || pageNum < 1) {
        return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
      }
      if (isNaN(limitNum) || limitNum < 1) {
        return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
      }

      // Validate UUID fields
      if (assigntoid && !isUUID(assigntoid)) {
        return res.status(400).json({ error: 'Invalid assigntoid: Must be a valid UUID' });
      }
      if (created_by && !isUUID(created_by)) {
        return res.status(400).json({ error: 'Invalid created_by: Must be a valid UUID' });
      }

      // Validate assigntoid exists
      if (assigntoid) {
        const assigneeCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [assigntoid]);
        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assigntoid: User does not exist' });
        }
      }

      // Validate created_by exists
      if (created_by) {
        const creatorCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [created_by]);
        if (creatorCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid created_by: User does not exist' });
        }
      }

      const offset = (pageNum - 1) * limitNum;

      let query = `
        SELECT 
          c.*,
          u1.name AS assigned_to_name,
          u2.name AS created_by_name
        FROM customers c
        LEFT JOIN users u1 ON c.assigntoid = u1.id
        LEFT JOIN users u2 ON c.created_by = u2.id
      `;
      let conditions = [];
      let values = [];
      let paramCount = 1;

      if (assigntoid) {
        conditions.push(`c.assigntoid = $${paramCount}::uuid`);
        values.push(assigntoid);
        paramCount++;
      }
      if (created_by) {
        conditions.push(`c.created_by = $${paramCount}::uuid`);
        values.push(created_by);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      values.push(limitNum, offset);

      let countQuery = `SELECT COUNT(*) FROM customers c`;
      const countParams = [];
      let countParamIndex = 1;

      if (assigntoid) {
        countQuery += ` WHERE c.assigntoid = $${countParamIndex}::uuid`;
        countParams.push(assigntoid);
        countParamIndex++;
      }
      if (created_by) {
        countQuery += countParams.length > 0 ? ` AND c.created_by = $${countParamIndex}::uuid` : ` WHERE c.created_by = $${countParamIndex}::uuid`;
        countParams.push(created_by);
        countParamIndex++;
      }

      const [result, countResult] = await Promise.all([
        client.query(query, values),
        client.query(countQuery, countParams)
      ]);

      const dataList = result.rows;
      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.status(200).json({
        success: true,
        data: {
          dataList,
          totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum)
        },
        message: 'Customers fetched successfully'
      });
    } catch (err) {
      console.error('Get customers error:', err.stack);
      if (err.code === '22023' || err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format in query parameters', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch customers', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
};

// Get Customer by ID
exports.getCustomerById = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid customer ID: Must be a valid UUID' });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `
        SELECT 
          c.*,
          u1.name AS assigned_to_name,
          u2.name AS created_by_name
        FROM customers c
        LEFT JOIN users u1 ON c.assigntoid = u1.id
        LEFT JOIN users u2 ON c.created_by = u2.id
        WHERE c.id = $1
        `,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json({
        success: true,
        data: result.rows[0] ,
        message: 'Customer fetched successfully'
      });
    } catch (err) {
      console.error('Get customer by ID error:', err.stack);
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to fetch customer', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Database connection failed', details: err.message });
  }
};

// Update Customer
exports.updateCustomer = async (req, res) => {
  const { id } = req.params;
  const {
    name, email, phone, address, website, created_by,
    companyname, locationaddress, location_lat, location_long,
    locationname, customercode, assigntoid, imageurl
  } = req.body;

  // Validate required fields
  if (!id) return res.status(400).json({ error: 'Customer ID is required' });
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!email) return res.status(400).json({ error: 'Email is required' });
  if (!created_by) return res.status(400).json({ error: 'Created_by is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid customer ID: Must be a valid UUID' });
  if (!isUUID(created_by)) return res.status(400).json({ error: 'Invalid created_by: Must be a valid UUID' });
  if (assigntoid && !isUUID(assigntoid)) return res.status(400).json({ error: 'Invalid assigntoid: Must be a valid UUID' });

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });

  // Validate other fields
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  if (website && !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(website)) return res.status(400).json({ error: 'Invalid website URL' });
  if (location_lat && (isNaN(location_lat) || location_lat < -90 || location_lat > 90)) return res.status(400).json({ error: 'Invalid latitude: Must be between -90 and 90' });
  if (location_long && (isNaN(location_long) || location_long < -180 || location_long > 180)) return res.status(400).json({ error: 'Invalid longitude: Must be between -180 and 180' });
  if (customercode && !/^[A-Z0-9]{3,10}$/.test(customercode)) return res.status(400).json({ error: 'Invalid customer code: Must be 3-10 alphanumeric characters' });

  try {
    const client = await pool.connect();
    try {
      // Validate created_by exists
      const creatorCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [created_by]);
      if (creatorCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid created_by: User does not exist' });
      }

      // Validate assigntoid exists
      if (assigntoid) {
        const assigneeCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [assigntoid]);
        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assigntoid: User does not exist' });
        }
      }

      const result = await client.query(
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
      res.status(200).json({
        success: true,
        data: result.rows[0] ,
        message: 'Customer updated successfully'
      });
    } catch (err) {
      console.error('Update customer error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation (e.g., duplicate email)' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for UUID or other field' });
      }
      res.status(500).json({ error: 'Failed to update customer', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};

// Delete Customer
exports.deleteCustomer = async (req, res) => {
  const { id } = req.params;

  // Validate UUID
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid customer ID: Must be a valid UUID' });

  try {
    const client = await pool.connect();
    try {
      const result = await client.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json({
        success: true,
        message: 'Customer deleted successfully'
      });
    } catch (err) {
      console.error('Delete customer error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Cannot delete customer due to foreign key constraint', details: err.detail || 'Customer is referenced by other records' });
      }
      if (err.code === '22P02') {
        return res.status(400).json({ error: 'Invalid UUID format', details: err.message });
      }
      res.status(500).json({ error: 'Failed to delete customer', details: err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Database connection error:', err.stack);
    res.status(500).json({ error: 'Failed to connect to database', details: err.message });
  }
};