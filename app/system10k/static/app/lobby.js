

localStorage.teamId = location.pathname.slice(6, 10)

if(!localStorage.sessionId) {
    location = '/'
}


var clipboard
var openFolders = []

var user
var yourEmail

var shortTeamId = location.hred.split('id=')[1].slice(0, 4)
var team

var webSocket

var localVideoStream
var localScreenStream

var colors = ['#8af', '#fb2', '#afa', '#ff3', '#f33', '#3ff', '#3f3', '#33f']
var colorCursor = 0
var assignedColors = {}

var activeTab

var firstClick = false

window.addEventListener('DOMContentLoaded', function (event) {
    getUser(function() {
        loadPage()
    })        
})

function loadPage() {
    yourEmail = user.email
    
    document.title = shortTeamId + ' | Prospero.Live'
    document.querySelector('[name="your-email"]').textContent = user.email

    updateOfflineList()
    updateInvitedList()

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

    // registerInviteHandler()

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

    startTimeline()
}


function getUser(done) {
    fetch('/api/user', {
        headers: {
            Authorization: 'Bearer ' + localStorage.sessionId,
        },
    }).then(function (response) {
        if (response.ok) {
            return response.json()
        }
        
        else {
            unAuthed()
        }
    }).then(function(data) {
        user = data
        team = getTeam(shortTeamId)

        if(!user) {
            return
        }
        
        console.log('user:', user)
        
        done()
    })
}

function unAuthed() {
    location.href = '/'
    // document.querySelector('header [name="email"]').textContent = 'You are not logged in.'
}

function connect() {
    console.log('connect')

    var statusElement = document.querySelector('#status-bar')
    statusElement.textContent = 'Connecting to server...'

    var webSocketProtocol = 'wss:'
    if(location.protocol == 'http:') {
        webSocketProtocol = 'ws:'
    } 

    webSocket = new WebSocket(webSocketProtocol + '//' + location.host)
    
    webSocket.addEventListener('open', function (event) {
        statusElement.textContent = 'Connected to server. Measuring latency...'

        var message = {
            type: 'authorization',
            authorization: 'Bearer ' + localStorage.sessionId,
            team: shortTeamId, 
        }

        webSocket.send(JSON.stringify(message))
    })

    webSocket.addEventListener('message', function (event) {
        var message = JSON.parse(event.data)
        // console.log(message)

        if(message.type == 'pong') {
            var latency = Math.ceil((Date.now() - message.pingTime))
            // console.log('Latency:', latency + 'ms')
            document.querySelector('#status-bar').textContent = 'Connected to server with ' + latency + 'ms latency'
        }

        if(message.type == 'authenticated') {
            message.onlineTeam.forEach(function(email) {
                if(email == user.email) return

                // console.log(team)
                team.members[email].online = true
                if(!team.members[email].peerElement) {
                    team.members[email].peerElement = addPeerElement(email)
                }

                if(localVideoStream) {
                    // console.log('b')
                    team.members[email].peerConnections.toVideo = call(email, 'toVideo')
                }
                if(localScreenStream) {
                    team.members[email].peerConnections.toScreen = call(email, 'toScreen')
                }
            })

            updateOfflineList()
            updateInvitedList()
            updateFilesystem()
        }

        if(message.type == 'filesystem-changed') {
            updateFilesystem()
        }

        // if(message.type == 'file-changed') {
        //     patchFile(message.path, message.filename, message.change)
        // }

        if(message.type == 'change-confirmation') {
            // if(message.from == user.email) {
            //     editor.unconfirmedChanges--
            // }

            if(message.success && message.reason == 'checksum-match') {
                markTimeline('#2f2')
            }

            else if(message.success && message.reason == 'checksum-mismatch') {
                markTimeline('#ff2')
            }
            
            else if(!message.success) {
                console.log(message.reason)
                // console.log(message.reason, message.contents)
                markTimeline('#f22')
            }

            else {
                console.log(message.reason)
                // console.log(message.reason, message.contents)
                markTimeline('#f2f')
            }

            var editor = null
            var editorTab = null

            var tabs = document.querySelector('#tabs')
            tabs.querySelectorAll('div').forEach(function(tab) {
                if(tab.key == 'file:' + message.path + message.filename && tab.element.querySelector(".CodeMirror")) {
                    editorTab = tab
                    editor = tab.element.querySelector(".CodeMirror").CodeMirror
                }
            })

            if(!editor) return

            if(!message.success && message.reason == 'checksum') {
                // (message.from == user.email || editor.unconfirmedChanges <= 0)) {
                // closeTab(editorTab)
                // editor.refreshing = true
                // var cursor = editor.getCursor()
                // editor.setValue(message.contents)
                // editor.setCursor(cursor)
                // editor.refreshing = false
            }
        }

        if(message.type == 'team-changed') {
            getUser(function() {
                updateOfflineList()
                updateInvitedList()
            })
        }

        if(message.type == 'set-active-tab') {
            // console.log('set-active-tab', message)
            team.members[message.email].activeTabName = message.tab 
        }
        
        if(message.type == 'set-position') {
            // console.log('set-position', message)
            team.members[message.email].position = {
                line: message.line,
                ch: message.ch,
            }
        }

        if(message.type == 'relay') {
            handlePeerMessage(message.message, null, message.from)
        }

        // if(message.type == 'dm') {
        //     var link = sanitizeHTML(message.link)
        //     toast('<b>' + sanitizeHTML(message.from) + '</b>: ' + sanitizeHTML(message.message) + ' <a target="_blank" href="' + link + '">' + link + '</a>')
        // }

        if(message.type == 'joined') {
            var email = message.email
            
            team.members[email].online = true  

            if(!team.members[email].peerElement) {
                team.members[email].peerElement = addPeerElement(email)
            }

            team.members[email].peerConnections.data = call(email, 'data')

            if(localVideoStream) {
                // if(team.members[email].justCalled === undefined || Date.now() - team.members[email].justCalled > 5000) {
                    // console.log('c')
                    // team.members[email].justCalled = Date.now()
                    team.members[email].peerConnections.toVideo = call(email, 'toVideo')
                // }
            }
            if(localScreenStream) {
                team.members[email].peerConnections.toScreen = call(email, 'toScreen')
            }

            if(activeTab) {
                webSocket.send(JSON.stringify({
                    type: 'set-active-tab',
                    tab: activeTab.name,
                }))                
            }
            
            updateOfflineList()
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
            }

            team.members[email].peerConnections = {}
            delete team.members[email].dataChannel

            updateOfflineList()
        }

        else if(message.type == 'iceCandidate') {
            // console.log('received iceCandidate', message.candidate)
            var candidate = new RTCIceCandidate(message.candidate)

            var peer = team.members[message.from]
            // console.log('peer', peer)
            // console.log('peerConnection', peer.peerConnections[message.channel])


            if(peer.peerConnections[message.channel]) {
                var peerConnection = peer.peerConnections[message.channel]

                function retry() {
                    if(peerConnection.q) {
                        if(peer.peerConnections[message.channel] && peer.peerConnections[message.channel].remoteDescription) {
                            peerConnection.q.forEach(function(item) {
                                peerConnection.addIceCandidate(item)

                                // console.log('commited iceCandiate from queue', item)
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
        
        updateOfflineList()
    }
}

function getTeam(shortTeamId) {
    var result = null


    user.teams.forEach(function(t) {
        var teamId = t.teamId
        if(teamId.slice(0, 4) == shortTeamId) {
            result = t
        }
    })

    var teamObject = {}
    result.members.forEach(function(email) {
        if(user.email != email) {
            teamObject[email] = {
                email: email,
                online: false,
                peerConnections: {},
            }
        }
    })

    result.members = teamObject

    return result
}

function updateOfflineList() {
    var offlineList = document.querySelector('#offline')
    offlineList.innerHTML = '<p name="title" style="font-size: 75%; margin: 1px; text-decoration: underline;">Offline</p>'

    var anyOffline = false
    Object.values(team.members).forEach(function(peer) {
        if(!peer.online) {
            var p = document.createElement('p')
            p.textContent = peer.email
            p.style.margin = '3px'
            p.style.overflow = 'hidden'
            p.style.whiteSpace = 'nowrap'
            offlineList.appendChild(p)
            anyOffline = true
        }
    })

    if(!anyOffline) {
        offlineList.querySelector('[name="title"]').style.display = 'none' 
    }
}

function updateInvitedList() {
    var l = document.querySelector('#invited')
    l.innerHTML = '<p name="title" style="font-size: 75%; margin: 1px; text-decoration: underline;">Invited</p>'

    if(team.invited.length > 0) {
        Object.values(team.invited).forEach(function(peer) {
            var p = document.createElement('p')
            p.textContent = peer
            p.style.margin = '3px'
            p.style.overflow = 'hidden'
            p.style.whiteSpace = 'nowrap'
            l.appendChild(p)
            anyInvited = true
        })
    }

    else {
        l.querySelector('[name="title"]').style.display = 'none' 
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
        
        var pElement = team.members[toEmail].peerElement
        if(pElement !== undefined) {
            var l = team.members[toEmail].peerElement.querySelector('.latency')
            l.textContent = latency + 'ms'
        }
    }

    
    if(message.type == 'editor-changes') {
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


            // Check beforeChecksum and find when it matches
            var otherChanges
        
            var history = editor.history
            console.log('before patch history:', history)
            console.log('before patch checksumTable:', editor.checksumTable)

            var match = editor.checksumTable[message.beforeChecksum]
            
            if(match !== undefined) {
                otherChanges = history.slice(match.index + 1)
            }

            if(otherChanges === undefined) {
                markTimeline('#22f')

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

            var changes = message.changes
            changes.forEach(function(change) {
                change.madeBy = toEmail
            })

            // Shift message.changes by otherChanges
            // shiftChanges(otherChanges, changes, contents)

            // console.log('before otherChanges:', otherChanges)
            // console.log('before changes:', changes)
            

            console.log('before shift changes:', changes)
            shiftChanges(otherChanges, changes)

            console.log('after shift changes:', changes)
            
            console.log('before patch contents:')
            console.log(editor.getValue())
            console.log('---------------------')
            pprint(editor.getValue())

            // console.log('after otherChanges:', otherChanges)
            // console.log('after changes:', changes)

            // var newContents = patchFile(contents, changes, message.checksum)

            message.changes.forEach(function(change) {
                var from = editor.posFromIndex(change.from)
                var to = editor.posFromIndex(change.to)

                // if(change.origin == '+delete' && (change.removed[0].length > 0 || change.removed.length > 0)) {
                //     console.log(editor.getValue())
                //     editor.replaceRange('', change.from, change.to, '+remote')    
                //     console.log(editor.getValue())
                // }
                
                // if(change.origin == '+input' && (change.text[0].length > 0 || change.text.length > 0)) {
                //     editor.replaceRange(change.text.join('\n'), change.from, change.to, '+remote')    
                // }
                
                if(change.removed[0].length > 0 || change.removed.length > 1) {
                    // console.log(editor.getValue())
                    editor.replaceRange('', from, to, '+remote')    
                    // console.log(editor.getValue())
                }
                
                if(change.text[0].length > 0 || change.text.length > 1) {
                    // var len = change.text.join('\n')
                    editor.replaceRange(change.text.join('\n'), from, from, '+remote')    
                }

                // if((change.removed[0].length > 0 || change.removed.length > 1) && (change.text[0].length > 0 || change.text.length > 1)) {
                //     console.log('BOTH removed and text', change)
                // }

                // console.log(editor.getValue())

                change.checksum = crc32(editor.getValue().toString('binary'))
                change.contents = editor.getValue()
                
                // console.log('revisionId receive', message.revisionId)
                // console.log(message.changes)
            })
            

            console.log('after patch contents:')
            console.log(editor.getValue())
            pprint(editor.getValue())

            // if(crc32(editor.getValue()) != message.checksum) {
            //     markTimeline('#f22')
            //     console.log('Checksum mismatch!!!')
            //     console.log(message.changes)
            //     // var cursor = editor.getCursor()
            //     // editor.setValue(message.contents)
            //     // editor.setCursor(cursor)
            // }

            // Add entry to checksum table
            editor.checksumTable[crc32(editor.getValue().toString('binary'))] = {
                index: editor.history.length,
                contents: editor.getValue(),
                historyEntry: changes[0],
            }

            editor.history = editor.history.concat(changes)
            console.log('after patch history:', editor.history)
            console.log('after patch checksumTable:', editor.checksumTable)

            editor.beforeChecksum = crc32(editor.getValue().toString('binary'))
            editor.beforeContents = editor.getValue()

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
