'use strict';

const port = process.argv[2];

const express = require('express');
const app = express();
const routes = require('./routes.js');
app.use('/',routes);

var listener = app.listen(port, () => {
    console.log('API REST running on port ' + listener.address().port);
});

