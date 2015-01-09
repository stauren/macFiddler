var findProxyFromPac = (function () {
  {$realPac}
  return FindProxyForURL || function () { return 'DIRECT'; };
})();

var shExpMatch,
  isInNet,
  exports;

if (shExpMatch === undefined) {
  shExpMatch = function (url, pattern) {
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
  };
}

if (isInNet === undefined) {
  isInNet = function (host, pattern, mask) {
    var i;
    host = host.split('.');
    pattern = pattern.split('.');
    mask = mask.split('.');

    for (i = 0; i < 4; i++) {
      if ((host[i] & mask[i]) !== (pattern[i] & mask[i])) {
        return false;
      }
    }

    return true;
  };
}

if (exports === undefined) {
  exports = {};
}

exports.findProxyFromPac = findProxyFromPac;
