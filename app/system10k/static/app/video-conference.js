
function shareVideo() {
    navigator.mediaDevices.getUserMedia({
        audio: true,
        // audio: {
        //     autoGainControl: true,
        //     echoCancellation: true,
        //     noiseSuppression: true,
        // },
        // video:  true,
        video: {
            width: 320,
            height: 240,
        },
    }).then(function(localStream) {
        localVideoStream = localStream

        // document.querySelector('canvas.audio').style.display = 'block'
        // setupAudio(localStream)
        // processAudioFrame()

        var tabName = 'You'

        var localVideo = document.querySelector('video[name="local-video"]')
        localVideo.addEventListener('click', function() {
            var video
            if(!localVideo.mainVideo) {
                video = document.createElement('video')
                video.autoplay = true
                video.muted = true
                // video.controls = true
                localVideo.mainVideo = video
            } else {
                video = localVideo.mainVideo
            }

            var tab = addTab(tabName, 'stream:camera:' + user.email, video)
            // updateTab(tabName, video)
            switchTab(tab)

            video.srcObject = localStream
        })

        localVideo.srcObject = localStream

        if(localVideo.mainVideo) {
            localVideo.mainVideo.srcObject = localStream
            // updateTab(tabName, video)
        }
        

        Object.values(team.members).forEach(function(peer) {
            if(peer.online) {
                // console.log('a')
                peer.peerConnections.toVideo = call(peer.email, 'toVideo')
                peer.justCalled = Date.now()
            }
        })
    })
    .catch(function(error) {
        console.log('share video error:', error)
    })
}



function shareScreen() {
    navigator.mediaDevices.getDisplayMedia({
        video: true,
        // frameRate: 5,
        // video: {
        //     width: 800,
        //     height: 450,
        // }
    })
    .then(function(localStream) {
        localScreenStream = localStream

        // localScreenStream.onremovetrack = function() {

        // }

        var tabName = 'You'

        var localScreen = document.querySelector('video[name="local-screen"]')        
        // var video
        // localScreen.addEventListener('click', function() {
        //     var video
        //     if(!localScreen.mainVideo) {
        //         video = document.createElement('video')
        //         video.autoplay = true
        //         video.muted = true
        //         video.controls = true
        //         localScreen.mainVideo = video
        //     } else {
        //         video = localScreen.mainVideo
        //     }

        //     var tab = addTab(tabName, 'stream:screen:' + user.email, video)
        //     // updateTab(tabName, video)
        //     switchTab(tab)

        //     video.srcObject = localStream
        // })
        
        localScreen.srcObject = localStream

        if(localScreen.mainVideo) {
            localScreen.mainVideo.srcObject = localStream
            // updateTab(tabName, video)
        }
        
        
        Object.values(team.members).forEach(function(peer) {
            if(peer.online) {
                peer.peerConnections.toScreen = call(peer.email, 'toScreen')
            }
        })
    })
    .catch(function(error) {
        console.log('share screen error', error)
    })
}

function reverseChannel(channel) {
    if(channel == 'toVideo') return 'fromVideo'
    if(channel == 'toScreen') return 'fromScreen'    
    if(channel == 'fromVideo') return 'toVideo'
    if(channel == 'fromScreen') return 'toScreen'    
    if(channel == 'data') return 'data'    
}

function addPeerElement(toEmail) {
    var color

    if(toEmail == teamRest[0].email) {
        document.querySelector('#teammate-outer').style.display = 'none'
        color = teamRest[0].color
    }

    if(teamRest.length > 1 && toEmail == teamRest[1].email) {
        document.querySelector('#third-outer').style.display = 'none'
        color = teamRest[1].color
    }
    // document.querySelector('#teammate-outer').style.display = 'none'

    var peerElement

    // if(assignedColors[toEmail] != undefined) {
    //     color = assignedColors[toEmail]
    // }
    
    // else {
    //     color = colors[colorCursor]
    //     assignedColors[toEmail] = color
    // }

    // colorCursor += 1
    // if(colorCursor >= colors.length) {
    //     colorCursor = 0
    // }

    peerElement = document.createElement('div')
    peerElement.style.borderRadius = '10px'
    peerElement.style.border = 'solid 5px ' + color
    peerElement.style.margin = '5px'
    peerElement.style.backgroundColor = '#fff'
    peerElement.color = color
    
    var p = document.createElement('p')
    p.textContent = toEmail
    p.style.margin = '0'
    p.style.paddingLeft = '3px'
    p.style.borderBottom = 'solid 1px #ddd'
    p.style.overflow = 'hidden'
    p.style.whiteSpace = 'nowrap'
    peerElement.appendChild(p)

    var l = document.createElement('p')
    l.textContent = ''
    l.style.margin = '0'
    l.style.paddingLeft = '3px'
    l.classList.add('latency')
    peerElement.appendChild(l)

    var peerVideoElement = document.createElement('video')
    peerVideoElement.setAttribute('name', 'camera')
    peerVideoElement.classList.add('preview')
    peerVideoElement.style.display = 'none'
    peerVideoElement.autoplay = true
    // peerVideoElement.controls = true
    if(!firstClick) {
        peerVideoElement.muted = true
    }
    peerElement.appendChild(peerVideoElement)
    
    peerVideoElement.addEventListener('click', function(event) {
        event.stopPropagation()
        var video = document.createElement('video')
        video.autoplay = true
        video.muted = true
        // video.controls = true
        peerVideoElement.mainVideo = video

        var tabName = toEmail + ' | Camera'
        var tab = addTab(tabName, 'stream:camera:' + toEmail, video)
        // updateTab(tabName, video)
        switchTab(tab)

        peerVideoElement.mainVideoTab = tab

        video.srcObject = peerVideoElement.srcObject
    })

    var peerScreenElement = document.createElement('video')
    peerScreenElement.setAttribute('name', 'screen')
    peerScreenElement.classList.add('preview')
    peerScreenElement.style.display = 'none'
    peerScreenElement.autoplay = true
    peerScreenElement.muted = true
    // peerScreenElement.controls = true
    peerElement.appendChild(peerScreenElement)

    peerScreenElement.addEventListener('click', function() {
        event.stopPropagation()
        var video = document.createElement('video')
        video.autoplay = true
        video.muted = true
        video.setAttribute('controls', true)
        // video.controls = true
        peerScreenElement.mainVideo = video

        var tabName = toEmail + ' | Screen'
        var tab = addTab(tabName, 'stream:screen:' + toEmail, video)
        // updateTab(tabName, video)
        switchTab(tab)

        peerScreenElement.mainVideoTab = tab

        video.srcObject = peerScreenElement.srcObject
    })

    var peerEditPreviewElement = document.createElement('div')
    peerEditPreviewElement.classList.add('edit-preview')
    peerElement.appendChild(peerEditPreviewElement)


    var lastItem = document.querySelector('#your-element')
    document.querySelector('#right-panel').insertBefore(peerElement, lastItem)

    return peerElement
}

function createPeerConnection(toEmail, channel) {
    var peer = team.members[toEmail]

    // var nodeId = location.href.split('.app.')[1].split('.prospero.')[0]

    // console.log(nodeId)

    var peerConnection = new RTCPeerConnection({
        iceServers: [{
            urls: ['stun:' + envPrefix + 'stun.nyc30.prospero.live:5349'],
            // username: 'username',
            // credential: 'oGtata8EdBtFhQUc',
        }]
    })

    peerConnection.onconnectionstatechange = function(event) {
	console.log(channel, event.target.connectionState)
        //if(peerConnection.connectionState == 'disconnected' || peerConnection.connectionState == 'failed' || peerConnection.connectionState == 'closed') {
        if(peerConnection.connectionState == 'closed') {
            
	    // console.log(peerConnection.connectionState)
            var videoElement

            if(channel == 'fromVideo') {
                videoElement = team.members[toEmail].peerElement.querySelector('[name="camera"]')
            }
            if(channel == 'fromScreen') {
                videoElement = team.members[toEmail].peerElement.querySelector('[name="screen"]')
            }

            // console.log(videoElement)

            if(videoElement && channel == 'fromScreen') { // && peerConnection.connectionState != 'disc) {
                // videoElement.srcObject = null
                videoElement.style.display = 'none'

                if(videoElement.mainVideoTab) {
                    closeTab(videoElement.mainVideoTab)
                }
            }

            // delete team.members[toEmail].peerConnections[channel]

            // if(!team.members[toEmail].peerConnections) {
            //     team.members[toEmail].peerElement.remove()
            //     delete team.members[toEmail].peerElement
            // }
        }
    }

    peerConnection.onerror = function(event) {
        // console.log('Webrtc error:', channel, event)
    }
    
    peerConnection.onclose = function(event) {
        // console.log('Webrtc close:', channel, event)
        
    }
    
    peerConnection.onclosing = function(event) {
        // console.log('Webrtc closing:', channel, event)

    }
            
    peerConnection.onicecandidate = function(event) {
        // console.log('about to send iceCandidate', event, toEmail, yourEmail, channel)
        if(event.candidate) {
            webSocket.send(JSON.stringify({
                type: 'iceCandidate',
                candidate: event.candidate,
                to: toEmail,
                from: yourEmail,
                channel: reverseChannel(channel),
            }))
        } 
        // else if(!['connected', 'completed'].includes(peerConnection.iceConnectionState)) {
        //     console.log('peerConnection.iceConnectionState', peerConnection.iceConnectionState)
        //     console.log('Restarting Ice')
        //     peerConnection.restartIce()
        // } 
        else {
            // console.log('peerConnection.iceConnectionState', peerConnection.iceConnectionState)
        }
        
    }

    peerConnection.oniceconnectionstatechange = function(event) {
        // console.log('oniceconnectionstatechange', event)
    }

    peerConnection.ontrack = function(event) {
        // console.log('ontrack', toEmail, event.streams)
        // console.log('ontrack channel', channel)

        var videoElement

        if(channel == 'fromVideo') {
            videoElement = team.members[toEmail].peerElement.querySelector('[name="camera"]')
        }
        if(channel == 'fromScreen') {
            videoElement = team.members[toEmail].peerElement.querySelector('[name="screen"]')
        }

        videoElement.srcObject = event.streams[0]
        videoElement.style.display = 'inline'

        if(videoElement.mainVideo) {
            videoElement.mainVideo.srcObject = event.streams[0]
        }

        // event.track.addEventListener('ended', function() {
        //     videoElement.style.display = 'none'

        //     console.log(videoElement)

        //     if(videoElement.mainVideo) {
        //         closeTab(videoElement.mainVideo)
        //     }
        // })
    }

    peerConnection.ondatachannel = function(event) {
        // return
        var dataChannel = event.channel
        team.members[toEmail].dataChannel = dataChannel
        
        dataChannel.onopen = function(event) {
            // console.log('dataChannel opened from', toEmail)

            setInterval(function () {
                if(dataChannel.readyState == 'open') {
                    dataChannel.send(JSON.stringify({
                        type: 'ping',
                        time: Date.now(),
                    }))
                }
            }, 5 * 1000)
        }


        dataChannel.onmessage = function(event) {
            handlePeerMessage(JSON.parse(event.data), dataChannel, toEmail)
        }
        
    }

    return peerConnection
}

function call(toEmail, channel) {
    // console.log('call', toEmail, channel)
    precall(toEmail, channel)
    return call2(toEmail, channel)
}

function precall(toEmail, channel) {
    // console.log('sent precall', toEmail, channel)
    webSocket.send(JSON.stringify({
        type: 'precall',
        to: toEmail,
        from: yourEmail,
        channel: reverseChannel(channel),
    }))
}

function call2(toEmail, channel) {
    // console.log('call', toEmail, channel)
    var peerConnection = createPeerConnection(toEmail, channel)

    peerConnection.onnegotiationneeded = function(event) {
        peerConnection.createOffer()
        .then(function(offer) {
		var sessionDescription = offer
	    // var Bandwidth = 5000;
	//	sessionDescription.sdp = sessionDescription.sdp.replace(/b=AS:([0-9]+)/g, 'b=AS:'+Bandwidth+'\r\n');

            // console.log('offer', toEmail, offer)
            return peerConnection.setLocalDescription(offer)
        })
        .then(function() {
            // console.log('send offer')
            webSocket.send(JSON.stringify({
                type: 'offer',
                offer: peerConnection.localDescription,
                to: toEmail,
                from: yourEmail,
                channel: reverseChannel(channel),
            }))
        })
    }

    if(channel == 'toVideo') {
        localVideoStream.getTracks().forEach(function(track) {
            peerConnection.addTrack(track, localVideoStream)
        })
    }

    if(channel == 'toScreen') {
        localScreenStream.getTracks().forEach(function(track) {
            peerConnection.addTrack(track, localScreenStream)
        })
    }

    if(channel == 'data') {
        // return
        var dataChannel = peerConnection.createDataChannel('data')
        team.members[toEmail].dataChannel = dataChannel

        dataChannel.onopen = function(event) {
            // console.log('dataChannel opened to', toEmail)

            setInterval(function () {
                if(dataChannel.readyState == 'open') {
                    dataChannel.send(JSON.stringify({
                        type: 'ping',
                        time: Date.now(),
                    }))
                }
            }, 5 * 1000)
        }

        dataChannel.onmessage = function(event) {
            handlePeerMessage(JSON.parse(event.data), dataChannel, toEmail)
        }
        
    }

    return peerConnection
}
