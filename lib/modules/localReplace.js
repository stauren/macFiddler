/*jslint node: true*/

var exports;
(function () {
  'use strict';
  var deferred = require('deferred'),
    execu = require('child_process').exec,
    promisify = deferred.promisify,
    fs = require('fs'),
    readFile = promisify(fs.readFile),
    exists = promisify(fs.exists),
    stat = promisify(fs.stat),
    replaceRules = [],
    REG_FILE_TYPE = /\.([0-9a-zA-Z]+)$/,
    modEnabled,
    lastAutoBuildTime = {},
    types = {
      css : 'text/css',
      js : 'text/javascript',
      htm : 'text/html',
      html : 'text/html'
    },
    modLocalReplace;

  function isArray(obj) {
    return Object.prototype.toString.apply(obj) === '[object Array]';
  }

  function getFilePathByRule(matchResult, rule) {
    if (!isArray(rule)) {
      rule = [rule];
    }

    return rule.map(function (localPathWithDollar) {
      matchResult.forEach(function (matchName, idx) {
        if (idx > 0) {
          if (matchName === undefined) {
            matchName = '';
          }
          localPathWithDollar = localPathWithDollar
            .replace(new RegExp('\\{\\$' + idx + '\\}', 'g'), matchName);
        }
      });

      return localPathWithDollar;
    });
  }

  function pipeFile(filePath, res, modDelay, file404) {
    var def = deferred(),
      resolveWithPath = function (path) {
        var reader = fs.createReadStream(path);
        if (modDelay) {
          modDelay.pipe(reader, res, function () {
            def.resolve(path);
          });
        } else {
          reader.on('end', function () {
            def.resolve(path);
          });
          reader.pipe(res);
        }
      },
      go404 = function () {
        if (file404) {
          exists(file404)(function (exist404) {
            if (exist404) {
              resolveWithPath(file404);
            } else {
              def.reject(new Error('404'));
            }
          });
        } else {
          def.reject(new Error('404'));
        }
      };

    if (filePath.length === 1) {
      filePath = filePath[0];
      exists(filePath)(function (fileExist) {
        if (fileExist) {
          stat(filePath)(function (stats) {
            if (stats.isFile()) {
              resolveWithPath(filePath);
            } else {
              go404();
            }
          });
        } else {
          go404();
        }
      });
    } else {
      deferred.map(filePath, function (filename) {
        return exists(filename)(function (fileExist) {
          if (!fileExist) {
            throw new Error(filename);
          }
          return readFile(filename, 'binary');
        });
      })(function (result) {
        result = result.join('\n');
        if (modDelay) {
          modDelay.send(result, res, function () {
            def.resolve();
          });
        } else {
          res.write(result, 'binary');
          res.end();
          def.resolve();
        }
      }, function (err) {
        def.reject(err);
      });
    }

    return def.promise();
  }

  function buildFiles(url, rules) {
    var def = deferred(),
      hasBuilt;


    hasBuilt = rules.some(function (rule) {
      var lastTime;
      if (rule[0].test(url)) {
        lastTime = lastAutoBuildTime[rule[0]];
        if (lastTime) {
          if (Date.now() - lastTime < rule[2]) {//一定时间范围内，不重新build
            def.resolve();
            return true;
          }
        }
        execu(rule[1], function (err, stdout, stderr) {
          if (!err && !stderr) {
            lastAutoBuildTime[rule[0]] = Date.now();
            def.resolve(true);
          } else {
            def.reject();
          }
        });
        return true;
      }
    });

    if (!hasBuilt) {
      def.resolve();
    }

    return def.promise();
  }

  modLocalReplace = function (request, response, macFiddler) {
    var headers = {
        'Cache-Control' : 'max-age=0, must-revalidate',
        'Content-Type' : 'text/plain'
      },
      url,
      def = deferred(),
      matchFound;

    url = request.url;

    if (url === '/pac') {
      response.writeHead(200, headers);

      macFiddler.mods.pac.getBrowserPac().done(function (pac) {
        response.end(pac);
        def.resolve('Info: GET Pac');
      });

    } else {
      if (modEnabled) {
        matchFound = replaceRules.some(function (rule) {
          var matchUrl,
            matchFileType,
            localFile;

          matchUrl = url.match(rule[0]);

          if (matchUrl && rule[1]) {
            localFile = getFilePathByRule(matchUrl, rule[1]);

            matchFileType = (isArray(localFile) ? localFile[0] : localFile)
              .match(REG_FILE_TYPE);

            if (matchFileType && types[matchFileType[1]]) {
              headers['Content-Type'] = types[matchFileType[1]];
            } else if (!matchFileType) {
              headers['Content-Type'] = types.htm;
            }

            response.writeHead(200, headers);

            buildFiles(url, modLocalReplace.conf.autoBuild).then(function (hasBuilt) {
              var modDelay = macFiddler.mods.delayResponse;
              pipeFile(localFile, response,
                       modDelay && modDelay.filter(url) ? modDelay : null, rule[2]).
                then(function (replaceFile) {
                  def.resolve("Info: Replace " + url + ' with ' + replaceFile +
                              (hasBuilt ? ', autoBuild' : ''));
                }, function (err) {
                  var er = new Error('Error: Fail to Replace ' + url + ' with ' + localFile);
                  if (err.message !== '') {
                    er.message += ', can Not open: ' + err.message;
                  }
                  def.reject(er);
                });
            }, function () {
              def.reject(new Error('Error: Fail to Replace ' + url + ' with ' + localFile +
                ', fail to build: ' + localFile));
            });

            return true;
          }
        });
      }

      if (!matchFound) {
        def.reject(new Error(''));
      }
    }

    return def.promise();
  };

  modLocalReplace.defaultConf = {
    replaceBase : '',
    replaceRules : [],
    enable : true,
    autoBuild : []
  };

  modLocalReplace.init = function () {
    var base, conf = this.conf;

    modEnabled = conf.enable;

    if (modEnabled && conf.replaceRules) {
      base = conf.replaceBase ? conf.replaceBase + '/' : '';
      conf.replaceRules.forEach(function (rule) {
        if (isArray(rule[1])) {
          rule[1] = rule[1].map(function (onerule) {
            return onerule.charAt(0) === '/' ? onerule : base + onerule;
          });
        } else {
          rule[1] = rule[1].charAt(0) === '/' ? rule[1] : base + rule[1];
        }
        if (rule[2]) {
          rule[2] = rule[2].charAt(0) === '/' ? rule[2] : base + rule[2];
        }
      });

      replaceRules = conf.replaceRules;
    }

  };

  if (exports === undefined) {
    exports = {};
  }
  exports.localReplace = modLocalReplace;
}());

