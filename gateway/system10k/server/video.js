var http = require('http')
var fs = require('fs')
var crypto = require('crypto')

var title = '14K'

var server = http.createServer(handleRequest)
var port = 8082
server.listen(port)
console.log(title + ' server listening on port', port)

function handleRequest(req, res) {
    console.log(req.url)
    if(req.method == 'GET' && req.url == '/favicon.ico') {
        res.writeHead(200)
        res.end(fs.readFileSync('./favicon.ico'))
    }
    else {
        var id = crypto.randomBytes(16).toString('hex')
        res.writeHead(200)
        res.end(pages.index)
    }
}

var pages = {}

pages.index = `
    <!doctype html>

    <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>` + title + `</title>
        </head>

        <style>
            body {
                margin: 0;
                padding: 0;
            }

            canvas {
                margin: 0;
            }

            #timeline {
                width: 100%;
                height: 128px;
            }
        </style>

        <body>
            <canvas id="c2"></canvas>
            <canvas id="timeline"></canvas>
        
            <video style="display: none;" autoplay muted></video>
            <canvas style="display: none;"  id="c1"></canvas>
        </body>

        <script>
            var size = 44
            var scale = 4
            var srcSettings

            // var button = document.querySelector('button')
            var video = document.querySelector('video')

            var c1 = document.querySelector('#c1').getContext('2d')
            var c2 = document.querySelector('#c2').getContext('2d')

            function setSize() {
                c1.canvas.setAttribute('width', size)
                c1.canvas.setAttribute('height', size)

                c2.canvas.setAttribute('width', size * scale)
                c2.canvas.setAttribute('height', size * scale + 96 + 64)
            }

            // button.addEventListener('click', function() {
                navigator.mediaDevices.getUserMedia({
                    audio: true,
                    video: {
                        width: 320,
                        height: 240,
                    },
                }).then(function(localStream) {    
                    video.srcObject = localStream
                    srcSettings = localStream.getVideoTracks()[0].getSettings()            
                    setSize()
                    setupAudio(localStream)
                    requestAnimationFrame(processFrame)
                })
            // })

            var analyser
            var audioBufferLength
            var timeDomainBuffer
            var frequencyDomainBuffer
            var audioCtx

            function setupAudio(localStream) {
                audioCtx = new AudioContext()
                var source = audioCtx.createMediaStreamSource(localStream)

                // var noiseCancellationBass = audioCtx.createBiquadFilter()
                // noiseCancellationBass.type = 'bandpass'
                // noiseCancellationBass.frequency.setValueAtTime(300, audioCtx.currentTime)
                // noiseCancellationBass.Q.setValueAtTime(0.2, audioCtx.currentTime)
                
                // var noiseCancellationMid = audioCtx.createBiquadFilter()
                // noiseCancellationMid.type = 'bandpass'
                // noiseCancellationMid.frequency.setValueAtTime(800, audioCtx.currentTime)
                // noiseCancellationMid.Q.setValueAtTime(0.2, audioCtx.currentTime)
                
                // var noiseCancellationTreble = audioCtx.createBiquadFilter()
                // noiseCancellationTreble.type = 'bandpass'
                // noiseCancellationTreble.frequency.setValueAtTime(1800, audioCtx.currentTime)
                // noiseCancellationTreble.Q.setValueAtTime(0.2, audioCtx.currentTime)
                
                // source.connect(noiseCancellationBass)
                // noiseCancellationBass.connect(noiseCancellationMid)
                // noiseCancellationMid.connect(noiseCancellationTreble)

                var next = source
                // var next = noiseCancellationTreble
                analyser = audioCtx.createAnalyser()
                next.connect(analyser)
                audioBufferLength = analyser.fftSize
                timeDomainBuffer = new Uint8Array(audioBufferLength)
                frequencyDomainBuffer = new Uint8Array(analyser.frequencyBinCount)
            }

            var fps = 12
            var lastFrameAt = 0
            var batchedFrames = []

            var timeScale = 1.0 
            var freqScale = 1.0 

            var clipped = false

            function drawAudioTime(ctx, offsetX, offsetY) {
                if(clipped) {
                    ctx.fillStyle = 'rgba(255, 0, 0, 0.8)'
                } else {
                    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)'
                }
                ctx.fillRect(0, offsetY + 32, ctx.canvas.width, 96 + 64)
                clipped = false

                analyser.getByteTimeDomainData(timeDomainBuffer)

                ctx.lineWidth = 1.5
                ctx.lineCap = 'rounded'
                
                ctx.beginPath()
                ctx.moveTo(0 * ctx.canvas.width / audioBufferLength, timeDomainBuffer[0] / 2 + offsetY)
                
                for(var i = 1; i < audioBufferLength; i++) {
                    var sample = timeDomainBuffer[i]
                    
                    if(sample > 256 - 38 || sample < 38) {
                        clipped = true
                    }

                    if(sample > 128 + 50 || sample < 128 - 50) {
                        ctx.strokeStyle = 'rgb(250, 0, 0, 0.8)'
                    } 
                    
                    else if(sample > 128 + 25 || sample < 128 - 25) {
                        ctx.strokeStyle = 'rgb(200, 200, 0, 0.6)'
                    } 

                    // else if(sample > 128 + 4 || sample < 128 - 4) {
                    //     ctx.strokeStyle = 'rgb(0, 180, 0, 0.5)'
                    // } 
                    
                    else {
                        ctx.strokeStyle = 'rgb(0, 180, 0, 0.3)'
                        // ctx.strokeStyle = 'rgb(50, 50, 50, 0.2)'
                    }

                    
                    ctx.lineTo(i * ctx.canvas.width / audioBufferLength, sample / 2 + offsetY)
                    ctx.stroke()
                    ctx.beginPath()
                    ctx.moveTo(i * ctx.canvas.width / audioBufferLength, sample / 2 + offsetY)
                }
                ctx.stroke()
            }

            function drawAudioFreq(ctx, offsetX, offsetY) {
                analyser.getByteFrequencyData(frequencyDomainBuffer)

                var sum = 0
                for(var i = 0; i < analyser.frequencyBinCount; i++) {
                    var sample = 1.0 * frequencyDomainBuffer[i]
                    sum += sample
                }
                var average = sum / analyser.frequencyBinCount

                ctx.lineWidth = ctx.canvas.width / nSamples
                if(clipped) {
                    ctx.strokeStyle = 'rgb(150, 250, 150, 0.1)'
                } else {
                    ctx.strokeStyle = 'rgb(150, 250, 150, 0.3)'
                }
                
                var nSamples = 0.1 * analyser.frequencyBinCount
                for(var i = 0; i < nSamples; i++) {
                    ctx.beginPath()
                    var sample = 1.0 * frequencyDomainBuffer[i]
                    ctx.moveTo(i * ctx.canvas.width / nSamples, offsetY + 128)
                    ctx.lineTo(i * ctx.canvas.width / nSamples, -sample / 2 + offsetY + 128)
                    ctx.stroke()
                }
            }

            function processFrame(timestamp) {
                if(timestamp < lastFrameAt + (1000.0 / fps)) {
                    window.requestAnimationFrame(processFrame)
                    return
                }

                lastFrameAt = timestamp

                
                var w = c1.canvas.width
                var h = c1.canvas.height

                drawAudioTime(c2, 0, scale * h - 32)
                drawAudioFreq(c2, 0, scale * h + 32)

                var d = srcSettings.width - srcSettings.height
                
                c1.drawImage(video, d / 2, 0, srcSettings.width - d, srcSettings.height, 0, 0, w, h)
                var frame = c1.getImageData(0, 0, w, h)

                var nPixels = frame.data.length / 4
                for(var i = 0; i < nPixels; i++) {
                    var r = frame.data[i * 4 + 0]
                    var g = frame.data[i * 4 + 1]
                    var b = frame.data[i * 4 + 2]

                    var average = ((r + g + b) / 3) >> 5 << 5
                    var twidle = 25
                    var ratio1 = 1.2
                    var ratio2 = 1.9
                    var boost = 2
                    var blur = 220

                    if(r * ratio1 > g + b + twidle) {
                        frame.data[i * 4 + 0] = boost * average 
                        frame.data[i * 4 + 1] = 0
                        frame.data[i * 4 + 2] = 0
                        frame.data[i * 4 + 3] = blur
                    }
                    
                    else if (g * ratio1 > r + b + twidle) {
                        frame.data[i * 4 + 0] = 0
                        frame.data[i * 4 + 1] = boost * average 
                        frame.data[i * 4 + 2] = 0
                        frame.data[i * 4 + 3] = blur
                    }
                    
                    else if (b * ratio1 > r + g + twidle) {
                        frame.data[i * 4 + 0] = 0 
                        frame.data[i * 4 + 1] = 0 
                        frame.data[i * 4 + 2] = boost * average
                        frame.data[i * 4 + 3] = blur
                    }
                    
                    else if (b + r > ratio2 * g + twidle) {
                        frame.data[i * 4 + 0] = 1.5 * average
                        frame.data[i * 4 + 1] = 0 
                        frame.data[i * 4 + 2] = 1.5 * average
                        frame.data[i * 4 + 3] = blur
                    }
                    
                    else if (b + g > ratio2 * r + twidle) {
                        frame.data[i * 4 + 0] = 0
                        frame.data[i * 4 + 1] = 1.5 * average 
                        frame.data[i * 4 + 2] = 1.5 * average
                        frame.data[i * 4 + 3] = blur
                    }
                    
                    else if (r + g > ratio2 * b + twidle) {
                        frame.data[i * 4 + 0] = 1.5 * average
                        frame.data[i * 4 + 1] = 1.5 * average 
                        frame.data[i * 4 + 2] = 0
                        frame.data[i * 4 + 3] = blur
                    } 

                    else {
                        frame.data[i * 4 + 0] = average 
                        frame.data[i * 4 + 1] = average 
                        frame.data[i * 4 + 2] = average
                        frame.data[i * 4 + 3] = blur
                    }
                }

                c1.putImageData(frame, 0, 0)
                c2.drawImage(c1.canvas, 0, 0, w, h, 0, 0, w * scale, h * scale)

                window.requestAnimationFrame(processFrame)
            }
   
        </script>
    </html>
`