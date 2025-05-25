const express = require('express');
const router = express.Router();
const companiesController = require('../controller/company.controller');

router.post('/', companiesController.createCompany);
router.get('/', companiesController.getCompanies);
router.get('/:id', companiesController.getCompanyById);
router.put('/:id', companiesController.updateCompany);
router.delete('/:id', companiesController.deleteCompany);

module.exports = router;
