const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/allClosingsController');

router.get('/', ctrl.getAllClosings);

module.exports = router;
