
function htmlTokenize(code) {
    var tokens = []
    var state = 'outside-tag'
    var token = {
        type: 'non-tag',
        startIndex: 0,
    }

    var i
    for(i = 0; i < code.length; i++) {
        var char = code[i]

        if(state == 'outside-tag') {
            // if(whitespace.includes(char.charCodeAt(0))) {
            //     continue
            // }
            
            if(char == '<') {
                token.endIndex = i
                token.value = code.slice(token.startIndex, token.endIndex)
                tokens.push(token)

                token = {
                    type: 'tag',
                    startIndex: i,
                }
                
                state = 'inside-tag'
            }
            
            // else {
            //     console.log('Expected "<" at char', i)
            //     break
            // }
        }

        else if(state == 'inside-tag') {
            if(char == '<') {
                console.log('Expected ">" or anything but "<" at char', i, 'but got "<"')
                break
            }

            else if(char == '>') {
                token.endIndex = i + 1
                token.value = code.slice(token.startIndex, token.endIndex)
                tokens.push(token)

                state = 'outside-tag'
                token = {
                    type: 'non-tag',
                    startIndex: i + 1,
                }
            }
        }

        else {
            console.log('Fatal error. Bad state', state)
            break
        }
    }

    if(i < code.length) {
        console.log('Parse error on char', i)
    }

    return tokens
}

///////////////

var whitespace = [0x20, 0x09, 0x0a, 0x0b, 0x0c, 0x0d]

function stripComments(code) {
    var output = ''
    var state = 'start'
    var i

    for(i = 0; i < code.length; i++) {
        var char = code[i]

        if(state == 'start') {
            if(code.length > i + 4 && code.slice(i, i + 4) == '<!--') {
                state = 'inside-comment'
                i += 3
            }

            else {
                output += char
            }
        }

        else if(state == 'inside-comment') {
            if(code.length > i + 3 && code.slice(i, i + 3) == '-->') {
                token = {
                    endIndex: i,
                }
                
                state = 'start'
                i += 2
            }
        }

    }

    return output
}


function tokenize(code) {
    var tokens = []
    var state = 'outside-tag'
    var token = {
        type: 'non-tag',
        startIndex: 0,
    }

    var i
    for(i = 0; i < code.length; i++) {
        var char = code[i]

        if(state == 'outside-tag') {
            // if(whitespace.includes(char.charCodeAt(0))) {
            //     continue
            // }
            
            if(char == '<') {
                token.endIndex = i
                token.value = code.slice(token.startIndex, token.endIndex)
                tokens.push(token)

                token = {
                    type: 'tag',
                    startIndex: i,
                }
                
                state = 'inside-tag'
            }
            
            // else {
            //     console.log('Expected "<" at char', i)
            //     break
            // }
        }

        else if(state == 'inside-tag') {
            if(char == '<') {
                console.log('Expected ">" or anything but "<" at char', i, 'but got "<"')
                break
            }

            else if(char == '>') {
                token.endIndex = i + 1
                token.value = code.slice(token.startIndex, token.endIndex)
                tokens.push(token)

                state = 'outside-tag'
                token = {
                    type: 'non-tag',
                    startIndex: i + 1,
                }
            }
        }

        else {
            console.log('Fatal error. Bad state', state)
            break
        }
    }

    if(i < code.length) {
        console.log('Parse error on char', i)
    }

    return tokens
}

function divideIntoSections(tokens) {
    var result = {
        scripts: '',
        styles: '',
        body: [],
    }

    var onBody = false

    var i
    var token
    for(i = 0; i < tokens.length; i++) {
        token = tokens[i]

        if(token.value == '</' + 'script>' && tokens[i-2].value == '<' + 'script>') {
            result.scripts += reindentScripts(tokens[i-1].value)
        }
        
        if(token.value == '</' + 'style>' && tokens[i-2].value == '<' +'style>') {
            result.styles += tokens[i-1].value
        }
        
        if(token.value == '<body>') {
            onBody = true
        }

        if(onBody) {
            result.body.push(token)
        }
        
        if(token.value == '</body>') {
            onBody = false
        }
    }

    function reindentScripts(value) {
        var result = []
        
        var lines = value.split('\n')
        lines.forEach(function(line) {
            result.push(line.slice(8))
        })

        return result.join('\n')
    }

    return result
}

function preProcessScript(script) {
    var lines = []
    script.split('\n').forEach(function(lineValue, i) {
        var indentationLevel = getIndentationLevel(lineValue)

        var line = {
            value: lineValue.slice(4 * indentationLevel),
            lineNumber: i + 1,
            indentationLevel: indentationLevel,
        }
        
        if(line.value == '') {
            return
        }

        if(line.value.trimStart().slice(0, 2) == '//') {
            return
        }

        lines.push(line)
    })

    return lines
}

function getIndentationLevel(line) {
    for(var i = 0 ; i < 8; i++) {
        if(line.length < (i+1) * 4 || line.slice(4 * i, 4 * (i+1)) != '    ') {
            return i
        }
    }

    console.log('Too much indentation. 8+ levels deep.')
    return 9
}