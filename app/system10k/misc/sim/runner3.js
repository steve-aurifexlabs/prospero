
var numClients = 2

test = [Edit()]
var isConsistent = true
var output


function runTest(test) {
    preprocessTest(test)

    var algorithm = Algorithm()

    var sim = DistributedSystemSimulator(test, algorithm)

    sim.simulate()
    
    return sim
}

function preprocessTest(test) {
    test.expectedResult = ''
    test.initialDocument = ''
    test.nodes = [
        {
            type: 'client',
            name: 'A',
            inputEvents: [],
        },
        {
            type: 'client',
            name: 'B',
            inputEvents: [],
        },
        {
            type: 'server',
            name: 'S',
        }
    ]

    // Globalize event ordering
    var ordering = []

    test.forEach(function(edit, i) {
        ordering = insert(ordering, edit.editOrder, 3 * i)
        ordering = insert(ordering, edit.peerOrder, 3 * i + 1)
        ordering = insert(ordering, edit.serverOrder, 3 * i + 2)
    })

    function insert(list, pos, value) {
        return list.slice(0, pos).concat([value]).concat(list.slice(pos))
    }

    test.forEach(function(edit, i) {
        var change = {
            // at: 0.1 * edit.editOrder + 0.1,
            from: edit.position,
            to: edit.position,
            text: [i.toString()],
            removed: [''],
            editOrder: ordering.indexOf(3 * i),
            peerOrder: ordering.indexOf(3 * i + 1),
            serverOrder: ordering.indexOf(3 * i + 2),
            // origin: '+input',
            // messageLatencies: [null, null, null],
        }

        if(change.peerOrder < change.editOrder || change.serverOrder < change.editOrder) {
            throw "ordering:effect-before-cause"
        }

        if(i > 0 && change.editOrder < ordering.indexOf(3 * (i-1))) {
            throw "ordering:edit-order-number"
        }
        
        test.nodes[edit.madeBy].inputEvents.push(change)
    })
    
    // console.log(JSON.stringify(test), JSON.stringify(test.nodes[0].inputEvents))

    // console.log(JSON.stringify(test))
}

function runForever() {
    test = getTest()
    
    setTimeout(function() {
        runNext(test,
            function(result) {
                return !stopped
            },
            function() {
                document.querySelector('.output').innerHTML = output.html

                var element = document.createElement('script')
                element.innerHTML = output.script
                document.body.appendChild(element)
            }
        )
    }, 1)
}

function next() {
    nextTest(test)
}

function open() {
    setTimeout(function() {
        runNext(test,
            function(result) {
                return false
            },
            function() {
                document.querySelector('.output').innerHTML = output.html

                var element = document.createElement('script')
                element.innerHTML = output.script
                document.body.appendChild(element)
            }
        )
    }, 1)
}

function getTest() {
    var test

    // test = [Edit()]
    test = [Edit(), Edit(), Edit(), Edit()]
    test[2].serverOrder = 8
    test[2].peerOrder = 6
    test[2].editOrder = 2
    test[2].position = 0
    test[2].madeBy = 1

    test[3].serverOrder = 9
    test[3].peerOrder = 8
    test[3].editOrder = 5
    test[3].position = 1

    // test = [Edit()]

    return test
}

function firstFailing() {
    test = getTest()

    setTimeout(function() {
        runNext(test,
            function(result) {
                return result
            },
            function() {
                document.querySelector('.output').innerHTML = output.html

                var element = document.createElement('script')
                element.innerHTML = output.script
                document.body.appendChild(element)
            }
        )
    }, 1)
}

function runNext(test, continueFunc, doneCallback) {
    try {
        var sim = runTest(test)
    } catch(err) {
        // console.log('sim threw exception:', err)
        if(!['ordering:tcp-peer', 'ordering:tcp-server', 'ordering:effect-before-cause', 'ordering:edit-order-number', 'position: from'].includes(err)) {
            throw err
            // throw new Exception(err)
        }

        nextTest(test)
        
        // if(test.length < 4) {   
            setTimeout(function() {
                runNext(test, continueFunc, doneCallback)
            }, 1)
        // }

        return
    }

    var result = sim.checkConsistency()
    isConsistent = result

    if(!continueFunc(result)) {
        output = sim.render()
        doneCallback()
    }

    else {   
        nextTest(test)
        
        // if(test.length < 4) {   
            setTimeout(function() {
                runNext(test, continueFunc, doneCallback)
            }, 1)
        // }
    }
}

function Edit(n) {
    if(n === undefined) {
        n = 0
    }
    return {
        madeBy: 0,
        position: 0,
        editOrder: n,
        peerOrder: n + 1,
        serverOrder: n + 1,
    }
}

function nextTest(test) {
    var i = 0

    while(test[i]) {
        if(test[i].madeBy < numClients - 1) {
            test[i].madeBy++
            break
        }
        
        else {
            test[i].madeBy = 0
            
            if(test[i].position < i) {
                test[i].position++
                break
            }

            else {
                test[i].position = 0

                if(test[i].editOrder < 3 * i) {
                    test[i].editOrder++
                    break
                }

                else {
                    if(i > 0) {
                        test[i].editOrder = test[i-1].editOrder + 1
                    } else {
                        test[i].editOrder = 0
                    }

                    if(test[i].peerOrder < 3 * i + 1) {
                        test[i].peerOrder++
                        break
                    }

                    else {
                        test[i].peerOrder = test[i].editOrder + 1

                        if(test[i].serverOrder < 3 * i + 2) {
                            test[i].serverOrder++
                            break
                        }

                        else {
                            test[i].serverOrder =  test[i].editOrder + 1

                            if(i == test.length - 1) {
                                test.push(Edit(i + 1))
                                break
                            }
                        }
                    }
                }
            }
        }

        i++
    }
}

function draw() {
    var canvas = document.querySelector('canvas')
    var c = canvas.getContext('2d')
    c.font = '16px sans-serif'

    c.fillStyle = '#FFF8'
    c.fillRect(0, 0, 640, 480)
    
    test.forEach(function(edit, i) {
        if(isConsistent) {
            c.fillStyle = '#080F'
        } else {
            c.fillStyle = '#800F'
        }

        c.fillText(JSON.stringify(edit), 5, 20 + 22*i)
    })

    

    requestAnimationFrame(draw)
}

