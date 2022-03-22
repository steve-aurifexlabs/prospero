
var editorKeymap = localStorage.editorKeymap || 'sublime'

function setKeymap(keymap) {
    editorKeymap = keymap
    localStorage.editorKeymap = keymap
}


function createEditor(parentElement, inputData, name, path) {
    var readOnly = true

    var mode = null
    if(name.slice(-3) == '.md') mode = 'markdown'
    if(name.slice(-5) == '.html') mode = 'htmlmixed'
    if(name.slice(-3) == '.js') mode = 'javascript'
    if(name.slice(-4) == '.css') mode = 'css'
    // if(name.slice(-5) == '.http') mode = 'http'
    if(name.slice(-5) == '.json') mode = 'javascript'
    // if(name.slice(-6) == '.nginx') mode = 'nginx'
    // if(name.slice(-5) == '.wast') mode = 'wast'
    if(name.slice(-4) == '.yml') mode = 'yaml'
    if(name.slice(-3) == '.sh') mode = 'shell'
    if(name.slice(-3) == '.py') mode = 'python'
    if(name.slice(-2) == '.c' || name.slice(-2) == '.h') mode = 'clike'

    var editor = CodeMirror(parentElement, {
        value: inputData,
        lineNumbers: true,
        readOnly: readOnly,
        mode: mode,
        theme: 'vscode-dark',
        // theme: 'mbo',
        // cursorHeight: 2.0,
        // lineWrapping: true,
        // scrollbarStyle: 'native',
        // smartIndent: true,
        // electricChars: false,
        // keyMap: editorKeymap,
        indentUnit: 4,
        // matchBrackets: true,
        // matchTags: true,
        // autoCloseBrackets: true,
        // autoCloseTags: true,   
    })

    // parentElement.querySelector('.CodeMirror').style.height = '100%'
    
    editor.filename = name
    editor.filepath = path

    editor.revisionId = 0
    // editor.unconfirmedChanges = 0
    editor.refreshing = false

    editor.beforeContents = editor.getValue()
    editor.beforeChecksum = crc32(editor.beforeContents.toString('binary'))
    editor.history = [{
        checksum: editor.beforeChecksum,
        contents: editor.getValue(),
    }]

    editor.checksumTable = {}
    editor.checksumTable[editor.beforeChecksum] = {
        index: 0,
        contents: editor.beforeContents,
        historyEntry: editor.history[0],
    }

    editor.on('inputRead', function(cm, change) {
        Object.keys(team.members).forEach(function(peerEmail) {
            var peer = team.members[peerEmail]

            var size = getChangeSize(change)
            if(peer.cursorPos && change.from.line < peer.cursorPos.line) {
                handlePeerMessage({
                    type: 'cursor-position',
                    filepath: editor.filepath,
                    filename: editor.filename,
                    line: peer.cursorPos.line + size.lines,
                    ch: peer.cursorPos.ch,
                }, null, peerEmail)
            }
            
            else if(peer.cursorPos && change.from.line == peer.cursorPos.line && change.from.ch <= peer.cursorPos.ch) {
                handlePeerMessage({
                    type: 'cursor-position',
                    filepath: editor.filepath,
                    filename: editor.filename,
                    line: peer.cursorPos.line,
                    ch: peer.cursorPos.ch + size.chars,
                }, null, peerEmail)
            }
        })
    })


    editor.on('keydown', function(cm, event) {
        // console.log('keydown', event)

        // console.log('crc32', crc32(editor.getValue()))

        var navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']
        if(editor.options.readOnly && !navKeys.includes(event.key)) {
            toast('Press the "Start Editing" button above to start editing.', 3)
        }
    })

    editor.on('cursorActivity', function(cm) {
        var cursor = cm.getCursor()
        // console.log('cursorActivity', cursor)
        
        function getNearby1() {
            var centerY = cursor.line
            if(cursor.line < 2) {
                centerY = 2
            }
            
            var nearby = editor.getRange({
            line: centerY - 2,
            ch: 0,
            }, {
                line: centerY + 3,
                ch: 0,
            })
            
            var n = 9
            
            var lines = nearby.split('\n').slice(0, 5)
            lines.forEach(function(line, i) {
                line = line.padEnd(cursor.ch + (2 * n), ' ')
                
                var start = cursor.ch - n
                if(start < 0) {
                    start = 0
                }
                
                var aPadding = n
                if(cursor.ch < n) {
                    aPadding = cursor.ch
                }
                var a = line.slice(start, cursor.ch).padStart(aPadding, ' ')
                
                var end = cursor.ch + (2 * n) - aPadding
                if(end > line.length - 1) {
                    end = line.length - 1
                }
                
                var b = line.slice(cursor.ch, end).padEnd((2 * n) - aPadding, ' ')
                
                // lines[i] = (cursor.line + i + 1).toString() + ': ' + a + b
                lines[i] = (centerY + i - 1).toString() + ':' + a + b
            })

            return lines.join('\n')
        }
        
        function getNearby2() {
            var centerY = cursor.line
            if(cursor.line < 1) {
                centerY = 1
            }
            
            var nearby = editor.getRange({
            line: centerY - 1,
            ch: 0,
            }, {
                line: centerY + 2,
                ch: 0,
            })
            
            var n = 11
            
            var lines = nearby.split('\n').slice(0, 3)
            lines.forEach(function(line, i) {
                line = line.padEnd(cursor.ch + (2 * n), ' ')
                
                var start = cursor.ch - n
                if(start < 0) {
                    start = 0
                }
                
                var aPadding = n
                if(cursor.ch < n) {
                    aPadding = cursor.ch
                }
                var a = line.slice(start, cursor.ch).padStart(aPadding, ' ')
                
                var end = cursor.ch + (2 * n) - aPadding
                if(end > line.length - 1) {
                    end = line.length - 1
                }
                
                var b = line.slice(cursor.ch, end).padEnd((2 * n) - aPadding, ' ')
                
                // lines[i] = (cursor.line + i + 1).toString() + ': ' + a + b
                lines[i] = a + b
            })

            // var headingLength = 40 - (cursor.line.toString().length + cursor.ch.toString().length + 2)
            var headingLength = 20

            // var heading = (editor.filepath + editor.filename).slice(-headingLength).padEnd(headingLength, ' ') + ' ' + cursor.line + ':' + cursor.ch
            // var heading = (editor.filepath + editor.filename).slice(-headingLength)
            var heading = (editor.filename).slice(-headingLength)
            var pos = ((cursor.line + 1) + ':' + (cursor.ch + 1)).padStart(headingLength, ' ')
            // lines = ([heading.slice(0, 20), heading.slice(20, 40)]).concat(lines)
            lines = ([heading]).concat(lines).concat([pos])
            // lines = ([editor.filename, cursor.line + ':' + cursor.ch]).concat(lines)
            return lines.join('\n')

        }
        // nearby = lines.slice(0, lines.length - 1).join('\n')
        // nearby = lines.join('\n')
        var nearby = getNearby2()

        // console.log(nearby)
        document.querySelector('.demo').style.fontSize = '90%'
        document.querySelector('.demo').style.backgroundColor = '#222'
        document.querySelector('.demo').style.color = '#aab'
        document.querySelector('.demo').style.overflow = 'hidden'
        document.querySelector('.demo').innerHTML = '<pre style="margin: 0; font-family: Cousine, monospace;">' + sanitizeHTML(nearby) + '</pre>'
        
        webSocket.send(JSON.stringify({
            type: 'cursor-position',
            line: cursor.line,
            ch: cursor.ch,
            index: editor.indexFromPos({
                line: cursor.line,
                ch: cursor.ch,
            }),
            filepath: editor.filepath,
            filename: editor.filename,
            time: Date.now(),
            nearby: nearby,
        }))

        Object.values(team.members).forEach(function(teammate) {
            if(teammate.online) {
                if(team.dataChannel && teammate.dataChannel.readyState == 'open') {
                    teammate.dataChannel.send(JSON.stringify({
                        type: 'cursor-position',
                        line: cursor.line,
                        ch: cursor.ch,
                        index: editor.indexFromPos({
                            line: cursor.line,
                            ch: cursor.ch,
                        }),
                        filepath: editor.filepath,
                        filename: editor.filename,
                        time: Date.now(),
                        nearby: nearby,
                    }))
                } else {
                    webSocket.send(JSON.stringify({
                        type: 'relay',
                        to: teammate.email,
                        message: {
                            type: 'cursor-position',
                            line: cursor.line,
                            ch: cursor.ch,
                            index: editor.indexFromPos({
                                line: cursor.line,
                                ch: cursor.ch,
                            }),
                            filepath: editor.filepath,
                            filename: editor.filename,
                            time: Date.now(),
                            nearby: nearby,
                        },
                    }))
                }
            }
        })
    })

    editor.on('change', function(cm, change) {
        if(editor.refreshing) return

        collabDebugLog.push(JSON.parse(JSON.stringify({ type: 'start' })))
        collabDebugLog.push(JSON.parse(JSON.stringify(change)))

        change.originalFrom = change.from
        change.from = cm.indexFromPos(change.from)
        change.originalTo = change.to
        change.to = change.from + change.removed.join('\n').length
        
        change.beforeContents = editor.beforeContents
        change.beforeChecksum = editor.beforeChecksum

        change.contents = editor.getValue()
        change.checksum = crc32(change.contents.toString('binary'))

        collabDebugLog.push(JSON.parse(JSON.stringify(change)))
        
        if(change.origin != '+remote') {
            var afterContents = editor.getValue()
            var checksum = crc32(afterContents.toString('binary'))

            collabDebugLog.push(JSON.parse(JSON.stringify(afterContents)))
            collabDebugLog.push(JSON.parse(JSON.stringify(checksum)))

            editor.revisionId++
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.revisionId)))

            editor.checksumTable[crc32(editor.getValue().toString('binary'))] = {
                index: editor.history.length,
                contents: editor.getValue(),
                historyEntry: change,
            }
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.checksumTable)))

            editor.history = editor.history.push(change)
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.history)))
             
            var messageId = Math.random().toString()
            collabDebugLog.push(JSON.parse(JSON.stringify(messageId)))

            var msg = JSON.stringify({
                type: 'editor-changes',
                filepath: editor.filepath,
                filename: editor.filename,
                change: change,
                time: Date.now(),
                contents: afterContents,
                checksum: checksum,
                beforeContents: editor.beforeContents,
                beforeChecksum: editor.beforeChecksum,
                revisionId: editor.revisionId,
                id: messageId,
            })

            collabDebugLog.push(JSON.parse(msg))

            webSocket.send(msg)

            Object.values(team.members).forEach(function(teammate) {
                if(teammate.online) {
                    webSocket.send(JSON.stringify({
                        type: 'relay',
                        to: teammate.email,
                        message: msg,
                    }))
                }
            })
            
            editor.beforeChecksum = checksum
            editor.beforeContents = afterContents

            collabDebugLog.push(JSON.parse(JSON.stringify(editor.beforeChecksum)))
            collabDebugLog.push(JSON.parse(JSON.stringify(editor.beforeContents)))
        }
        
    }) 

    return editor
}

function getChangeSize(change) {
    var size = {
        lines: 0,
        chars: 0,
    }

    size.lines -= change.removed.length - 1
    
    change.removed.forEach(function(str) {
        size.chars -= str.length
    })

    size.lines += change.text.length - 1

    change.text.forEach(function(str) {
        size.chars += str.length
    })

    // console.log('size', size)
    return size
}
