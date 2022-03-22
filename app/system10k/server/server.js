'Requires: node v12.x, postmark, stripe'

'node dependencies'
var http = require('http')
var url = require('url')
var fs = require('fs')
var crypto = require('crypto')
var process = require('process')
var child_process = require('child_process')
var ws = require('ws')

'npm dependencies'
// var postgres = require('pg')
var postmark = new (require('postmark').ServerClient)(process.env.POSTMARK_KEY)
require('isomorphic-fetch')

'Throttling'
//var Throttle = require('throttle');
const { monitorEventLoopDelay } = require('perf_hooks');
const eventLoopMonitor = monitorEventLoopDelay({ resolution: 20 });
eventLoopMonitor.enable();

'constants'
console.log(process.env.STORAGE_PATH)
var durablePath = process.env.STORAGE_PATH + '/data/'
var reportPath = '/var/log/prospero/'
var envPrefix = ''

'ephemerals'
var emailAuthCodes = {}
var teams = {}
var teamActiveConnections = {}
var shortTermMemory = {}
var checksumTables = {}
var unappliedChangeQueues = {}
var runSessions = {}
var debugEmailTimes = {}
var collabDebugErrorsByTeam = {}
var collabDebugReportSentByTeam = {}
var collabDebugLogsByTeam = {}
var collabDebugServerLogsByTeam = {}
var collabDebugRecentFileContents = {}
var collabDebugTimeout = Date.now()
// var storageRemaining = {}
var editTimestamps = {}

var emailsByIP = {}


'durables'
var sessions = loadSessions()

'start db'
// var dbConnection = new postgres.Client({
//     connectionString: process.env.DATABASE_URL,
//     ssl: {
//         ca: fs.readFileSync('./server/ca_cert.crt').toString(),
//         rejectUnauthorized: false,
//     },
// })
// dbConnection.connect()
// dbConnection.query('SELECT NOW()', function(error, response) {
//     console.log('SELECT NOW():', response.rows, 'Date.now()', new Date(Date.now()))
// })

'start'
process.title = 'prospero-server'
var server = http.createServer(handleRequest)

var webSocketServer = new ws.Server({ server: server })
webSocketServer.on('connection', handleWebSocketConnection)

var port = process.argv.slice(-1)[0]
console.log('port:', port)

if(port.length != 4 && port.length != 5) {
    process.exit(1)
}

server.listen(port, '127.0.0.1')
console.log('Started server on port', port)

'handleRequest'
function handleRequest(req, res) {
    // var reqStringA = crypto.randomBytes(2).toString('hex') + '  ' + (new Date()).toString().slice(0, 24) + ': '
    // var reqStringB = ' ' + req.headers["x-real-ip"] + '  ' + req.method + ' ' + req.headers.host + req.url
    // console.log(reqStringA + ' req ' + reqStringB)

    var displayEmail = (emailsByIP[req.headers["x-real-ip"]] || '                ').slice(0, 16)
    var reqStringA = (new Date()).toString().slice(0, 24) + ' ' + req.headers["x-real-ip"] + ' ' + displayEmail + ' ' + crypto.randomBytes(2).toString('hex')
    var reqStringB = req.method.slice(0, 4).padStart(4) + ' ' + req.headers.host + req.url
    console.log(reqStringA + ' req ' + reqStringB)
    

    // console.log(req.headers)
    // console.log('\n#### START REQUEST ####')
    // console.log('Request from:', req.connection.remoteAddress)
    // console.log('Request to:', req.connection.localAddress, req.connection.localPort)
    // console.log(req.method, req.url, 'at', new Date())
    // console.log('with headers:', req.headers)

    // console.log('mem used:', process.memoryUsage())

    var teamId = req.headers.host.slice(0, 4) + req.headers.host.slice(5, 33)
    // console.log('teamId:', teamId)
    
    var urlArgs = JSON.parse(JSON.stringify(url.parse(req.url, true).query))
    // console.log('urlArgs:', urlArgs)
    // console.log('custom log:')

    if(req.method == 'GET' && (req.url == '/' || req.url.startsWith('/?'))) {
       	console.log(reqStringA + ' 200 ' + reqStringB)

       	res.writeHead(200, { 'Content-Type': 'text/html' })
	res.end(fs.readFileSync('./static/app/prospero.html').toString())
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/editor-check?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            console.log(reqStringA + ' 401 ' + reqStringB)
            return
        }

        var storageId = getTeamStorageId(teamId)
        // console.log('storageId:', storageId)     

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
            return
        }

        var checksum = urlArgs.checksum
        if(!checksum) {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
            return
        }

        try {
            var serverChecksum = crc32(fs.readFileSync(durablePath + 'storage/' + storageId + path + filename).toString('utf8'))
        } catch(e) {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
            console.log('    No file:', durablePath + 'storage/' + storageId + path + filename)
            return
        }

        if(!editTimestamps[teamId] || !editTimestamps[teamId][path + filename]) {
            res.writeHead(200)
            res.end()
            console.log(reqStringA + ' 200 ' + reqStringB)
        } 

        else if(serverChecksum != checksum && Date.now() > editTimestamps[teamId][path + filename] + 500) {
            console.log(serverChecksum, checksum, Date.now(), editTimestamps[teamId][path + filename])
            res.writeHead(409)
            res.end()
            console.log(reqStringA + ' 409 ' + reqStringB)
        }

        else {
            res.writeHead(200)
            res.end()
            console.log(reqStringA + ' 200 ' + reqStringB)
        }
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/debug/collab')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            console.log(reqStringA + ' 401 ' + reqStringB)
            return
        }

        var storageId = getTeamStorageId(teamId)
        // console.log('storageId:', storageId)     

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
            return
        }

        var body = ''
        req.on('data', function(chunk) {
            body += chunk.toString('binary')

            if(body.length > 1e8) {
                res.writeHead(400)
                res.end()
                console.log(reqStringA + ' 400 ' + reqStringB)
            }
        })

        req.on('end', function() {
            var data
            try {
                data = JSON.parse(body)
            } catch(e) {
                res.writeHead(400)
                res.end()
                console.log(reqStringA + ' 400 ' + reqStringB)
                return
            }

            try {
                var fileContents = fs.readFileSync(durablePath + 'storage/' + storageId + path + filename).toString('binary')
            } catch(e) {
                console.log('No file:', durablePath + 'storage/' + storageId + path + filename)
                res.writeHead(400)
                res.end()
                console.log(reqStringA + ' 400 ' + reqStringB)
                return
            }

            if(!collabDebugLogsByTeam[teamId]) {
                collabDebugLogsByTeam[teamId] = []
            }
            collabDebugLogsByTeam[teamId].push({
                from: email,
                logData: data.log,
                fileContents: data.value,
            })
            collabDebugLogsByTeam[teamId].push({
                from: 'server',
                logData: collabDebugServerLogsByTeam[teamId],
                fileContents: fileContents,
            })

            collabDebugServerLogsByTeam[teamId] = []


            if(!collabDebugRecentFileContents[teamId]) {
                collabDebugRecentFileContents[teamId] = {}
            }
            collabDebugRecentFileContents[teamId][email] = data.value

            if(collabDebugLogsByTeam[teamId].length > 30) {
                collabDebugLogsByTeam[teamId] = collabDebugLogsByTeam[teamId].slice(1)
            }

            if(data.value != fileContents) {
                console.log('Not so good...')
                // console.log(data.value, fileContents)

                if(!collabDebugErrorsByTeam[teamId]) {
                    collabDebugErrorsByTeam[teamId] = 3
                } else {
                    collabDebugErrorsByTeam[teamId] += 3
                }
            } else {
                // console.log('Looks good!')

                if(!collabDebugErrorsByTeam[teamId]) {
                    collabDebugErrorsByTeam[teamId] = 0
                } else {
                    collabDebugErrorsByTeam[teamId] -= 1
                }
                
                if(collabDebugErrorsByTeam[teamId] < 0) {
                    collabDebugErrorsByTeam[teamId] = 0
                }
            }

            if(collabDebugErrorsByTeam[teamId] > 160 && !collabDebugReportSentByTeam[teamId] && Date.now() > collabDebugTimeout) {
                console.log('Ugh oh! Bad!')
                
                collabDebugTimeout = Date.now() + 2 * 60 * 1000

                var debugData = {
                    from: email,
                    teamId: teamId,
                    at: new Date(),
                    clientsFileContents: collabDebugRecentFileContents[teamId],
                    serverFileContents: fileContents,
                    log: collabDebugLogsByTeam[teamId],
                }


                
                // console.log(Buffer.from(JSON.stringify(debugData, null, 2)).toString('base64'))

                var now = (new Date()).toString()

                var reportFilename = 'debug-' + teamId + '-' + now + '.json'
                var linkUrl = 'https://' + req.headers.host + '/debug/collab/report?filename=' + encodeURIComponent(reportFilename)

                postmark.sendEmail({
                    From: 'Prospero.Live <auth@prospero.live>',
                    To: 'steve@aurifexlabs.com',
                    Subject: 'Collab Debug Report',
                    TextBody: 'Team: ' + teamId + '\n\nFrom: ' + email + '\n\nAt: ' + now + '\n\n' + linkUrl,
                    // Attachments: [
                    //     {
                    //         Name: 'debug-' + teamId.slice(0, 4) + '-' + now + '.json',
                    //         ContentType: 'application/json',
                    //         Content: Buffer.from(JSON.stringify(debugData, null, 2)).toString('base64'),
                    //     }
                    // ]
                })

                
                fs.writeFile(reportPath + reportFilename, JSON.stringify(debugData, null, 2), function(error) {
                    console.log('report write error:', error)
                })

                res.writeHead(409)
                res.end()
                console.log(reqStringA + ' 409 ' + reqStringB)
                return

                // collabDebugReportSentByTeam[teamId] = true
            }

            res.writeHead(200)
            res.end()
            console.log(reqStringA + ' 200 ' + reqStringB)
        })
    }

    else if(req.method == 'GET' && req.url.startsWith('/debug/collab/report-data?')) {
        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
            return
        }

        res.writeHead(200, { 'Content-Type': 'application/json' })
        
        var stream = fs.createReadStream(reportPath + filename)

        stream.on('close', function() {
            res.end()
            console.log(reqStringA + ' 200 ' + reqStringB)
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url.startsWith('/run/')) {
        var sessionId

        var runSessionUrlPrefix = req.headers.host.slice(0, 32)

        if(req.headers.cookie) {
            var cookies = req.headers.cookie.split(';')
            cookies.forEach(function(cookie) {
                var key = cookie.split('=')[0]
                var value = cookie.split('=')[1]
                if(key == '_prospero_live_run_session_id') {
                    sessionId = value
                }
            })
        }

        var runSession = runSessions[runSessionUrlPrefix]

        // console.log(runSession, sessionId, runSessions)

        if(sessionId && runSession && sessionId == runSession.runSessionId) {
            var filepath = durablePath + 'storage/' + runSession.team + decodeURIComponent(req.url.slice(4))
            // console.log(filepath)
            
            try {
                if(filepath.slice(-3) == '.js') {
                	var fileContents = fs.readFileSync(filepath).toString()
			res.writeHead(200, { 'Content-Type': 'application/javascript' })
		}
                else if(filepath.slice(-4) == '.png') {
	                var fileContents = fs.readFileSync(filepath)
			res.writeHead(200, { 'Content-Type': 'image/png' })
		}
		else {
	                var fileContents = fs.readFileSync(filepath).toString()
			res.writeHead(200)
		}
                res.end(fileContents)
                console.log(reqStringA + ' 200 ' + reqStringB)
            } catch(e) {
                res.writeHead(404)
                res.end()
                console.log(reqStringA + ' 404 ' + reqStringB)
            }

            return
        }

        var otp = urlArgs.otp
        if(!otp || otp.length != 64) {
            res.writeHead(400)
            res.end()
            return
        }
        
        if(!runSession || runSession.runSessionOtp != otp) {
            res.writeHead(400)
            res.end()
            return
        }
        
        delete runSession.runSessionOtp
        var runSessionId = crypto.randomBytes(32).toString('hex')
        runSession.runSessionId = runSessionId

        res.writeHead(301, {
            'Set-Cookie': '_prospero_live_run_session_id=' + runSessionId + '; Secure; HttpOnly',
            'location': req.url.split('?')[0],
        })
        res.end()
    }

    else if(req.method == 'GET' && req.url == '/auth/start') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/auth/index.html').toString())
    }
    
    else if(req.method == 'GET' && req.url == '/auth/email-verification') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/auth/email-verification.html').toString())
    }


    else if(req.method == 'GET' && req.url == '/averiasanslibre.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' })
        
        var stream = fs.createReadStream('./fonts/averiasanslibre.woff2')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/fonts/hindmadurai.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' })
        
        var stream = fs.createReadStream('./static/fonts/hindmadurai.woff2')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }
    
    else if(req.method == 'GET' && req.url == '/static/fonts/nunito.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' })
        
        var stream = fs.createReadStream('./static/fonts/nunito.woff2')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/fonts/inconsolata-extended.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' })
        
        var stream = fs.createReadStream('./static/fonts/inconsolata-extended.woff2')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/fonts/inconsolata.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' })
        
        var stream = fs.createReadStream('./static/fonts/inconsolata.woff2')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/fonts/cousine-extended.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' })
        
        var stream = fs.createReadStream('./static/fonts/cousine-extended.woff2')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/fonts/cousine.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' })
        
        var stream = fs.createReadStream('./static/fonts/cousine.woff2')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/footer.jpg') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' })
        
        var stream = fs.createReadStream('./static/images/footer.jpg')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/epaper.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/images/epaper.png')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/favicon.ico') {
        res.writeHead(200, { 'Content-Type': 'image/x-icon' })
        
        var stream = fs.createReadStream('./static/images/favicon.ico')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/audio/bell.ogg') {
        res.writeHead(200, { 'Content-Type': 'audio/ogg' })
        
        var stream = fs.createReadStream('./static/audio/bell.ogg')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/css/prospero.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(fs.readFileSync('./static/app/prospero.css').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/css/theme.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(fs.readFileSync('./static/css/theme.css').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/index.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/auth/index.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/prospero.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end('var envPrefix = "' + envPrefix + '"\n\n' + fs.readFileSync('./static/app/prospero.js').toString())
    }
    
    else if(req.method == 'GET' && req.url == '/static/javascript/helpers.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/helpers.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/collab-editor.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/collab-editor.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/editor-wrapper.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/editor-wrapper.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/filesystem.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/filesystem.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/payment.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/payment.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/tabs.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/tabs.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/ui.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/ui.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/video-conference.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/video-conference.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/collab-test.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/collab-test.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/whiteboard.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/whiteboard/whiteboard.js').toString())
    }

    else if(req.method == 'GET' && req.url.startsWith('/debug/collab/report?')) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/app/report/report.html').toString())
    }

    else if(req.method == 'GET' && req.url == '/debug/collab/render.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/app/report/render.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/images/blackpen.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/app/whiteboard/blackpen.png')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/bluepen.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/app/whiteboard/bluepen.png')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/eraser.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/app/whiteboard/eraser.png')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/graypen.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/app/whiteboard/graypen.png')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/greenpen.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/app/whiteboard/greenpen.png')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/redpen.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/app/whiteboard/redpen.png')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/whitepen.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/app/whiteboard/whitepen.png')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/email-verification.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/auth/email-verification.js').toString())
    }

    else if(req.method == 'GET' && req.url.startsWith('/lib/codemirror/codemirror.js')) {
        res.writeHead(200, { 'Content-Type': 'text/javascript' })
        res.end(fs.readFileSync('./static/app/lib/CodeMirror-minified-master/lib/codemirror.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/lib/codemirror/syntax.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        
	var syntax =
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/fold/xml-fold.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/dialog/dialog.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/mode/simple.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/search/searchcursor.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/search/search.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/search/jump-to-line.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/search/matchesonscrollbar.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/edit/matchbrackets.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/edit/closebrackets.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/edit/matchtags.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/edit/trailingspace.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/edit/closetag.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/comment/comment.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/fold/foldcode.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/fold/foldgutter.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/mode/overlay.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/hint/show-hint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/hint/javascript-hint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/hint/xml-hint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/hint/html-hint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/hint/css-hint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/hint/anyword-hint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/hint/sql-hint.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/search/match-highlighter.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/selection/mark-selection.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/selection/active-line.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/mode/loadmode.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/meta.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/comment/continuecomment.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/display/placeholder.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/scroll/annotatescrollbar.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/display/panel.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/wrap/hardwrap.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/scroll/scrollpastend.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/lint/lint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/lint/html-lint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/lint/json-lint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/lint/javascript-lint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/lint/coffeescript-lint.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/addon/lint/css-lint.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/apl/apl.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/clike/clike.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/clojure/clojure.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/cmake/cmake.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/cobol/cobol.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/coffeescript/coffeescript.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/commonlisp/commonlisp.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/css/css.js').toString() +
		
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/dart/dart.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/diff/diff.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/django/django.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/dockerfile/dockerfile.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/forth/forth.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/fortran/fortran.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/go/go.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/haskell/haskell.js').toString() +
		
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/htmlmixed/htmlmixed.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/javascript/javascript.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/jinja2/jinja2.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/jsx/jsx.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/julia/julia.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/lua/lua.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/markdown/markdown.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/nginx/nginx.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/pascal/pascal.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/pegjs/pegjs.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/perl/perl.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/php/php.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/powershell/powershell.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/python/python.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/r/r.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/ruby/ruby.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/rust/rust.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/sass/sass.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/scheme/scheme.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/shell/shell.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/smalltalk/smalltalk.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/sparql/sparql.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/sql/sql.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/swift/swift.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/tcl/tcl.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/vb/vb.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/verilog/verilog.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/vhdl/vhdl.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/vue/vue.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/xml/xml.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/yaml/yaml.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/mode/z80/z80.js').toString() +

		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/keymap/sublime.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/keymap/emacs.js').toString() +
		fs.readFileSync('./static/app/lib/CodeMirror-minified-master/keymap/vim.js').toString()
		

		// fs.readFileSync('./static/app/lib/syntax.js').toString()

	res.end(syntax)
    }

    else if(req.method == 'GET' && req.url.startsWith('/lib/codemirror/codemirror.css')) {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(fs.readFileSync('./static/app/lib/CodeMirror-minified-master/lib/codemirror.css').toString())
    }
    
    else if(req.method == 'GET' && req.url.startsWith('/lib/codemirror/theme/vscode-dark.css')) {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(fs.readFileSync('./static/app/lib/CodeMirror-minified-master/theme/vscode-dark.css').toString())
    }

	else if(req.method == 'GET' && req.url.startsWith('/lib/sublime-cm.js')) {
        res.writeHead(200, { 'Content-Type': 'text/javascript' })
        res.end(fs.readFileSync('./static/app/lib/sublime-cm.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/status') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/status.html').toString())
    }

    else if(req.method == 'GET' && req.url == '/status-endpoint') {
        fetch('https://' + envPrefix + 'gateway.prosperodev.live/status-endpoint', {
            headers: {
                Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
            },
        }).then(function(response) {
            res.writeHead(response.status)
            res.end()
        }).catch(function(error) {
            res.writeHead(400)
            res.end()
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/auth/start')) {
        var email = urlArgs.email

        if(!validEmail(email)) {
            res.writeHead(400)
            res.end()
        }

        else if(emailAuthCodes[email]) {
            if(Date.now() < emailAuthCodes[email].resendAt) {
                res.writeHead(400)
                res.end()
            }

            else {
                sendAuthCode(email)
            }
        }

        else {
            sendAuthCode(email)
        }

        function sendAuthCode(email) {
            var code = crypto.randomBytes(4).toString('hex')

            emailAuthCodes[email] = {
                code: code,
                expiresAt: Date.now() + 20 * 60 * 1000,
                resendAt: Date.now() + 25 * 1000,
                failedAttempt: false,
            }

            postmark.sendEmail({
                From: 'Prospero.Live <auth@prospero.live>',
                To: email,
                Subject: 'Your Requested Authentication Code for Team ' + teamId.slice(0, 4),
                TextBody: 'Your authentication code for Team ' + teamId.slice(0, 4) + ' is: \n\n' + code + '\n\n- Prospero.Live',
            })

            res.writeHead(200)
            res.end()
        }
    }

    else if(req.method == 'POST' && req.url.startsWith('/auth/email-auth')) {
        var email = urlArgs.email
        var code = urlArgs.code

        if(!validEmail(email)) {
            res.writeHead(400)
            res.end()
        }

        else if(!code || code.length != 8) {
            res.writeHead(400)
            res.end()
        }

        else if(!emailAuthCodes[email]) {
            res.writeHead(400)
            res.end()
        }

        else if(!emailAuthCodes[email].code || !emailAuthCodes[email].expiresAt) {
            res.writeHead(400)
            res.end()
        }

        else if(Date.now() > emailAuthCodes[email].expiresAt) {
            res.writeHead(400)
            res.end()
        }

        else if(code != emailAuthCodes[email].code) {
            emailAuthCodes[email].failedAttempt = true

            res.writeHead(400)
            res.end()
        }

        else if(emailAuthCodes[email].failedAttempt) {
            res.writeHead(400)
            res.end()
        }

        else {
            delete emailAuthCodes[email]

            fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/auth?email=' + encodeURIComponent(email) + '&team=' + encodeURIComponent(teamId), {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
                },
            }).then(function(response) {
                if(response.ok) {
                    return response.json()
                } else {
                    res.writeHead(400)
                    res.end()
                }
            }).then(function(data) {
                var creator = data.creator
                var other = data.other
                var third = data.third
            // })

            // var pgQuery = "SELECT * FROM teams WHERE teamId = $1 AND (creator = $2 OR other = $2)"

            // dbConnection.query(pgQuery, [teamId, email], function(error, response) {
                // console.log(error, response)

                // if(error) {
                //     res.writeHead(400)
                //     res.end()
                //     return
                // }
                    
                // if(response.rows.length < 1) {
                //     res.writeHead(400)
                //     res.end()
                //     return
                // }

                // var creator = response.rows[0].creator
                // var other = response.rows[0].other

                // teams[teamId] = {
                //     creator: creator,
                //     other: other,
                // }

                try {
                    fs.mkdirSync(durablePath + 'storage/' + getTeamStorageId(teamId))
                } catch(e) {    

                }

                var sessionId = crypto.randomBytes(32).toString('hex')
                
                if(!sessions[teamId]) {
                    sessions[teamId] = {}
                }

                var expiresAt = Date.now() + 13 * 60 * 60 * 1000
                sessions[teamId][sessionId] = {
                    email: email,
                    expiresAt: expiresAt,
                }

                saveSession(sessionId)
                
                res.writeHead(200, { 'Content-Type': 'application/json'})
                res.end(JSON.stringify({
                    sessionId: sessionId,
                    expiresAt: expiresAt,
                }))
            })
        }
    }

    else if(req.method == 'POST' && req.url.startsWith('/auth/check-otp')) {
        var otp = urlArgs.otp

        if(!otp) {
            res.writeHead(400)
            res.end()
        }

        else {
            fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/check-otp?otp=' + encodeURIComponent(otp) + '&team=' + encodeURIComponent(teamId), {
                method: 'POST',
                headers: {
                    Authorization: 'Bearer None',
                },
            }).then(function(response) {
                if(response.ok) {
                    return response.json()
                } else {
                    res.writeHead(400)
                    res.end()
                }
            }).then(function(data) {
		//if(!data || !data.email) {
		//	res.writeHead(400)
                //	res.end()
		//}


                var email = data.email
                //var creator = data.creator
                //var other = data.other
                //var third = data.third
           
                try {
                    fs.mkdirSync(durablePath + 'storage/' + getTeamStorageId(teamId))
                } catch(e) {    

                }

                var sessionId = crypto.randomBytes(32).toString('hex')
                
                if(!sessions[teamId]) {
                    sessions[teamId] = {}
                }

                var expiresAt = Date.now() + 13 * 60 * 60 * 1000
                sessions[teamId][sessionId] = {
                    email: email,
                    expiresAt: expiresAt,
                }

                saveSession(sessionId)
                
                res.writeHead(200, { 'Content-Type': 'application/json'})
                res.end(JSON.stringify({
                    sessionId: sessionId,
                    expiresAt: expiresAt,
                }))
            })
        }
    }

    else if(req.method == 'GET' && req.url == '/auth/check') {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/auth?email=' + encodeURIComponent(email) + '&team=' + encodeURIComponent(teamId), {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ',
            },
        }).then(function(response) {
            if(response.ok) {
                return response.json()
            } else {
                res.writeHead(response.status)
                res.end()
                console.log(reqStringA, response.status, reqStringB)
            }
        }).then(function(data) {
            var user = {
                email: email,
                creator: false,
            }

            var rest

            if(email == data.creator) {
                user.creator = true
                user.color = '#6800A8'
                rest = [{
                    email: data.other,
                    color: '#A85700',
                }]

                if(data.third) {
                    rest.push({
                        email: data.third,
                        color: '#00A85F',
                    })
                }
            } else if(email == data.other) {
                user.color = '#A85700'
                rest = [{
                    email: data.creator,
                    color: '#6800A8',
                    creator: true,
                }]

                if(data.third) {
                    rest.push({
                        email: data.third,
                        color: '#00A85F',
                    })
                }
            } else if(email == data.third) {
                user.color = '#00A85F'
                rest = [{
                    email: data.creator,
                    color: '#6800A8',
                    creator: true,
                }, {
                    email: data.other,
                    color: '#A85700',
                }]
            } else {
                res.writeHead(400)
                res.end()
                return
            }


	    if(data.third) {
		    var newProjectPath = durablePath + 'storage/' + teamId
		    var isEmpty = fs.readdirSync(newProjectPath).length === 0

		    var originalProjectId = data.third.split(':')[1]
		    var snapshotTime = data.third.split(':')[2]

		    var originalProjectPath = process.env.STORAGE_PATH + '/backups/' + snapshotTime + '/data/storage/'  + originalProjectId

	            if(data.third.startsWith('snapshot:') && isEmpty) {
	 		child_process.exec('cp -r ' + originalProjectPath + ' ' + newProjectPath, function(error, stdout, stderr) {
				if(error) {
					console.error(error)
				}

				console.log(stdout)
				console.error(stderr)
			})
		    }
	    }

	    res.writeHead(200)
	    res.end(JSON.stringify({
	        user: user,
	        rest: rest,
		third: '',
	    }))



            // console.log(reqStringA + ' 200 ' + reqStringB)
        })

    }

    else if(req.method == 'GET' && req.url == '/team') {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }


    
        res.writeHead(200)
        res.end()
    }

    else if(req.method == 'POST' && req.url == '/auth/logout') {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var sessionId = req.headers.authorization.slice(7)
        delete sessions[teamId][sessionId]

        saveSession(sessionId)

        res.writeHead(200)
        res.end()
    }
/*
    else if(req.method == 'GET' && req.url.startsWith('/user/storage')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/storage/user?email=' + encodeURIComponent(email), {
            headers: {
                Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
            },
        }).then(function(response) {
            if(response.ok) {
                return response.json()
            } else {
                res.writeHead(400)
                res.end()
            }
        }).then(function(data) {
            // console.log(data)
            // console.log('limit:', data.limit, 'storage:', data.storage)

            res.writeHead(200)
            res.end(JSON.stringify({
                limit: data.limit,
                storage: data.storage,
            }))
        })
    }
*/
    else if(req.url.startsWith('/api/fs/')) {
        handleFileSystemRequest(req, res, reqStringA, reqStringB)
    }
    
    else if(req.method == 'POST' && req.url.startsWith('/api/run/start-run-session?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var runSessionUrlPrefix = crypto.randomBytes(16).toString('hex')
        var runSessionOtp = crypto.randomBytes(32).toString('hex')

        // Store session id
        runSessions[runSessionUrlPrefix] = {
            team: teamId,
            path: path,
            runSessionOtp: runSessionOtp,
            expiresAt: new Date(Date.now() + 1000 * 60 * 40),
        }

        res.writeHead(200)
        res.end(JSON.stringify({
            runSessionOtp: runSessionOtp,
            runSessionUrlPrefix: runSessionUrlPrefix,
        }))

        // console.log(runSessions)
    }

    else {
        res.writeHead(404)
        res.end('Resource not found.')
    }
}

'handleWebSocketConnection'
function handleWebSocketConnection(webSocket) {
    console.log('new websocket connected')

    var authenticated = false
    var email
    var teamId

    webSocket.on('message', function(messageJSON) {
        // console.log(messageJSON)

        try {
            var message = JSON.parse(messageJSON)
        } catch(e) {
            // console.log(email, '| webSocket: Invalid message JSON:', messageJSON)
            console.log('webSocket: Invalid message JSON')
            return
        }

        if(message.type == 'authorization') {
            var authorizationRequestObject = {
                headers: {
                    authorization: message.authorization,
                    host: message.team.slice(0, 4) + '-' + message.team.slice(4, 32),
                }
            }

            email = authenticate(authorizationRequestObject)

            // console.log('auth email:', email)

            if(!email) {
                // webSocket.destroy()
                return
            }

            authenticated = true
            teamId = message.team

            if(teamActiveConnections[teamId] === undefined) {
                teamActiveConnections[teamId] = {}
            }

            // if(teamActiveConnections[teamId][email] !== undefined) {
                // webSocket.destroy()
                // return
            // }

            teamActiveConnections[teamId][email] = webSocket
            
            webSocket.send(JSON.stringify({
                type: 'authenticated',
                value: true,
                onlineTeam: Object.keys(teamActiveConnections[teamId]),
            }))

            Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
                var peerWebSocket = teamActiveConnections[teamId][peerEmail]
                if(peerEmail != email) {
                    peerWebSocket.send(JSON.stringify({
                        type: 'joined',
                        email: email,
                    }))
                }
            })

            updateStorage(email, teamId)

            return
        }

        else if(!authenticated) {
            return
        }

        // console.log(message)

        if(message.type == 'ping') {
            webSocket.send(JSON.stringify({
                type: 'pong',
                pingTime: message.time,
                time: Date.now(),
            }))
        }

        else {
            // console.log(message)
        }

        if(message.type == 'set-active-tab') {
            Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
                // try {
                    var peerWebSocket = teamActiveConnections[teamId][peerEmail]
                    if(peerEmail != email) {
                        peerWebSocket.send(JSON.stringify({
                            type: 'set-active-tab',
                            email: email,
                            tab: message.tab,
                        }))
                    }
                // } catch(e) {
                    // console.log(e)
                // }
            })
        }

        if(message.type == 'editor-changes') {
            applyChange(message, true)
        }

        if(message.type == 'cursor-position') {
            var path = message.filepath
            var filename = message.filename

        }

        if(message.type == 'position') {
            Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
                // try {
                    var peerWebSocket = teamActiveConnections[teamId][peerEmail]
                    if(peerEmail != email) {
                        peerWebSocket.send(JSON.stringify({
                            type: 'set-position',
                            email: email,
                            line: message.line,
                            ch: message.ch,
                        }))
                    }
                // } catch(e) {
                    // console.log(e)
                // }
            })
        }

        if(message.type == 'relay') {
            try {
                teamActiveConnections[teamId][message.to].send(JSON.stringify({
                    message: message.message,
                    from: email,
                    type: 'relay',
                }))
            } catch(e) {
                console.log('relay error', e)
            }
        }

        if(['lead', 'precall', 'offer', 'answer', 'iceCandidate'].includes(message.type)) {
        // else if(['offer', 'answer'].includes(message.type)) {
            try {
                teamActiveConnections[teamId][message.to].send(messageJSON)
            } catch(e) {
                console.log('webrtc handshake error', e)
            }
        }

        if(message.type == 'getOnlineTeam') {
            webSocket.send(JSON.stringify({
                type: 'onlineTeam',
                onlineTeam: Object.keys(teamActiveConnections[teamId]),
            }))
        }

        // else {
            // console.log(email, '| webSocket: Unknown message type:', message.type, 'message:', message)
        // }

        function applyChange(message, isRealMessage) {
            if(!collabDebugServerLogsByTeam[teamId]) {
                collabDebugServerLogsByTeam[teamId] = []
            }
            var collabDebugLog = collabDebugServerLogsByTeam[teamId]





            if(isRealMessage) {
                // console.log('\n\n\n----------------------------------\nRECEIVED CHANGE MESSAGE\n')
            }
            
            else {
                // console.log('\n\n\n----------------------------------\nAPPLYING MESSAGE FROM QUEUE\n')
            }


            // collabDebugLog.push(JSON.parse(JSON.stringify({ type: 'server-start-applyChange' })))
            // collabDebugLog.push(JSON.parse(JSON.stringify(message)))
            // console.log('message:', message)

            // var delta = message.change.text.length - (message.change.to - message.change.from)
            // if(storageRemaining[email] === undefined || storageRemaining[email] < delta) {
            //     res.writeHead(400)
            //     res.end()
            //     return
            // }

            var path = message.filepath
            var filename = message.filename


            if(!editTimestamps[teamId]) {
                editTimestamps[teamId] = {}
            }

            editTimestamps[teamId][path + filename] = Date.now()
        
            var storageId = getTeamStorageId(teamId)
            var fullPath = durablePath + 'storage/' + storageId + path + filename
        
            collabDebugLog.push(JSON.parse(JSON.stringify({
                path: path,
                filename: filename,
                storageId: storageId,
                fullPath: fullPath,
            })))

            var contents
            try {
                contents = fs.readFileSync(fullPath).toString()
            } catch(error) {
                console.log('SEVERE Edit failed - read error', fullPath, error)
                
                // send(teamId, 'all', {
                //     type: 'change-confirmation',
                //     success: false,
                //     reason: 'server-error',
                //     path: path,
                //     filename: filename,
                // })
            
                return
            }
        
            // collabDebugLog.push(JSON.parse(JSON.stringify(contents)))
            // console.log('CHANGES', message.changes)
            // console.log(contents.slice(0, 500).toString(), contents.slice(-500, -1).toString())
            
            var checksumTable = checksumTables[fullPath]
            var unappliedChangeQueue = unappliedChangeQueues[fullPath]

            // collabDebugLog.push(JSON.parse(JSON.stringify(checksumTable)))
            // collabDebugLog.push(JSON.parse(JSON.stringify(unappliedChangeQueue)))
            
            // collabDebugLog.push(JSON.parse(JSON.stringify(shortTermMemory[fullPath])))
            // Add to checksumTable
            if(!shortTermMemory[fullPath]) {
                shortTermMemory[fullPath] = [{
                    checksum: crc32(contents.toString('binary')),
                    contents: contents,
                }]
            }
            // collabDebugLog.push(JSON.parse(JSON.stringify(shortTermMemory[fullPath])))
            
            
            // collabDebugLog.push(JSON.parse(JSON.stringify(checksumTable)))
            if(!checksumTable) {
                checksumTables[fullPath] = {}
                checksumTable = checksumTables[fullPath]
                
                checksumTable[crc32(contents.toString('binary'))] = {
                    index: 0,
                    contents: contents,
                    // historyEntry: shortTermMemory[fullPath][0],
                }
            }
            // collabDebugLog.push(JSON.parse(JSON.stringify(checksumTable)))
            
            if(unappliedChangeQueue === undefined) {
                unappliedChangeQueues[fullPath] = []
                unappliedChangeQueue = unappliedChangeQueues[fullPath]
            }
            // collabDebugLog.push(JSON.parse(JSON.stringify(unappliedChangeQueue)))
        
            
            // Lookup in checksumTable
            // Check beforeChecksum and find when it matches
            var otherChanges
            
            var history = shortTermMemory[fullPath]
            // console.log('before patch history:', history)
            // console.log('before patch checksumTable:', checksumTable)
        
            var match = checksumTable[message.beforeChecksum]
            // collabDebugLog.push(JSON.parse(JSON.stringify(match || 'match == undefined')))
            
            if(match !== undefined) {
                otherChanges = history.slice(match.index + 1)
            }
            // collabDebugLog.push(JSON.parse(JSON.stringify(otherChanges || 'otherChanges == undefined')))
        
            // console.log('base checksum:', message.beforeChecksum)
            // console.log('base contents:', message.beforeContents)
            // console.log('operations to transform through:', otherChanges)
        
            if(otherChanges === undefined) {
                unappliedChangeQueue.push(message)
                // collabDebugLog.push(JSON.parse(JSON.stringify(unappliedChangeQueue)))
                // collabDebugLog.push(JSON.parse(JSON.stringify({ type: 'end-add-t0-unapplied-queue'}))) 
                return
            }
        
            else if(otherChanges.length > 0) {
                checksumTable[message.checksum] = {
                    index: match.index,
                    // contents: message.contents,
                    // historyEntry: history[match.index],
                }
            }
            collabDebugLog.push(JSON.parse(JSON.stringify(checksumTable)))
            
            var change = message.change
            if(isRealMessage) {
                change.madeBy = email
            }
            collabDebugLog.push(JSON.parse(JSON.stringify(change)))
            
            shiftChange(otherChanges, change)
            collabDebugLog.push(JSON.parse(JSON.stringify(change)))
            collabDebugLog.push(JSON.parse(JSON.stringify(otherChanges)))
            
            var newContents = patchFile(contents, change, message.checksum)
            collabDebugLog.push(JSON.parse(JSON.stringify(newContents)))
            
            try {
                fs.writeFileSync(fullPath, newContents)
            } catch(error) {
                console.log('SEVERE Edit failed - write error', fullPath, error)
                
                // send(teamId, 'all', {
                //     type: 'change-confirmation',
                //     success: false,
                //     reason: 'server-error',
                //     path: path,
                //     filename: filename,
                // })
            
                // collabDebugLog.push(JSON.parse(JSON.stringify({ type: 'end-write-error'}))) 

                return
            }
        
            updateStorage(email, teamId)
        
            // Add entry to checksum table
            checksumTable[crc32(newContents.toString('binary'))] = {
                index: shortTermMemory[fullPath].length,
                // contents: newContents,
                // historyEntry: change,
            }
            // collabDebugLog.push(JSON.parse(JSON.stringify(checksumTable))) 
            
            
            shortTermMemory[fullPath] = shortTermMemory[fullPath].concat(change)
            // collabDebugLog.push(JSON.parse(JSON.stringify(shortTermMemory[fullPath]))) 

            if(shortTermMemory[fullPath].length > 20) {
                shortTermMemory[fullPath] = shortTermMemory[fullPath].slice(shortTermMemory[fullPath].length - 18)
                // collabDebugLog.push(JSON.parse(JSON.stringify(shortTermMemory[fullPath]))) 
            }
        
            if(unappliedChangeQueue.length > 0) {
                var afterMatch = checksumTable[unappliedChangeQueue[0].beforeChecksum]
                // collabDebugLog.push(JSON.parse(JSON.stringify(afterMatch || 'afterMatch == undefined'))) 
                
                if(afterMatch !== undefined) {
                    // collabDebugLog.push(JSON.parse(JSON.stringify(unappliedChangeQueue))) 
                    var queuedMessage = unappliedChangeQueue[0]
                    unappliedChangeQueues[fullPath] = unappliedChangeQueue.slice(1)
                    // collabDebugLog.push(JSON.parse(JSON.stringify(unappliedChangeQueues[fullPath])))

                    applyChange(queuedMessage, false)
                } 
            }

            fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/storage/team?teamId=' + encodeURIComponent(teamId), {
                method: 'GET',
                headers: {
                    Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
                },
            }).then(function(response) {
                if(response.ok) {
                    return response.json()
                } else {
                    // res.writeHead(400)
                    // res.end()
                }
            }).then(function(data) {
                // console.log('limit:', data.limit, 'storage:', data.storage)
                if(!data.limit || data.limit < data.storage) {
                    webSocket.send(JSON.stringify({
                        type: 'over-limit',
                    }))
                }
            })
        }
    })

    webSocket.on('close', function(code, reason) {
        console.log('webSocket closed: code', code, 'because', reason)
        closeWebSocket()
    })
    
    webSocket.on('error', function (error) {
        console.log('webSocket error:', error)
        closeWebSocket()
    })

    function closeWebSocket() {
        if(email !== undefined && teamId !== undefined && teamActiveConnections[teamId] !== undefined) {            
            Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
                var peerWebSocket = teamActiveConnections[teamId][peerEmail]
                if(peerEmail != email) {
                    peerWebSocket.send(JSON.stringify({
                        type: 'left',
                        email: email,
                    }))
                }
            })

            delete teamActiveConnections[teamId][email]
        }
    }
}

'helper functions'
function authenticate(req) {
    // console.log('auth', req.headers.authorization, req.headers.host, sessions)
    
    if(!req.headers.authorization) {
        return
    }

    var teamId = req.headers.host.slice(0, 4) + req.headers.host.slice(5, 33)

    var teamSessions = sessions[teamId]
    if(!teamSessions) {
        return
    }
    
    var sessionId = req.headers.authorization.slice(7)
    var session = teamSessions[sessionId]

    if(!session || !session.expiresAt || !session.email || Date.now() > session.expiresAt) {
        return
    }

    emailsByIP[req.headers["x-real-ip"]] = session.email

    return session.email
}

function validEmail(email) {
    if(!email || !email.includes('@') || email.length > 254) {
        return false
    }

    return true
}

function loadSessions() {
    return JSON.parse(fs.readFileSync(durablePath + 'sessions.json').toString())
}

function saveSession(sessionId) {
    fs.writeFileSync(durablePath + 'sessions.json', JSON.stringify(sessions, null, 2))
}


function patchFile(contents, change) {
    var nDeleted = change.removed.length - 1
    change.removed.forEach(function(str) {
        nDeleted += str.length
    })
    contents = contents.slice(0, change.from) + contents.slice(change.from + nDeleted)

    var insertedText = []
    change.text.forEach(function(str) {
        insertedText.push(str)
    })
    insertedText = insertedText.join('\n')
    contents = contents.slice(0, change.from) + insertedText + contents.slice(change.from)
    
    return contents
}

var crcTable = (function() {
    var c;
    var crcTable = [];
    for(var n =0; n < 256; n++){
        c = n;
        for(var k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
})()

function crc32(str) {
    var crc = 0 ^ (-1);

    for (var i = 0; i < str.length; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
}

function send(teamId, to, obj) {
    if(to == 'all') {
        Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
            var peerWebSocket = teamActiveConnections[teamId][peerEmail]
            peerWebSocket.send(JSON.stringify(obj))
        })
    }

    else if(to == 'other') {
        Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
            var peerWebSocket = teamActiveConnections[teamId][peerEmail]
            if(peerEmail != email) {
                peerWebSocket.send(JSON.stringify(obj))
            }
        })
    }

    else {
        var peerWebSocket = teamActiveConnections[teamId][to]
        peerWebSocket.send(JSON.stringify(obj))
    }
}



function shiftChange(missedChanges, proposedChange, checksumTable, match) {
    var extraPatches = []
    var newChanges = []

    // Transforms partner history through your history ->
    missedChanges.forEach(function(missedChange, i) {
        if(missedChange.madeBy != proposedChange.madeBy //) {
            && missedChange.revisionId > proposedChange.peerRevisionId) {
            
            var newChange = Object.assign({}, missedChange)  
            
            missedChanges.slice(i+1).forEach(function(userOtherChange) {
                if(userOtherChange.madeBy == proposedChange.madeBy) {
                    var extraPatch = transformChange(userOtherChange, newChange)
                    if(extraPatch) {
                        extraPatches.push(extraPatch)
                    }
                }
            })
            
            newChanges.push(newChange)
            extraPatches.forEach(function(extraPatch) {
                newChanges.push(extraPatch)
            })
        }
    })


    // Trasform your change through other changes...
    newChanges.forEach(function(newChange) {
        var extraPatch = transformChange(newChange, proposedChange)

        var document = patchFile(newChange.afterDocument, proposedChange)
        
        if(extraPatch) {
            document = patchFile(document, extraPatch)
            // document = patchFile(newChange.afterDocument, extraPatch)
        }
        
        var checksum = crc32(document.toString('binary'))

        checksumTable[checksum] = {
            index: match.index,
            document: document,
        }        
    })
}


function transformChange(committedChange, patch) {
    var delta = committedChange.text.length - (committedChange.to - committedChange.from)
    
    if(patch.to < committedChange.from) {
        return {}
    }
    
    else if(patch.from > committedChange.to) {
        if(delta < 0 && committedChange.to > patch.from) {
            delta -= committedChange.to - patch.from
        }

        patch.from += delta
        patch.to += delta
    }

    else {
        var extraPatch = {}

        if(delta > 0) {
            patch.to = committedChange.from
            extraPatch.from = committedChange.from + delta
            extraPatch.to = patch.to + delta
        }
        
        else {
            patch.to += delta
        }

        return extraPatch
    }
}
























































var tmpPath = process.env.HOME + '/tmp/'
var backupPath = process.env.HOME + '/backup/uploads/'


function getTeamStorageId(teamId) {
    return teamId
}


function signalChangeToFile(teamId, path, filename) {
    if(!teamActiveConnections[teamId]) return

    Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
        var peerWebSocket = teamActiveConnections[teamId][peerEmail]
        peerWebSocket.send(JSON.stringify({
            type: 'file-changed',
            path: path,
            filename: filename,
        }))
    })
}

function signalChangeToFilesystem(teamId) {
    if(!teamActiveConnections[teamId]) return

    Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
        var peerWebSocket = teamActiveConnections[teamId][peerEmail]
        peerWebSocket.send(JSON.stringify({
            type: 'filesystem-changed',
        }))
    })
}

function validFilename(filename) {
    if(!filename || filename.length > 255) {
        return false
    }

    if(filename.includes('/') || filename.includes('\0') || filename == '..') {
        return false
    }

    return true
}

function validPath(path) {
    if(!path || path.length > 4096) {
        return false
    }

    if(path[0] != '/' || path.slice(-1) != '/') {
        return false
    }

    if(path.includes('\0') || path.includes('/../')) {
        return false
    }

    return true
}

function handleFileSystemRequest(req, res, reqStringA, reqStringB) {
    var teamId = req.headers.host.slice(0, 4) + req.headers.host.slice(5, 33)
    var urlArgs = JSON.parse(JSON.stringify(url.parse(req.url, true).query))
    
    if(req.method == 'POST' && req.url.startsWith('/api/fs/newFolder?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }

        try {
            fs.mkdirSync(durablePath + 'storage/' + storageId + path + filename)
        } catch(e) {
            console.log(e)
            res.writeHead(409)
            res.end()
            return
        }

        signalChangeToFilesystem(teamId)
        res.writeHead(201)
        res.end()

        updateStorage(email, teamId)
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/uploadFolder')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        // var teamId = urlArgs.team
        
        var storageId = getTeamStorageId(teamId)
        // console.log('storageId:', storageId)

        var tmpFilename = tmpPath + crypto.randomBytes(12).toString('hex') + '.zip'
        // console.log('tmpFilename: ', tmpFilename)

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var statedSize = req.headers["content-length"]
        // console.log('statedSize:', statedSize)
        if(!statedSize) {
            res.writeHead(400)
            res.end()
            return
        }

        fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/storage/team?teamId=' + encodeURIComponent(teamId), {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
            },
        }).then(function(response) {
            if(response.ok) {
                return response.json()
            } else {
                // res.writeHead(400)
                // res.end()
            }
        }).then(function(data) {
            // console.log('limit:', data.limit, 'storage:', data.storage, 'statedSize:', statedSize)
            if(!data.limit || data.limit - data.storage < statedSize) {
                res.writeHead(507)
                res.end()
                return
            }

            var body = ''
            req.on('data', function(chunk) {
                body += chunk.toString('binary')

            })

            req.on('end', function() {
                fs.writeFile(tmpFilename, body, {
                    encoding: 'binary',
                }, function(error) {
                    if(error) {
			console.log('Error writing temporary file.', error)
                        res.writeHead(500)
                        res.end()
                    }

                    unzipAndWrite()
                })
            })
        })

        function unzipAndWrite(done) {
            var outputPath = durablePath + 'storage/' + storageId + path
            var unzipProcess = child_process.spawn('unzip', ['-n', tmpFilename, '-d', outputPath.slice(0, -1)])
            unzipProcess.on('close', function(code) {
                // console.log('unzip done:', code)
                if(code !== 0) {
                    console.log('unzip exit code:', code)
                    res.writeHead(500)
                    res.end()    
                } else {
                    signalChangeToFilesystem(teamId)
                    res.writeHead(200)
                    res.end()
                    fs.unlinkSync(tmpFilename)
                }

                updateStorage(email, teamId)
            })

            unzipProcess.stdout.on('data', function(data) {
                // console.log(data.toString())
            })

            unzipProcess.stderr.on('data', function(data) {
                // console.log(data.toString())
            })

            unzipProcess.on('error', function(error) {
                console.log('unzip error:', error)
                res.writeHead(500)
                res.end()
            })
        }
    }

    else if(req.method == 'GET' && req.url.startsWith('/api/fs/folder?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)
        // console.log('storageId:', storageId)        

        var filesystemTree = getFolderTree(durablePath + 'storage/' + storageId)

        function getFolderTree(path) {
            var folder = []
            var directory = fs.opendirSync(path)
            while(true) {
                var directoryEntry = directory.readSync()
                
                if(!directoryEntry) {
                    break
                }

                if(directoryEntry.isDirectory()) {
                    folder.push({
                        type: 'folder',
                        name: directoryEntry.name,
                        contents: getFolderTree(path + '/' + directoryEntry.name),
                    })
                }

                if(directoryEntry.isFile()) {
                    folder.push({
                        type: 'file',
                        name: directoryEntry.name,
                    })
                }
            }

            directory.close()

            return folder
        }

        res.writeHead(200)
        res.end(JSON.stringify(filesystemTree))
    }

    else if(req.method == 'GET' && req.url.startsWith('/api/fs/downloadFolder?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)
        // console.log('storageId:', storageId)

        var path = urlArgs.path
        var filename = urlArgs.filename
        var root = false

        if(path == '' && filename == '/') {
            root = true
            path = '/'
            filename = teamId.slice(0, 4) + '-root.zip'
        }

        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }

        var tmpFilename = tmpPath + crypto.randomBytes(12).toString('hex') + '.zip'
        console.log('tmpFilename: ', tmpFilename)

        zipFolder(function() {
            res.writeHead(200, {
                'Content-Type': 'application/zip',
                'Content-Disposition': 'attachment; filename="' + filename + '.zip"',
            })

            var stream = fs.createReadStream(tmpFilename)

	stream.on('readable', function() {
		readNextChunks()
	})

	function readNextChunks() {
		var chunk
		if(eventLoopMonitor.mean > 50 * 1000 * 1000) {
	        	setTimeout(readNextChunks, 100)
                } else {
			while(true) {
				chunk = stream.read()
				if(chunk === null) {
					break
				}
		      		res.write(chunk)
			}
	      	}
	}


            stream.on('end', function() {
                res.end()
                fs.unlinkSync(tmpFilename)
            })

//	    var throttle = new Throttle(200 * 1024); // * 1024);
//            stream.pipe(throttle).pipe(res)
//            stream.pipe(res)
        })

        function zipFolder(done) {
            var sourcePath
            if(root) {
                sourcePath = durablePath + 'storage/' + storageId + '/'
            } else {
                sourcePath = durablePath + 'storage/' + storageId + path + filename
            }

            console.log('sourcePath', sourcePath)
            
            var zipProcess = child_process.spawn('zip', ['-r', tmpFilename, '.'], {
                cwd: sourcePath,
            })
            zipProcess.on('close', function(code) {
                // console.log('zip done:', code)
                if(code !== 0) {
                    console.log('zip exit code:', code)
                    res.writeHead(500)
                    res.end()    
                } else {
                    done()
                }
            })

            //zipProcess.stdout.on('data', function(data) {
                // console.log(data.toString())
            //})

            //zipProcess.stderr.on('data', function(data) {
                // console.log(data.toString())
            //})

            zipProcess.on('error', function(error) {
                console.log('zip error:', error)
                res.writeHead(500)
                res.end()
            })
        }
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/rename?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var oldFilename = urlArgs.oldFilename
        if(!validFilename(oldFilename)) {
            res.writeHead(400)
            res.end()
            return
        }

        var newFilename = urlArgs.newFilename
        if(!validFilename(newFilename)) {
            res.writeHead(400)
            res.end()
            return
        }
        
        var oldPath = durablePath + 'storage/' + storageId + path + oldFilename
        var newPath = durablePath + 'storage/' + storageId + path + newFilename
        
        try {
            fs.accessSync(newPath)
            res.writeHead(409)
            res.end('already-exists')
            return
        }

        catch(error) {
            try {
                fs.renameSync(oldPath, newPath)
            } catch(e) {
                signalChangeToFilesystem(teamId)
                res.writeHead(400)
                res.end()
                return 
            }
            
            signalChangeToFilesystem(teamId)
            res.writeHead(200)
            res.end()

            updateStorage(email, teamId)
        }
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/move?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)

        var oldPath = urlArgs.oldPath
        if(!validPath(oldPath)) {
            res.writeHead(400)
            res.end()
            return
        }

        var newPath = urlArgs.newPath
        if(!validPath(newPath)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }
        
        var oldPath = durablePath + 'storage/' + storageId + oldPath + filename
        var newPath = durablePath + 'storage/' + storageId + newPath + filename

        try {
            fs.accessSync(newPath)
            res.writeHead(409)
            res.end('already-exists')
            return
        }

        catch(error) {   
            try {
                fs.renameSync(oldPath, newPath)
            } catch(e) {
                signalChangeToFilesystem(teamId)
                res.writeHead(400)
                res.end()
                return    
            }

            signalChangeToFilesystem(teamId)
            res.writeHead(200)
            res.end()

            updateStorage(email, teamId)
        }
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/copyFile?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)

        var oldPath = urlArgs.oldPath
        if(!validPath(oldPath)) {
            res.writeHead(400)
            res.end()
            return
        }

        var newPath = urlArgs.newPath
        if(!validPath(newPath)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }
        
        var oldPath = durablePath + 'storage/' + storageId + oldPath + filename
        var newPath = durablePath + 'storage/' + storageId + newPath + filename
        
        // fetch('https://' + envPrefix + 'gateway.prospero.live/gateway/storage?email=' + encodeURIComponent(email), {
        fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/storage/team?teamId=' + encodeURIComponent(teamId), {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
            },
        }).then(function(response) {
            if(response.ok) {
                return response.json()
            } else {
                // res.writeHead(400)
                // res.end()
            }
        }).then(function(data) {
            // console.log('limit:', data.limit, 'storage:', data.storage, 'statedSize:', statedSize)
            if(!data.limit || data.limit < data.storage) {
                res.writeHead(507)
                res.end()
                return
            }

            try {
                fs.accessSync(newPath)
                res.writeHead(409)
                res.end('already-exists')
                return
            }

            catch(error) {
                try {
                    fs.copyFileSync(oldPath, newPath)
                } catch(e) {
                    signalChangeToFilesystem(teamId)
                    res.writeHead(400)
                    res.end()    
                    return
                }

                signalChangeToFilesystem(teamId)
                res.writeHead(200)
                res.end()

                updateStorage(email, teamId)
            }
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/copyFolder?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)

        var oldPath = urlArgs.oldPath
        if(!validPath(oldPath)) {
            res.writeHead(400)
            res.end()
            return
        }

        var newPath = urlArgs.newPath
        if(!validPath(newPath)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }
        
        var oldPath = durablePath + 'storage/' + storageId + oldPath + filename
        var newPath = durablePath + 'storage/' + storageId + newPath + filename


        fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/storage/team?teamId=' + encodeURIComponent(teamId), {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
            },
        }).then(function(response) {
            if(response.ok) {
                return response.json()
            } else {
                // res.writeHead(400)
                // res.end()
            }
        }).then(function(data) {
            // console.log('limit:', data.limit, 'storage:', data.storage, 'statedSize:', statedSize)
            if(!data.limit || data.limit < data.storage) {
                res.writeHead(507)
                res.end()
                return
            }

            try {
                fs.accessSync(newPath)
                res.writeHead(409)
                res.end('already-exists')
                return
            }

            catch(error) {
                try {
                    child_process.exec('cp -r "' + oldPath + '" "' + newPath + '"')
                } catch(e) {
                    signalChangeToFilesystem(teamId)
                    res.writeHead(400)
                    res.end()    
                    return
                }

                signalChangeToFilesystem(teamId)
                res.writeHead(200)
                res.end()

                updateStorage(email, teamId)
            }
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/deleteFolder?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }

        try {
            fs.rmdirSync(durablePath + 'storage/' + storageId + path + filename, {
                recursive: true,
            })
        } catch(e) {
            signalChangeToFilesystem(teamId)
            res.writeHead(400)
            res.end()    
            return
        }

        signalChangeToFilesystem(teamId)
        res.writeHead(200)
        res.end()

        updateStorage(email, teamId)
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/newFile?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)
        // console.log(path)
        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }
        
        var fsPath = durablePath + 'storage/' + storageId + path + filename
        
        try {
            fs.accessSync(fsPath)
            res.writeHead(409)
            res.end('already-exists')
            return
        }

        catch(err) {
            try {
                fs.writeFileSync(fsPath, '')
            } catch(e) {
                console.log('write error', e)
                // signalChangeToFilesystem(teamId)
                res.writeHead(400)
                res.end(e.toString())    
                return
            }  
        }
        
        signalChangeToFilesystem(teamId)
        res.writeHead(201)
        res.end()

        updateStorage(email, teamId)
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/uploadFile')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            console.log(reqStringA + ' 401 ' + reqStringB)
            return
        }

        var statedSize = req.headers["content-length"]
        // console.log('statedSize:', statedSize)
        if(!statedSize) {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
            return
        }

        fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/storage/team?teamId=' + encodeURIComponent(teamId), {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
            },
        }).then(function(response) {
            if(response.ok) {
                return response.json()
            } else {
                // res.writeHead(400)
                // res.end()
            }
        }).then(function(data) {
            // console.log('limit:', data.limit, 'storage:', data.storage, 'statedSize:', statedSize)
            if(!data.limit || data.limit - data.storage < statedSize) {
                res.writeHead(507)
                res.end()
                console.log(reqStringA + ' 507 ' + reqStringB)
                return
            }
            
            var storageId = getTeamStorageId(teamId)
            // console.log('storageId:', storageId)

            var path = urlArgs.path
            if(!validPath(path)) {
                res.writeHead(400)
                res.end()
                console.log(reqStringA + ' 400 ' + reqStringB)
                return
            }
            
            var filename = urlArgs.filename
            if(!validFilename(filename)) {
                res.writeHead(400)
                res.end()
                console.log(reqStringA + ' 400 ' + reqStringB)
                return
            }

            req.on('error', function(error) {
                console.log('upload error:', error)
            })
        
            var tooBig = false
            var body = ''
            req.on('data', function(chunk) {
                // console.log(chunk)
                body += chunk.toString('binary')

                // if(teamActiveConnections[teamId]) {   
                //     Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
                //         var peerWebSocket = teamActiveConnections[teamId][peerEmail]
                //         peerWebSocket.send(JSON.stringify({
                //             type: 'upload-progress',
                //             by: email,
                //             path: path,
                //             filename: filename,
                //             size: statedSize,
                //             received: 100000,
                //             at: Date.now(),
                //         }))
                //     })
                // }
            })

            req.on('end', function() {
                if(!data.limit || data.limit - data.storage < body.length) {
                    res.writeHead(507)
                    res.end()
                    console.log(reqStringA + ' 507 ' + reqStringB)
                    return
                }

                fs.writeFile(durablePath + 'storage/' + storageId + path + filename, body, {
                    encoding: 'binary',
                }, function(error) {
                    if(error) {
                        res.writeHead(500)
                        res.end()
                        console.log(reqStringA + ' 500 ' + reqStringB)
                    }

                    signalChangeToFilesystem(teamId, path, filename)
                    signalChangeToFile(teamId, path, filename)
                    res.writeHead(200)
                    res.end()
                    console.log(reqStringA + ' 200 ' + reqStringB)

                    updateStorage(email, teamId)
                })

                // updateStorageRemaining(email)

                // fs.writeFile(backupPath + Date.now() + '-' + storageId + '-' + filename, body, {
                //     encoding: 'binary',
                // }, function(error) {
                //     if(error) {
                //         console.log('ALERT - BACKUP FAILED', error)
                //     }
                // })
            })
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/pushFile')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var path = urlArgs.path
        // if(!validPath(path)) {
        //     res.writeHead(400)
        //     res.end()
        //     return
        // }

        var body = ''
        req.on('data', function(chunk) {
            body += chunk.toString('binary')
        })

        req.on('end', function() {
            // Send to simple-receive clients
            // console.log('Send...', path)
            // console.log(body)

            if(!teamActiveConnections[teamId]) return

            Object.keys(teamActiveConnections[teamId]).forEach(function(peerEmail) {
                var peerWebSocket = teamActiveConnections[teamId][peerEmail]
                peerWebSocket.send(JSON.stringify({
                    type: 'push',
                    path: path,
                    contents: body,
                }))
            })

            res.writeHead(200)
            res.end()

            updateStorage(email, teamId)
        })
    }

    else if(req.method == 'GET' && req.url.startsWith('/api/fs/file?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)
        // console.log('storageId:', storageId)     

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }
        try {
            file = fs.readFileSync(durablePath + 'storage/' + storageId + path + filename)
        } catch(e) {
            console.log('read error', e)
        }
        
        var filePath = durablePath + 'storage/' + storageId + path + filename
        if(urlArgs.syntax) {
            var tmpFilename = tmpPath + crypto.randomBytes(12).toString('hex') + filename

            var syntaxProcess = child_process.spawn('pygmentize', ['-f', 'html', '-O', 'linenos', '-o', tmpFilename, filePath])
            syntaxProcess.on('close', function(code) {
                // console.log('syntax done:', code)
                if(code !== 0) {
                    // console.log('syntax exit code:', code)
                    res.writeHead(200)
                    res.end(file)    
                } else {
                    file = fs.readFileSync(tmpFilename)
                    res.writeHead(200)
                    res.end(file)
                }
            })

            syntaxProcess.stdout.on('data', function(data) {
                // console.log(data.toString())
            })

            syntaxProcess.stderr.on('data', function(data) {
                // console.log(data.toString())
            })

            syntaxProcess.on('error', function(error) {
                // console.log('unzip error:', error)
                res.writeHead(200)
                res.end(file)
            })
        }
        
        else {
            
            res.writeHead(200)
            res.end(file)
        }
    }

    else if(req.method == 'GET' && req.url.startsWith('/api/fs/downloadFile?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)
        // console.log('storageId:', storageId)     

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }

        var file = fs.readFileSync(durablePath + 'storage/' + storageId + path + filename)

        res.writeHead(200, {
            'Content-Type': 'application/x-unknown',
            'Content-Disposition': 'attachment; filename="' + filename + '"'
        })
        res.end(file)
    }

    else if(req.method == 'POST' && req.url.startsWith('/api/fs/deleteFile?')) {
        var email = authenticate(req)

        if(!email) {
            res.writeHead(401)
            res.end()
            return
        }

        var storageId = getTeamStorageId(teamId)

        var path = urlArgs.path
        if(!validPath(path)) {
            res.writeHead(400)
            res.end()
            return
        }

        var filename = urlArgs.filename
        if(!validFilename(filename)) {
            res.writeHead(400)
            res.end()
            return
        }

        try {
            fs.unlinkSync(durablePath + 'storage/' + storageId + path + filename)
        } catch(e) {
            signalChangeToFilesystem(teamId)
            res.writeHead(400)
            res.end()    
            return
        }

        signalChangeToFilesystem(teamId)
        res.writeHead(200)
        res.end()
        
        updateStorage(email, teamId)
    }


    else {
        res.writeHead(404)
        res.end('Resource not found.')
    }
}

// function updateStorageRemaining(email) {
    // storageRemaining[email] = 1000000000
    // child_process.exec('du /root/data/storage/' + teamId + '/ --max-depth=0', function(error) {
    //     storageRemaining[email] = parseInt(stdin.split(' ')[0])
    // })
// }


var userStorage = {}

// setInterval(function() {
//     userStorage = {}
// }, 2000)


function updateStorage(email, teamId) {
    fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/auth?email=' + encodeURIComponent(email) + '&team=' + encodeURIComponent(teamId), {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
        },
    }).then(function(response) {
        if(response.ok) {
            return response.json()
        } else {
            res.writeHead(400)
            res.end()
            console.log(reqStringA + ' 400 ' + reqStringB)
        }
    }).then(function(data) {
        var creator = data.creator

        Object.keys(teamActiveConnections).forEach(function(teamId) {
            if(!teamActiveConnections[teamId][creator]) {
                return
            }

            child_process.exec('du ' + durablePath + '/storage/' + teamId + '/ --max-depth=0 --bytes', function(error, stdout, stderr) {
                if(error) {
                    console.log('storage check error', error)
                    return
                }
                
                if(!userStorage[creator]) {
                    userStorage[creator] = {}
                }

                userStorage[creator][teamId] = parseInt(stdout.split('\t')[0])

                var totalStorage = 0

                Object.keys(userStorage[creator]).forEach(function(teamId) {
                    totalStorage += userStorage[creator][teamId]
                })

                fetch('https://' + envPrefix + 'gateway.prosperodev.live/gateway/storage?email=' + encodeURIComponent(creator) + '&storage=' + encodeURIComponent(totalStorage) + '&team=' + encodeURIComponent(teamId), {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + process.env.GATEWAY_SECRET,
                    },
                }).then(function(response) {
                    if(response.ok) {
                        // return response.json()
                    } else {
                        // res.writeHead(400)
                        // res.end()
                    }
                })
                // .then(function(data) {
                //     // var creator = data.creator
                //     // var other = data.other
                // })
            })
        })
    })
}
// }, 2 * 1000)
// }, 2 * 60 * 1000)
