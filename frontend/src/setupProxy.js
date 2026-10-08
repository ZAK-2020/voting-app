const { createProxyMiddleware } = require("http-proxy-middleware");

// Scope development proxying to API/live requests, including WebSocket upgrades
// without an Accept header. Page navigation stays with the React dev server.
module.exports = function setupProxy(app) {
  app.use(createProxyMiddleware(["/api", "/socket.io"], {
    target: "http://127.0.0.1:5000",
    changeOrigin: true,
    ws: true,
    logLevel: "warn",
  }));
};
