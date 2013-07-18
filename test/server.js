var http = require('http');
var url  = require('url');
var path = require('path');
var fs   = require('fs');

http.createServer(function (req, res) {
  var uri = url.parse(req.url).pathname;
  var filename = path.join(process.cwd(), uri);
  
  fs.readFile(filename, 'binary', function (err, file) {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.write(err + '\n');
      res.end();
      return;
    }
    
    res.writeHead(200, filename.match(/\.js$/) ? { 'Content-Type': 'text/javascript' } : {});
    res.write(file, 'utf-8');
    res.end();
  });
}).listen(8124, '0.0.0.0');

console.log('Test suite url: http://localhost:8124/test/index.html');
