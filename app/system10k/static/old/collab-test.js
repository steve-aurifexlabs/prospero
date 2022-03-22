var receiveTestEvent = (function() {
    var testDelay = 3
    
    // var testDocument = 'abcdefghij\n0123456789\nABCDEFGHIJ\n≡↗!@#$%^ &'
    // var nLines = 4
    // var lineLength = 10

    var test = {
        a: [0.0, 1.0],
        // a: [0.0, 0.1, 0.2, 1.0, 1.1, 1.2],
        b: [0.5, 1.5],
        // b: [0.5, 0.6, 0.7, 1.5, 1.6, 1.7],
    }

    var testStrings = {
        a: ['_a0≡', '.a1↗'],
        b: [',b0↑', '-b1←'],
    }

    function genEdit(text) {
        var editor = activeTab.element.editor
        
        var change = {}

        change.from = {}
        change.from.line = Math.floor(Math.random() * editor.lineCount())
        change.from.ch = Math.floor(Math.random() * editor.getLine(change.from.line).length)

        change.to = {}
        change.to.line = Math.floor(Math.random() * (editor.lineCount() - change.from.line)) + change.from.line
        change.to.ch = Math.floor(Math.random() * (editor.getLine(change.to.line).length - change.from.ch)) + change.from.ch

        var textStart = Math.floor(Math.random() * text.length)
        var textEnd = Math.floor(Math.random() * (text.length - textStart)) + textStart
        change.text = text.slice(textStart, textEnd).split('\n')

        change.removed = editor.getRange(change.from, change.to).split('\n')
        
        return change
    }

    var testButton = document.createElement('button')
    testButton.setAttribute('id', 'test-button')
    testButton.textContent = 'Test'
    document.querySelector('#right-footer').insertAdjacentElement('afterbegin', testButton)

    var button = document.querySelector('#test-button')
    button.addEventListener('click', function() {
        var timeToPeer = getLatency() / 2

        test.a.forEach(function(delay, i) {
            setTimeout(function() {
                runTest(testStrings.a[i])
            }, ((delay * timeToPeer) + testDelay)  * 1000)
        })
        
        var teammate = team.members[localStorage.teammate]
    
        test.b.forEach(function(delay, i) {
            webSocket.send(JSON.stringify({
                type: 'relay',
                to: teammate.email,
                message: {
                    type: 'collab-test-event',
                    text: testStrings.b[i],
                    at: delay,
                },
            }))
        })
    })
    
    function receiveTestEvent(event) {
        var timeToPeer = getLatency() / 2

        setTimeout(function() {
            runTest(event.text)
        }, (((event.at - 1) * timeToPeer) + testDelay)  * 1000)
    }
    
    function runTest(text) {
        var change = genEdit(text)
        activeTab.element.editor.replaceRange(change.text, change.from, change.to, '+input')
    }

    function getLatency() {
        if(!team.members[localStorage.teammate]) {
            console.log('Teammate not online!!!!!!!!!!! Your teammate needs to be online to run the test!!!!')    
        }

        return team.members[localStorage.teammate].latency
    }

    
    return receiveTestEvent
})()
