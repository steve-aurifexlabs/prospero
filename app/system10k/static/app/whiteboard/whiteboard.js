var paletteHeight = 20

function loadWhiteboard(img, mimeType) {
    var colors = ['#ffffff', '#000000', '#000088', '#008800', '#880000', '#888888', '#fefefe']
    var paletteWidth = 80
    
    var whiteboard = createWhiteboard()
    
    var c = whiteboard.getContext('2d')
    c.drawImage(img, 0, paletteHeight)

    // Palette
    colors.forEach(function(color, i) {
        c.fillStyle = color + '80'
        c.fillRect(i * paletteWidth, 0, paletteWidth, paletteHeight)
    })


    c.strokeStyle = '#000000'
    c.strokeRect(paletteWidth * (colors.length - 1), 0, paletteWidth, paletteHeight)

    c.fillStyle = '#222222'
    c.font = '14px sans-serif'
    c.fillText('Eraser', 20, 15)
    //c.fillText('Mix', 240, 150)
    //c.fillText('Script', 320, 150)
    //c.fillText('Go', 800, 15)

    whiteboard.whiteboardId = Math.floor(Math.random() * 8999) + 1000
    var tab = addTab('wb-' + whiteboard.whiteboardId, 'wb:' + whiteboard.whiteboardId, whiteboard)
    switchTab(tab)
}

function saveWhiteboard(canvas, latest) {
    var shouldSendLiveWhiteboard = false

    if(!latest || Date.now() > 2 * 1000 + canvas.lastSaveAt) {
        canvas.lastSaveAt = Date.now()
    } else {
	return
    }

    /*if(!latest || Date.now() > 500 + canvas.lastSentAt) {
        canvas.lastSentAt = Date.now()
	//shouldSendLiveWhiteboard = true
    }*/

    var path = '/'
    var now = (new Date()).toString()
    var name

    if(latest) {
        name = 'wb-' + canvas.whiteboardId + '.png' 
    } else {
        name = 'wb-' + now.slice(0, 3) + '-' + now.slice(16, 24) + '-' + canvas.whiteboardId + '.png'
    }

    var tempCanvas = document.createElement('canvas')
    tempCanvas.width = canvas.width
    tempCanvas.height = canvas.height - paletteHeight

    var c = tempCanvas.getContext('2d')
    c.drawImage(canvas, 0, -paletteHeight)

    tempCanvas.toBlob(function(blob) {
        fetch('/api/fs/uploadFile?path=' + encodeURIComponent(path) + '&filename=' + encodeURIComponent(name), {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + localStorage.sessionId,
            },
            body: blob,
        }).then(function(response) {
            if(response.ok) {
                // console.log('ok')
            }

            else if(response.status == 401) {
                location.href = '/'
            }

            else if(response.status == 507) {
                promptForPayment()
            }

            else {
                console.log('upload error')
            }
        })

	if(shouldSendLiveWhiteboard) {
		// Send directly
		Object.values(team.members).forEach(function(teammate) {
			if(teammate.online && teammate.email != yourEmail) {
				var reader = new FileReader()

	  			reader.addEventListener("load", function () {
					webSocket.send(JSON.stringify({
				        	type: 'relay',
					        to: teammate.email,
					        message: {
	                                        	type: 'whiteboard',
		                                        whiteboardId: canvas.whiteboardId,
		                                        time: Date.now(),
		                                        data: reader.result,
		                                },
					}))
				}, false)

				if (blob) {
					reader.readAsDataURL(blob)
				}
			}
		})
	}
    })
}

function createWhiteboard(whiteboardId) {
    var canvas = document.createElement('canvas')
    if(whiteboardId) {
	canvas.whiteboardId = whiteboardId
    } else {
        canvas.whiteboardId = (Math.floor(Math.random() * 8999) + 1000).toString()
    }

    canvas.lastSaveAt = Date.now() - 10 * 1000
    canvas.lastSentAt = Date.now() - 10 * 1000

    canvas.setAttribute('width', '1200')
    canvas.setAttribute('height', '800')
    canvas.style.margin = '0 auto'
    canvas.style.padding = '0'
    canvas.style.border = '3px solid black'
    canvas.style.borderRadius = '15px'
    canvas.style.cursor = "url('/static/images/blackpen.png') 1 32, crosshair"
    canvas.style.backgroundColor = '#fff'

    var c = canvas.getContext('2d')

    var gridSize = 20
    var paletteWidth = 4
    var colors = ['#ffffff', '#000000', '#000088', '#008800', '#880000', '#888888', '#fefefe', '#ddddff', '#ddffdd']
    var penWidth = 3
    var eraserColor = colors[0]
    var eraserWidth = 50
    var gridColor = colors[5]
    var icons = {
        '#ffffff': 'eraser.png',
        '#000000': 'blackpen.png',
        '#000088': 'bluepen.png',
        '#008800': 'greenpen.png',
        '#880000': 'redpen.png',
        '#888888': 'graypen.png',
        '#fefefe': 'whitepen.png',
	'#ddddff': 'bluepen.png',
        '#ddffdd': 'greenpen.png',
    }


    var penColor
    function setPenColor(color) {
        penColor = color
        canvas.style.borderColor = penColor
    }
    setPenColor(colors[1])

    var previousPosition
    var pointerDown = false

    c.fillStyle = '#fff'
    c.fillRect(0, 0, canvas.width, canvas.height)

    // Grid
    c.fillStyle = gridColor + '40'
    for(var i = 0; i < canvas.width; i += gridSize) {
        for(var j = 0; j < canvas.height; j += gridSize) {
            c.fillRect(i, j, 2, 2)
        }  
    }

    // Palette
    colors.forEach(function(color, i) {
        c.fillStyle = color + '80'
        c.fillRect(i * gridSize * paletteWidth, 0, paletteWidth * gridSize, gridSize)
    })

    c.fillStyle = '#222222'
    c.font = '14px sans-serif'
    c.fillText('Eraser', 20, 15)
    c.fillText('🖌', 590, 15)
    c.fillText('👆', 670, 15)

    //c.strokeStyle = '#000000'
    //c.strokeRect(gridSize * paletteWidth * (colors.length - 1), 0, gridSize * paletteWidth, gridSize)

    canvas.addEventListener('pointermove', function(event) {
	//event.preventDefault()
	event.pressure = 0.5
	//var touch = event.touches.item(0)
	//console.log('touches[0]', touch)

	const rect = event.target.getBoundingClientRect();
	event.offsetX = event.clientX - rect.left
	event.offsetY = event.clientY - rect.top
        moveInputEvent(event)
	//return false
    })

/*
    canvas.addEventListener('pointermove', function(event) {
	console.log('pointermove', event)

        moveInputEvent(event)
    })
*/

    function moveInputEvent(event) {
        var x = event.offsetX + 3
        var y = event.offsetY + 3

	//console.log('previousPosition', previousPosition)
        
	//console.log('move', event)

	var pressure
	//if(event.pointerType == 'pen' && event.pressure < 0.001) {
	//	pressure = 0.5
	//} else {
		pressure = event.pressure
	//}

        if(pressure > 0 && previousPosition && pointerDown) {
	//console.log('pointermove', event)

        //if((event.pressure > 0 || event.pointerType == 'pen') && previousPosition) {
            if(penColor == eraserColor) {
                c.lineWidth = eraserWidth
                c.strokeStyle = penColor + 'ff'
                c.fillStyle = penColor + 'ff'
            } else if(penColor == '#ddddff') {
                c.lineWidth = eraserWidth - 30
                c.strokeStyle = penColor + 'ff'
                c.fillStyle = penColor  + 'ff'
            } else if(penColor == '#ddffdd') {
		return
            } else {
                c.lineWidth = penWidth
                var alpha = Math.floor(event.pressure * 256).toString(16)
                c.strokeStyle = penColor + alpha
                c.fillStyle = penColor + alpha
            }

            c.beginPath()
            c.moveTo(previousPosition.x, previousPosition.y)
            c.lineTo(x, y)
            c.stroke()

            // Circular end caps
            if(penColor == eraserColor) {
                c.beginPath()
                c.arc(previousPosition.x, previousPosition.y, c.lineWidth / 2, 0, 2 * Math.PI)
                c.fill()
        
                c.beginPath()
                c.arc(x, y, c.lineWidth / 2, 0, 2 * Math.PI)
                c.fill()
            }

            saveWhiteboard(canvas, true)
        }

        if(y < gridSize && x < colors.length * paletteWidth * gridSize) {
            canvas.style.cursor = "crosshair"
        } else if(penColor == eraserColor) {
            canvas.style.cursor = "url(/static/images/" + icons[eraserColor] + ") 23 23, crosshair"
        } else {
            canvas.style.cursor = "url(/static/images/" + icons[penColor] + ") 1 32, crosshair"
        }

        previousPosition = {
            x: x,
            y: y,
        }
    }

    canvas.addEventListener('pointerdown', function(event) {
	//console.log('pointerdown', event)

	startInputEvent(event)
    })
/*
    canvas.addEventListener('mousedown', function(event) {
	startInputEvent(event)
    })
*/
    function startInputEvent(event) {
        var x = event.offsetX + 3
        var y = event.offsetY + 3
        
        if(y < gridSize && x < colors.length * paletteWidth * gridSize) {
            colors.forEach(function(color, i) {
                if(x >= paletteWidth * gridSize * i && x < paletteWidth * gridSize * (i + 1)) {
                    setPenColor(color)
                }
            })
        }

        if(penColor == '#ddddff') {
		c.lineWidth = 20
            c.fillStyle = penColor + 'ff'
	}
        if(penColor == eraserColor) {
            c.lineWidth = eraserWidth
            c.fillStyle = penColor + 'ff'
        }

        c.beginPath()
        c.arc(x, y, c.lineWidth / 2, 0, 2 * Math.PI)
        c.fill()

        previousPosition = {
            x: x,
            y: y,
        }

        saveWhiteboard(canvas, true)
	pointerDown = true
    }

    canvas.addEventListener('pointerup', function(event) {
	//console.log('pointerup', event)
	endInputEvent(event)
    })
/*
    canvas.addEventListener('mouseup', function(event) {
        endInputEvent(event)
    })
*/
    function endInputEvent(event) {
	delete previousPosition
	pointerDown = false
    }

    return canvas
}
