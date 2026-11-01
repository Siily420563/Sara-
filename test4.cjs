const EventEmitter = require('events');
const ee = new EventEmitter();
process.on('uncaughtException', (err) => {
  console.log('Uncaught:', err.code, err.message, err.name);
});
ee.emit('error', { error: function(){}, _errorEmitted: false, _errored: false, onerror: function senderOnError(){} });
