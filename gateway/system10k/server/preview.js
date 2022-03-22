'Requires: node v12.x, postmark, stripe'

'node dependencies'
var http = require('http')
var url = require('url')
var fs = require('fs')
var crypto = require('crypto')
var process = require('process')

'npm dependencies'

'constants'
var durablePath = process.env.HOME + '/data/'

'ephemerals'

'durables'

'start'
process.title = 'preview-server'
var server = http.createServer(handleRequest)
server.listen(8081)
console.log('Started server on port 8081.')

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

    if(req.method == 'GET') {
        // var fullPath = Buffer.from(code, 'hex').toString('utf8') + req.url.split('/').slice(2).join('')

        try {
            var file = fs.readFileSync(durablePath + 'storage' + req.url)
        } catch(error) {
            console.log(error)
            res.writeHead(404)
            res.end('File not found.')
        }

        var contentType = 'application/x-unknown'
        
        if(req.url.endsWith('.html')) {
            contentType = 'text/html'
            file = file.toString('utf8')
        }
        
        else if(req.url.endsWith('.js')) {
            contentType = 'text/javascript'
            file = file.toString('utf8')
        }
        
        else if(req.url.endsWith('.css')) {
            contentType = 'text/css'
            file = file.toString('utf8')
        }

        res.writeHead(200, {
            'Content-Type': contentType,
            // 'Content-Disposition': 'attachment; filename="' + filename + '"'
        })
        res.end(file)
    }

    else {
        res.writeHead(405)
        res.end('Read only.')
    }
}