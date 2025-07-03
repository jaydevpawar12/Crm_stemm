const { pool } = require('../db');
const { validate: isUUID } = require('uuid');

// Utility function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (let key in obj) {
    let camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    camelKey = camelKey.replace(/^([A-Z])/, (match, letter) => letter.toLowerCase());
    // Explicit mappings for specific fields
    if (camelKey === 'createdBy') camelKey = 'createdBy';
    if (camelKey === 'companyId') camelKey = 'companyId';
    if (camelKey === 'locationAddress') camelKey = 'locationAddress';
    if (camelKey === 'locationLat') camelKey = 'locationLat';
    if (camelKey === 'locationLong') camelKey = 'locationLong';
    if (camelKey === 'locationName') camelKey = 'locationName';
    if (camelKey === 'customerCode') camelKey = 'customerCode';
    if (camelKey === 'assignedToId') camelKey = 'assignedToId';
    if (camelKey === 'imageUrl') camelKey = 'imageUrl';
    if (camelKey === 'dialCode') camelKey = 'dialCode';
    if (camelKey === 'countryCode') camelKey = 'countryCode';
    if (camelKey === 'companyName') camelKey = 'companyName';
    if (camelKey === 'assignedToName') camelKey = 'assignedToName';
    if (camelKey === 'createdByName') camelKey = 'createdByName';
    if (camelKey === 'secretkey') camelKey = 'secretKey';
    if (camelKey === 'isnewuser') camelKey = 'isNewUser';
    // New fields
    if (camelKey === 'tags') camelKey = 'tags';
    if (camelKey === 'category') camelKey = 'category';
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Create Customer
exports.createCustomer = async (req, res) => {
  const {
    name, email, phone, address, website, createdBy,
    companyId, locationAddress, locationLat, locationLong,
    locationName, customerCode, assignedToId, imageUrl, dialCode, countryCode, companyName, tags, category
  } = req.body;

  // Validate required fields
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!createdBy) return res.status(400).json({ error: 'CreatedBy is required' });

  // Validate UUID fields
  if (!isUUID(createdBy)) return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  if (assignedToId && !isUUID(assignedToId)) return res.status(400).json({ error: 'Invalid assignedToId: Must be a valid UUID' });

  // Validate UUID arrays for tags and category
  if (tags && (!Array.isArray(tags) || !tags.every(isUUID))) {
    return res.status(400).json({ error: 'Invalid tags: Must be an array of valid UUIDs' });
  }
  if (category && (!Array.isArray(category) || !category.every(isUUID))) {
    return res.status(400).json({ error: 'Invalid category: Must be an array of valid UUIDs' });
  }

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate other fields
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  if (locationLat && (isNaN(locationLat) || locationLat < -90 || locationLat > 90)) return res.status(400).json({ error: 'Invalid latitude: Must be between -90 and 90' });
  if (locationLong && (isNaN(locationLong) || locationLong < -180 || locationLong > 180)) return res.status(400).json({ error: 'Invalid longitude: Must be between -180 and 180' });

  try {
    const client = await pool.connect();
    try {
      // Validate createdBy exists in users table
      const creatorCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
      if (creatorCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
      }

      // Validate assignedToId exists in users table
      if (assignedToId) {
        const assigneeCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [assignedToId]);
        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assignedToId: User does not exist' });
        }
      }

      // Check for existing email if provided
      if (email) {
        const emailCheck = await client.query('SELECT 1 FROM customers WHERE email = $1', [email]);
        if (emailCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      // Check for existing phone if provided
      if (phone) {
        const phoneCheck = await client.query('SELECT 1 FROM customers WHERE phone = $1', [phone]);
        if (phoneCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Phone number already exists' });
        }
      }

      const result = await client.query(
        `INSERT INTO customers (
           name, email, phone, address, website, created_by,
           company_id, location_address, location_lat, location_long,
           location_name, customer_code, assigned_to_id, image_url, dial_code, country_code, company_name, tags, category
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
         RETURNING *`,
        [
          name, email, phone, address, website, createdBy,
          companyId, locationAddress, locationLat, locationLong,
          locationName, customerCode, assignedToId, imageUrl, dialCode, countryCode, companyName, tags, category
        ]
      );

      // Convert snake_case to camelCase for the response data
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(201).json({
        status: true,
        data: camelCaseData,
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
      const { assignedToId, createdBy, companyId, page = 1, limit = 10, search, tags } = req.query;

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
      if (assignedToId && !isUUID(assignedToId)) {
        return res.status(400).json({ error: 'Invalid assignedToId: Must be a valid UUID' });
      }
      if (createdBy && !isUUID(createdBy)) {
        return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
      }

      // Validate search parameter
      if (search && typeof search !== 'string') {
        return res.status(400).json({ error: 'Invalid search parameter: Must be a string' });
      }

      // Validate companyId if provided
      if (companyId && typeof companyId !== 'string') {
        return res.status(400).json({ error: 'Invalid companyId: Must be a string' });
      }

      // Validate tags parameter
      let tagIds = [];
      if (tags) {
        if (typeof tags === 'string') {
          tagIds = tags.split(',').map(id => id.trim()).filter(id => id);
        } else if (Array.isArray(tags)) {
          tagIds = tags.map(id => id.trim()).filter(id => id);
        } else {
          return res.status(400).json({ error: 'Invalid tags: Must be a comma-separated string or array of UUIDs' });
        }

        // Validate each tag ID
        for (const tagId of tagIds) {
          if (!isUUID(tagId)) {
            return res.status(400).json({ error: `Invalid tag ID: ${tagId} is not a valid UUID` });
          }
        }

        // Validate tags exist
        if (tagIds.length > 0) {
          const tagCheck = await client.query(
            'SELECT id FROM customertags WHERE id = ANY($1::uuid[])',
            [tagIds]
          );
          if (tagCheck.rows.length !== tagIds.length) {
            return res.status(400).json({ error: 'One or more tag IDs do not exist' });
          }
        }
      }

      // Validate assignedToId exists
      if (assignedToId) {
        const assigneeCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [assignedToId]);
        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assignedToId: User does not exist' });
        }
      }

      // Validate createdBy exists
      if (createdBy) {
        const creatorCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
        if (creatorCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
        }
      }

      const offset = (pageNum - 1) * limitNum;

      // Main query
      let query = `
        SELECT 
          c.*,
          u1.name AS assigned_to_name,
          u2.name AS created_by_name,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object('id', cc.id, 'name', cc.name)
              )
              FROM customercategory cc
              WHERE cc.id = ANY(c.category)
            ),
            '[]'::json
          ) AS category_details,
          COALESCE(
            (
              SELECT json_agg(
                json_build_object('id', ct.id, 'name', ct.name)
              )
              FROM customertags ct
              WHERE ct.id = ANY(c.tags)
            ),
            '[]'::json
          ) AS tags_details
        FROM customers c
        LEFT JOIN users u1 ON c.assigned_to_id = u1.id
        LEFT JOIN users u2 ON c.created_by = u2.id
      `;
      let conditions = [];
      let values = [];
      let paramCount = 1;

      if (assignedToId) {
        conditions.push(`c.assigned_to_id = $${paramCount}::uuid`);
        values.push(assignedToId);
        paramCount++;
      }
      if (createdBy) {
        conditions.push(`c.created_by = $${paramCount}::uuid`);
        values.push(createdBy);
        paramCount++;
      }
      if (companyId) {
        conditions.push(`c.company_id = $${paramCount}`);
        values.push(companyId);
        paramCount++;
      }
      if (search) {
        const trimmedSearch = search.trim();
        conditions.push(`(LOWER(c.name) LIKE LOWER($${paramCount}) OR LOWER(c.company_name) LIKE LOWER($${paramCount}))`);
        values.push(`%${trimmedSearch}%`);
        paramCount++;
      }
      if (tagIds.length > 0) {
        conditions.push(`c.tags && $${paramCount}::uuid[]`);
        values.push(tagIds);
        paramCount++;
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ` ORDER BY c.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      values.push(limitNum, offset);

      // Count query
      let countQuery = `SELECT COUNT(*) FROM customers c`;
      const countConditions = [];
      const countParams = [];
      let countParamIndex = 1;

      if (assignedToId) {
        countConditions.push(`c.assigned_to_id = $${countParamIndex}::uuid`);
        countParams.push(assignedToId);
        countParamIndex++;
      }
      if (createdBy) {
        countConditions.push(`c.created_by = $${countParamIndex}::uuid`);
        countParams.push(createdBy);
        countParamIndex++;
      }
      if (companyId) {
        countConditions.push(`c.company_id = $${countParamIndex}`);
        countParams.push(companyId);
        countParamIndex++;
      }
      if (search) {
        const trimmedSearch = search.trim();
        countConditions.push(`(LOWER(c.name) LIKE LOWER($${countParamIndex}) OR LOWER(c.company_name) LIKE LOWER($${countParamIndex}))`);
        countParams.push(`%${trimmedSearch}%`);
        countParamIndex++;
      }
      if (tagIds.length > 0) {
        countConditions.push(`c.tags && $${countParamIndex}::uuid[]`);
        countParams.push(tagIds);
        countParamIndex++;
      }

      if (countConditions.length > 0) {
        countQuery += ' WHERE ' + countConditions.join(' AND ');
      }

      // Debugging logs
      console.log('Main Query:', query);
      console.log('Main Query Params:', values);
      console.log('Count Query:', countQuery);
      console.log('Count Query Params:', countParams);

      const [result, countResult] = await Promise.all([
        client.query(query, values),
        client.query(countQuery, countParams)
      ]);

      // Convert snake_case to camelCase for each row
      const camelCaseRows = result.rows.map(row => toCamelCase(row));

      const totalCount = parseInt(countResult.rows[0].count, 10);

      res.status(200).json({
        status: true,
        data: {
          dataList: camelCaseRows,
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
        LEFT JOIN users u1 ON c.assigned_to_id = u1.id
        LEFT JOIN users u2 ON c.created_by = u2.id
        WHERE c.id = $1
        `,
        [id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

      // Convert snake_case to camelCase for the response data
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
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
    name, email, phone, address, website, createdBy,
    companyId, locationAddress, locationLat, locationLong,
    locationName, customerCode, assignedToId, imageUrl, dialCode, countryCode, companyName, tags, category
  } = req.body;

  // Validate required fields
  if (!id) return res.status(400).json({ error: 'Customer ID is required' });
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!createdBy) return res.status(400).json({ error: 'CreatedBy is required' });

  // Validate UUID fields
  if (!isUUID(id)) return res.status(400).json({ error: 'Invalid customer ID: Must be a valid UUID' });
  if (!isUUID(createdBy)) return res.status(400).json({ error: 'Invalid createdBy: Must be a valid UUID' });
  if (assignedToId && !isUUID(assignedToId)) return res.status(400).json({ error: 'Invalid assignedToId: Must be a valid UUID' });

  // Validate UUID arrays for tags and category
  if (tags && (!Array.isArray(tags) || !tags.every(isUUID))) {
    return res.status(400).json({ error: 'Invalid tags: Must be an array of valid UUIDs' });
  }
  if (category && (!Array.isArray(category) || !category.every(isUUID))) {
    return res.status(400).json({ error: 'Invalid category: Must be an array of valid UUIDs' });
  }

  // Validate email format if provided
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate other fields
  if (phone && !/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Invalid phone number: Must be 10 digits' });
  if (locationLat && (isNaN(locationLat) || locationLat < -90 || locationLat > 90)) return res.status(400).json({ error: 'Invalid latitude: Must be between -90 and 90' });
  if (locationLong && (isNaN(locationLong) || locationLong < -180 || locationLong > 180)) return res.status(400).json({ error: 'Invalid longitude: Must be between -180 and 180' });

  try {
    const client = await pool.connect();
    try {
      // Validate createdBy exists
      const creatorCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [createdBy]);
      if (creatorCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Invalid createdBy: User does not exist' });
      }

      // Validate assignedToId exists
      if (assignedToId) {
        const assigneeCheck = await client.query('SELECT 1 FROM users WHERE id = $1', [assignedToId]);
        if (assigneeCheck.rows.length === 0) {
          return res.status(400).json({ error: 'Invalid assignedToId: User does not exist' });
        }
      }

      // Check for existing email if provided
      if (email) {
        const emailCheck = await client.query('SELECT 1 FROM customers WHERE email = $1 AND id != $2', [email, id]);
        if (emailCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Email already exists' });
        }
      }

      // Check for existing phone if provided
      if (phone) {
        const phoneCheck = await client.query('SELECT 1 FROM customers WHERE phone = $1 AND id != $2', [phone, id]);
        if (phoneCheck.rows.length > 0) {
          return res.status(400).json({ error: 'Phone number already exists' });
        }
      }

      const result = await client.query(
        `UPDATE customers SET
           name=$1, email=$2, phone=$3, address=$4, website=$5, created_by=$6,
           company_id=$7, location_address=$8, location_lat=$9, location_long=$10,
           location_name=$11, customer_code=$12, assigned_to_id=$13, image_url=$14,
           dial_code=$15, country_code=$16, company_name=$17, tags=$18, category=$19
         WHERE id=$20 RETURNING *`,
        [
          name, email, phone, address, website, createdBy,
          companyId, locationAddress, locationLat, locationLong,
          locationName, customerCode, assignedToId, imageUrl, dialCode, countryCode, companyName, tags, category, id
        ]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Customer not found' });

      // Convert snake_case to camelCase for the response data
      const camelCaseData = toCamelCase(result.rows[0]);

      res.status(200).json({
        status: true,
        data: camelCaseData,
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
        return res.status(400).json({ error: 'Invalid data type', details: err.detail || 'Invalid format for americanos or other field' });
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