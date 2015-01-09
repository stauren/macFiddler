var findProxyFromPac = (function () {
  {$realPac}

  return FindProxyForURL || function () { return 'DIRECT'; };
})();

{$filterFn}

function _FindProxyForURL(url, host) {
  var rules = {$proxyRules}, i, j, len, rule, matched;


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

  return findProxyFromPac(url, host);
}

function FindProxyForURL(url, host) {
  var result = "DIRECT";
  if (url.indexOf("http://") === 0 && filter(url, host)) {
    return "PROXY {$proxyIp}:{$proxyPort}";
  }
  return _FindProxyForURL(url, host);
}
