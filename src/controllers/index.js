const express = require('express');
var router = express.Router();

router.use('/search', require('./search'));
router.use('/map', require('./map'));

module.exports = router;