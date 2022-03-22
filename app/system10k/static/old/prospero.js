console.log('asdfasd')


document.querySelector('#exit').addEventListener('click', function() {
    location = 'https://dev.prospero.live/user/dashboard'
})

var logoutLink = document.querySelector('#logout')
logoutLink.addEventListener('click', function (event) {
    event.preventDefault()

    fetch('/auth/logout', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + localStorage.sessionId,
        },
    }).then(function (response) {
        if (response.ok) {
            delete localStorage.sessionId
            location.href = '/'
        }
        
        else {
            console.log('Logout failed.')
        }
    })

    return false
})


// localStorage.teamId = location.pathname.slice(6, 10)
var teamId = location.hostname.slice(0, 4) + location.hostname.slice(5, 33)

if(Date.now() > localStorage.expiresAt - (20 * 60 * 1000)) {
    location.href = '/auth/start'
}

var clipboard
var openFolders = []

var lastCliCommand

var user = {}
var yourEmail

var teammate

//  = {
//     email: localStorage.email,
// }

//  = user.email

var team = {
    members: {}
}


// team.members[yourEmail] = {
//     email: localStorage.teammate,
//     online: false,
//     peerConnections: {},
// }

var webSocket

var localVideoStream
var localScreenStream

var colors = ['#8af', '#fb2']
var colorCursor = 0
var assignedColors = {}

var activeTab

var firstClick = false

var collabDebugLog = []

setInterval(function() {
    if(Date.now() > localStorage.expiresAt) {
        location.href = '/auth/start'
    } else if(Date.now() > localStorage.expiresAt - (20 * 60 * 1000)) {
        var timeLeft = (localStorage.expiresAt - Date.now()) / (60 * 1000)
        toast('Your current session will end in ' + Math.floor(timeLeft) + ' minutes. Exit and re-enter to re-auth.')
    }
}, 1 * 60 * 1000)

setInterval(function() {
    fetch('/user/storage', {
        headers: {
            Authorization: 'Bearer ' + localStorage.sessionId,
        },
    }).then(function (response) {
        if (response.ok) {
            return response.json()
        }

        else if(response.status == 401) {
            location.href = '/'
        }
        
        else {
            console.log(response.status)
        }   
    }).then(function(data) {
        console.log('limit:', data.limit, 'storage:', data.storage)

        document.querySelector('#storage').textContent = (data.storage / (1024 * 1024)).toFixed(2) + ' / ' + (data.limit / (1024 * 1024)).toFixed(2) + ' MB'
    })
}, 10 * 1000)

setInterval(function() {
    // var cm = document.querySelector('#main-view .CodeMirror')
    
    if(!activeTab || !activeTab.element || !activeTab.element.editor) {
        return
    }
    
    var cm = activeTab.element.editor

    if(cm) {
        console.log('send debug info')
        
        if(activeTab.key.split(':')[0] != 'file') {
            return
        }

        var path = activeTab.key.split(':')[1].split('/').slice(0, -1).join('/') + '/'
        var filename = activeTab.key.split(':')[1].split('/').slice(-1)

        fetch('/api/debug/collab?path=' + encodeURIComponent(path) + '&filename=' + encodeURIComponent(filename), {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + localStorage.sessionId,
            },
            body: JSON.stringify({
                value: cm.getValue(),
                log: collabDebugLog,
            })
        })

        collabDebugLog = []
    }
}, 1000)

window.addEventListener('DOMContentLoaded', function (event) {
    getUser(function() {
        loadPage()
    })        
})

function loadPage() {
    document.title = teamId.slice(0, 4) + ' w/ ' + teammate + ' | Prospero.Live'
    document.querySelector('[name="your-email"]').textContent = user.email
    document.querySelector('#teammate').textContent = teammate

    document.querySelector('button[name="share-video"]').addEventListener('click', function() {
        document.querySelector('[name="local-video"]').style.display = 'inline'
        shareVideo()
    })
    
    document.querySelector('button[name="share-screen"]').addEventListener('click', function() {
        document.querySelector('[name="local-screen"]').style.display = 'inline'
        shareScreen()    
    })

    window.addEventListener('click', function() {
        firstClick = true
        if(team) {
            Object.values(team.members).forEach(function(peer) {
                var peerElement = peer.peerElement
                if(peerElement !== undefined) {
                    var peerCameraElement = peerElement.querySelector('[name="camera"]')
                    peerCameraElement.muted = false
                }
            })
        }
    })

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


function getUser(done) {
    fetch('/auth/check', {
        headers: {
            Authorization: 'Bearer ' + localStorage.sessionId,
        },
    }).then(function (response) {
        if (response.ok) {
            return response.json()
        }
        
        else if(response.status == 401) {
            delete localStorage.sessionId
            location.href = '/auth/start'
        }

        else {
            console.log('error:', response.status)
        }
    }).then(function(data) {
        user.email = data.email
        yourEmail = data.email

        team.members[yourEmail] = {
            email: yourEmail,
            online: false,
            peerConnections: {},
        }

        teammate = data.teammate

        done()
    })
}

function connect() {
    console.log('connect')

    var statusElement = document.querySelector('#status-bar')
    statusElement.textContent = 'Connecting to server...'

    var webSocketProtocol = 'wss:' 

    webSocket = new WebSocket(webSocketProtocol + '//' + location.host)
    
    webSocket.addEventListener('open', function (event) {
        statusElement.textContent = 'Connected to server. Measuring latency...'

        var message = {
            type: 'authorization',
            authorization: 'Bearer ' + localStorage.sessionId,
            team: teamId, 
        }

        webSocket.send(JSON.stringify(message))
    })

    webSocket.addEventListener('message', function (event) {
        var message = JSON.parse(event.data)
        console.log('message', message)

        if(message.type == 'pong') {
            var latency = Math.ceil((Date.now() - message.pingTime))
            document.querySelector('#status-bar').textContent = 'Connected to server with ' + latency + 'ms latency'
            updateFilesystem()
        }

        if(message.type == 'authenticated') {
            message.onlineTeam.forEach(function(email) {
                if(email == user.email) return
                
                if(!team.members[email]) {
                    team.members[email] = {
                        email: email,
                        online: false,
                        peerConnections: {},
                    }    
                }

                team.members[email].online = true
                
                if(!team.members[email].peerElement) {
                    team.members[email].peerElement = addPeerElement(email)
                }

                if(localVideoStream) {
                    team.members[email].peerConnections.toVideo = call(email, 'toVideo')
                }

                // console.log(localScreenStream)
                if(localScreenStream) {
                    team.members[email].peerConnections.toScreen = call(email, 'toScreen')
                }
            })

            updateFilesystem()
        }

        if(message.type == 'filesystem-changed') {
            updateFilesystem()
        }

        if(message.type == 'set-active-tab') {
            team.members[message.email].activeTabName = message.tab 
        }
        
        if(message.type == 'set-position') {
            team.members[message.email].position = {
                line: message.line,
                ch: message.ch,
            }
        }

        if(message.type == 'over-limit') {
            // activeTab.element.editor.setOption('readOnly', true)
            promptForPayment()
        }

        if(message.type == 'upload-progress') {
            console.log(message)
            // var progressElement = document.querySelector('progress')
            // if(!progressElement) {
            //     progressElement = document.createElement('progress')
            //     progressElement.style.position = 'fixed'
            //     progressElement.style.bottom = '0px'
            //     progressElement.style.left = '10px'
            //     progressElement.style.width = '120px'
            //     // uploadBar.max = '100'
            //     document.body.appendChild(progressElement)
            // }

            // progressElement.value = (message.received / message.size).toString()
        }

        if(message.type == 'relay') {
            handlePeerMessage(message.message, null, message.from)
        }

        if(message.type == 'joined') {
            document.querySelector('#bell').play()

            var email = message.email

            if(!team.members[email]) {
                team.members[email] = {
                    email: email,
                    online: false,
                    peerConnections: {},
                }    
            }

            team.members[email].online = true

            if(!team.members[email].peerElement) {
                team.members[email].peerElement = addPeerElement(email)
            }

            team.members[email].peerConnections.data = call(email, 'data')

            if(localVideoStream) {
                team.members[email].peerConnections.toVideo = call(email, 'toVideo')
            }
            
            console.log(localScreenStream)
            if(localScreenStream) {
                team.members[email].peerConnections.toScreen = call(email, 'toScreen')
            }

            if(activeTab) {
                webSocket.send(JSON.stringify({
                    type: 'set-active-tab',
                    tab: activeTab.name,
                }))                
            }
        }
        
        if(message.type == 'left') {
            var email = message.email
            console.log(email, 'left')
            team.members[email].online = false

            if(team.members[email].peerElement) {
                var cameraElement = team.members[email].peerElement.querySelector('[name="camera"]')
                if(cameraElement) {
                    closeTab(cameraElement.mainVideoTab)
                }
                
                var screenElement = team.members[email].peerElement.querySelector('[name="screen"]')
                if(screenElement) {
                    closeTab(screenElement.mainVideoTab)
                }

                team.members[email].peerElement.remove()
                delete team.members[email].peerElement

                document.querySelector('#teammate-outer').style.display = 'block'
            }

            team.members[email].peerConnections = {}
            delete team.members[email].dataChannel
        }

        else if(message.type == 'iceCandidate') {
            var candidate = new RTCIceCandidate(message.candidate)

            var peer = team.members[message.from]

            if(peer.peerConnections[message.channel]) {
                var peerConnection = peer.peerConnections[message.channel]

                function retry() {
                    if(peerConnection.q) {
                        if(peer.peerConnections[message.channel] && peer.peerConnections[message.channel].remoteDescription) {
                            peerConnection.q.forEach(function(item) {
                                peerConnection.addIceCandidate(item)
                            })
                            
                            peerConnection.q = []
                        }

                        else {
                            setTimeout(function() {
                                retry()
                            }, 1000)    
                        }
                    }
                }
                
                // console.log('remoteDescription', peer.peerConnections[message.channel].remoteDescription)
                if(!peer.peerConnections[message.channel].remoteDescription) {
                    if(!peerConnection.q) {
                        peerConnection.q = []
                    }

                    // console.log('iceCandidate pushed to queue')
                    peerConnection.q.push(candidate)
                    // console.log('got ice message too early: no remoteDescription')

                    setTimeout(function() {
                        retry()
                    }, 1000)
                }
                
                else {
                    retry()
                    peerConnection.addIceCandidate(candidate)
                    // console.log('commited iceCandiate immediately', candidate)
                }
            }
            
            else {
                // console.log('got ice message too early: no peerConnection')
            }
        }
        
        else if(message.type == 'answer') {
            var peer = team.members[message.from]
            var sessionDescription = new RTCSessionDescription(message.answer)
            var peerConnection = peer.peerConnections[message.channel]
            peerConnection.setRemoteDescription(sessionDescription)
        }

        else if(message.type == 'precall') {
            // console.log('received precall', message.from, message.channel)
            var toEmail = message.from
            var peer = team.members[message.from]
            
            delete peer.peerConnections[message.channel]
        }
        
        else if(message.type == 'offer') {
            var toEmail = message.from
            var peer = team.members[message.from]
            
            var peerConnection = createPeerConnection(toEmail, message.channel)
            peer.peerConnections[message.channel] = peerConnection

            var sessionDescription = new RTCSessionDescription(message.offer)

            peerConnection.setRemoteDescription(sessionDescription)
            .then(function() {
                return peerConnection.createAnswer()
            })
            .then(function(answer) {
                // console.log('answer', toEmail, answer)  
                return peerConnection.setLocalDescription(answer)
            })
            .then(function() {
                webSocket.send(JSON.stringify({
                    type: 'answer',
                    answer: peerConnection.localDescription,
                    to: toEmail,
                    from: yourEmail,
                    channel: reverseChannel(message.channel),
                }))
            })
        }
    })

    webSocket.addEventListener('error', function (event) {
        statusElement.textContent = 'Disconnected. Trying to reconnect...'
        console.log('webSocket error:', event)
        closeWebSocket()
    })
    
    webSocket.addEventListener('close', function (event) {
        statusElement.textContent = 'Disconnected. Trying to reconnect...'
        console.log('webSocket closed:', event)
        closeWebSocket()
    })
    
    function closeWebSocket() {
        Object.values(team.members).forEach(function(peer) {
            if(peer.peerElement) {
                    peer.peerElement.remove()
                delete peer.peerElement
            }
            
            peer.online = false
            
            peer.peerConnections = {}
            delete peer.dataChannel
        })
    }
}


var processedMessages = {}
var shortTermMemory = {}

function handlePeerMessage(message, replyChannel, toEmail) {
    if(message.type == 'ping') {
        try {
            replyChannel.send(JSON.stringify({
                type: 'pong',
                pingTime: message.time,
                time: Date.now(),
            }))
        } catch(e) {
            console(e)
        }
    }

    if(message.type == 'pong') {
        var latency = Math.ceil((Date.now() - message.pingTime))
        team.members[toEmail].latency = latency
        
        var pElement = team.members[toEmail].peerElement
        if(pElement !== undefined) {
            var l = team.members[toEmail].peerElement.querySelector('.latency')
            l.textContent = latency + 'ms'
        }
    }

    if(message.type == 'collab-test-event') {
        receiveTestEvent(message)
    }
    
    if(message.type == 'editor-changes') {
        console.log(message)

        if(processedMessages[message.id]) {
            return
        }

        else {
            processedMessages[message.id] = true
        }

        var editor  = null
        var tabName = '≡ ' + message.filename + ' in ' + message.filepath
        
        var tabs = document.querySelector('#tabs')
        tabs.querySelectorAll('div').forEach(function(tab) {
            if(tab.key == 'file:' + message.filepath + message.filename && tab.element.querySelector(".CodeMirror"))  {
                editor = tab.element.querySelector(".CodeMirror").CodeMirror
            }
        })

        var fullPath = message.filepath + message.filename

        if(editor) {
            console.log('\n\n\n----------------------------------\nRECEIVED CHANGE MESSAGE\n')
            console.log('message:', message)


            collabDebugLog.push(JSON.parse(JSON.stringify({ type: 'received edit', at: Date.now() })))
            collabDebugLog.push(JSON.parse(JSON.stringify(message)))

            // Check beforeChecksum and find when it matches
            var otherChanges
        
            var history = editor.history
            console.log('before patch history:', history)
            console.log('before patch checksumTable:', editor.checksumTable)

            collabDebugLog.push(JSON.parse(JSON.stringify(history)))
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.checksumTable)))
            
            var match = editor.checksumTable[message.beforeChecksum]
            collabDebugLog.push(JSON.parse(JSON.stringify(match || 'undefined')))
            
            if(match !== undefined) {
                otherChanges = history.slice(match.index + 1)
            }

            collabDebugLog.push(JSON.parse(JSON.stringify(otherChanges || 'undefined')))
            
            if(otherChanges === undefined) {
                return
            }

            else if(otherChanges.length > 0) {
                // add entry to checksum table
                editor.checksumTable[message.checksum] = {
                    index: match.index,
                    contents: editor.getValue(),
                    historyEntry: editor.history[match.index],
                }
            }

            collabDebugLog.push(JSON.parse(JSON.stringify(editor.checksumTable))) 
            
            var change = message.change
            message.change.madeBy = toEmail

            collabDebugLog.push(JSON.parse(JSON.stringify(change)))

            shiftChange(otherChanges, message.change, editor.checksumTable, match)

            collabDebugLog.push(JSON.parse(JSON.stringify(otherChanges)))
            collabDebugLog.push(JSON.parse(JSON.stringify(change)))
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.getValue())))
            collabDebugLog.push(JSON.parse(JSON.stringify(message)))

            var from = editor.posFromIndex(change.from)
            var to = editor.posFromIndex(change.to)
            
            collabDebugLog.push(JSON.parse(JSON.stringify(from)))
            collabDebugLog.push(JSON.parse(JSON.stringify(to)))
            
            if(change.removed[0].length > 0 || change.removed.length > 1) {
                // console.log(editor.getValue())
                editor.replaceRange('', from, to, '+remote')    
                // console.log(editor.getValue())
            }
            
            if(change.text[0].length > 0 || change.text.length > 1) {
                // var len = change.text.join('\n')
                editor.replaceRange(change.text.join('\n'), from, from, '+remote')    
            }

            change.checksum = crc32(editor.getValue().toString('binary'))
            change.contents = editor.getValue()

            collabDebugLog.push(JSON.parse(JSON.stringify(change.checksum)))
            collabDebugLog.push(JSON.parse(JSON.stringify(change.contents)))

            editor.checksumTable[crc32(editor.getValue().toString('binary'))] = {
                index: editor.history.length,
                contents: editor.getValue(),
                historyEntry: change,
            }
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.checksumTable)))
            
            editor.history = editor.history.concat(change)
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.history)))

            editor.beforeChecksum = crc32(editor.getValue().toString('binary'))
            editor.beforeContents = editor.getValue()
            
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.beforeChecksum)))
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.beforeContents)))

            // if(shortTermMemory[fullPath].length > 50) {
            //     shortTermMemory[fullPath] = shortTermMemory[fullPath].slice(shortTermMemory[fullPath].length - 50)
            // }
        }
    }


    if(message.type == 'cursor-position') {
        // console.log('cursor-position', message)
        var editor  = null
        var tabName = '≡ ' + message.filename + ' in ' + message.filepath
        
        var tabs = document.querySelector('#tabs')
        tabs.querySelectorAll('div').forEach(function(tab) {
            if(tab.key == 'file:' + message.filepath + message.filename && tab.element.querySelector(".CodeMirror")) {
                editor = tab.element.querySelector(".CodeMirror").CodeMirror
            }
        })

        var peerEditPreview = team.members[toEmail].peerElement.querySelector('.edit-preview')
        peerEditPreview.innerHTML = '<pre style="margin: 0; font-family: Cousine, monospace;">' + sanitizeHTML(message.nearby) + '</pre>'

        // peerEditPreview.addEventListener('click', function() {
        //     var fileView = createFileView(message.filename, message.filepath)
        //     var icon = getIconFromFilename(message.filename)
        //     var tab = addTab(icon + ' ' + message.filename, 'file:' + message.filepath + message.filename, fileView)

        //     switchTab(tab)
        // })

        if(editor && team.members[toEmail]) {
            var cursorPos = {
                line: message.line,
                ch: message.ch,
            }
            var cursorCoords = editor.cursorCoords(cursorPos);


            if(team.members[toEmail].cursor) {
                team.members[toEmail].cursor.clear()
            }

            var cursorElement = document.createElement('span');
            cursorElement.style.borderLeftStyle = 'solid';
            cursorElement.style.borderLeftWidth = '2px';
            // cursorElement.style.borderLeftColor = '#ff0000';
            cursorElement.style.borderLeftColor = team.members[toEmail].peerElement.color;
            // cursorElement.style.height = (cursorCoords.bottom - cursorCoords.top) + 'px'
            // cursorElement.style.height = '16px'
            cursorElement.style.padding = 0;
            cursorElement.style.marginLeft = '-2px';
            // cursorElement.style.marginTop = '-3px';
            // cursorElement.style.display = 'inline-block';
            // cursorElement.style.zIndex = 0;

            var otherCursor = editor.setBookmark(cursorPos, {
                widget: cursorElement,
            })

            if(team.members[toEmail].cursorInterval) {
                clearInterval(team.members[toEmail].cursorInterval)
            }

            team.members[toEmail].cursorPos = cursorPos
            team.members[toEmail].cursorState = true
            team.members[toEmail].cursorInterval = setInterval(function() {
                if(team.members[toEmail] && team.members[toEmail].peerElement) {
                    if(team.members[toEmail].cursorState) {
                        // cursorElement.style.borderLeftColor = '#ffcccc'
                        cursorElement.style.borderLeftColor = '#ffffff80'
                        team.members[toEmail].cursorState = false
                    } else {
                        // cursorElement.style.borderLeftColor = '#ff0000'
                        cursorElement.style.borderLeftColor = team.members[toEmail].peerElement.color
                        team.members[toEmail].cursorState = true
                    }
                }
            }, 530)
            team.members[toEmail].cursor = otherCursor
        }
    }
}

document.querySelector('#whiteboard').addEventListener('click', function() {
// document.addEventListener('keydown', function(event) {
    // if(event.key == 'z' && event.ctrlKey) {
        // console.log('asdf')
        var whiteboard = createWhiteboard()
        var whiteboardId = Math.floor(Math.random() * 8999) + 1000
        var tab = addTab('wb-' + whiteboardId, 'wb:' + whiteboardId, whiteboard)
        switchTab(tab)
    // }
})