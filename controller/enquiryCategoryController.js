// const { initializePool } = require('../db');
  const { pool } = require('../db');


const validator = require('validator');
const xss = require('xss');

exports.createEnquiryCategory = async (req, res) => {
  const { createdById, customerId, name, categoryType } = req.body;

  // Input validation
  if (!createdById || !customerId || !name || !categoryType) {
    return res.status(400).json({ error: 'createdById, customerId, name, and categoryType are required' });
  }

  // Validate data types and formats
  if (!validator.isUUID(createdById)) {
    return res.status(400).json({ error: 'createdById must be a valid UUID' });
  }

  if (!validator.isUUID(customerId)) {
    return res.status(400).json({ error: 'customerId must be a valid UUID' });
  }

  if (!validator.isLength(name, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'name must be between 1 and 255 characters' });
  }

  if (!['Sales', 'Services'].includes(categoryType)) {
    return res.status(400).json({ error: 'categoryType must be either Sales or Services' });
  }

  // Sanitize inputs to prevent XSS
  const sanitizedName = xss(name);

  try {
    // const pool = await initializePool();
    const client = await pool.connect();

    try {
      // Verify createdById exists in users table
      const userCheck = await client.query(
        'SELECT 1 FROM public.users WHERE id = $1',
        [createdById]
      );

      if (userCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid createdById: user does not exist' });
      }

      // Verify customerId exists in customers table
      const customerCheck = await client.query(
        'SELECT 1 FROM public.customers WHERE id = $1',
        [customerId]
      );

      if (customerCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid customerId: customer does not exist' });
      }

      // Check for duplicate category name for the same customer
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.enquirycategory WHERE customerid = $1 AND name = $2',
        [customerId, sanitizedName]
      );

      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Category name already exists for this customer' });
      }

      const result = await client.query(
        `INSERT INTO public.enquirycategory (createdbyid, customerid, name, categorytype)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [createdById, customerId, sanitizedName, categoryType]
      );
      const enquiryCategory=result.rows
      res.status(201).json({
        success:true,
        data:{
          enquiryCategory
        },
        message:"Enquiry Category Create Successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create enquiry category error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllEnquiryCategories = async (req, res) => {
  try {
          // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          ec.id,
          ec.createdbyid,
          u.name AS createdbyname,
          ec.createdon,
          ec.name,
          ec.categorytype,
          ec.customerid,
          c.name AS customername
        FROM public.enquirycategory ec
        LEFT JOIN public.users u ON ec.createdbyid = u.id
        LEFT JOIN public.customers c ON ec.customerid = c.id
      `);
      // res.json(result.rows);
      const enquiryCategory=result.rows
      res.status(201).json({
        success:true,
        data:{
          enquiryCategory
        },
        message:"Enquiry Category Fetch Successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get enquiry categories error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.getEnquiryCategoryById = async (req, res) => {
  const { id } = req.params;
  try {
          // const pool = await initializePool();

    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          ec.id,
          ec.createdbyid,
          u.name AS createdbyname,
          ec.createdon,
          ec.name,
          ec.categorytype,
          ec.customerid,
          c.name AS customername
        FROM public.enquirycategory ec
        LEFT JOIN public.users u ON ec.createdbyid = u.id
        LEFT JOIN public.customers c ON ec.customerid = c.id
        WHERE ec.id = $1
      `, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Not found' });
      }
      // res.json(result.rows[0]);
      const enquiryCategory=result.rows
      res.status(201).json({
        success:true,
        data:{
          enquiryCategory
        },
        message:"Enquiry Category Fetch Successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get enquiry category error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.updateEnquiryCategory = async (req, res) => {
  const { id } = req.params;
  const { name, categoryType } = req.body;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(
        `UPDATE enquiryCategory SET name = $1, categoryType = $2 WHERE id = $3 RETURNING *`,
        [name, categoryType, id]
      );
      if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      // res.json(result.rows[0]);
      const enquiryCategory=result.rows
      res.status(201).json({
        success:true,
        data:{
          enquiryCategory
        },
        message:"Enquiry Category Update Successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update enquiry category error:', err);
    res.status(500).json({ error: err.message });
  }
};

exports.deleteEnquiryCategory = async (req, res) => {
  const { id } = req.params;
  try {
    // const pool = await initializePool();
    const client = await pool.connect();
    try {
      const result = await client.query(`DELETE FROM enquiryCategory WHERE id = $1 RETURNING *`, [id]);
      if (result.rows.length === 0) return res.status(404).json({ message: 'Not found' });
      res.status(200).json({ message: 'Enquiry category deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete enquiry category error:', err);
    res.status(500).json({ error: err.message });
  }
};






