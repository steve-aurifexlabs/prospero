var runner = {}

runner.run = function() {
    var html = ''
    var nClients = 2
    var maxEdits = 3
    var maxEditLength = 1
    
    var nEdits = 1
    while(nEdits <= maxEdits) {
        html += '<h2>' + nEdits + ' Edit(s)</h2>'
        
        var eventQueue = []
 
        while(eventQueue.length < nEdits) {
            html += '<h3>On edit ' + eventQueue.length + '</h3>'

            var clientIndex = 0
            while(clientIndex < 2) {
                if(eventQueue.length == 0 && clientIndex > 0) {
                    break
                }

                html += '<h4>if user number ' + clientIndex + '</h4>'
                
                var position = 0
                while(position <= eventQueue.length * maxEditLength) {
                    var symbol = eventQueue.length
                    
                    html += '<h5>types the symbol ' + symbol + ' at position ' + position +'</h5>'
                    
                    var text = [symbol]
                    var removed = ['']
                    
                    position++
                }

                clientIndex++
            }

            eventQueue.push({})
        }
        
        nEdits++
    }

    return html

    var clientIndex
    var firstEdit = true

    if(firstEdit) {
        clientIndex = 0 
    }
    
    else {
        clientIndex = 0
    }

    // var change = {
    //     from: ,
    //     text:,
    //     removed:,
    // }

    change.to = change.from + change.removed[0].length

    var test = Test({
        expectedResult: '',
        initialDocument: '',
        changes: [
            [

            ],
            [],
        ]
    })

    var sim = DistributedSystemSimulator(test, algorithm)

    sim.simulate()
    // var output = sim.render()
    var isConvergent = sim.checkConsistency()
    var isCorrect = sim.checkResult()



    // setTimeout(runner.run, 0)
}

function Test(changes) {
    var test = {}

    return test
}

function generateEdit(clientIndex) {
    
}

runner.render = function() {
    var html = ''

    html += ''

    return html
}

function randomIndex(n) {
    Math.floor(Math.random() * n)
}

function randomPositive(n) {
    Math.floor(Math.random() * n) + 1
}
