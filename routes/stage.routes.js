const express = require('express');
const router = express.Router();
const stageController = require('../controllers/stageController');

router.post('/', stageController.createStage);
router.get('/', stageController.getAllStages);
router.get('/:id', stageController.getStageById);
router.put('/:id', stageController.updateStage);
router.delete('/:id', stageController.deleteStage);

module.exports = router;
