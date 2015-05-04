/*jslint node: true*/

var exports;
(function () {
  'use strict';
  var deferred = require('deferred'),
    promisify = deferred.promisify,
    fs = require('fs'),
    zlib = require('zlib'),
    MemoryStream = require('memorystream'),
    mime = require('mime'),
    noop,
    modLogs;

  modLogs = {
    stream : null,

    writeCount : {},

    getStream : function () {
      var that = this;
      if (!this.stream) {
        this.stream = fs.createWriteStream(this.path, {
          flags : 'a',
          encoding : 'utf8'
        });
      }
      this.rotateFile(this.path, function () {
        that.stream = null;
      });

      return this.stream;
    },

    rotateFile : function (filePath, cb) {
      var max = this.conf.maxSize,
        count;

      cb = cb || noop;

      count = (this.writeCount[filePath] || 0) + 1;
      this.writeCount[filePath] = count;

      if (count === 1 || count % 100 === 0) {
        fs.exists(filePath, function (exists) {
          if (exists) {
            promisify(fs.stat)(filePath)(function (stats) {
              if (stats.size > max * 1024 * 1024) { //10M
                fs.rename(filePath, filePath + '.old', cb);
              }
            });
          }
        });
      }
    },

    log : function (msg) {
      var tm = new Date(), idx;
      tm = tm.toLocaleDateString() + ' ' + tm.toLocaleTimeString();

      if (!/^(Info|Warning|Error):/.test(msg)) {
        msg = 'Info: ' + msg;
      }
      idx = msg.indexOf(' ');
      msg = msg.substr(0, idx + 1) + tm + ',' + msg.substr(idx) + '\n';

      this.getStream().write(msg, 'utf8');
    },
    getStreamByCt : function (contentType) {
      var enc, logFileName;

      enc = contentType.match(/charset=([a-z\-0-9]+)/i);
      enc = (enc && enc[1]) || 'utf8';

      if (/(gbk|gb2312|gb18030)/i.test(enc)) {
        enc = 'gb18030';
      }

      //iso-8859-1: Latin-1, first 256 of Unicode
      if (/(utf8|utf-8|utf_8|iso-8859-1)/i.test(enc)) {
        enc = 'utf-8';
      }
      logFileName = this.resPathPreFix + enc + '.log';

      this.rotateFile(logFileName);

      return fs.createWriteStream(logFileName, {
        flags : 'a',
        encoding : enc
      });
    },

    logResponse : function (url, response) {
      var memStream,
        header,
        headers = response.headers,
        ct = headers['content-type'] || '',
        bufferLength,
        that = this,
        resHeader,
        bufferQueue = [],

        onDecode = function (err, bodyBuf) {
          var writer;
          if (err) {
            bodyBuf = 'Error: Fail to decode: ' + url + ' ' + err;
            that.log(bodyBuf);
          }
          writer = that.getStreamByCt(ct);
          writer.write(resHeader.join('\n'));
          writer.write(bodyBuf);
          writer.end('\n\n\n');
        };

      if (!this.enalbeResponse) {
        return;
      }

      //if (ct.match(/text\/html/i)) {
      if (mime.extension(ct.split(';')[0]) !== 'bin') {

        resHeader = [
          (new Date()).toLocaleString(),
          response.statusCode + ' ' + url
        ];
        for (header in headers) {
          if (headers.hasOwnProperty(header)) {
            resHeader.push(header + ': ' + headers[header]);
          }
        }
        resHeader.push('\n');

        memStream = new MemoryStream();

        bufferLength = 0;
        memStream.on('data', function (chunk) {
          bufferQueue.push(chunk);
          bufferLength += chunk.length;
        });

        memStream.on('end', function () {
          var bufferAll, pos = 0, spaceLine;

          spaceLine = new Buffer('\n\n');
          bufferQueue.push(spaceLine);
          bufferLength += spaceLine.length;

          switch (bufferQueue.length) {
          case 1:
            bufferAll = bufferQueue[0];
            break;
          default:
            bufferAll = new Buffer(bufferLength);
            bufferQueue.forEach(function (buf) {
              buf.copy(bufferAll, pos);
              pos += buf.length;
            });
          }

          switch (headers['content-encoding']) {
          case 'gzip':
            zlib.gunzip(bufferAll, onDecode);
            //response.pipe(zlib.createGunzip()).pipe(memStream);
            break;
          case 'deflate':
            zlib.inflate(bufferAll, function (err, result) {
              if (err && err.code === 'Z_DATA_ERROR') {
                zlib.inflateRaw(bufferAll, onDecode);
              } else {
                onDecode(err, result);
              }
            });
            //response.pipe(zlib.createInflate()).pipe(memStream);
            //response.pipe(zlib.createInflateRaw()).pipe(memStream);
            break;
          default:
            onDecode(null, bufferAll);
            break;
          }
        });

        response.pipe(memStream);
      }
    },

    defaultConf : {
      maxSize : 10,
      logFile : './logs/visit.log',
      enableResponseLog : true,
      responseLogFilePrefix : './logs/response_'
    },

    init : function (macFiddler) {
      var conf = this.conf;
      noop = macFiddler.noop;

      this.enalbeResponse = conf.enableResponseLog;
      this.path = macFiddler.conf.scriptBase + '/' + conf.logFile;
      this.resPathPreFix = macFiddler.conf.scriptBase + '/' + conf.responseLogFilePrefix;
    }
  };

  if (exports === undefined) {
    exports = {};
  }
  exports.logs = modLogs;

}());
