'Requires: node v12.x, postmark'

'node dependencies'
var process = require('process')
var child_process = require('child_process')

'npm dependencies'
var postmark = new (require('postmark').ServerClient)(process.env.POSTMARK_KEY)

'constants'
alertPeriod = 30  // minutes

'start'
process.title = 'al-monitor'

setInterval(main, 1 * 60 * 1000)

var lastAlertAt = 0 
function alert(message) {
    var now = Date.now()
    if(now - lastAlertAt > alertPeriod * 60 * 1000) {
        lastAlertAt = now

        postmark.sendEmail({
            From: 'contact@aurifexlabs.com',
            To: 'steve@aurifexlabs.com',
            Subject: 'Monitor alert!',
            TextBody: message,
        })
    }
}

function main() {   
    var running = false

    var process = child_process.exec('netstat -tulpn | grep -o "[[:digit:]]*/al-server"')
    
    process.on('close', function(code) {
        console.log('netstat done with exit code:', code)
    
        if(!running) {
            alert('prospero.live is down!')
        }
    })
    
    process.stdout.on('data', function(data) {
        console.log(data.toString())
        
        running = true
    })
    
    process.stderr.on('data', function(data) {
        console.log(data.toString())
    })
    
    process.on('error', function(error) {
        console.log('netstat error:', error)
        alert('Monitor failed!')
    })
}