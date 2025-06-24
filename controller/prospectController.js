// const { initializePool } = require('../db');
const validator = require('validator');
const xss = require('xss');
  
const { pool } = require('../db');


exports.createProspect = async (req, res) => {
  const {
    name, email, phone, countryCode, dialCode, bill_no, date,
    prospect_type, enquiryCategoryId, productsCategory, customerId
  } = req.body;

  // Input validation
  if (!name || !prospect_type || !enquiryCategoryId || !productsCategory || !customerId) {
    return res.status(400).json({ error: 'name, prospect_type, enquiryCategoryId, productsCategory, and customerId are required' });
  }

  // Validate data types and formats
  if (!validator.isUUID(enquiryCategoryId)) {
    return res.status(400).json({ error: 'enquiryCategoryId must be a valid UUID' });
  }

  if (!validator.isUUID(productsCategory)) {
    return res.status(400).json({ error: 'productsCategory must be a valid UUID' });
  }

  if (!validator.isUUID(customerId)) {
    return res.status(400).json({ error: 'customerId must be a valid UUID' });
  }

  if (!validator.isLength(name, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'name must be between 1 and 255 characters' });
  }

  if (email && !validator.isEmail(email)) {
    return res.status(400).json({ error: 'email must be a valid email address if provided' });
  }

  if (phone && !validator.isMobilePhone(phone, 'any', { strictMode: false })) {
    return res.status(400).json({ error: 'phone must be a valid phone number if provided' });
  }

  if (countryCode && !validator.isLength(countryCode, { min: 1, max: 10 })) {
    return res.status(400).json({ error: 'countryCode must be between 1 and 10 characters if provided' });
  }

  if (dialCode && !validator.matches(dialCode, /^\+\d{1,4}$/)) {
    return res.status(400).json({ error: 'dialCode must be a valid dial code (e.g., +1, +91) if provided' });
  }

  if (bill_no && !validator.isLength(bill_no, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'bill_no must be between 1 and 50 characters if provided' });
  }

  if (date && !validator.isISO8601(date)) {
    return res.status(400).json({ error: 'date must be a valid ISO 8601 date if provided' });
  }

  if (!validator.isLength(prospect_type, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'prospect_type must be between 1 and 100 characters' });
  }

  // Sanitize inputs to prevent XSS
  const sanitizedName = xss(name);
  const sanitizedEmail = email ? xss(email) : null;
  const sanitizedPhone = phone ? xss(phone) : null;
  const sanitizedCountryCode = countryCode ? xss(countryCode) : null;
  const sanitizedDialCode = dialCode ? xss(dialCode) : null;
  const sanitizedBillNo = bill_no ? xss(bill_no) : null;
  const sanitizedProspectType = xss(prospect_type);

  try {
    const client = await pool.connect();
    try {
      // Verify enquiryCategoryId exists
      const enquiryCheck = await client.query(
        'SELECT 1 FROM public.enquirycategory WHERE id = $1',
        [enquiryCategoryId]
      );
      if (enquiryCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid enquiryCategoryId: category does not exist' });
      }

      // Verify productsCategory exists
      const productCheck = await client.query(
        'SELECT 1 FROM public.product_categories WHERE id = $1',
        [productsCategory]
      );
      if (productCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid productsCategory: category does not exist' });
      }

      // Verify customerId exists
      const customerCheck = await client.query(
        'SELECT 1 FROM public.customers WHERE id = $1',
        [customerId]
      );
      if (customerCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid customerId: customer does not exist' });
      }

      // Check for duplicate prospect (e.g., same name and customerId)
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.prospects WHERE customerid = $1 AND name = $2',
        [customerId, sanitizedName]
      );
      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Prospect name already exists for this customer' });
      }

      const result = await client.query(
        `INSERT INTO public.prospects (
          name, email, phone, countrycode, dialcode, bill_no, date,
          prospect_type, enquirycategoryid, productscategory, customerid
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          sanitizedName, sanitizedEmail, sanitizedPhone, sanitizedCountryCode,
          sanitizedDialCode, sanitizedBillNo, date, sanitizedProspectType,
          enquiryCategoryId, productsCategory, customerId
        ]
      );
      // res.status(201).json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Prospect created successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Create prospect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getAllProspects = async (req, res) => {
  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          p.id, p.name, p.email, p.phone, p.countrycode, p.dialcode, p.bill_no, p.date,
          p.prospect_type, p.enquirycategoryid, ec.name AS enquirycategoryname,ec.categorytype  AS enquirycategorytype,
          p.productscategory, pc.categoryname  AS productcategoryname,
          p.customerid, c.name AS customername
        FROM public.prospects p
        LEFT JOIN public.enquirycategory ec ON p.enquirycategoryid = ec.id
        LEFT JOIN public.product_categories pc ON p.productscategory = pc.id
        LEFT JOIN public.customers c ON p.customerid = c.id
        ORDER BY p.date DESC
      `);
      const dataList=result.rows
      res.status(200).json({
        success:true,
        data:{
          dataList
        },
        message:"Prospects Fetch Successfully"
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get prospects error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.getProspectById = async (req, res) => {
  const { id } = req.params;

  // Validate id
  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          p.id, p.name, p.email, p.phone, p.countrycode, p.dialcode, p.bill_no, p.date,
          p.prospect_type, p.enquirycategoryid, ec.name AS enquirycategoryname,
          p.productscategory, pc.name AS productcategoryname,
          p.customerid, c.name AS customername
        FROM public.prospects p
        LEFT JOIN public.enquirycategory ec ON p.enquirycategoryid = ec.id
        LEFT JOIN public.product_categories pc ON p.productscategory = pc.id
        LEFT JOIN public.customers c ON p.customerid = c.id
        WHERE p.id = $1
      `, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      // res.json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Prospect Fetch successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Get prospect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateProspect = async (req, res) => {
  const {
    name, email, phone, countryCode, dialCode, bill_no, date,
    prospect_type, enquiryCategoryId, productsCategory, customerId
  } = req.body;
  const { id } = req.params;

  // Input validation
  if (!name || !prospect_type || !enquiryCategoryId || !productsCategory || !customerId) {
    return res.status(400).json({ error: 'name, prospect_type, enquiryCategoryId, productsCategory, and customerId are required' });
  }

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  if (!validator.isUUID(enquiryCategoryId)) {
    return res.status(400).json({ error: 'enquiryCategoryId must be a valid UUID' });
  }

  if (!validator.isUUID(productsCategory)) {
    return res.status(400).json({ error: 'productsCategory must be a valid UUID' });
  }

  if (!validator.isUUID(customerId)) {
    return res.status(400).json({ error: 'customerId must be a valid UUID' });
  }

  if (!validator.isLength(name, { min: 1, max: 255 })) {
    return res.status(400).json({ error: 'name must be between 1 and 255 characters' });
  }

  if (email && !validator.isEmail(email)) {
    return res.status(400).json({ error: 'email must be a valid email address if provided' });
  }

  if (phone && !validator.isMobilePhone(phone, 'any', { strictMode: false })) {
    return res.status(400).json({ error: 'phone must be a valid phone number if provided' });
  }

  if (countryCode && !validator.isLength(countryCode, { min: 1, max: 10 })) {
    return res.status(400).json({ error: 'countryCode must be between 1 and 10 characters if provided' });
  }

  if (dialCode && !validator.matches(dialCode, /^\+\d{1,4}$/)) {
    return res.status(400).json({ error: 'dialCode must be a valid dial code (e.g., +1, +91) if provided' });
  }

  if (bill_no && !validator.isLength(bill_no, { min: 1, max: 50 })) {
    return res.status(400).json({ error: 'bill_no must be between 1 and 50 characters if provided' });
  }

  if (date && !validator.isISO8601(date)) {
    return res.status(400).json({ error: 'date must be a valid ISO 8601 date if provided' });
  }

  if (!validator.isLength(prospect_type, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'prospect_type must be between 1 and 100 characters' });
  }

  // Sanitize inputs to prevent XSS
  const sanitizedName = xss(name);
  const sanitizedEmail = email ? xss(email) : null;
  const sanitizedPhone = phone ? xss(phone) : null;
  const sanitizedCountryCode = countryCode ? xss(countryCode) : null;
  const sanitizedDialCode = dialCode ? xss(dialCode) : null;
  const sanitizedBillNo = bill_no ? xss(bill_no) : null;
  const sanitizedProspectType = xss(prospect_type);

  try {
    const client = await pool.connect();
    try {
      // Verify enquiryCategoryId exists
      const enquiryCheck = await client.query(
        'SELECT 1 FROM public.enquirycategory WHERE id = $1',
        [enquiryCategoryId]
      );
      if (enquiryCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid enquiryCategoryId: category does not exist' });
      }

      // Verify productsCategory exists
      const productCheck = await client.query(
        'SELECT 1 FROM public.product_categories WHERE id = $1',
        [productsCategory]
      );
      if (productCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid productsCategory: category does not exist' });
      }

      // Verify customerId exists
      const customerCheck = await client.query(
        'SELECT 1 FROM public.customers WHERE id = $1',
        [customerId]
      );
      if (customerCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid customerId: customer does not exist' });
      }

      // Check for duplicate prospect (e.g., same name and customerId, excluding current prospect)
      const duplicateCheck = await client.query(
        'SELECT 1 FROM public.prospects WHERE customerid = $1 AND name = $2 AND id != $3',
        [customerId, sanitizedName, id]
      );
      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({ error: 'Prospect name already exists for this customer' });
      }

      const result = await client.query(
        `UPDATE public.prospects SET 
          name = $1, email = $2, phone = $3, countrycode = $4, dialcode = $5,
          bill_no = $6, date = $7, prospect_type = $8, enquirycategoryid = $9,
          productscategory = $10, customerid = $11
         WHERE id = $12
         RETURNING *`,
        [
          sanitizedName, sanitizedEmail, sanitizedPhone, sanitizedCountryCode,
          sanitizedDialCode, sanitizedBillNo, date, sanitizedProspectType,
          enquiryCategoryId, productsCategory, customerId, id
        ]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      // res.json(result.rows[0]);
       res.status(201).json({
        status: true,
        data: result.rows[0],
        message: 'Prospect Update successfully'
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update prospect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.deleteProspect = async (req, res) => {
  const { id } = req.params;

  // Validate id
  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      const result = await client.query(
        'DELETE FROM public.prospects WHERE id = $1 RETURNING *',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      res.json({ message: 'Prospect deleted successfully' });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Delete prospect error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

exports.updateCustomerIdForProspect = async (req, res) => {
  const { customerId } = req.body;
  const { id } = req.params;

  // Input validation
  if (!customerId) {
    return res.status(400).json({ error: 'customerId is required' });
  }

  if (!validator.isUUID(customerId)) {
    return res.status(400).json({ error: 'customerId must be a valid UUID' });
  }

  if (!validator.isUUID(id)) {
    return res.status(400).json({ error: 'id must be a valid UUID' });
  }

  try {
    const client = await pool.connect();
    try {
      // Verify customerId exists
      const customerCheck = await client.query(
        'SELECT 1 FROM public.customers WHERE id = $1',
        [customerId]
      );
      if (customerCheck.rowCount === 0) {
        return res.status(400).json({ error: 'Invalid customerId: customer does not exist' });
      }

      const result = await client.query(
        `UPDATE public.prospects SET customerid = $1 WHERE id = $2 RETURNING *`,
        [customerId, id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Prospect not found' });
      }
      res.json(result.rows[0]);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Update prospect customerId error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};