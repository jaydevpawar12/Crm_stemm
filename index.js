// const express = require('express');
// const { initializePool } = require('./db');

// const app = express();

// // Middleware
// app.use(express.json());
// app.use(require('cors')());

// // Routes
// const roleRoutes = require('./routes/role.routes');
// const userRoutes = require('./routes/users.routes');
// const departmentRoutes = require('./routes/department.routes');
// const companyRoutes = require('./routes/company.routes');
// const customersRoutes = require('./routes/customer.routes');
// const productCategoryRoutes = require('./routes/productCategory.routes');
// const catalogueRoutes = require('./routes/productCatalogueRoutes');
// const leadRoutes = require('./routes/leadRoutes');
// const interactionRoutes = require('./routes/interactionRoutes');
// const enquiryCategoryRoutes = require('./routes/enquiryCategoryRoutes');
// const productRoutes = require('./routes/productRoutes');
// const prospectRoutes = require('./routes/prospectRoutes');

// app.use('/api/roles', roleRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/departments', departmentRoutes);
// app.use('/api/companies', companyRoutes);
// app.use('/api/customers', customersRoutes);
// app.use('/api/product-categories', productCategoryRoutes);
// app.use('/api/productcatalogues', catalogueRoutes);
// app.use('/api/leads', leadRoutes);
// app.use('/api/interactions', interactionRoutes);
// app.use('/api/enquiry-category', enquiryCategoryRoutes);
// app.use('/api/products', productRoutes);
// app.use('/api/prospects', prospectRoutes);

// // Health check endpoint
// app.get('/', (req, res) => {
//   res.status(200).send('API is running');
// });

// // Flag to check if database is initialized
// let isDbInitialized = false;

// // Initialize database pool (run once during startup)
// (async () => {
//   try {
//     await initializePool();
//     console.log("Database pool initialized successfully");
//     isDbInitialized = true;
//   } catch (error) {
//     console.error("Failed to initialize database pool during startup:", error);
//     isDbInitialized = false;
//   }
// })();

// // Export Cloud Function
// exports.crmApi = async (req, res) => {
//   try {
//     if (!isDbInitialized) {
//       console.warn("Database not initialized, API will run without database access");
//       res.status(200).send('API is running but database is not initialized');
//       return;
//     }
//     app(req, res);
//   } catch (error) {
//     console.error("Error in crmApi:", error);
//     res.status(500).send('Internal Server Error: ' + error.message);
//   }
// };

const express = require('express');
require('dotenv').config();
const app = express();

const roleRoutes = require('./routes/role.routes');
const userRoutes = require('./routes/users.routes');
const departmentRoutes = require('./routes/department.routes');
const companyRoutes = require('./routes/company.routes');
const customersRoutes = require('./routes/customer.routes');
const productCategoryRoutes = require('./routes/productCategory.routes');
const catalogueRoutes = require('./routes/productCatalogueRoutes');
const leadRoutes = require('./routes/leadRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const enquiryCategoryRoutes = require('./routes/enquiryCategoryRoutes');
const productRoutes = require('./routes/productRoutes');
const prospectRoutes = require('./routes/prospectRoutes');




app.use(express.json());
app.use(require('cors')());


app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/productCategories', productCategoryRoutes);
app.use('/api/productCatalogues', catalogueRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/enquiryCategory', enquiryCategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/prospects', prospectRoutes);




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Connected")
  console.log(`Server running on port ${PORT}`);
});