/*jslint node: true*/

var exports;
(function () {
  'use strict';
  var deferred = require('deferred'),
    promisify = deferred.promisify,
    fs = require('fs'),
    readFile = promisify(fs.readFile),

    log,
    modHosts;

  modHosts = {
    delayUpId : null,
    watch : function () {
      var that = this;
      fs.watch(this.file, function (event) {
        clearTimeout(that.delayUpId);
        that.delayUpId = setTimeout(function () {
          if (event === 'change') {
            that.update();
          } else {
            //TODO fs.exists
            that.watch();
          }
        }, 1000);
      });
    },
    update : function () {
      var that = this;
      readFile(this.file).done(function (allHosts) {
        var map = {};

        allHosts.toString().split('\n').forEach(function (line) {
          line = line.trim();
          if (line !== '' && line[0] !== '#') {
            line = line.split(/\s+/);
            if (line.length === 2) {
              map[line[1]] = line[0];
            }
          }
        });

        log('Info: Update hosts conf');
        that.mapHostName2Ip = map;
        that.watch();
      });
    },

    findIp4Host : function (host) {
      return this.mapHostName2Ip[host];
    },

    defaultConf : {
      hostsFile : './hosts.conf'
    },

    init : function (macFiddler) {
      this.file = macFiddler.conf.scriptBase + '/' + this.conf.hostsFile;
      log = macFiddler.log;
      this.update();
    }
  };

  if (exports === undefined) {
    exports = {};
  }
  exports.hosts = modHosts;

}());

