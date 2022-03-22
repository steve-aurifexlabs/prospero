var startAt = Date.now() 
console.log(clock(), 'startAt:', startAt)

var http = require('http')
var ws = require('ws')

var a = 200  // Buffer length (ms)
var b = 150  // Half max round trip latency (ms) 
var c = 5    // Half server processing time (ms)
var s = 30   // Size (px)

var delay = a + 2 * b
var maxNetworkLatency = 2 * (b - c)
var serverProcessingTime = 2 * c
var receiveOffsetTime = 2 * b % a 

var dataBufferSize = 2 * 1024
var dataBufferOffset = 0

var audioSampleRate = 44100  // hz
var samplesPerBuffer = a * audioSampleRate / 1000
var inputBufferAudioOffset = dataBufferSize
var outputBufferAudioOffset = dataBufferSize
var audioBufferSize = 2 * samplesPerBuffer // 16bps

var frameLength = 16.6667  // ms
var framesPerBuffer = Math.round(a / frameLength)
var frameSize = 3 * s * s  // 24bpp
var inputBufferVideoOffset = inputBufferAudioOffset + audioBufferSize
var outputBufferVideoOffset = outputBufferAudioOffset + audioBufferSize
var videoBufferSize = framesPerBuffer * frameSize

var inputBufferSize = dataBufferSize + audioBufferSize + videoBufferSize
var outputBufferSize = dataBufferSize + audioBufferSize + 3 * videoBufferSize

var connections = {}

var buffers = {
    input: {},
    output: {
        a: new ArrayBuffer(outputBufferSize),
        b: new ArrayBuffer(outputBufferSize),
        c: new ArrayBuffer(outputBufferSize),
        d: new ArrayBuffer(outputBufferSize),
    },
}

function copyVideoToOutputBuffers(userId) {
    var inputView = buffers.input[userId]
    
    var team = ['a', 'b', 'c', 'd']
    team.forEach(function(id) {
        if(id != userId) {
            var bufferIndex = team.indexOf(userId)
            if(team.indexOf(userId) > team.indexOf(id)) {
                bufferIndex -= 1
            }

            var outputView = new DataView(buffers.output[id], outputBufferVideoOffset + bufferIndex * videoBufferSize, videoBufferSize)
            
            for(var i = 0; i < outputView.byteLength; i++) {
                outputView.setUint8(i, inputView.readUInt8(i + inputBufferVideoOffset))
            }
        }
    })
}

function mixAudio(userId) {
    Object.keys(buffers.output).forEach(function(id) {
        // if(id == userId) return
        
        // var inputView = new DataView(buffers.input[userId], inputBufferAudioOffset, audioBufferSize)
        var inputView = buffers.input[userId]
        var outputView = new DataView(buffers.output[id], outputBufferAudioOffset, audioBufferSize)
        
        for(var i = 0; i < audioBufferSize; i+=2) {
            // var value = outputView.getInt16(i) + inputView.readInt16LE(i + inputBufferAudioOffset) / 4
            var value = inputView.readInt16BE(i + inputBufferAudioOffset)
            // if(Math.random() < 0.05) console.log(value)
            outputView.setInt16(i, value)
        }
        
        // }
    })

    // console.log(new Int16Array(buffers.output[userId].slice(outputBufferAudioOffset, outputBufferAudioOffset + 20)))
}

function fillVideoFrames() {
    Object.keys(buffers.output).forEach(function(id) {
        for(var f = 0; f < framesPerBuffer; f++) {
            var buffer = new DataView(buffers.output[id], outputBufferVideoOffset + f * frameSize, videoBufferSize)
            for(var i = 0; i < s; i++) {
                for(var j = 0; j < s; j++) {
                    buffer.setUint8(i * s * 3 + j * 3 + 0, 20)
                    buffer.setUint8(i * s * 3 + j * 3 + 1, 250)
                    buffer.setUint8(i * s * 3 + j * 3 + 2, 20)
                }
            }
        }
    })
}

function zeroAudioBuffers(userId) {
    Object.keys(buffers.output).forEach(function(id) {
        var outputView = new DataView(buffers.output[id], outputBufferAudioOffset, audioBufferSize)
        
        for(var i = 0; i < outputView.length; i+=2) {
            outputView.setInt16(i, 0)
        }
    })
}

var server = http.createServer(handleRequest)
var webSocketServer = new ws.Server({ server: server })
webSocketServer.on('connection', handleWebSocket)
server.listen(8083)
console.log('Started sparrow server on port 8083')

function handleRequest(req, res) {
    res.writeHead(404)
    res.end()
}

function handleWebSocket(webSocket) {
    console.log('New connection.')

    webSocket.on('message', function(messageBytes) {
        if(messageBytes === undefined || messageBytes == 'undefined') return

        if(messageBytes instanceof Buffer) {
            if(messageBytes.length != inputBufferSize) return

            if(webSocket.userId) {
                buffers.input[webSocket.userId] = messageBytes
                
                copyVideoToOutputBuffers(webSocket.userId)

                mixAudio(webSocket.userId)
                
            }
            
            return
        }

        try {
            var message = JSON.parse(messageBytes)
        } catch(e) {
            console.log(clock(), 'Invalid message', messageBytes, e)
            return
        }
        
        if(message.type == 'intro') {
            console.log(clock(), 'intro', message.id)
            
            connections[message.id] = webSocket
            
            webSocket.userId = message.id
            webSocket.n = 0
            webSocket.variance = 0
            webSocket.shift = 0

            webSocket.send(JSON.stringify({
                type: 'intro',
                startAt: startAt,
            }))
        }

        else if(message.type == 'client-time-sync') {
            var now = Date.now()
            var middle = ((now - message.sentAt) / 2) + message.sentAt
            var shift = message.receivedAt - middle
            // console.log(message.sentAt, middle, message.receivedAt, now, now - message.sentAt)
            
            if(!webSocket.shift) {
                webSocket.shift = shift
            }

            var n
            if(webSocket.n < 20) {
                n = webSocket.n
            }
            else {
                n = 2000
            }

            webSocket.shift += ((shift - webSocket.shift) / (n + 1))
            webSocket.variance += Math.abs(shift - webSocket.shift)
            webSocket.n += 1
            // console.log(shift, 'webSocket.shift', webSocket.shift, '+/-', webSocket.variance / webSocket.n)
        }

        else {
            console.log('unknown message', message)
        }
    })
}


var loadAt = Date.now()
console.log('loadAt:', loadAt, 'loadTime:', loadAt - startAt)

var wait = a - loadAt % a - 1
setTimeout(clockSyncLoop, wait)

function clockSyncLoop() {
    Object.keys(connections).forEach(function(connectionId) {
        var connection = connections[connectionId]
        connection.send(JSON.stringify({
            type: 'server-time-sync',
            at: Date.now(),
            shift: connection.shift,
        }))
    })
    
    wait = b - Date.now() % a - c - 1
    if(wait < 10) {
        wait += a
    }
    setTimeout(dataLoop, wait)
}

function dataLoop() {
    Object.keys(connections).forEach(function(connectionId) {
        var connection = connections[connectionId]
        connection.send(buffers.output[connectionId])
        // console.log(connectionId, buffers.output[connectionId].slice(outputBufferVideoOffset, outputBufferVideoOffset + 100))
        
    })

    // zeroAudioBuffers()
    // fillVideoFrames()

    wait = a - Date.now() % a - 1
    if(wait < 10) {
        wait += a
    }
    setTimeout(clockSyncLoop, wait)
}

function clock() {
    var t = Date.now() - startAt
    
    var minutes = Math.floor(t / 60000)
    var seconds = Math.floor(t % 60000 / 1000)
    var b = Math.floor(t % 1000 / 200)
    var f = Math.floor(t % 200 / 16.67)
    var m = Math.floor(t % 16.67)

    if(seconds < 10) seconds = '0' + seconds
    if(b < 10) b = '0' + b
    if(f < 10) f = '0' + f
    if(m < 10) m = '0' + m

    return minutes + ':' + seconds + '.' + b + '-' + f + '.' + m
}