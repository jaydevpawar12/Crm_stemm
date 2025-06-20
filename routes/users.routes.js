const express = require('express');
const router = express.Router();
const userController = require('../controller/users.controller');

router.post('/', userController.createUser);
router.get('/', userController.getAllUsers);
router.get('/emailphone', userController.getUserByEmailOrPhone);
router.get('/reporting-manager', userController.getAllReportingManagers);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
