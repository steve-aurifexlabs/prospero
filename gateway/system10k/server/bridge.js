
'node dependencies'
var http = require('http')
var url = require('url')
var fs = require('fs')
var crypto = require('crypto')
var process = require('process')

'npm dependencies'
var postgres = require('pg')
// var postmark = new (require('postmark').ServerClient)(process.env.POSTMARK_KEY)

'ephemerals'
// var userStorage = {}

'start db'
var dbConnection = new postgres.Client()

dbConnection.connect()
dbConnection.query('SELECT NOW()', function(error, response) {
    console.log('SELECT NOW():', response.rows, 'Date.now()', new Date(Date.now()))
})

'start'
process.title = 'prospero-gateway'
var server = http.createServer(handleRequest)

server.listen(8081)
console.log('Started gateway server on port 8081.')

'handleRequest'
function handleRequest(req, res) {
    // var reqStringA = crypto.randomBytes(2).toString('hex') + '  ' + (new Date()).toString().slice(0, 24) + ': '
    // var reqStringB = ' ' + req.headers["x-real-ip"] + '  ' + req.method + ' ' + req.headers.host + req.url
    // console.log(reqStringA + ' req ' + reqStringB)

    var displayEmail = ('                ').slice(0, 16)
    var reqStringA = (new Date()).toString().slice(0, 24) + ' ' + req.headers["x-real-ip"] + ' ' + displayEmail + ' ' + crypto.randomBytes(2).toString('hex')
    var reqStringB = req.method.slice(0, 4).padStart(4) + ' ' + req.headers.host + req.url
    console.log(reqStringA + ' req ' + reqStringB)
    
    // console.log('\n#### START REQUEST ####')
    // console.log('Request from:', req.connection.remoteAddress)
    // console.log('Request to:', req.connection.localAddress, req.connection.localPort)
    // console.log((new Date()).toString(), req.method, req.url)
    // console.log('with headers:', req.headers)
    
    var urlArgs = JSON.parse(JSON.stringify(url.parse(req.url, true).query))
    // console.log('urlArgs:', urlArgs)

    // console.log('custom log:')

    if(req.method == 'GET' && req.url == '/health-check') {
        res.writeHead(200)
        res.end()
        return
    }

    else if(req.method == 'POST' && req.url.startsWith('/gateway/auth')) {
        if(!authenticate(req)) {
            res.writeHead(401)
            res.end()
            return
        }

        var email = urlArgs.email
        var teamId = urlArgs.team

        var pgQuery = "SELECT * FROM teams WHERE teamId = $1 AND (creator = $2 OR other = $2 OR third = $2)"

        dbConnection.query(pgQuery, [teamId, email], function(error, response) {
            // console.log(error, response)

            if(error) {
                res.writeHead(400)
                res.end()
                console.log(400, 1)
                return
            }
                
            if(response.rows.length < 1) {
                res.writeHead(400)
                res.end()
                console.log(400, 2)
                return
            }

            var creator = response.rows[0].creator
            var other = response.rows[0].other
            var thirdData = response.rows[0].third
            var third = null

            pgQuery = "SELECT * FROM users WHERE email = $1"

            dbConnection.query(pgQuery, [email], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    console.log(400, 3)
                    return
                }
                    
                if(response.rows.length < 1) {
                    res.writeHead(422)
                    res.end()
                    console.log(422, 4)
                    return
                }

                res.writeHead(200, { 'Content-Type': 'application/json'})
                res.end(JSON.stringify({
                    creator: creator,
                    other: other,
                    third: thirdData,
                }))
            })

            // console.log(200, creator, other, third)
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/gateway/check-otp')) {
        console.log('a')
        if(!authenticate(req)) {
            res.writeHead(401)
            res.end()
            return
        }
        console.log('b')

        var otp = urlArgs.otp
        var teamId = urlArgs.team

        console.log(otp, teamId)

        // var pgQuery = "SELECT * FROM teams WHERE teamId = $1 AND (creator = $2 OR other = $2 OR third = $2)"
        var pgQuery = "SELECT * FROM users WHERE otp = $1"

        dbConnection.query(pgQuery, [otp], function(error, response) {
            console.log(error, response)

            if(error) {
                res.writeHead(400)
                res.end()
                console.log(400, 1)
                return
            }
                
            if(response.rows.length < 1) {
                res.writeHead(400)
                res.end()
                console.log(400, 2)
                return
            }

            if(!response.rows[0].otpat || response.rows[0].otpat < new Date(Date.now() - 1000 * 60 * 2)) {
            // if(false) {
                res.writeHead(400)
                res.end()
                console.log(400, 5)
                return
            }

            var email = response.rows[0].email

            
            var thirdData = response.rows[0].third
            var third = null

            pgQuery = "SELECT * FROM teams WHERE teamId = $1 AND (creator = $2 OR other = $2 OR third = $2)"
            // pgQuery = "SELECT * FROM users WHERE email = $1"

            dbConnection.query(pgQuery, [teamId, email], function(error, response) {
                console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    console.log(400, 3)
                    return
                }
                    
                if(response.rows.length < 1) {
                    res.writeHead(400)
                    res.end()
                    console.log(400, 4)
                    return
                }

                var creator = response.rows[0].creator
                var other = response.rows[0].other

                res.writeHead(200, { 'Content-Type': 'application/json'})
                res.end(JSON.stringify({
                    email: email,
                    creator: creator,
                    other: other,
                    third: thirdData,
                }))
            })

            // console.log(200, creator, other, third)
        })
    }

    else if(req.method == 'POST' && req.url.startsWith('/gateway/storage')) {
        if(!authenticate(req)) {
            res.writeHead(401)
            res.end()
            return
        }

        var email = urlArgs.email
        var storage = urlArgs.storage
        var region = urlArgs.region
        var teamId = urlArgs.team

        var pgQuery = 'UPDATE teams SET size = $2 WHERE teamid = $1;'
        dbConnection.query(pgQuery, [teamId, parseInt(storage)], function(error, response) {
            // console.log(error, response)
                            
            if(error) {
                res.writeHead(400)
                res.end()
                return
            }

            res.writeHead(200)
            res.end()
        })
    }

    else if(req.method == 'GET' && req.url.startsWith('/gateway/storage/user')) {
        if(!authenticate(req)) {
            res.writeHead(401)
            res.end()
            return
        }

        var email = urlArgs.email

        var storage = 0

        var pgQuery = "SELECT size FROM teams WHERE creator = $1"
        dbConnection.query(pgQuery, [email], function(error, response) {
            // console.log(error, response)

            if(error) {
                console.log(error)
                res.writeHead(400)
                res.end()
                return
            }
            
            response.rows.forEach(function(data) {
                if(data.size !== null) {
                    storage += parseInt(data.size)
                }
            })

            pgQuery = "SELECT plan FROM users WHERE email = $1"

            dbConnection.query(pgQuery, [email], function(error, response) {
                // console.log(error, response)

                if(error) {
                    console.log(error)
                    res.writeHead(400)
                    res.end()
                    return
                }
                    
                if(response.rows.length < 0) {
                    res.writeHead(400)
                    res.end()
                    return
                }

                var plan
                if(response.rows[0]) {
                    plan = response.rows[0].plan
                } else {
                    plan = 'free'
                }

                var limit = {
                    free: 40 * 1024 * 1024,
                    standard: 1024 * 1024 * 1024,
                    pro: 10 * 1024 * 1024 * 1024,
                    enterprise: 40 * 1024 * 1024 * 1024,
                }[plan]

                res.writeHead(200, { 'Content-Type': 'application/json'})
                res.end(JSON.stringify({
                    storage: storage,
                    limit: limit,
                    plan: plan,
                }))
            })
        })
    }


    else if(req.method == 'GET' && req.url.startsWith('/gateway/storage/team')) {
        if(!authenticate(req)) {
            res.writeHead(401)
            res.end()
            return
        }

        var teamId = urlArgs.teamId

        var storage = 0

        var pgQuery = "SELECT creator FROM teams WHERE teamid = $1"
        dbConnection.query(pgQuery, [teamId], function(error, response) {
            // console.log(error, response)

            if(error) {
                res.writeHead(400)
                res.end()
                return
            }

            var creatorEmail = response.rows[0].creator

            var pgQuery = "SELECT size FROM teams WHERE creator = $1"
            dbConnection.query(pgQuery, [creatorEmail], function(error, response) {
                // console.log(error, response)

                if(error) {
                    res.writeHead(400)
                    res.end()
                    return
                }
                
                response.rows.forEach(function(data) {
                    if(data.size !== null) {
                        storage += parseInt(data.size)
                    }
                })

                pgQuery = "SELECT plan FROM users WHERE email = $1"

                dbConnection.query(pgQuery, [creatorEmail], function(error, response) {
                    // console.log(error, response)

                    if(error) {
                        res.writeHead(400)
                        res.end()
                        return
                    }
                        
                    if(response.rows.length < 0) {
                        res.writeHead(400)
                        res.end()
                        return
                    }

                    var plan
                    if(response.rows[0]) {
                        plan = response.rows[0].plan
                    } else {
                        plan = 'free'
                    }

                    var limit = {
                        free: 40 * 1024 * 1024,
                        standard: 1024 * 1024 * 1024,
                        pro: 10 * 1024 * 1024 * 1024,
                        enterprise: 40 * 1024 * 1024 * 1024,
                    }[plan]

                    res.writeHead(200, { 'Content-Type': 'application/json'})
                    res.end(JSON.stringify({
                        storage: storage,
                        limit: limit,
                        plan: plan,
                    }))
                })
            })
        })
    }


    else if(req.method == 'GET' && req.url == '/status-endpoint') {
        if(!authenticate(req)) {
            res.writeHead(401)
            res.end()
            return
        }

        res.writeHead(200)
        res.end()
    }

    else {
        res.writeHead(404)
        res.end('Resource not found.')
    }
}

function authenticate(req) {
    /*if(!req.headers.authorization) {
        return
    }

    var gatewaySecret = req.headers.authorization.slice(7)

    if(gatewaySecret != process.env.GATEWAY_SECRET) {
        return
    }*/

    return true
}
