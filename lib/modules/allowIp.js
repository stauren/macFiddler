/*jslint node: true*/

var exports;
(function () {
  'use strict';
  var //deferred = require('deferred'),
    //promisify = deferred.promisify,
    //fs = require('fs'),
    iplist,
    //ipFilePath,
    modAllowIp;

  modAllowIp = function (request) {
    var incomingIp = request.connection.remoteAddress;
    incomingIp = incomingIp.split('.');

    return iplist.some(function (ip) {
      var i, allowIpAry = ip.split('.');
      for (i = 0; i < 4; i++) {
        if (allowIpAry[i] !== '*' && allowIpAry[i] !== incomingIp[i]) {
          return false;
        }
        if (i === 3 || (allowIpAry[i] === '*' && i === allowIpAry.length - 1)) {
          return true;
        }
      }
    });
  };

  /*
  modAllowIp.update = function () {
    var that = this;
    iplist = that.conf.ips;

    if (iplist.length < 1) {
      iplist = ['*'];
    }

    fs.exists(ipFilePath, function (exists) {
      if (exists) {
        promisify(fs.readFile)(ipFilePath, 'utf-8').done(function (content) {
          iplist = content.split('\n').filter(function (ip) {
            return ip.length;
          }).concat(that.conf.ips);
        });
      }
    });
  };

  modAllowIp.watch = function() {
    fs.watchFile(ipFilePath, {interval : 10000}, this.update.bind(this));
  };
  */

  modAllowIp.defaultConf = {
    //file : './conf/allowip.conf',
    ips : [ '*' ]
  };

  modAllowIp.init = function(macFiddler) {
    iplist = this.conf.ips;
    /*
    ipFilePath = macFiddler.conf.scriptBase + '/' + this.conf.file;

    this.update();
    this.watch();
    */
  };

  if (exports === undefined) {
    exports = {};
  }
  exports.allowIp = modAllowIp;

}());

