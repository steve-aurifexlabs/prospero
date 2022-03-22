
var tabAmount = 4
var tab = []
for(var n = 0; n < tabAmount; n++) {
    tab.push(' ')
}
tab = tab.join('')

var lastKeyAt = Date.now()

var A = {}
var B = {}
var S = {}

A.document = [
    "var fs = require('fs')",
    '',
    "fs.readFileSync('file.txt', function(data) {",
    "    console.log(data)",
    "})",
]
B.document = ['abc', 'def']
S.document = ['abc', 'def']

A.canvas = document.querySelector('#A')
B.canvas = document.querySelector('#B')
S.canvas = document.querySelector('#S')

A.cursor = {
    row: 0,
    col: 0,
}

document.addEventListener('paste', function(event) {
    event.preventDefault()
    var pasteContents = (event.clipboardData || window.clipboardData).getData('text')
    console.log(pasteContents)

    var pasteLines = pasteContents.split('\n')
    console.log(pasteLines)

    A.document =
        A.document.slice(0, A.cursor.row)
        .concat([A.document[A.cursor.row].slice(0, A.cursor.col) + pasteLines[0]])
        .concat(pasteLines.slice(1, pasteLines.length - 1))
        .concat([pasteLines[pasteLines.length - 1] + A.document[A.cursor.row].slice(A.cursor.col)])
        .concat(A.document.slice(A.cursor.row + 1))

    // A.cursor.row += pasteContents.lines
    // A.cursor.col += pasteLines[pasteLines.length - 1].length
})

A.canvas.addEventListener('mousedown', function(event) {
    A.cursor.row = Math.floor((event.offsetY - 52) / lineHeight)
    A.cursor.col = Math.floor((event.offsetX - 45) / 16)
    
    if(A.cursor.row < 0) {
        A.cursor.row = 0
    }

    if(A.cursor.row > A.document.length - 1) {
        A.cursor.row = A.document.length - 1
    }

    if(A.cursor.col < 0) {
        A.cursor.col = 0
    }
    
    if(A.cursor.col > A.document[A.cursor.row].length) {
        A.cursor.col = A.document[A.cursor.row].length
    }
})

document.addEventListener('keydown', function(event) {
    // console.log(event.key)

    lastKeyAt = Date.now()

    if(event.key.length == 1) {
        if(event.ctrlKey) {
            return
        }

        event.preventDefault()

        var char = event.key
        // var advanceAmount = 1
        
        if(char == '(') {
            char = '()'
        }
        if(char == '[') {
            char = '[]'
        }
        if(char == "'") {
            char = "''"
        }
        if(char == '"') {
            char = '""'
        }

        A.document[A.cursor.row] =
            A.document[A.cursor.row].slice(0, A.cursor.col) +
            char +
            A.document[A.cursor.row].slice(A.cursor.col)

        A.cursor.col += 1

        if(char == '{') {
            var indentAmount =
                A.document[A.cursor.row].length -
                A.document[A.cursor.row].trimStart().length

            var indentation = A.document[A.cursor.row].slice(0, indentAmount)

            A.document =
                A.document.slice(0, A.cursor.row).concat(
                [A.document[A.cursor.row].slice(0, A.cursor.col)]).concat(
                [indentation + tab, indentation + '}' + A.document[A.cursor.row].slice(A.cursor.col)]).concat(
                A.document.slice(A.cursor.row + 1))

            A.cursor.row += 1
            A.cursor.col = indentAmount + tabAmount
        }
    }

    else if(event.key == 'Tab') {
        event.preventDefault()

        A.document[A.cursor.row] =
            A.document[A.cursor.row].slice(0, A.cursor.col) +
            tab +
            A.document[A.cursor.row].slice(A.cursor.col)

        A.cursor.col += tabAmount
    }

    else if(event.key == 'Backspace') {
        event.preventDefault()
        
        if(A.cursor.col > 0) {
            if(A.document[A.cursor.row].slice(A.cursor.col - tabAmount, A.cursor.col) == tab) {
                A.document[A.cursor.row] = 
                    A.document[A.cursor.row].slice(0, A.cursor.col - tabAmount) + 
                    A.document[A.cursor.row].slice(A.cursor.col)
                    
                A.cursor.col -= tabAmount
            } else {   
                A.document[A.cursor.row] =
                A.document[A.cursor.row].slice(0, A.cursor.col - 1) +
                A.document[A.cursor.row].slice(A.cursor.col)
                
                A.cursor.col -= 1
            }
        } else if(A.cursor.row > 0) {
            var beforeLine = A.document[A.cursor.row - 1]
            var splicedLine = beforeLine + A.document[A.cursor.row]

            A.document = 
                A.document.slice(0, A.cursor.row - 1).concat(
                splicedLine).concat(
                A.document.slice(A.cursor.row + 1))

            A.cursor.row -= 1
            A.cursor.col = beforeLine.length
        }
    }

    else if(event.key == 'Delete') {
        event.preventDefault()

        if(A.cursor.col < A.document[A.cursor.row].length) {
            if(A.document[A.cursor.row].slice(A.cursor.col, A.cursor.col + tabAmount) == tab) {
                A.document[A.cursor.row] = 
                    A.document[A.cursor.row].slice(0, A.cursor.col) + 
                    A.document[A.cursor.row].slice(A.cursor.col + tabAmount)
            } else {
                A.document[A.cursor.row] =
                    A.document[A.cursor.row].slice(0, A.cursor.col) +
                    A.document[A.cursor.row].slice(A.cursor.col + 1)
            }
        } else if(A.cursor.row < A.document.length - 1) {
            var beforeLine = A.document[A.cursor.row]
            var splicedLine = beforeLine + A.document[A.cursor.row + 1]

            A.document = 
                A.document.slice(0, A.cursor.row).concat(
                splicedLine).concat(
                A.document.slice(A.cursor.row + 2))
        }
    }

    else if(event.key == 'Enter') {
        event.preventDefault()

        var indentAmount =
                A.document[A.cursor.row].length -
                A.document[A.cursor.row].trimStart().length

        var indentation = A.document[A.cursor.row].slice(0, indentAmount)

        var beforeSplit = A.document.slice(0, A.cursor.row + 1)
        beforeSplit[beforeSplit.length - 1] = beforeSplit[beforeSplit.length - 1].slice(0, A.cursor.col)
        
        var afterSplit = A.document.slice(A.cursor.row)
        afterSplit[0] = indentation + afterSplit[0].slice(A.cursor.col)
        
        A.document = beforeSplit.concat(afterSplit)

        A.cursor.row += 1
        A.cursor.col = indentAmount
    }

    else if(true) { //event.ctrlKey) {
        if(event.key == 'ArrowUp') {
            event.preventDefault()

            A.cursor.row -= 1
            if(A.cursor.row < 0) {
                A.cursor.row = 0
            }

            if(A.cursor.col > A.document[A.cursor.row].length){
                A.cursor.col = A.document[A.cursor.row].length
            }
        }

        else if(event.key == 'ArrowDown') {
            event.preventDefault()

            if(event.shiftKey) {
                A.selection = {
                    start: {
                        row: A.cursor.row,
                        col: A.cursor.col,
                    },       
                }
            }

            A.cursor.row += 1
            if(A.cursor.row > A.document.length - 1) {
                A.cursor.row = A.document.length - 1
            }

            if(A.cursor.col > A.document[A.cursor.row].length){
                A.cursor.col = A.document[A.cursor.row].length
            }

            if(event.shiftKey) {
                A.selection.end = {
                    row: A.cursor.row,
                    col: A.cursor.col,
                }
            }
        }
        
        else if(event.key == 'ArrowLeft') {
            event.preventDefault()

            if(A.document[A.cursor.row].slice(A.cursor.col - tabAmount, A.cursor.col) == tab) {
                A.cursor.col -= tabAmount
            }

            else {

                A.cursor.col -= 1
                if(A.cursor.col < 0) {
                    A.cursor.row -= 1
                    if(A.cursor.row < 0) {
                        A.cursor.row = 0
                        A.cursor.col = 0
                    } else {
                        A.cursor.col = A.document[A.cursor.row].length
                    }

                }
            }
        }
        
        else if(event.key == 'ArrowRight') {
            event.preventDefault()

            var beforeCursor = {
                row: A.cursor.row,
                col: A.cursor.col,
            }

            if(A.document[A.cursor.row].slice(A.cursor.col, A.cursor.col + tabAmount) == tab) {
                A.cursor.col += tabAmount
            }

            else {

                A.cursor.col += 1
                if(A.cursor.col > A.document[A.cursor.row].length) {
                    A.cursor.row += 1
                    if(A.cursor.row > A.document.length - 1) {
                        A.cursor.row = A.document.length - 1
                        A.cursor.col = A.document[A.cursor.row].length
                    } else {
                        A.cursor.col = 0
                    }
                }
            }

            if(event.shiftKey) {
                if(A.selection === undefined) {
                    A.selection = {
                        start: {
                            row: beforeCursor.row,
                            col: beforeCursor.col,
                        },       
                    }
                }

                A.selection.end = {
                    row: A.cursor.row,
                    col: A.cursor.col,
                }
            }
        }

        // console.log(A.selection)

        // console.log('cursor:', A.cursor.row, A.cursor.col)

        // return false
    }

})

B.autoResponder = function() {

}

A.autoResponder = function() {

}

S.messageDelayer = function() {

}

function render() {
    renderEditor(A)
    // renderEditor(B)
    // renderEditor(S)

    requestAnimationFrame(render)
}

var renderTimes = []

var columnHeader = []
for(var n = 0; n < 80; n++) {
    if(n < 10) {
        columnHeader.push('   ' + (n))
    } else {
        columnHeader.push('  ' + (n))
    }
}
columnHeader = columnHeader.join('')

var lineHeight = 40
var maxVisibleLines = 20

var oddEven = false

function renderEditor(node) {
    oddEven = !oddEven
    if(oddEven) {
        return
    }

    var startRenderAt = performance.now() 
    
    var c = node.canvas.getContext('2d')
    
    c.fillStyle = '#ffffffc0'
    c.fillRect(0, 0, node.canvas.width, node.canvas.height)
    
    
    c.fillStyle = '#000'
    c.font = '8px Inconsolata'
    // c.fillText('0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20', 50, 35 + 0 * 30)
    c.fillText(columnHeader, 37, 30)
    c.fillText(columnHeader, 37, 1030)
    
    
    for(var n = 0; n < 24; n++) {
        if(n >= node.document.length) {
            break
        }
        
        var line = node.document[n]
        
        c.fillStyle = '#000'
        c.font = '16px Inconsolata'
        c.fillText(n, 5, 73 + n * lineHeight)
        c.fillText(n, 55 + 80 * 16, 73 + n * lineHeight)
        c.font = '32px Inconsolata'
        
        var syntaxedLine = syntaxHighlight(line)
        // console.log(syntaxedLine)
        
        var y = 0
        syntaxedLine.forEach(function(part) {
            c.fillStyle = part.color
            if(y > 80 - 1) {
                c.font = '16px Inconsolata'
                c.fillText(part.value, 38 + (y - 80 + 1) * 8, 90 + n * lineHeight)
            } else {
                c.font = '32px Inconsolata'
                c.fillText(part.value, 45 + y * 16, 75 + n * lineHeight)
            }
            y += part.value.length
        })
        // c.fillText(line, 45, 75 + n * 30)
        
        c.fillStyle = '#aaaaaa20'
        c.fillRect(44 + 16 * (line.length), 50 + n * lineHeight, 2, lineHeight)         
        // c.fillRect(46 + 16 * (line.length), 50 + n * lineHeight, 2, lineHeight)         
    }
    
    
    if(node.cursor) {
        c.font = '32px Inconsolata'
        if(Math.floor(Date.now() - lastKeyAt) % 1000 < 500) {
            c.fillStyle = '#00000010'
            c.strokeStyle = '#000'
        } else {
            c.fillStyle = '#c0c0c010'
            c.strokeStyle = '#ccc'
        }
        
        if(node.cursor.col < 80) {    
            c.beginPath()
            c.moveTo(44 + 16 * node.cursor.col, 50 + node.cursor.row * lineHeight)
            c.lineTo(44 + 16 * node.cursor.col, 50 + lineHeight + node.cursor.row * lineHeight)
            c.stroke()
            
            c.fillRect(44 + 16 * node.cursor.col, 50 + node.cursor.row * lineHeight, 16, lineHeight)
            
            c.fillStyle = '#aaaaaa10'
            c.fillRect(44 + 16 * node.cursor.col, 0, 16, node.canvas.height)
            c.fillRect(0, 50 + node.cursor.row * lineHeight, node.canvas.width, lineHeight)
        } else {
            c.beginPath()
            c.moveTo(46 + 8 * (node.cursor.col - 80), 78 + node.cursor.row * lineHeight)
            c.lineTo(46 + 8 * (node.cursor.col - 80), 90 + node.cursor.row * lineHeight)
            c.stroke()
            
            c.fillRect(46 + 8 * (node.cursor.col - 80), 78 + node.cursor.row * lineHeight, 8, 12)
            
            c.fillStyle = '#aaaaaa10'
            c.fillRect(46 + 8 * (node.cursor.col - 80), 0, 8, node.canvas.height)
            c.fillRect(0, 78 + node.cursor.row * lineHeight, node.canvas.width, 12)    
        }
        
        var char = node.document[node.cursor.row][node.cursor.col]
        if(char == '{') {
            if(node.document[node.cursor.row].length > node.cursor.col + 1 && node.document[node.cursor.row][node.cursor.col + 1] == '}') {
                c.fillStyle = '#aaaaaa10'
                c.fillRect(51 + 16 * (node.cursor.col + 1), 0, 4, node.canvas.height)
                c.fillRect(0, 60 + node.cursor.row * lineHeight, node.canvas.width, 8)
            }
                
            else {
                for(var n = node.cursor.row + 2; n < node.cursor.row + maxVisibleLines; n++) {
                    if(node.document.length > n && node.document[n].length > 0 && node.document[n][0] == '}') {
                        c.fillStyle = '#aaaaaa10'
                        c.fillRect(51 + 16 * (0), 0, 4, node.canvas.height)
                        c.fillRect(0, 60 + n * lineHeight, node.canvas.width, 8)
                        break
                    }
                }
            }    
        }
        if(char == '}') {
            if(node.cursor.col > 0 &&
                node.document[node.cursor.row][node.cursor.col - 1] == '{') {
                    c.fillStyle = '#aaaaaa10'
                c.fillRect(51 + 16 * (node.cursor.col - 1), 0, 4, node.canvas.height)
                c.fillRect(0, 60 + node.cursor.row * lineHeight, node.canvas.width, 8)
            }

            else {
                for(var n = node.cursor.row - 2; n > node.cursor.row - maxVisibleLines; n--) {
                    if(n >= 0 && node.document[n][node.document[n].length - 1] == '{') {
                        c.fillStyle = '#aaaaaa10'
                        c.fillRect(51 + 16 * (node.document[n].length - 1), 0, 4, node.canvas.height)
                        c.fillRect(0, 60 + n * lineHeight, node.canvas.width, 8)
                        break
                    }
                }
            }    
        }
    }

    renderTimes.push(performance.now() - startRenderAt)
    
    if(node.selection) {
        c.fillStyle = '#aaaaaa50'
        
        // var width = 8 * (node.selection.end.col - node.selection.start.col)
        // c.fillRect(46 + 8 * (selection.start.col - 80), selection.start.row * 30, selection.end, node.canvas.height)    
        
        for(var n = node.selection.start.row; n < node.selection.end.row; n++) {
            var width = node.document[n].length * 16
            c.fillRect(46, 50 + node.selection.start.row * lineHeight, width, lineHeight)    
        }
    }

    // renderTimes.push(performance.now() - startRenderAt)
}


var keywordSingles = new Set([
    '=', '(', ')', '{', '}', '.', '[', ']', '>', '<', '!', '+', '-', '*', '/', '%', ':', ';', ',', '|', '&',
])

var longKeywords = {
    c: {
        o: 'const',
    },
    e: {
        l: 'else',
    },
    f: {
        a: 'false',
        o: 'for',
        u: 'function',
    },
    i: {
        f: 'if',
    },
    r: {
        e: 'return',
    },
    t: {
        r: 'true',
    },
    v: {
        a: 'var',
    },
    w: {
        h: 'while',
    },
}

var colors = {
    // string: '#088a00',
    other: '#3333aa',
    keyword: '#000000',
    // other: '#000088',
    string: '#008800',
    comment: '#bbbbbb',
}

function syntaxHighlight(line) {
    var result = []
    
    var state = 'start'
    var stringStart = 0

    for(var n = 0; n < line.length; n++) {
        var char = line[n]

        if(state == 'start') {
            if(char == '/' && n < line.length - 1) {
                var nextChar = line[n + 1]
                if(nextChar == '/') {
                    result.push({
                        type: 'other',
                        color: colors.other,
                        value: line.slice(stringStart, n),
                    })
    
                    result.push({
                        type: 'comment',
                        color: colors.comment,
                        value: line.slice(n),
                    })

                    n = line.length
                    stringStart = n
                }
            }
            
            else if(keywordSingles.has(char)) {
                result.push({
                    type: 'other',
                    color: colors.other,
                    value: line.slice(stringStart, n),
                })

                result.push({
                    type: 'keyword',
                    color: colors.keyword,
                    value: line[n],
                })

                stringStart = n + 1

            }
            
            else if(longKeywords[char] && n < line.length - 1) {
                var nextChar = line[n + 1]
                var keyword = longKeywords[char][nextChar]
                
                if(keyword && line.slice(n, n + keyword.length) == keyword) {
                    result.push({
                        type: 'other',
                        color: colors.other,
                        value: line.slice(stringStart, n),
                    })
    
                    result.push({
                        type: 'keyword',
                        color: colors.keyword,
                        value: keyword,
                    })

                    n += keyword.length - 1
                    stringStart = n + 1
                }
            }
            
            else if(char == '"') {
                result.push({
                    type: 'other',
                    color: colors.other,
                    value: line.slice(stringStart, n),
                })

                state = 'double-quote'
                stringStart = n
            }
            
            else if(char == "'") {
                result.push({
                    type: 'other',
                    color: colors.other,
                    value: line.slice(stringStart, n),
                })

                state = 'single-quote'
                stringStart = n
            }
        }
        
        else if(state == 'double-quote') {
            if(char == '"') {   
                result.push({
                    type: 'string',
                    color: colors.string,
                    value: line.slice(stringStart, n + 1),
                })

                state = 'start'
                stringStart = n + 1
            }
        }

        else if(state == 'single-quote') {
            if(char == "'") {   
                result.push({
                    type: 'string',
                    color: colors.string,
                    value: line.slice(stringStart, n + 1),
                })

                state = 'start'
                stringStart = n + 1
            }
        }
    }

    if(stringStart < line.length) {
        if(state == 'start') {
            result.push({
                type: 'other',
                color: colors.other,
                value: line.slice(stringStart),
            })        
        }
        else if(state == 'double-quote' || state == 'single-quote') {
            result.push({
                type: 'string',
                color: colors.string,
                value: line.slice(stringStart),
            })        
        }
    }

    return result
}

