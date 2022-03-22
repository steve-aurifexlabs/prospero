
function sendTakeKeyboardSignal() {
    Object.values(team.members).forEach(function(teammate) {
        if(teammate.online) {
            webSocket.send(JSON.stringify({
                type: 'relay',
                to: teammate.email,
                message: {
                    type: 'take-keyboard',
                }
            }))
        }
    })
}

function createEditor(parentElement, inputData, name, path) {
    var readOnly = true

    var mode = null

	if(name.slice(-4) == '.apl') mode = 'apl'
	if(name.slice(-4) == '.cpp' || name.slice(-2) == '.c' || name.slice(-2) == '.h' || name.slice(-5) == '.java') mode = 'clike'
	if(name.slice(-3) == '.cl') mode = 'clojure'
	if(name.slice(-6) == '.cmake') mode = 'cmake'
	if(name.slice(-4) == '.cob') mode = 'cobol'
	if(name.slice(-7) == '.coffee') mode = 'coffeescript'
	if(name.slice(-5) == '.lisp') mode = 'commonlisp'
	if(name.slice(-4) == '.css') mode = 'css'

	if(name.slice(-5) == '.dart') mode = 'dart'
	if(name.slice(-5) == '.diff') mode = 'diff'
	if(name.slice(-7) == '.django') mode = 'django'
	if(name.slice(-7) == '.docker') mode = 'dockerfile'
	if(name.slice(-6) == '.forth') mode = 'forth'
	if(name.slice(-8) == '.fortran') mode = 'fortran'
	if(name.slice(-3) == '.go') mode = 'go'
	if(name.slice(-3) == '.hs') mode = 'haskell'

	if(name.slice(-5) == '.html') mode = 'htmlmixed'
	if(name.slice(-3) == '.js' || name.slice(-5) == '.json' || name.slice(-3) == '.ts') mode = 'javascript'
	if(name.slice(-6) == '.jinja') mode = 'jinja2'
	if(name.slice(-4) == '.jsx') mode = 'jsx'
	if(name.slice(-6) == '.julia') mode = 'julia'
	if(name.slice(-4) == '.lua') mode = 'lua'
	if(name.slice(-3) == '.md') mode = 'markdown'
	if(name.slice(-6) == '.nginx') mode = 'nginx'

	if(name.slice(-4) == '.pas') mode = 'pascal'
	if(name.slice(-4) == '.peg') mode = 'pegjs'
	if(name.slice(-5) == '.perl') mode = 'perl'
	if(name.slice(-4) == '.php') mode = 'php'
	if(name.slice(-4) == '.ps1') mode = 'powershell'
	if(name.slice(-3) == '.py') mode = 'python'
	if(name.slice(-2) == '.r') mode = 'r'
	if(name.slice(-3) == '.rb') mode = 'ruby'
	if(name.slice(-3) == '.rs') mode = 'rust'

	if(name.slice(-5) == '.sass') mode = 'sass'
	if(name.slice(-7) == '.scheme') mode = 'scheme'
	if(name.slice(-3) == '.sh') mode = 'shell'
	if(name.slice(-7) == '.sparql') mode = 'sparql'
	if(name.slice(-4) == '.sql') mode = 'sql'
	if(name.slice(-6) == '.swift') mode = 'swift'
	if(name.slice(-4) == '.tcl') mode = 'tcl'
	if(name.slice(-3) == '.vb') mode = 'vb'
	if(name.slice(-2) == '.v') mode = 'verilog'
	if(name.slice(-5) == '.vhdl') mode = 'vhdl'

	if(name.slice(-4) == '.vue') mode = 'vue'
	if(name.slice(-4) == '.xml') mode = 'xml'
	if(name.slice(-5) == '.yaml') mode = 'yaml'
	if(name.slice(-4) == '.z80') mode = 'z80'



    var editor = CodeMirror(parentElement, {
        value: inputData,
        lineNumbers: true,
        readOnly: readOnly,
        mode: mode,
        theme: 'vscode-dark',
        indentUnit: 4,
        // undoDepth: 0,

        smartIndent: false,
        electricChars: false,

        workTime: 20,
        workDelay: 250,
        maxHighlightLength: 1000,

        // theme: 'mbo',
        // cursorHeight: 2.0,
        // lineWrapping: true,
        // scrollbarStyle: 'native',
        smartIndent: true,
        electricChars: true,
        // keyMap: 'sublime',
        matchBrackets: true,
        matchTags: true,
        autoCloseBrackets: true,
        autoCloseTags: true,
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

    editor.on('electricInput', function(cm, line) {
        // console.log('electricInput:', line)
    })

    // editor.on('inputRead', function(cm, change) {
    function dummyInputRead() {
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
    }


    editor.on('beforeSelectionChange', function(cm, event) {
        if(event.ranges.length > 1) {
            event.update([event.ranges[0]])
        }
    })

    editor.on('keydown', function(cm, event) {
        var navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End']
        if(editor.options.readOnly && !navKeys.includes(event.key)) {
            toast('Press the "Start Editing" button above to start editing.', 3)
        }
    })

    editor.on('changes', function(cm, changes) {
        if(editor.refreshing) return
        
        changes.forEach(function(change) {
            collabDebugLog.push(JSON.parse(JSON.stringify({ type: 'start', at: (new Date()).toString() })))
            collabDebugLog.push(JSON.parse(JSON.stringify(change)))

            change.originalFrom = change.from
            change.from = cm.indexFromPos(change.from)
            change.originalTo = change.to
            change.to = change.from + change.removed.join('\n').length
            
            change.beforeContents = editor.beforeContents
            change.beforeChecksum = editor.beforeChecksum

            change.contents = patchFile(editor.beforeContents, change)
            change.checksum = crc32(change.contents.toString('binary'))

            // collabDebugLog.push(JSON.parse(JSON.stringify(change)))
            
            if(change.origin != '+remote') {
                // var afterContents = editor.getValue()
                var afterContents = change.contents
                var checksum = crc32(afterContents.toString('binary'))

                // collabDebugLog.push(JSON.parse(JSON.stringify(afterContents)))
                // collabDebugLog.push(JSON.parse(JSON.stringify(checksum)))

                editor.revisionId++
                // collabDebugLog.push(JSON.parse(JSON.stringify(editor.revisionId)))

                editor.checksumTable[crc32(afterContents.toString('binary'))] = {
                    index: editor.history.length,
                    contents: afterContents,
                    // contents: editor.getValue(),
                    historyEntry: change,
                }
                // collabDebugLog.push(JSON.parse(JSON.stringify(editor.checksumTable)))

                // editor.history = editor.history.push(change)
                editor.history.push(change)
                // collabDebugLog.push(JSON.parse(JSON.stringify(editor.history)))
                
                var messageId = Math.random().toString()
                // collabDebugLog.push(JSON.parse(JSON.stringify(messageId)))

                var msg = {
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
                }

                // collabDebugLog.push(JSON.parse(JSON.stringify(msg)))

                webSocket.send(JSON.stringify(msg))

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

                strobe()
                // collabDebugLog.push(JSON.parse(JSON.stringify(editor.beforeChecksum)))
                // collabDebugLog.push(JSON.parse(JSON.stringify(editor.beforeContents)))
            }
        })    
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
