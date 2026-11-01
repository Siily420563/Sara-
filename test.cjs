process.on('uncaughtException', (err) => { console.log('caught!'); });
const EventEmitter = require('events');
const ee = new EventEmitter();
ee.emit('error', { a: 1, _errorEmitted: false });
