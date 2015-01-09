#!/usr/bin/env node
/*jslint node: true*/

(function () {
  'use strict';
  var path = require('path'),
    macFiddler = require('./lib/macFiddler.js'),
    defaultConf = './defaultConf.js',
    conf;

  conf = process.argv[2] || defaultConf;

  if (!conf.match(/^(\/|[A-Z]:\\)/)) {
    conf = path.normalize(__dirname + '/' + conf);
  }

  macFiddler.init(conf);

}());
