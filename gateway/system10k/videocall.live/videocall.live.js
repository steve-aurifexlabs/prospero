'Requires: node v12.x, ws, postmark, stripe'

'node dependencies'
var http = require('http')
var url = require('url')
var fs = require('fs')
var crypto = require('crypto')
var process = require('process')
// var child_process = require('child_process')

'npm dependencies'
var ws = require('ws')
var postmark = new (require('postmark').ServerClient)('')
// later: stripe

'constants'
var domain = 'https://videocall.live'
var durablePath = process.env.HOME + '/videocall.live/data/'
var reservedRoutes = ['/privacy', '/terms', '/security', '/about']

'ephemerals'
var emailAuthCodes = {}
var teamActiveConnections = {}

'durables'
var sessions = loadSessions()

'start'
process.title = 'videocall.live'
var server = http.createServer(handleRequest)
var webSocketServer = new ws.Server({ server: server })
// webSocketServer.on('connection', handleWebSocketConnection)
server.listen(8090)
console.log('Started videocall.live server on port 8090.')

'handleRequest'
function handleRequest(req, res) {
    if(req.method == 'GET' && req.url == '/network') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(pages.network)
        return
    }

    if(req.method == 'GET' && req.url == '/app') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(pages.app)
        return
    }
    
    if(req.method == 'GET' && req.url == '/networking/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' })
        res.end('')
        return
    }

    if(req.method == 'GET' && !reservedRoutes.includes(req.url) && !req.url.startsWith('/api/')) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(pages.index)
        return
    }

    console.log('')
    console.log(req.method, req.url, 'at', new Date())
    console.log(req.connection.remoteAddress, req.headers['user-agent'])

    var arguments = JSON.parse(JSON.stringify(url.parse(req.url, true).query))
    console.log(arguments)

    if(req.method == 'POST' && req.url.startsWith('/api/call?')) {
        var email = arguments.email

        if(!validEmail(email)) {
            res.writeHead(400)
            res.end()
        }

        else {
            var code = genCode()
            var link = domain + '/' + code

            postmark.sendEmail({
                From: 'contact@aurifexlabs.com',
                To: email,
                Subject: 'Ring... Ring... You have a video call.',
                TextBody: 'Someone is trying to call you using Videocall.Live. Click the link to answer:\n\n' + link + '\n\n- The Videocall.Live Team',
            })

            res.writeHead(200)
            res.end(JSON.stringify({
                code: code,
            }))
        }
    }

    else {
        res.writeHead(404)
        res.end('Resource not found.')
    }
}

function validEmail(email) {
    if(!email || !email.includes('@') || email.length > 254) {
        return false
    }

    return true
}

function genCode() {
    return crypto.randomBytes(4).toString('hex')
}

function loadSessions() {
    return JSON.parse(fs.readFileSync(durablePath + 'sessions.json').toString())
}

function saveSession(sessionId) {
    fs.writeFileSync(durablePath + 'sessions.json', JSON.stringify(sessions, null, 2))
}

var pages = {}

pages.index = `
    <!doctype html>

    <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>Videocall.Live</title>

            <link rel="shortcut icon" type="image/x-icon" href="data:image/x-icon;base64,AAABAAEAICAQAAEABADoAgAAFgAAACgAAAAgAAAAQAAAAAEABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiuyIARN1EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==">    
            
            <style>
                @font-face {
                    font-family: 'Montserrat';
                    font-style: normal;
                    font-weight: 400;
                    font-display: fallback;
                    src: local('Montserrat Regular'), local('Montserrat-Regular'), url('data:image/x-icon;base64,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') format('woff2');
                    unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
                }

                body, button {
                    font-family: "Montserrat", sans-serif;
                }

                input {
                    font-family: sans-serif;
                    font-size: 125%;
                }

                header {
                    text-align: center;
                }

                h2 {
                    text-align: center;
                    margin-top: 150px;
                }

                h3 {
                    text-decoration: underline;
                }

                body > p {
                    max-width: 700px;
                    margin: 20px auto;
                }

                #pricing {
                    display: grid;
                    grid-auto-flow: column;
                    width: 90%;
                    max-width: 1000px;
                    margin: 0 auto;
                }

                #pricing > div {
                    border: 1px solid #888;
                    border-radius: 5px;
                    width: 250px;
                    padding: 20px;
                    margin: 0 auto;
                    text-align: center;
                }

                .price {
                    font-size: 200%;
                    // text-decoration: line-through;
                }

                form {
                    font-size: 150%;
                    border: 1px solid #888;
                    padding: 50px;
                    border-radius: 10px;
                    width: 80%;
                    max-width: 500px;
                    margin: 150px auto;
                }

                form a {
                    display: block;
                    font-size: 125%;
                }

                form p {
                    margin-top: 50px;
                }

                form label {
                    font-size: 75%;
                }
                
                form input {
                    display: block;
                    width: 100%;
                }
                
                form button {
                    font-size: 200%;
                    background-color: #8f8;
                    border-radius: 5px;
                    border: 1px solid #ddd;
                    padding: 10px 20px;
                    display: block;
                    margin: 0 auto;
                    margin-top: 20px;
                    width: 103%;
                }
                
                form button:hover {
                    background-color: #bfb;
                }

                footer {
                    font-size: 75%;
                    text-align: center;
                    margin-top: 150px;
                    margin-bottom: 20px;
                }

                footer > * {
                    display: block;
                    margin: 5px auto;
                }

                footer a {
                    margin: 5px;
                }

                nav {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    display: block;
                }

                nav a {
                    margin: 5px;
                    font-size: 75%;
                }   
            </style>

            <script>
                if(!location.pathname || location.pathname == '/') {
                    var callId = Array.from(crypto.getRandomValues(new Uint8Array(4))).map(function(n) {
                        return (n >> 4).toString(16) + (n & 0x0f).toString(16)                    
                    }).join('')
                    
                    history.pushState({}, '', '/' + callId)
                }
            </script>
        </head>

        <body>
            <header style="font-size: 110%;">
                <h1 style="margin-bottom: 0px;">
                    <span style="color: #2b2">Videocall</span>.<span style="color: #4d4;">Live</span>
                </h1>
                <p style="margin-top: 0px;">Simple 1-on-1 desktop video calling</p>
            </header>

            <form>
                <h2 style="margin-top: 0;">How do I call someone?</h2>
                <p style="margin: 0;">Just share this link with them:</p>
                <script>
                    var link = document.createElement('a')
                    link.textContent = location.href
                    link.setAttribute('href', location.href)
                    document.currentScript.parentNode.appendChild(link)
                    // document.querySelector('form').appendChild(link)
                </script>
                <p>It's that simple.</p>
            </form>

            <h2>How much does it cost?</h2>
            <!--<p>
                For most calls, it's <b style="font-size: 1500%;">free</b>.
                </p>
            </p>-->

            <!--<p>
                For cases where free calling doesn't work, our paid plans use a global network of servers
                to securely relay video traffic. Only the caller pays.
            </p>-->


            <div id="pricing">
            <div>
                <h3>First 5 hours</h2>
                <p class="price">Free</p>
                <p>Try it free.</p>
            </div>

                <div>
                    <h3>50 hours</h2>
                    <p class="price">$1</p>
                    <p>Only the caller pays.</p>
                </div>

                <!-- <div>
                    <h3>Unlimited</h2>
                    <p class="price">$2 / month</p>
                    <p>Free through July 2020</p>
                </div> -->

                <div>
                    <h3>500 hours</h2>
                    <p class="price">$9</p>
                    <p>Only the caller pays.</p>
                </div>
            </div>

            <h2 style="margin-bottom: 0px;">Do I need to install anything?</h2>
            <h2 style="margin-top: 0px;">Does it work on my computer/browser?</h2>
            
            <p>No installation is required; everything runs in the browser. It should work on all major desktop platforms and browsers.</p>
            
            <p>If you are having technical issues, email <a href="mailto:support@aurifexlabs.com">support@aurifexlabs.com</a></p>

            <form>
                <h2 style="margin-top: 0;">Make a call</h2>
                <p style="margin: 0;">Share this link:</p>
                <script>
                    var link = document.createElement('a')
                    link.textContent = location.href
                    link.setAttribute('href', location.href)
                    document.currentScript.parentNode.appendChild(link)
                    // document.querySelectorAll('form').appendChild(link)
                </script>
            </form>

            <footer>
                <p>
                    <a href="/src">Source</a>
                    <a href="/terms-of-service">Terms of Service</a>
                    <a href="/privacy-policy">Privacy Policy</a>
                    <a href="mailto:contact@aurifexlabs.com">Contact</a>
                </p>
                <span>Copyright 2020 Aurifex Labs LLC</span>
            </footer>
            
            <script>
                var forms = Array.from(document.querySelectorAll('form'))
                forms.forEach(function(form) {
                    form.addEventListener('submit', function (event) {
                        event.preventDefault()
            
                        var message = form.querySelector('p[name="message"]')
            
                        var email = form.querySelector('input[name="email"]').value
                        if (!email || !email.includes('@') || email.length > 254) {
                            message.textContent = 'Please enter a valid email address.'
                            return false
                        }
            
                        message.textContent = 'Calling...'
                        fetch('/api/call?email=' + encodeURIComponent(email), {
                            method: 'POST',
                        }).then(function (response) {
                            if (response.ok) {
                                return response.json()
                            }
                            
                            else {
                                message.textContent = 'There was an error. Please try again.'
                            }
                        }).then(function(data) {
                            location.href = '/' + data.code
                        })
            
                        return false
                    })
                })
            </script>
        </body>
    </html>
`

pages.app = `
<!doctype html>

<html lang="en">
    <head>
        <meta charset="utf-8">
        <title>Videocall.Live</title>

        <link rel="shortcut icon" type="image/x-icon" href="data:image/x-icon;base64,AAABAAEAICAQAAEABADoAgAAFgAAACgAAAAgAAAAQAAAAAEABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiuyIARN1EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==">    
        
        <style>
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 400;
                font-display: fallback;
                src: local('Montserrat Regular'), local('Montserrat-Regular'), url('data:image/x-icon;base64,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') format('woff2');
                unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }

            body, button {
                font-family: "Montserrat", sans-serif;
            }

            input {
                font-family: sans-serif;
                font-size: 125%;
            }
             
            button {
                font-size: 200%;
                background-color: #8f8;
                border-radius: 5px;
                border: 1px solid #ddd;
                padding: 10px 20px;
                display: block;
                margin: 0 auto;
                margin-top: 20px;
                width: 200px;
            }
            
            button:hover {
                background-color: #bfb;
            }

            video, canvas {
                margin: 20px;
            }
        </style>
    </head>
    <body>
        <button type="button">Enable camera</button>
        <video id="src" autoplay></video>
        <canvas id="c1" width="320" height="240"></canvas>
        <canvas id="c2" width="320" height="240"></canvas>
        <script>
            var w = 320
            var h = 240

            var button = document.querySelector('button')
            button.addEventListener('click', function() {
                shareVideo()
            })
            
            var video = document.querySelector('video#src')    
            function shareVideo() {
                navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: {
                        width: 320,
                        height: 240,
                    },
                }).then(function(localStream) {
                    video.srcObject = localStream
                    window.requestAnimationFrame(processFrame)
                })
                .catch(function(error) {
                    console.log(error)
                })
            }

            var c1 = document.querySelector('#c1').getContext('2d')
            var c2 = document.querySelector('#c2').getContext('2d')

            function processFrame(timestamp) {
                c1.drawImage(video, 0, 0, w, h)
                var frame = c1.getImageData(0, 0, w, h)

                var nPixels = frame.data.length / 4
                for(var i = 0; i < nPixels; i++) {
                    var r = frame.data[i * 4 + 0]
                    var g = frame.data[i * 4 + 1]
                    var b = frame.data[i * 4 + 2]

                    var average = (r + g + b) / 3

                    frame.data[i * 4 + 0] = average 
                    frame.data[i * 4 + 1] = average 
                    frame.data[i * 4 + 2] = average 
                }

                c2.putImageData(frame, 0, 0)

                window.requestAnimationFrame(processFrame)
            }

        </script>
    </body>
</html>
`


pages.network = `
<!doctype html>

<html lang="en">
    <head>
        <meta charset="utf-8">
        <title>WebRTC Network Diagnostic | Videocall.Live</title>

        <link rel="shortcut icon" type="image/x-icon" href="data:image/x-icon;base64,AAABAAEAICAQAAEABADoAgAAFgAAACgAAAAgAAAAQAAAAAEABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAiuyIARN1EAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAARERERERAAAAAAAAAAAAAAEREREREQAAAAAAAAAAAAABEREREREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==">    
        
        <style>
            @font-face {
                font-family: 'Montserrat';
                font-style: normal;
                font-weight: 400;
                font-display: fallback;
                src: local('Montserrat Regular'), local('Montserrat-Regular'), url('data:image/x-icon;base64,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') format('woff2');
                unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
            }

            body, button {
                font-family: "Montserrat", sans-serif;
            }

            input {
                font-family: sans-serif;
                font-size: 125%;
            }
             
            button {
                font-size: 200%;
                background-color: #8f8;
                border-radius: 5px;
                border: 1px solid #ddd;
                padding: 10px 20px;
                display: block;
                margin: 0 auto;
                margin-top: 20px;
                width: 200px;
            }
            
            button:hover {
                background-color: #bfb;
            }

            video, canvas {
                margin: 20px;
                border: 1px solid #444;
                border-radius: 5px;
            }
        </style>
    </head>
    <body>
        <h1>Networking Diagnostic Tool</h1>

        <div name="set-interval">
            <h2>HTTP - setInterval</h2>
            <p></p>
            <p>134 B overhead/message | 10 messages/second</p>
            <canvas width="800" height="600"></canvas>
        </div>
        
        <div name="request-animation-frame">
            <h2>HTTP - requestAnimationFrame</h2>
            <p></p>
        </div>
        
        <div name="websocket">
            <h2>Websocket</h2>
            <p></p>
        </div>
        
        
        <div name="webrtc">
            <h2>WebRTC</h2>
            <p></p>
        </div>

        <script>
            (function() {
                var setIntervalElement = document.querySelector('div[name="set-interval"] > p')
                var canvas = document.querySelector('div[name="set-interval"] > canvas')
                var ctx = canvas.getContext('2d')
                
                ctx.font = '10px Montserrat'
                ctx.fillStyle = '#ccc'
                ctx.strokeStyle = '#44a'
                
                var x = 0
                var startSweepAt = Date.now()

                setInterval(function() {
                    x += 10
                    if(x > canvas.width) {
                        x = 10
                        startSweepAt = Date.now()
                    }

                    ctx.clearRect(x, 0, 10, canvas.height)

                    for(var i = 0; i < canvas.width; i += 100) {
                        ctx.fillText((i / 100) + 's', i, 12)
                        ctx.fillText((i / 100) + 's', i, canvas.height)

                        ctx.strokeStyle = '#eee'
                        ctx.beginPath()
                        ctx.moveTo(i, 0)
                        ctx.lineTo(i, canvas.height)
                        ctx.closePath()
                        ctx.stroke()
                        ctx.strokeStyle = '#44a'
                    }

                    for(var j = 0; j < canvas.height; j += 100) {
                        ctx.fillText(j + 'ms', 0, canvas.height - j)
                        ctx.fillText(j + 'ms', canvas.width - 35, canvas.height - j)
                    
                        ctx.strokeStyle = '#eee'
                        ctx.beginPath()
                        ctx.moveTo(0, j)
                        ctx.lineTo(canvas.width, j)
                        ctx.closePath()
                        ctx.stroke()
                        ctx.strokeStyle = '#44a'
                    }

                    var requestAt = Date.now()
                    fetch('/networking/ping' + Date.now()).then(function(response) {
                        if(response.ok) {
                            var latency = Math.ceil((Date.now() - requestAt) / 2)
                            
                            setIntervalElement.textContent = latency + 'ms'
                            
                            var a = requestAt - startSweepAt
                            if(a < 0) {
                                a = 0
                            }

                            var b = Date.now() - startSweepAt
                            if(b < 0) {
                                b = 0
                            }

                            // setIntervalElement.textContent = 'a: ' + a + '  b: ' + b                             
                            ctx.beginPath()
                            ctx.moveTo(a / 10, canvas.height - latency)
                            ctx.lineTo(b / 10, canvas.height - latency)
                            ctx.closePath()
                            ctx.stroke()
                        }
                        
                        else {
                            setIntervalElement.textContent = reponse.status
                            
                        }
                    })
                }, 100)
            })()
        </script>
    </body>
</html>
`
