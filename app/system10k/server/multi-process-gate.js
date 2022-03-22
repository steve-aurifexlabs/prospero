
'node dependencies'
var http = require('http')
var child_process = require('child_process')
var ws = require('ws')
var fs = require('fs')

'npm dependencies'
var postmark = new (require('postmark').ServerClient)(process.env.POSTMARK_KEY)
require('isomorphic-fetch')

'constants'
var startingPort = fs.readFileSync('/root/next_port').toString('utf8')
var lastPort = 9999
var warningPort = 9900

'ephemerals'
var assignedPorts = {}
var nextPort = startingPort
var childProcesses = []
var runSessions = {}

'start'
process.title = 'multi-process-gate'
var server = http.createServer(handleRequest)

var webSocketServer = new ws.Server({ noServer: true })
webSocketServer.on('connection', handleWebSocketConnection)
server.on('upgrade', handleWebSocketUpgrade)

server.listen(8082, 'localhost')
console.log('Started multi process gate server on port 8082.')

'handleRequest'
function handleRequest(req, res) {
    // console.log('\n#### START REQUEST ####')
    // console.log('Request from:', req.connection.remoteAddress, req.connection.remotePort)
    // console.log('Request to:', req.connection.localAddress, req.connection.localPort)
    console.log(req.method, req.headers.host, req.url, 'at', (new Date()).toString())
    console.log('with headers:', req.headers)

    // console.log('mem used:', process.memoryUsage())

    var teamId = req.headers.host.slice(0, 4) + req.headers.host.slice(5, 33)
    if(teamId.includes('.')) {
        var runSession = runSessions[req.headers.host.slice(0, 32)]
        if(runSession) {
            teamId = runSession.teamId
        }
    }

    // console.log(teamId, runSessions)

    if(!teamId) {
        res.writeHead(400)
        res.end
        return
    }

    port = assignedPorts[teamId]

    console.log(teamId, assignedPorts, port, nextPort)

    if(!port) {
        startAppServer(nextPort)

        port = nextPort
        assignedPorts[teamId] = port
        nextPort++
        fs.writeFileSync('/root/next_port', nextPort.toString())

        if(nextPort > warningPort) {
            postmark.sendEmail({
                From: 'Prospero.Live <steve@prospero.live>',
                To: 'steve@aurifexlabs.com',
                Subject: 'Max ports used: ' + nextPort,
                TextBody: '',
            })
        }

        if(nextPort > lastPort) {
            fs.writeFileSync('/root/next_port', '9000')
            process.exit(1)
        }

        setTimeout(function() {
            forwardRequest(req, res, port, teamId)
        }, 1500)
    }

    else {
        forwardRequest(req, res, port, teamId)
    }
}

function forwardRequest(req, res, port, teamId) {
    var inputData = Buffer.from('')

    req.on('data', function(chunk) {
        inputData = Buffer.concat([inputData, chunk])
    })

    req.on('end', function() {
        var requestURL = 'http://127.0.0.1:' + port + req.url
        // var requestURL = 'http://127.123.1.4:8080' + port + req.url

        var request = http.request(requestURL, {
            method: req.method,
            headers: req.headers,
            // body: inputData.toString('binary'),
        }, function(response) {
            res.writeHead(response.statusCode, response.headers)

            var responseBody = Buffer.from('')
            
            response.on('data', function(chunk) {
                responseBody = Buffer.concat([responseBody, chunk])
                res.write(chunk)
            })
            
            response.on('end', function() {
                if(req.url.startsWith('/api/run/start-run-session?')) {
                    try {
                        var responseData = JSON.parse(responseBody.toString('utf8'))
                    } catch(e) {
                        // console.log('run session json parse error', responseBody.toString('utf8'))
                    }

                    runSessions[responseData.runSessionUrlPrefix] = {
                        teamId: teamId,
                    }
                }
            
                res.end()
            })
        }).on('error', function(err) {
            console.error('proxy error:', err);
            delete assignedPorts[teamId]
        })

        request.write(inputData)
    })
}

function handleWebSocketConnection(webSocket) {
    var teamId = webSocket.host.slice(0, 4) + webSocket.host.slice(5, 33)
    port = assignedPorts[teamId]

    if(!port) {
        return
    }

    var startQueue = []
    var finishedInit = false

    webSocket.on('message', function(message) {
        // console.log(message)
        if(finishedInit) {
            internalWebSocket.send(message)
        } else {
            startQueue.push(message)
        }
    })

    var internalWebSocket = new ws('ws://127.0.0.1:' + port)

    internalWebSocket.on('open', function() {
        finishedInit = true
        startQueue.forEach(function(msg) {
            internalWebSocket.send(msg)
        })
        startQueue = []
    })
    
    internalWebSocket.on('message', function(message) {
        // console.log(message)
        webSocket.send(message)
    })


    webSocket.on('close', function() {
        internalWebSocket.close()
    })

    webSocket.on('error', function() {
        internalWebSocket.close()
    })
}

function handleWebSocketUpgrade(req, socket, head) {
    webSocketServer.handleUpgrade(req, socket, head, function done(webSocket) {
        webSocket.host = req.headers.host
        webSocketServer.emit('connection', webSocket, req)
    })
}

function startAppServer(port) {
    // var appProcess = child_process.spawn('node', ['--max_old_space_size=10', 'server/server.js', port.toString()])
    var appProcess = child_process.spawn('node', ['server/server.js', port.toString()])

    //console.log(appProcess)

    appProcess.stdout.on('data', function(data) {
        console.log(data.toString())
    })
      
    appProcess.stderr.on('data', function(data) {
        console.error(data.toString());
    })

    appProcess.on('close', function(code) {
	console.log(`process exited with code ${code}`);
    })

    childProcesses.push(appProcess)
}

/*
process.on('SIGINT', function() {
    childProcesses.forEach(function(cp) {
        cp.kill()
    })

    process.exit(1)
})
*/
