var canvas = document.querySelector('canvas')
var c = canvas.getContext('2d')

var gridSize = 20
var paletteWidth = 4
var colors = ['#ffffff', '#000000', '#000088', '#008800', '#880000', '#888888']
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
}


var penColor
function setPenColor(color) {
    penColor = color
    canvas.style.borderColor = penColor
}
setPenColor(colors[1])

var previousPosition

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

c.fillStyle = '222222'
c.font = '14px sans-serif'
c.fillText('Eraser', 20, 15)

canvas.addEventListener('pointermove', function(event) {
    if(event.pressure > 0 && previousPosition) {
        if(penColor == eraserColor) {
            c.lineWidth = eraserWidth
            c.strokeStyle = penColor + 'ff'
            c.fillStyle = penColor + 'ff'
        } else {
            c.lineWidth = penWidth
            var alpha = Math.floor(event.pressure * 256).toString(16)
            c.strokeStyle = penColor + alpha
            c.fillStyle = penColor + alpha
        }

        c.beginPath()
        c.moveTo(previousPosition.x, previousPosition.y)
        c.lineTo(event.clientX, event.clientY)
        c.stroke()

        // Circular end caps
        if(penColor == eraserColor) {
            c.beginPath()
            c.arc(previousPosition.x, previousPosition.y, c.lineWidth / 2, 0, 2 * Math.PI)
            c.fill()
    
            c.beginPath()
            c.arc(event.clientX, event.clientY, c.lineWidth / 2, 0, 2 * Math.PI)
            c.fill()
        }
    }

    if(event.clientY < gridSize && event.clientX < colors.length * paletteWidth * gridSize) {
        canvas.style.cursor = "crosshair"
    } else if(penColor == eraserColor) {
        canvas.style.cursor = "url('" + icons[eraserColor] + "') 23 23, crosshair"
    } else {
        canvas.style.cursor = "url('" + icons[penColor] + "') 1 32, crosshair"
    }

    previousPosition = {
        x: event.clientX,
        y: event.clientY,
    }
})

canvas.addEventListener('mousedown', function(event) {
    if(event.clientY < gridSize && event.clientX < colors.length * paletteWidth * gridSize) {
        colors.forEach(function(color, i) {
            if(event.clientX >= paletteWidth * gridSize * i && event.clientX < paletteWidth * gridSize * (i + 1)) {
                setPenColor(color)
            }
        })
    }
    
    if(penColor == eraserColor) {
        c.lineWidth = eraserWidth
        c.fillStyle = penColor + 'ff'
    }

    c.beginPath()
    c.arc(event.clientX, event.clientY, c.lineWidth / 2, 0, 2 * Math.PI)
    c.fill()

    previousPosition = {
        x: event.clientX,
        y: event.clientY,
    }
})

canvas.addEventListener('mouseup', function(event) {
    delete previousPosition
})