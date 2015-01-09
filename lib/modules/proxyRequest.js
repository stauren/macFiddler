/*jslint node: true*/

var exports;
(function () {
  'use strict';
  var url = require('url'),
    http = require('http'),
    modProxyRequest;

  modProxyRequest = function (originalRequest, originalResponse, macFiddler) {
    var proxyRequestOption,
      proxyReq,
      proxy,
      reqCallback,
      ip,
      logMsg,
      proxyInfo,
      modLogs = macFiddler.mods.logs,
      modPac = macFiddler.mods.pac,
      modDelay = macFiddler.mods.delayResponse,
      log = macFiddler.log;

    logMsg = "Info: ProxyReqest " + originalRequest.url;

    proxyRequestOption = url.parse(originalRequest.url);

    proxy = modPac ?
        modPac.findProxyForURL(originalRequest.url, proxyRequestOption.host) :
        'DIRECT';

    proxyRequestOption.method = originalRequest.method;
    proxyRequestOption.headers = originalRequest.headers;

    ip = macFiddler.mods.hosts && macFiddler.mods.hosts.findIp4Host(proxyRequestOption.host);

    if (ip) {
      if (ip === '10.0.0.0') {
        log(logMsg + ' with empty response.');
        originalResponse.end();
        return;
      }
      proxyRequestOption.host = ip;
      log(logMsg + ' with host : ' + ip);
      delete proxyRequestOption.hostname;
    } else {
      if (proxy !== 'DIRECT') {
        proxyInfo = proxy.split(' ')[1].split(':');
        if (proxyInfo[0] === '10.0.0.0') {
          log(logMsg + ' with empty response.');
          originalResponse.end();
          return;
        }
        log(logMsg + ' with proxy : ' + proxyInfo.join(':'));
        proxyRequestOption.host = proxyInfo[0];
        proxyRequestOption.hostname = proxyRequestOption.host;
        proxyRequestOption.port = proxyInfo[1];
        proxyRequestOption.headers.host = proxyRequestOption.host;
        proxyRequestOption.path = originalRequest.url;
      } else {
        log(logMsg + ' with direct connection');
      }
    }

    reqCallback = function (proxyResponse) {
      if (modLogs) {
        modLogs.logResponse(originalRequest.url, proxyResponse);
      }
      originalResponse.writeHead(proxyResponse.statusCode, proxyResponse.headers);

      if (modDelay && modDelay.filter(originalRequest.url)) {
        modDelay.pipe(proxyResponse, originalResponse);
      } else {
        proxyResponse.on('data', function (chunk) {
          originalResponse.write(chunk, 'binary');
        });
        proxyResponse.on('end', function () {
          originalResponse.end();
        });
      }
    };

    proxyReq = http.request(proxyRequestOption, reqCallback);

    proxyReq.on('error', function (e) {
      log('Error: ' + e);
    });

    if (proxyRequestOption.method.toUpperCase() === 'POST') {
      originalRequest.on('data', function (chunk) {
        proxyReq.write(chunk, 'binary');
      });
      originalRequest.on('end', function () {
        proxyReq.end();
      });
    } else {
      proxyReq.end();
    }
  };

  modProxyRequest.defaultConf = {
  };

  modProxyRequest.init = function(macFiddler) {
  };

  if (exports === undefined) {
    exports = {};
  }
  exports.proxyRequest = modProxyRequest;

}());

