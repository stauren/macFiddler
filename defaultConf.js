module.exports = {
  enableReplace : true,
  enableProxyRequest : true,

  replaceBase : './replaceDocs',

  replaceRules : [
    [ /direct.example.com\/(\w+)\.html/, '{$1}.html', '404.html' ]
  ],

  autoBuild : [
    [
      /^the url to match$/i,
      'the shell command to run before response',
      5 * 1000 //min build interval
    ]
  ],

  filter : function (url, host) {
    if (!/\.(swf|jpg|jpeg|gif|bmp|png|cur)(\?|$)/i.test(url) && //no images or flash
        !/^127\.0\.0\.1/i.test(host) //no local
        ) {
      return true;
    }
  },

  //delay : 1000,
  delayFilter : function (url) {
    return /\.js/i.test(url);
  },

  proxyRules : {
    'PROXY example.com:8080' : [
      'http://needproxy.example.com/*',
      'needproxy2.example.com'
    ],
    'DIRECT' : [
      '127.0.0.1:*',
      'http://direct.example.com/*'
    ]
  },

  allowIps : [
    '127.0.0.1',
    '10.211.55.*'
  ],

  scriptBase : __dirname,
  pac : 'http://example.com/path/to.pac',
  pacEncoding : 'utf8',

  enableLogs : true,
  logFile : './runtime/logs/visit.log',
  enableResponseLog : true,
  responseLogFilePrefix : './runtime/logs/response_',

  hostsFile : './hosts.conf',

  port : 8080,
  maxSockets : 10
};

