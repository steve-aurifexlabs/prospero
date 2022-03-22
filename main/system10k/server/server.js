'Requires: node v12.x, postmark, stripe'

'node dependencies'
var http = require('http')
var url = require('url')
var fs = require('fs')
var crypto = require('crypto')
var process = require('process')

'npm dependencies'
var postgres = require('pg')
var postmark = new (require('postmark').ServerClient)(process.env.POSTMARK_KEY)
require('isomorphic-fetch')

var envPrefix = process.env.ENV_PREFIX || ''

var emailsByIP = {}

'start db'
var dbConnection = new postgres.Client()

dbConnection.connect()
dbConnection.query('SELECT NOW()', function(error, response) {
    console.log('SELECT NOW():', response.rows, 'Date.now()', new Date(Date.now()))
})

'start server'
process.title = 'prospero-live-stateless-server'
var server = http.createServer(handleRequest)
server.listen(8080, 'localhost')
console.log('Started server on port 8080.')

'handleRequest'
function handleRequest(req, res) {
    var urlArgs = JSON.parse(JSON.stringify(url.parse(req.url, true).query))
    
    console.log(req.headers)

    var displayEmail = (emailsByIP[req.headers["x-real-ip"]] || '                ').slice(0, 16)
    var reqStringA = (new Date()).toString().slice(0, 24) + ' ' + req.headers["x-real-ip"] + ' ' + displayEmail + ' ' + crypto.randomBytes(2).toString('hex')
    var reqStringB = req.method.slice(0, 4).padStart(4) + ' ' + req.headers.host + req.url
    console.log(reqStringA + ' req ' + reqStringB)
    
    // if(req.headers['host'] != 'cloud.digitalocean.com') {
    //     console.log('\n#### START REQUEST ####')
    //     console.log('Request from:', req.connection.remoteAddress)
    //     // console.log('Request to:', req.connection.localAddress, req.connection.localPort)
    //     console.log(req.method, req.url, 'at', new Date())
    //     console.log('with headers:', req.headers)
    //     console.log('urlArgs:', urlArgs)
    //     console.log('custom log:')
    // }


    if(req.method == 'GET' && (req.url == '/' || req.url.startsWith('/?'))) {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/pages/index.html').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/fonts/averiasanslibre.woff2') {
        res.writeHead(200, { 'Content-Type': 'font/woff2' })
        
        var stream = fs.createReadStream('./static/fonts/averiasanslibre.woff2')

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

    else if(req.method == 'GET' && req.url == '/static/images/team.jpg') {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' })
        
        var stream = fs.createReadStream('./static/images/team.jpg')

        stream.on('close', function() {
            res.end()
        })

        stream.pipe(res)
    }

    else if(req.method == 'GET' && req.url == '/static/images/demo.jpg') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        
        var stream = fs.createReadStream('./static/images/demo.jpg')

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

    else if(req.method == 'GET' && req.url == '/static/css/theme.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(fs.readFileSync('./static/css/theme.css').toString())
    }
    
    else if(req.method == 'GET' && req.url == '/static/css/index.css') {
        res.writeHead(200, { 'Content-Type': 'text/css' })
        res.end(fs.readFileSync('./static/css/index.css').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/index.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/javascript/index.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/auth/email-verification') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/pages/email-verification.html').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/email-verification.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/javascript/email-verification.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/user/create-account') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/pages/create-account.html').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/create-account.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end(fs.readFileSync('./static/javascript/create-account.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/user/dashboard') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/pages/dashboard.html').toString())
    }

    else if(req.method == 'GET' && req.url == '/static/javascript/dashboard.js') {
        res.writeHead(200, { 'Content-Type': 'application/javascript' })
        res.end('var envPrefix = "' + envPrefix + '"\n\n' + fs.readFileSync('./static/javascript/dashboard.js').toString())
    }

    else if(req.method == 'GET' && req.url == '/status') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(fs.readFileSync('./static/pages/status.html').toString())
    }

    else if(req.method == 'GET' && req.url == '/status-endpoint') {
        res.writeHead(200)
        res.end()
    }

    else if(req.method == 'POST' && req.url.startsWith('/auth/start')) {
        var email = urlArgs.email

        if(!validEmail(email)) {
            res.writeHead(400)
            res.end()
            return
        }

        var pgQuery = 'SELECT resendAt FROM emailAuthCodes WHERE email = $1 ORDER BY resendAt DESC'

        dbConnection.query(pgQuery, [email], function(error, response) {
            // console.log(error, response)

            if(error) {
                res.writeHead(400)
                res.end()
                return
            }

            if(response.rows.length > 0 && new Date() < response.rows[0].resendat) {
                res.writeHead(400)
                res.end()
                return
            }

            sendAuthCode(email)
        })

        function sendAuthCode(email) {
            var code = crypto.randomBytes(4).toString('hex')
            var expiresAt = new Date(Date.now() + 20 * 60 * 1000)
            var resendAt = new Date(Date.now() + 25 * 1000)
                
            var pgQuery = "INSERT INTO emailAuthCodes VALUES ($1, $2, $3, $4, false, false, false);"

            dbConnection.query(pgQuery, [email, code, expiresAt, resendAt], function(error, response) {
                // console.log(error, response)
                
                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                postmark.sendEmail({
                    From: 'Prospero.Live <auth@prospero.live>',
                    To: email,
                    Subject: 'Your Requested Authentication Code',
                    TextBody: 'Your authentication code is: \n\n' + code + '\n\n- Prospero.Live',
                })
                
                res.writeHead(200)
                res.end()
            })
        }
    }

    else if(req.method == 'POST' && req.url.startsWith('/auth/request-demo')) {
        var email = urlArgs.email

        if(!validEmail(email)) {
            res.writeHead(400)
            res.end()
            return
        }

        postmark.sendEmail({
            From: 'Prospero.Live <contact@prospero.live>',
            To: 'steve@prospero.live',
            Subject: 'Someone requested a demo!',
            TextBody: email,
        })
        
        res.writeHead(200)
        res.end()
    }

    else if(req.method == 'POST' && req.url.startsWith('/auth/email-auth')) {
        var email = urlArgs.email
        var code = urlArgs.code

        if(!validEmail(email)) {
            res.writeHead(400)
            res.end()
            return
        }

        if(!code || code.length != 8) {
            res.writeHead(400)
            res.end()
            return
        }

        var pgQuery = 'SELECT * FROM emailAuthCodes WHERE email = $1 ORDER BY expiresAt DESC'

        dbConnection.query(pgQuery, [email], function(error, response) {
            // console.log(error, response)

            if(error) {
                res.writeHead(400)
                res.end()
                return
            }

            if(response.rows.length < 1) {
                res.writeHead(400)
                res.end()
                return
            }

            if(!response.rows[0].code || !response.rows[0].expiresat) {
                res.writeHead(400)
                res.end()
                return
            }

            if(response.rows[0].used) {
                res.writeHead(400)
                res.end()
                return
            }

            if(new Date(Date.now()) > response.rows[0].expiresAt) {
                res.writeHead(400)
                res.end()
                return
            }

            var pgQuery = 'BEGIN; UPDATE emailAuthCodes SET used = true WHERE email = $1;'
            
            if(code != response.rows[0].code) {
                pgQuery += 'UPDATE emailAuthCodes SET failedAttempt = true WHERE email = $1 AND code = $2; COMMIT;'
                
                transaction(pgQuery, [[], [email], [email, code], []], function(error, response) {
                    res.writeHead(400)
                    res.end()
                })

                return
            }

            pgQuery += 'UPDATE emailAuthCodes SET successfulLogin = true WHERE email = $1 AND code = $2;'

            var sessionId = crypto.randomBytes(32).toString('hex')
            var sessionExpiresAt = new Date(Date.now() + 17 * 24 * 60 * 60 * 1000)
            var loggedOut = false

            pgQuery += 'INSERT INTO sessions VALUES ($1, $2, $3, $4); COMMIT;'

            transaction(pgQuery, [[], [email], [email, code], [sessionId, email, sessionExpiresAt, loggedOut], []], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                res.writeHead(200, { 'Content-Type': 'application/json'})
                res.end(JSON.stringify({
                    sessionId: sessionId,
                }))
            })
        })
    }

    else if(req.method == 'POST' && req.url == '/auth/logout') {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }
            
            var pgQuery = 'UPDATE sessions SET loggedOut = true WHERE email = $1;'

            dbConnection.query(pgQuery, [email], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                res.writeHead(200)
                res.end()        
            })
        })
    }

    else if(req.method == 'POST' && req.url == '/user/create-account') {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }
  
            var pgQuery = 'SELECT * FROM users WHERE email = $1;'

            dbConnection.query(pgQuery, [email], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }
                
                if(response.rows.length > 0) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                var createdAt = new Date(Date.now())
                var plan = 'free'
                var backupCode = crypto.randomBytes(12).toString('base64')

                pgQuery = "INSERT INTO users VALUES ($1, $2, $3, $4);"
 
                dbConnection.query(pgQuery, [email, createdAt, plan, backupCode], function(error, response) {
                    // console.log(error, response)
                                    
                    if(error) {
                        res.writeHead(400)
                        res.end()
                        return
                    }

                    res.writeHead(200)
                    res.end(JSON.stringify({
                        email: email,
                        createdAt: createdAt,
                        plan: plan,
                        backupCode: backupCode,
                    }))

                    postmark.sendEmail({
                        From: 'Onboarding <onboarding@prospero.live>',
                        To: 'steve@aurifexlabs.com',
                        Subject: 'New User',
                        TextBody: 'Email: ' + email,
                    })
                })    
            })

        })
        
    }

    else if(req.method == 'POST' && req.url == '/user/request-otp') {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }
        
            var otp = crypto.randomBytes(16).toString('base64')
            var otpAt = new Date(Date.now())
            var pgQuery = "UPDATE users SET otp = $2, otpAt = $3 WHERE email = $1"
            
            dbConnection.query(pgQuery, [email, otp, otpAt], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                res.writeHead(200)
                res.end(JSON.stringify({
                    otp: otp,
                }))
            })
        })
    }


    else if(req.method == 'POST' && req.url.startsWith('/user/register-key?')) {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }

            var challenge = crypto.randomBytes(32).toString('base64')
            var challengeAt = new Date(Date.now())
            var pgQuery = "UPDATE users SET challenge = $2, challengeAt = $3 WHERE email = $1"

            dbConnection.query(pgQuery, [email, challenge, challengeAt], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                res.writeHead(200)
                res.end(JSON.stringify({
                    challenge: challenge,
                }))
            })
        })
    }

    else if(req.method == 'GET' && req.url == '/user/user') {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }
  
            var pgQuery = 'SELECT email, createdAt, plan FROM users WHERE email = $1;'

            dbConnection.query(pgQuery, [email], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }
                
                if(response.rows.length != 1) {
                    res.writeHead(404)
                    res.end()
                    return
                }

                var user = response.rows[0]

                var result = {
                    email: email,
                    createdAt: user.createdat,
                    plan: user.plan,
                }

                res.writeHead(200)
                res.end(JSON.stringify(result))
            })
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/user/newTeam?')) {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }
            
            // console.log(urlArgs)

            var otherEmail = urlArgs.email

            // console.log(otherEmail)
            if(!validEmail(otherEmail)) {
                res.writeHead(400)
                res.end()
                return
            }

            var thirdEmail = ''
            var teamId = crypto.randomBytes(16).toString('hex')
            var nodeId = 'nyc30'

            var team = [
                teamId,
                new Date(Date.now()),
                email,
                otherEmail,
                nodeId,
                thirdEmail,
            ]

            var pgQuery = 'INSERT INTO teams VALUES ($1, $2, $3, $4, false, false, $5, false, $6, 0, false, false);'
            dbConnection.query(pgQuery, team, function(error, response) {
                // console.log(error, response)
                                
                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                postmark.sendEmail({
                    From: 'Prospero.Live <contact@prospero.live>',
                    To: otherEmail,
                    Subject: email + ' invited you to join them on Prospero.Live',
                    TextBody: 'Go to https://prospero.live to login or create an account and get started pairing with ' + email + '.\n\n- Prospero.Live',
                })

                res.writeHead(201)
                res.end(JSON.stringify({
                    teamId: teamId,
                    nodeId: nodeId,
                }))
            })
        })
    }

    else if(req.method == 'GET' && req.url == '/user/teams') {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }
  
            var pgQuery = 'SELECT * FROM teams WHERE (creator = $1 OR (other = $1 AND NOT inviteRejected) OR (third = $1 AND NOT thirdRejected));'

            dbConnection.query(pgQuery, [email], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                res.writeHead(200)
                res.end(JSON.stringify(response.rows))
            })
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/user/acceptInvite?')) {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }

            var teamId = urlArgs.teamId
            
            if(!teamId) {
                res.writeHead(400)
                res.end()
                return
            }

            // var pgQuery = "UPDATE teams SET inviteAccepted = true WHERE teamid = $1 AND other = $2;"
            var pgQuery = "BEGIN; UPDATE teams SET inviteAccepted = true WHERE teamid = $1 AND other = $2; UPDATE teams SET thirdAccepted = true WHERE teamid = $1 AND third = $2; COMMIT;"

            transaction(pgQuery, [[], [teamId, email], [teamId, email], []], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }
                
                res.writeHead(200)
                res.end()
            })
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/user/declineInvite?')) {
        authenticate(req, function(email) {
            if(!email) {
                res.writeHead(401)
                res.end()
                return
            }

            var teamId = urlArgs.teamId
            
            if(!teamId) {
                res.writeHead(400)
                res.end()
                return
            }

            // var pgQuery = "UPDATE teams SET inviteRejected = true WHERE teamid = $1 AND other = $2;"
            var pgQuery = "BEGIN; UPDATE teams SET inviteRejected = true WHERE teamid = $1 AND other = $2; UPDATE teams SET thirdRejected = true WHERE teamid = $1 AND third = $2; COMMIT;"

            transaction(pgQuery, [[], [teamId, email], [teamId, email], []], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }
                
                res.writeHead(200)
                res.end()
            })
        })
    }

    else {
        res.writeHead(404)
        res.end('Resource not found.')
    }
}

'helper functions'
function authenticate(req, callback) {
    if(!req.headers.authorization) {
        callback(false)
    }

    var sessionId = req.headers.authorization.slice(7)
    
    var pgQuery = 'SELECT * FROM sessions WHERE sessionId = $1 AND loggedOut = false ORDER BY sessionExpiresAt DESC'

    dbConnection.query(pgQuery, [sessionId], function(error, response) {
        // console.log(error, response)

        if(error) {
            callback(false)
            return
        }
    
        var session = response.rows[0]
        if(!session || !session.sessionexpiresat || !session.email || Date.now() > session.sessionexpiresat) {
            callback(false)
            return
        }

        var email = response.rows[0].email 

        emailsByIP[req.headers["x-real-ip"]] = email

        callback(email)
    })
}

function validEmail(email) {
    if(!email || !email.includes('@') || email.length > 254) {
        return false
    }

    return true
}

function transaction(queryString, parameters, callback) {
    var first = queryString.split(';')[0]
    var rest = queryString.split(';').slice(1).join(';')

    dbConnection.query(first, parameters[0], function(error, response) {
        if(rest && !error) {
            transaction(rest, parameters.slice(1), callback)
        }
        
        else {
            callback(error, response)
        }
    })
}
