const express = require('express');
require('dotenv').config();
const app = express();

const roleRoutes = require('./routes/role.routes');
const userRoutes = require('./routes/users.routes');
const departmentRoutes = require('./routes/department.routes');
const companyRoutes = require('./routes/company.routes');
const customersRoutes = require('./routes/customer.routes');
const customerContactsRoutes = require('./routes/customerAdditionContacts.routes');
const productCategoryRoutes = require('./routes/productCategory.routes');
const catalogueRoutes = require('./routes/productCatalogueRoutes');
const leadRoutes = require('./routes/leadRoutes');
const interactionRoutes = require('./routes/interactionRoutes');
const enquiryCategoryRoutes = require('./routes/enquiryCategoryRoutes');
const productRoutes = require('./routes/productRoutes');
const prospectRoutes = require('./routes/prospectRoutes');




app.use(express.json());

app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/customer-contacts', customerContactsRoutes);
app.use('/api/product-categories', productCategoryRoutes);
app.use('/api/productcatalogues', catalogueRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/interactions', interactionRoutes);
app.use('/api/enquiry-category', enquiryCategoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/prospects', prospectRoutes);




const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Connected")
  console.log(`Server running on port ${PORT}`);
});
