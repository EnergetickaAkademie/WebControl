const PROXY_CONFIG = {
  "/api/*": {
    "target": "http://localhost:3001",
    "secure": false,
    "changeOrigin": true,
    "logLevel": "debug",
    "bypass": function (req, res, proxyOptions) {
      console.log(`Proxying request: ${req.method} ${req.url}`);
    }
  }
};

module.exports = PROXY_CONFIG;
