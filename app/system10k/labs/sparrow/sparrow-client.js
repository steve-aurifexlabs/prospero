var startAt = Date.now()
var frame = 0

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

var buffers = {
    input: [
        new ArrayBuffer(inputBufferSize),
        new ArrayBuffer(inputBufferSize),
        new ArrayBuffer(inputBufferSize),
        new ArrayBuffer(inputBufferSize),
    ],
    output: [
        new ArrayBuffer(outputBufferSize),
        new ArrayBuffer(outputBufferSize),
        new ArrayBuffer(outputBufferSize),
        new ArrayBuffer(outputBufferSize),
    ]
}

var camera

var teamViews

var mic = {}
mic.audioContext = new AudioContext()
mic.startAt = Date.now()

var speakers = {}
speakers.audioContext = new AudioContext()
speakers.startAt = Date.now()
speakers.buffer = speakers.audioContext.createBuffer(1, samplesPerBuffer, speakers.audioContext.sampleRate)

var webSocket
var receivedMessage = false

var user

function sparrow(id, teamViewElements) {
    user = {}
    user.id = id
    user.color = {'a': 'purple', 'b': 'blue', 'c': 'orange', 'd': 'red'}[user.id]
    console.log('user:', user)

    teamViews = teamViewElements

    connect()
    registerButton()
}

function frameStep() {
    document.querySelector('#clock').textContent = clock()
    
    processCamera()
    // processScreenShare()

    drawVideoFeeds()

    frame++
    requestAnimationFrame(frameStep)
}

function sendLoop() {
    if(webSocket.readyState == WebSocket.OPEN) {
        webSocket.send(getInputBuffer())
    }
    
    // var t = (msTime(clock(-2 * a)) % (3 * a)) / a
    // clearInputBuffer(t)
    // clearOutputBuffer(t)
        // fillCameraFrames()
        // zeroMicBuffer()

    var wait = receiveOffsetTime - shiftedNow() % a - 5
    if(wait < 10) {
        wait += a
    }
    setTimeout(receiveLoop, wait)
}

function receiveLoop() {
    processSpeaker()

    // var t = (msTime(clock(-2 * a)) % (3 * a)) / a
    // clearInputBuffer(t)
    
    receivedMessage = false

    var wait = a - shiftedNow() % a + 2
    if(wait < 10) {
        wait += a
    }
    setTimeout(sendLoop, wait)
}

function getBuffers(timestamp) {
    var t = Math.floor((msTime(timestamp) % (4 * a)) / a)
    
    return {
        input: buffers.input[t],
        output: buffers.output[t],
    }
}

function getCameraBuffer() {
    var timestamp = clock()
    var frameIndex = timestamp.split('-')[1].split('.')[0]

    var inputBuffer = getBuffers(timestamp).input

    return new DataView(inputBuffer, inputBufferVideoOffset + frameIndex * frameSize, frameSize)
}

function getVideoBuffers() {
    var timestamp = clock(-delay)
    var frameIndex = timestamp.split('-')[1].split('.')[0]

    var outputBuffer = getBuffers(timestamp).output
    var inputBuffer = getBuffers(timestamp).input

    var videoBuffers = {}
    var i = 0
    var team = ['a', 'b', 'c', 'd']
    team.forEach(function(id) {
        if(id == user.id) {
            videoBuffers[id] = new DataView(inputBuffer, inputBufferVideoOffset + frameIndex * frameSize, frameSize)
        }

        else {
            videoBuffers[id] = new DataView(outputBuffer, outputBufferVideoOffset + i * videoBufferSize + frameIndex * frameSize, frameSize)
            i++
        }
    })

    return videoBuffers
}

function getMicBuffer(length) {
    var currentBuffer = getBuffers(mic.clock()).input
    var offset = Math.floor((mic.startAt + mic.audioClock * 1000) % a)

    if(offset + 1000 * length / audioSampleRate < a) {
        return new DataView(currentBuffer, inputBufferAudioOffset + offset, 2 * length)
    }
    
    else {
        var nextBuffer = getBuffers(mic.clock(length / audioSampleRate)).input
        var byteOffset = Math.round(audioSampleRate * offset / 1000) * 2
        return JoinedDataView(currentBuffer, nextBuffer, inputBufferAudioOffset, audioBufferSize, byteOffset, 2 * length)
    }
}

function getSpeakerBuffer() {
    var timestamp = clock(-delay)
    // var timestamp = clock(-delay - a / 2)
    // return new DataView(getBuffers(timestamp).output, outputBufferAudioOffset, audioBufferSize)
    return new DataView(getBuffers(timestamp).input, outputBufferAudioOffset, audioBufferSize)
}

function getInputBuffer() {
    var timestamp = clock(-a / 2)
    return getBuffers(timestamp).input
}

function setOutputBuffer(arrayBuffer) {
    var timestamp = clock(-delay)
    var t = Math.floor((msTime(timestamp) % (4 * a)) / a)
    buffers.output[t] = arrayBuffer
}

function processCamera() {
    if(camera && !camera.paused && !camera.ended) {
        camera.drawingContext.drawImage(camera, 40 + 80, 80, 80, 80, 0, 0, s, s)
        
        var cameraData = camera.drawingContext.getImageData(0, 0, s, s).data

        var cameraBuffer = getCameraBuffer()

        for(var i = 0; i < s; i++) {
            for(var j = 0; j < s; j++) {
                cameraBuffer.setUint8(i * s * 3 + j * 3 + 0, cameraData[i * s * 4 + j * 4 + 0])
                cameraBuffer.setUint8(i * s * 3 + j * 3 + 1, cameraData[i * s * 4 + j * 4 + 1])
                cameraBuffer.setUint8(i * s * 3 + j * 3 + 2, cameraData[i * s * 4 + j * 4 + 2])
            }
        }
    }

    else if (camera && camera.paused) {
        camera.play()
    }
}

function fillCameraFrames() {
    for(var f = 0; f < framesPerBuffer; f++) {
        var buffer = new DataView(getInputBuffer(), inputBufferVideoOffset + f * frameSize, videoBufferSize)
        for(var i = 0; i < s; i++) {
            for(var j = 0; j < s; j++) {
                buffer.setUint8(i * s * 3 + j * 3 + 0, 250)
                buffer.setUint8(i * s * 3 + j * 3 + 1, 220)
                buffer.setUint8(i * s * 3 + j * 3 + 2, 20)
            }
        }
    }
}

function drawVideoFeeds() {
    var buffers = getVideoBuffers()
    
    Object.keys(buffers).forEach(function(id) {
        var buffer = buffers[id]
        var data = new Uint8ClampedArray(4 * s * s)

        for(var i = 0; i < s; i++) {
            for(var j = 0; j < s; j++) {
                data[i * s * 4 + j * 4 + 0] = buffer.getUint8(i * s * 3 + j * 3 + 0)
                data[i * s * 4 + j * 4 + 1] = buffer.getUint8(i * s * 3 + j * 3 + 1)
                data[i * s * 4 + j * 4 + 2] = buffer.getUint8(i * s * 3 + j * 3 + 2)
                data[i * s * 4 + j * 4 + 3] = 255
            }
        }
        
        teamViews[id].getContext('2d').putImageData(new ImageData(data, s, s), 0, 30)
    })
}

function startMic(localStream) {
    mic.audioContext.audioWorklet.addModule('mic.js').then(function() {        
        mic.sourceNode = mic.audioContext.createMediaStreamSource(localStream)
        
        mic.processingNode = new AudioWorkletNode(mic.audioContext, 'mic-processor')
        mic.processingNode.port.onmessage = function(event) {
            if(event.data === undefined) return

            // if(Math.random() < 0.005) console.log(event.data)

            var buffer = getMicBuffer(event.data.length)

            var scaleFactor = Math.pow(2, 14)
            event.data.forEach(function(sample, i) {
                buffer.setInt16(2 * i, Math.round(sample * scaleFactor))
            })

            mic.audioClock += event.data.length / audioSampleRate
        }
        
        mic.sourceNode.connect(mic.processingNode)

        mic.audioClock = mic.audioContext.currentTime
    })

    mic.clock = function(shift) {
        if(!shift) shift = 0
        return ts(mic.startAt - webSocket.startAt + mic.audioClock * 1000 + shift)
    }
}

function processSpeaker() {
    if(speakers.audioClock === undefined) {
        speakers.audioClock = speakers.audioContext.currentTime
    }

    var audioData = speakers.buffer.getChannelData(0)
    var buffer = getSpeakerBuffer()

    // console.log(new Int16Array(buffers.output[0].slice(outputBufferAudioOffset, outputBufferAudioOffset + 20)))

    var scaleFactor = Math.pow(2, -15)
    for(var i = 0; i < speakers.buffer.length; i++) {
        audioData[i] = buffer.getInt16(2 * i) * scaleFactor 
    }

    if(Math.random() < 0.05) console.log(audioData)
    var audioBufferNode = speakers.audioContext.createBufferSource()
    audioBufferNode.buffer = speakers.buffer
    audioBufferNode.connect(speakers.audioContext.destination)

    // var scheduledTime = speakers.audioClock + 0.5
    // audioBufferNode.start(scheduledTime)
    audioBufferNode.start()

    speakers.audioClock += a / 1000.0
}

function connect() {
    webSocket = new WebSocket('wss://prospero.live/labs/sparrow/ws')
    webSocket.binaryType = 'arraybuffer'
    webSocket.timeSyncCount = 0

    webSocket.addEventListener('open', function (event) {
        console.log('webSocket connected')

        document.querySelector('.message').textContent = 'Handshakes...'
        
        webSocket.send(JSON.stringify({
            type: 'intro', 
            id: user.id,
        }))
    })
    
    webSocket.addEventListener('error', function (event) {
        console.log('webSocket error:', event)
        connect()
    })

    webSocket.addEventListener('close', function (event) {
        console.log('webSocket closed:', event)
        connect()
    })

    webSocket.addEventListener('message', function (event) {
        var messageBytes = event.data
        
        if(messageBytes instanceof ArrayBuffer && messageBytes.byteLength == outputBufferSize) {
            setOutputBuffer(messageBytes)
            receivedMessage = true
            return
        }

        try {
            var message = JSON.parse(messageBytes)
        } catch(e) {
            console.log(clock(), 'Invalid message', messageBytes, e)
            return
        }

        if(message.type == 'intro') {
            webSocket.startAt = message.startAt
        }

        else if(message.type == 'server-time-sync') {
            webSocket.timeSyncCount++
            webSocket.shift = message.shift

            if(webSocket.timeSyncCount < 20) {
                document.querySelector('.message').textContent = 'Syncing clocks...' + Math.ceil(webSocket.timeSyncCount / 5)
            }

            else if(webSocket.timeSyncCount == 20) {
                document.querySelector('.message').textContent = '← Share your camera and microphone.'

                requestAnimationFrame(frameStep)

                var wait = a - shiftedNow() % a + 2
                setTimeout(sendLoop, wait)
            }

            webSocket.send(JSON.stringify({
                type: 'client-time-sync',
                sentAt: message.at,
                receivedAt: Date.now(),
            }))
        }

        else {
            console.log('Unknown message type', message)
        }
    })
}

function clock(shift) {
    if(!shift) shift = 0
    var t = shiftedNow() - webSocket.startAt + shift
    return ts(t)
}

function shiftedNow() {
    return Date.now() + webSocket.shift
}

function ts(t) {
    t = Math.floor(t)
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

function msTime(timestamp) {
    var bufferId = timestamp.split('-')[0]
    var minutes = parseInt(bufferId.split(':')[0])
    var seconds = parseInt(bufferId.split(':')[1].split('.')[0])
    var bufferIndex = parseInt(bufferId.split(':')[1].split('.')[1])
    var frameIndex = parseInt(timestamp.split('-')[1].split('.')[0])
    var msPart = parseInt(timestamp.split('-')[1].split('.')[1])

    return msPart + frameIndex * 16.67 + bufferIndex * a + seconds * 1000 + minutes * 60 * 1000
}

function JoinedDataView(bufferA, bufferB, inputOffset, inputLength, outputOffset, outputLength) {
    var dataViewA = new DataView(bufferA, inputOffset, inputLength)
    var dataViewB = new DataView(bufferB, inputOffset, inputLength)

    var result = {}

    result.setInt16 = function(offset, value) {
        // console.log(offset, outputLength)
        if(offset >= outputLength) {
            console.log('JoinedDataView Error: offset out of range', offset, '>=', outputLength)
        }

        if(offset + outputOffset < inputLength) {
            try {
                dataViewA.setInt16(offset + outputOffset, value)
            } catch(e) {
                console.log(offset, outputOffset, inputLength, outputLength)
            }
        }
        
        else {
            dataViewB.setInt16(offset + outputOffset - inputLength, value)
        }
    }    

    return result
}

function registerButton() {
    var cameraButton = document.querySelector('button#share-camera-mic')
    cameraButton.style.border = '3px solid ' + user.color
    cameraButton.style.color = user.color
    cameraButton.addEventListener('click', function(event) {
        shareCameraMic()    
    })

    // document.querySelector('button#share-screen').addEventListener('click', function(event) {
    //     shareScreen()    
    // })
}

function shareCameraMic() {
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: {
            width: 320,
            height: 240,
        },
    }).then(function(localStream) {
        camera = document.querySelector('video#raw-camera')
        camera.autoplay = true
        camera.muted = true
        camera.srcObject = localStream

        camera.canvas = teamViews[user.id]
        camera.drawingContext = camera.canvas.getContext('2d')

        startMic(localStream)
    })
    .catch(function(error) {
        console.log(error)
    })
}







function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({
        video: true,
    })
    .then(function(localStream) {
        user.screen = document.querySelector('video#raw-screen-share')
        user.screen.autoplay = true
        user.screen.muted = true
        user.screen.srcObject = localStream
            
        user.screen.canvas = document.querySelector('#scratch-screen-share')
        user.screen.drawingContext = user.screen.canvas.getContext('2d')
    })
    .catch(function(error) {
        console.log(error)
    })
}

function processScreenShare() {

    // if(user.screen && frame % 60 == 0) {
    //     // user.drawingContext.drawImage(user.camera, 40 + 40, 40, 160, 160, 0, 0, user.canvas.width, user.canvas.height)
    //     user.screen.drawingContext.drawImage(user.screen, 0, 0, user.screen.canvas.width, user.screen.canvas.height)
    //     var img = user.screen.canvas.toDataURL('image/png')
    //     console.log(img.length)
    // }

}