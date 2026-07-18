const WS = typeof window !== 'undefined' ? window.WebSocket : require('ws');
module.exports = WS;
module.exports.WebSocket = WS;
module.exports.default = WS;
