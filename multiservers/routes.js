'use strict';

const express = require('express');
const api = express.Router();

api.get('/', (req,res)=>{
  res.send({message: 'Hello World on port '+req.socket.address().port+'!'});
});
module.exports = api;

