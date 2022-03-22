var process = require('process')
var fs = require('fs')
require('isomorphic-fetch')
var WebSocket = require('isomorphic-ws')

var email = process.argv[2]
var team = process.argv[3]
var path = process.argv[4]
var code = process.argv[5]
var sessionId = process.argv[6]

var webSocket

if(!sessionId) {
    console.log(new Date(), 'Authenticating...')

    fetch('https://prospero.live/api/email-auth?email=' + encodeURIComponent(email) + '&code=' + encodeURIComponent(code), {
        method: 'POST',
    }).then(function(response) {
        if (response.ok) {
            return response.json()
        } else {
            console.log('There was an authentication error. Please try again.')
        }
    }).then(function(data) {
        if(data && data.sessionId) {
            sessionId = data.sessionId
            console.log(new Date(), 'Authenticated:', sessionId, '\n')
            startConnection()
        }
    })
}

else {
    startConnection()
}

function startConnection() {
    connect()

    setInterval(function () {
        if(webSocket === undefined || webSocket.readyState == WebSocket.CLOSED) {
            connect()
        }
   
        else if (webSocket.readyState == WebSocket.OPEN) {
            webSocket.send(JSON.stringify({
                type: 'ping',
                time: Date.now(),
            }))
        }
    }, 3 * 1000)
}
    
// connect to websocket
function connect() {
    console.log(new Date(), 'Connecting...')
    webSocket = new WebSocket('wss://prospero.live')
    
    webSocket.addEventListener('open', function (event) {
        console.log(new Date(), 'Connected.\n')

        var message = {
            type: 'authorization',
            clientType: 'simple-receive',
            authorization: 'Bearer ' + sessionId,
            team: team, 
        }
        
        webSocket.send(JSON.stringify(message))
    })

    webSocket.addEventListener('error', function (event) {
        console.log(new Date(), 'Error: Connection error. Attempting to reconnect...', event)
    })
    
    webSocket.addEventListener('close', function (event) {
        console.log(new Date(), 'Disconnect: Connection closed. Attempting to reconnect...', event)
    })
    
    webSocket.addEventListener('message', function (event) {
        var message = JSON.parse(event.data)
        // console.log(message)

        if(message.type == 'push') {
            writeSentFile(message)
        }
    })
    
}

// on message -> write to fs
function writeSentFile(message) {
    if(!validPath(message.path)) {
        console.log('Error: Invalid path', message.path + '\n')
        return
    }
    
    if(!message.path.startsWith(path)) {
        console.log(new Date(), 'Error: File (' + message.path + ') not in path (' + path + ')\n')
        return
    }
    
    var partialPath = message.path.slice(path.length)
    
    console.log(new Date(), 'Started writing', partialPath + '...')
    fs.writeFile('./' + partialPath, message.contents, {
        encoding: 'binary',
    }, function(error) {
        if(error) {
            console.log(new Date(), 'Error: Could not write file (' + message.path + ')', error, '\n')
        }

        else {
            console.log(new Date(), 'Finished writing', partialPath, '\n')
        }
    })

    function validPath(path) {
        if(!path || path.length > 4096) {
            return false
        }
    
        if(path[0] != '/') {
            return false
        }
    
        if(path.includes('\0') || path.includes('/../')) {
            return false
        }
    
        return true
    }
}