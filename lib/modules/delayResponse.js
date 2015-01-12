/*jslint node: true*/

var exports;
(function () {
  'use strict';
  var delayMs,
    modDelayResponse,
    writeInterval = 50;

  modDelayResponse = {
    send : function (content, writer, onEnd) {
      var writePos = 0,
        bufferLength = content.length,
        writeCounts = Math.ceil(delayMs / writeInterval),
        currentCount = 0,
        //lengthPerWrite = Math.max(Math.round(bufferLength / writeCounts), 1),
        writeParts = function() {
          var endPos = bufferLength;
          currentCount++;
          if (writePos < endPos) {
            //endPos = Math.min(endPos, writePos + lengthPerWrite);
            endPos = Math.min(endPos, Math.floor(bufferLength / writeCounts * currentCount));
            if (endPos > writePos) {
              writer.write(content.slice(writePos, endPos));
              //writer.write(content.substr(writePos, lengthPerWrite), 'binary');
              writePos = endPos;
            }
            setTimeout(writeParts, writeInterval);
          } else {
            writer.end();
            if (onEnd) {
              onEnd();
            }
          }
        };

      writeParts();
    },
    pipe : function (reader, writer, onEnd) {
      var bufferQueue = [],
        bufferLength = 0;

      reader.on('data', function (ck) {
        bufferQueue.push(ck);
        bufferLength += ck.length;
      });

      reader.on('end', function () {
        var bufferAll,
          pos = 0,
          writePos = 0,
          writeCounts = Math.ceil(delayMs / writeInterval),
          currentCount = 0,
          writeParts = function() {
            var endPos = bufferLength;
            currentCount++;
            if (writePos < endPos) {
              endPos = Math.min(endPos, Math.floor(bufferLength / writeCounts * currentCount));
              if (endPos > writePos) {
                writer.write(bufferAll.slice(writePos, endPos));
                writePos = endPos;
              }
              setTimeout(writeParts, writeInterval);
            } else {
              writer.end();
            }
          };

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

        writeParts();

        if (onEnd) {
          onEnd();
        }
      });

    },

    defaultConf : {
      filter : null,
    },

    init : function () {
      var conf = this.conf,
        delay;

      delay = parseInt(conf.delay, 10);

      if (isNaN(delay)) {
        delay = 0;
      }

      delayMs = delay;
      this.enabled = delay > 0;
      this.filter = this.enabled ? conf.filter || function () { return true; } :
          function () { return false; };
    }

  };

  if (exports === undefined) {
    exports = {};
  }
  exports.delayResponse = modDelayResponse;
}());

