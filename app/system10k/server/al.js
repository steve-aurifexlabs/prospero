var http = require('http')
var url = require('url')
var fs = require('fs')

process.title = 'aurifexlabs.com'
var server = http.createServer(handleRequest)
server.listen(8091)
console.log('Started server on port 8091.')

'handleRequest'
function handleRequest(req, res) {
    console.log('\n#### START REQUEST ####')
    console.log('Request from:', req.connection.remoteAddress)
    console.log('Request to:', req.connection.localAddress, req.connection.localPort)
    console.log(req.method, req.url, 'at', new Date())
    console.log('with headers:', req.headers)

    var arguments = JSON.parse(JSON.stringify(url.parse(req.url, true).query))
    console.log('arguments:', arguments)
    console.log('custom log:')

    if(req.method == 'GET' && req.url == '/') {
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=UTF-8' })
        res.end(fs.readFileSync('./pages/aurifexlabs.txt').toString())
    }
}