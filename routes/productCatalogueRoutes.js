// productcatalogues/productCatalogueRoutes.js
const express = require('express');
const router = express.Router();
const controller = require('../controller/productCatalogueController');

router.post('/', controller.createProductCatalogue);
router.get('/', controller.getAllProductCatalogues);
router.get('/:id', controller.getProductCatalogueById);
router.put('/:id', controller.updateProductCatalogue);
router.delete('/:id', controller.deleteProductCatalogue);

module.exports = router;
