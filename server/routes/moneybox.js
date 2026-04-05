const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/moneyBoxController');
const { requireRole } = require('../middleware/auth');

router.get('/connected',       ctrl.getConnectedBoxes);
router.get('/',                ctrl.getBoxes);
router.post('/connect',        ctrl.connectBox);
router.get('/:boxId/balance',  ctrl.getBoxBalance);
router.post('/disconnect',     ctrl.disconnectBox);
router.post('/create',         requireRole('supervisor', 'admin'), ctrl.createBox);

module.exports = router;
