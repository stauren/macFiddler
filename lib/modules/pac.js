/*jslint node: true*/

var exports;
(function () {
  'use strict';
  var deferred = require('deferred'),
    promisify = deferred.promisify,
    fs = require('fs'),
    http = require('http'),
    iconv = require('iconv-lite'),
    //exists = promisify(fs.exists),
    readFile = promisify(fs.readFile),

    log,
    modPac;

  function shExpMatch(url, pattern) {
    url = url || '';
    var pChar,
      isAggressive = false,
      pIndex,
      urlIndex = 0,
      patternLength = pattern.length,
      urlLength = url.length;
    for (pIndex = 0; pIndex < patternLength; pIndex += 1) {
      pChar = pattern[pIndex];
      switch (pChar) {
      case "?":
        isAggressive = false;
        urlIndex += 1;
        break;
      case "*":
        if (pIndex === patternLength - 1) {
          urlIndex = urlLength;
        } else {
          isAggressive = true;
        }
        break;
      default:
        if (isAggressive) {
          urlIndex = url.indexOf(pChar, urlIndex);
          if (urlIndex < 0) {
            return false;
          }
          isAggressive = false;
        } else {
          if (urlIndex >= urlLength || url[urlIndex] !== pChar) {
            return false;
          }
        }
        urlIndex += 1;
      }
    }
    return urlIndex === urlLength;
  }

  modPac = {
    pacReady : deferred(),

    strBrowserPac : '',

    findProxyFromPac : function () {
      return 'DIRECT';
    },

    findProxyForURL : function (url, host) {
      var i, j, len, rule, matched,
        rules = this.conf.proxyRules;

      for (i in rules) {
        if (rules.hasOwnProperty(i)) {
          rule = rules[i];
          len = rule.length;
          for (j = 0; j < len; j++) {
            matched = rule[j].indexOf('/') > -1 ?
                shExpMatch(url, rule[j]) :
                shExpMatch(host, rule[j]);
            if (matched) {
              return i;
            }
          }
        }
      }

      return this.findProxyFromPac(url, host);
    },

    getBrowserPac : function () {
      var browserPacPath = this.browserPacPath,
        that = this,
        def = deferred();

      if (this.strBrowserPac) {
        def.resolve(this.strBrowserPac);
      } else {
        fs.exists(browserPacPath, function (exists) {
          if (exists) {
            readFile(browserPacPath, 'utf8')(function (content) {
              that.strBrowserPac = content;
              def.resolve(content);
            });
          } else {
            that.pacReady.promise()(function () {
              def.resolve(that.strBrowserPac);
            });
          }
        });
      }

      return def.promise();
    },

    makePac : function () {
      var that = this,
        req,
        pacURI = this.originalPacURI,
        enc = this.conf.pacEncoding,
        cachedPacPath = this.cachedPacPath,

        writer = fs.createWriteStream(cachedPacPath, {
          flags : 'w',
          encoding : enc
        });

      writer.on('finish', function () {
        that.updateProxyPolicy();
      });

      if (pacURI.indexOf('http://') === 0) {
        req = http.get(pacURI, function (res) {
          res.pipe(writer);
        });
        req.on('socket', function (socket) {
          socket.setTimeout(8000);
          socket.on('timeout', function() {
            req.abort();
          });
        });
        req.on('error', function () {
          log('Error: Fail to load pac: ' + pacURI);
          writer.end();
        });
      } else {
        fs.exists(pacURI, function (fileExist) {
          if (fileExist) {
            fs.createReadStream(pacURI).pipe(writer);
          } else {
            if (pacURI) {
              log('Error: Fail to load pac: ' + pacURI);
            }
            writer.end();
          }
        });
      }
    },

    updateProxyPolicy : function () {
      var enc = this.conf.pacEncoding,
        browserPacTmpl = this.browserPacTmpl,
        proxyPacTmpl = this.proxyPacTmpl,
        policyPath = this.proxyPolicyPath,
        browserPacPath = this.browserPacPath,
        that = this,
        defProxyPac = deferred(),
        defBrowserPac = deferred(),
        filterFn = this.conf.filter;

      readFile(this.cachedPacPath).done(function (content) {
        content = iconv.decode(content, enc).trim();
        if (content === '') {
          content = 'var FindProxyForURL;';
        }
        readFile(proxyPacTmpl, 'utf8').done(function (tmpl) {
          var writer;
          tmpl = tmpl.replace('{$realPac}', content);

          writer = fs.createWriteStream(policyPath, {
            flags : 'w',
            encoding : enc
          });

          writer.on('finish', function () {
            that.findProxyFromPac = require(policyPath).findProxyFromPac;
            defProxyPac.resolve();
          });
          writer.end(tmpl);
        });

        readFile(browserPacTmpl, 'utf8').done(function (tmpl) {
          var writer,
            strFilter = filterFn.toString().
              replace('function (url, host)', 'function filter(url, host)');

          tmpl = tmpl.
            replace('{$realPac}', content).
            replace('{$filterFn}', strFilter).
            replace('{$proxyRules}', JSON.stringify(that.conf.proxyRules)).
            replace('{$proxyIp}', that.conf.ip).
            replace('{$proxyPort}', that.conf.port);

          that.strBrowserPac = tmpl;
          defBrowserPac.resolve();

          writer = fs.createWriteStream(browserPacPath, {
            flags : 'w',
            encoding : enc
          });

          writer.end(tmpl);
        });
      });

      deferred(defProxyPac.promise(), defBrowserPac.promise())(function () {
        that.pacReady.resolve();
        log('Info: Proxy started at : ' + that.conf.ip + ':' + that.conf.port +
            ', set your browser pac to: http://' + that.conf.ip +
            ':' + that.conf.port + '/pac');
      });
    },

    defaultConf : {
      proxyRules : {
      },
      filter : function () {
        return true;
      },
      ip : '127.0.0.1',
      port : '8080',
      pac : '',
      pacEncoding : 'utf8'
    },

    init : function (macFiddler) {

      this.originalPacURI = this.conf.pac;
      this.cachedPacPath = macFiddler.conf.scriptBase + '/runtime/origin.pac';
      this.browserPacPath = macFiddler.conf.scriptBase + '/runtime/browser.pac';
      this.proxyPolicyPath = macFiddler.conf.scriptBase + '/runtime/policy.js';
      this.proxyPacTmpl = macFiddler.conf.scriptBase + '/lib/proxyPacTemplate.js';
      this.browserPacTmpl = macFiddler.conf.scriptBase + '/lib/browserPacTemplate.js';

      log = macFiddler.log;

      this.makePac();
    }
  };

  if (exports === undefined) {
    exports = {};
  }
  exports.pac = modPac;

}());

