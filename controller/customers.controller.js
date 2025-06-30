const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

// Create Customer
exports.createCustomer = async (req, res) => {
  const {
    name, email, phone, address, website, created_by,
    company_id, location_address, location_lat, location_long,
    location_name, customer_code, assigned_to_id, image_url, dial_code, country_code, company_name
  } = req.body;

  // Validate required fields
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!created_by) return res.status(400).json({ error: 'Created_by is required' });

  // Validate UUID fields
  if (!isUUID(created_by)) return res.status(400).json({ error: 'Invalid created_by: Must be a valid UUID' });
  if (assigned_to_id && !isUUID(assigned_to_id)) return res.status(400).json({ error: 'Invalid assigned_to_id: Must be a valid UUID' });

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate other fields
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  if (location_lat && (isNaN(location_lat) || location_lat < -90 || location_lat > 90)) return res.status(400).json({ error: 'Invalid latitude: Must be between -90 and 90' });
  if (location_long && (isNaN(location_long) || location_long < -180 || location_long > 180)) return res.status(400).json({ error: 'Invalid longitude: Must be between -180 and 180' });

  try {
    const client = await pool.connect();
    try {
      // Validate created_by exists in users table
      const creator_check = await client.query('SELECT 1 FROM users WHERE id = $1', [created_by]);
      if (creator_check.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid created_by: User does not exist' });
      }

      // Validate assigned_to_id exists in users table
      if (assigned_to_id) {
        const assignee_check = await client.query('SELECT 1 FROM users WHERE id = $1', [assigned_to_id]);
        if (assignee_check.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assigned_to_id: User does not exist' });
        }
      }

      // Check for existing email if provided
      if (email) {
        const email_check = await client.query('SELECT 1 FROM customers WHERE email = $1', [email]);
        if (email_check.rows.length > 0) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      // Check for existing phone if provided
      if (phone) {
        const phone_check = await client.query('SELECT 1 FROM customers WHERE phone = $1', [phone]);
        if (phone_check.rows.length > 0) {
          return res.status(400).json({ error: 'Phone number already exists' });
        }
      }

      const result = await client.query(
        `INSERT INTO customers (
           name, email, phone, address, website, created_by,
           company_id, location_address, location_lat, location_long,
           location_name, customer_code, assigned_to_id, image_url, dial_code, country_code, company_name
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          name, email, phone, address, website, created_by,
          company_id, location_address, location_lat, location_long,
          location_name, customer_code, assigned_to_id, image_url, dial_code, country_code, company_name
        ]
      );

      res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Customer created successfully'
      });
    } catch (err) {
      console.error('Create customer error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
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
      const { assigned_to_id, created_by, company_id, page = 1, limit = 10, search } = req.query;

      // Validate page and limit
      const page_num = parseInt(page, 10);
      const limit_num = parseInt(limit, 10);
      if (isNaN(page_num) || page_num < 1) {
        return res.status(400).json({ error: 'Invalid page number: Must be a positive integer' });
      }
      if (isNaN(limit_num) || limit_num < 1) {
        return res.status(400).json({ error: 'Invalid limit: Must be a positive integer' });
      }

      // Validate UUID fields
      if (assigned_to_id && !isUUID(assigned_to_id)) {
        return res.status(400).json({ error: 'Invalid assigned_to_id: Must be a valid UUID' });
      }
      if (created_by && !isUUID(created_by)) {
        return res.status(400).json({ error: 'Invalid created_by: Must be a valid UUID' });
      }

      // Validate search parameter
      if (search && typeof search !== 'string') {
        return res.status(400).json({ error: 'Invalid search parameter: Must be a string' });
      }

      // Validate company_id if provided
      if (company_id && typeof company_id !== 'string') {
        return res.status(400).json({ error: 'Invalid company_id: Must be a string' });
      }

      // Validate assigned_to_id exists
      if (assigned_to_id) {
        const assignee_check = await client.query('SELECT 1 FROM users WHERE id = $1', [assigned_to_id]);
        if (assignee_check.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assigned_to_id: User does not exist' });
        }
      }

      // Validate created_by exists
      if (created_by) {
        const creator_check = await client.query('SELECT 1 FROM users WHERE id = $1', [created_by]);
        if (creator_check.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid created_by: User does not exist' });
        }
      }

      const offset = (page_num - 1) * limit_num;

      // Main query
      let query = `
        SELECT 
          c.*,
          u1.name AS assigned_to_name,
          u2.name AS created_by_name
        FROM customers c
        LEFT JOIN users u1 ON c.assigned_to_id = u1.id
        LEFT JOIN users u2 ON c.created_by = u2.id
      `;
      let conditions = [];
      let values = [];
      let param_count = 1;

      if (assigned_to_id) {
        conditions.push(`c.assigned_to_id = $${param_count}::uuid`);
        values.push(assigned_to_id);
        param_count++;
      }
      if (created_by) {
        conditions.push(`c.created_by = $${param_count}::uuid`);
        values.push(created_by);
        param_count++;
      }
      if (company_id) {
        conditions.push(`c.company_id = $${param_count}`);
        values.push(company_id);
        param_count++;
      }
      if (search) {
        const trimmed_search = search.trim();
        if (trimmed_search.length >= 3 && !trimmed_search.includes(' ')) {
          // Try exact match on name OR company_name
          conditions.push(`(LOWER(c.name) = LOWER($${param_count}) OR LOWER(c.company_name) = LOWER($${param_count}))`);
          values.push(trimmed_search);
        } else {
          // Partial match on name or company_name
          conditions.push(`(LOWER(c.name) LIKE LOWER($${param_count}) OR LOWER(c.company_name) LIKE LOWER($${param_count}))`);
          values.push(`%${trimmed_search}%`);
        }
        param_count++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${param_count} OFFSET $${param_count + 1}`;
      values.push(limit_num, offset);

      // Count query
      let count_query = `SELECT COUNT(*) FROM customers c`;
      const count_conditions = [];
      const count_params = [];
      let count_param_index = 1;

      if (assigned_to_id) {
        count_conditions.push(`c.assigned_to_id = $${count_param_index}::uuid`);
        count_params.push(assigned_to_id);
        count_param_index++;
      }
      if (created_by) {
        count_conditions.push(`c.created_by = $${count_param_index}::uuid`);
        count_params.push(created_by);
        count_param_index++;
      }
      if (company_id) {
        count_conditions.push(`c.company_id = $${count_param_index}`);
        count_params.push(company_id);
        count_param_index++;
      }
      if (search) {
        const trimmed_search = search.trim();
        if (trimmed_search.length >= 3 && !trimmed_search.includes(' ')) {
          count_conditions.push(`(LOWER(c.name) = LOWER($${count_param_index}) OR LOWER(c.company_name) = LOWER($${count_param_index}))`);
          count_params.push(trimmed_search);
        } else {
          count_conditions.push(`(LOWER(c.name) LIKE LOWER($${count_param_index}) OR LOWER(c.company_name) LIKE LOWER($${count_param_index}))`);
          count_params.push(`%${trimmed_search}%`);
        }
        count_param_index++;
      }

      if (count_conditions.length > 0) {
        count_query += ' WHERE ' + count_conditions.join(' AND ');
      }

      // Debugging logs
      console.log('Main Query:', query);
      console.log('Main Query Params:', values);
      console.log('Count Query:', count_query);
      console.log('Count Query Params:', count_params);

      const [result, count_result] = await Promise.all([
        client.query(query, values),
        client.query(count_query, count_params)
      ]);

      const dataList = result.rows;

      const totalCount = parseInt(count_result.rows[0].count, 10);

      res.status(200).json({
        status: true,
        data: {
          dataList,
          totalCount,
          page: page_num,
          limit: limit_num,
          totalPages: Math.ceil(totalCount / limit_num)
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
        LEFT JOIN users u1 ON c.assigned_to_id = u1.id
        LEFT JOIN users u2 ON c.created_by = u2.id
        WHERE c.id = $1
        `,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json({
        status: true,
        data: result.rows[0],
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
    company_id, location_address, location_lat, location_long,
    location_name, customer_code, assigned_to_id, image_url, dial_code, country_code, company_name
  } = req.body;

  // Validate required fields
  if (!id) return res.status(400).json({ error: 'Customer ID is required' });
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!created_by) return res.status(400).json({ error: 'Created_by is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid customer ID: Must be a valid UUID' });
  if (!isUUID(created_by)) return res.status(400).json({ error: 'Invalid created_by: Must be a valid UUID' });
  if (assigned_to_id && !isUUID(assigned_to_id)) return res.status(400).json({ error: 'Invalid assigned_to_id: Must be a valid UUID' });

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate other fields
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  if (location_lat && (isNaN(location_lat) || location_lat < -90 || location_lat > 90)) return res.status(400).json({ error: 'Invalid latitude: Must be between -90 and 90' });
  if (location_long && (isNaN(location_long) || location_long < -180 || location_long > 180)) return res.status(400).json({ error: 'Invalid longitude: Must be between -180 and 180' });

  try {
    const client = await pool.connect();
    try {
      // Validate created_by exists
      const creator_check = await client.query('SELECT 1 FROM users WHERE id = $1', [created_by]);
      if (creator_check.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid created_by: User does not exist' });
      }

      // Validate assigned_to_id exists
      if (assigned_to_id) {
        const assignee_check = await client.query('SELECT 1 FROM users WHERE id = $1', [assigned_to_id]);
        if (assignee_check.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assigned_to_id: User does not exist' });
        }
      }

      const result = await client.query(
        `UPDATE customers SET
          name=$1, email=$2, phone=$3, address=$4, website=$5, created_by=$6,
          company_id=$7, location_address=$8, location_lat=$9, location_long=$10,
          location_name=$11, customer_code=$12, assigned_to_id=$13, image_url=$14, dial_code=$15, country_code=$16, company_name=$17
        WHERE id = $18 RETURNING *`,
        [
          name, email, phone, address, website, created_by,
          company_id, location_address, location_lat, location_long,
          location_name, customer_code, assigned_to_id, image_url, dial_code, country_code, company_name, id
        ]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });
      res.status(200).json({
        status: true,
        data: result.rows[0],
        message: 'Customer updated successfully'
      });
    } catch (err) {
      console.error('Update customer error:', err.stack);
      if (err.code === '23503') {
        return res.status(400).json({ error: 'Invalid foreign key value', details: err.detail || 'Foreign key constraint violation' });
      }
      if (err.code === '23505') {
        return res.status(400).json({ error: 'Duplicate key value', details: err.detail || 'Unique constraint violation' });
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
        status: true,
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