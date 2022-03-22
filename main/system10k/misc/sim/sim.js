var send
var now

function DistributedSystemSimulator(input, algorithm) {
    if(!input.nodes || input.initialDocument === undefined) {
        throw('invalid-args')
    }

    var system = {}

    system.nodes = input.nodes
    system.expectedResult = input.expectedResult
    system.initialDocument = input.initialDocument
    
    system.algorithm = algorithm
    system.renderer = renderer

    system.time = -2

    system.eventProcessingQueue = []
    system.eventLog = []
    
    system.nodes.forEach(function(node, i) {
        node.index = i
        node.state = {}
        node.events = []

        system.eventProcessingQueue = chronologicalInsert(system.eventProcessingQueue, {
            type: 'init',
            at: -1,
            node: node,
            initialDocument: system.initialDocument,
        })

        if(node.type == 'client') {
            node.inputEvents.forEach(function(event) {
                event.at = event.editOrder
                event.node = node
                event.type = 'input'
                system.eventProcessingQueue = chronologicalInsert(system.eventProcessingQueue, event)         
            })
        }
    })

    system.simulate = function() {
        // console.log(system.eventProcessingQueue)

        var stop = 0
        while(system.eventProcessingQueue.length > 0 && stop < 15) {
            stop++
            var event = system.eventProcessingQueue[0]
            system.time = event.at
            system.processEvent(event)
            system.eventProcessingQueue = system.eventProcessingQueue.slice(1)
        }
    }

    system.processEvent = function(event) {
        var node = event.node
        
        node.beforeState = deepCopy(node.state)
        event.beforeState = node.beforeState

        system.algorithm(event, node)
        
        event.afterState = deepCopy(node.state)

        node.events.push(event)
        system.eventLog.push(event)
    }

    system.render = function() {
        // console.log(system)
        return system.renderer(system)
    }

    system.checkConsistency = function() {
        var result = true

        system.nodes.forEach(function(node) {
            if(node.state.document !== system.nodes[0].state.document) {
                result = false
            }
        })
        
        return result
    }


    system.checkResult = function() {
        var result = true

        system.nodes.forEach(function(node) {
            if(node.state.document !== system.expectedResult) {
                result = false
            }
        })
        
        return result
    }


    send = function(senderNode, toType, message, originalEvent) {
        system.nodes.forEach(function(receiverNode) {
            if(receiverNode.type != toType || senderNode == receiverNode) {
                return
            }

            var order

            if(receiverNode.type == 'client') {
                order = originalEvent.peerOrder
            }
            
            else if(receiverNode.type == 'server') {
                order = originalEvent.serverOrder
            }

            // console.log(order)

            var event = {
                node: receiverNode,
                type: 'message',
                message: message,
                // at: now() + generateMessageLatency(senderNode, receiverNode),
                // at: now() + originalEvent.messageLatencies[receiverNode.index],
                at: order,
            }

            system.eventProcessingQueue = chronologicalInsert(system.eventProcessingQueue, event)
        })
    }

    now = function() {
        return system.time
    }

    function generateMessageLatency(nodeA, nodeB) {
        var connection = system.connections[nodeA.index][nodeB.index]
        return connection.latency + connection.jitter * (2 * Math.random() - 1)
    }

    return system
}

function chronologicalInsert(queue, object) {
    var isDone = false
    var newQueue

    queue.forEach(function(entry, i) {
        // console.log(object, entry)
        if(!isDone && object.at < entry.at) {
            newQueue = queue.slice(0, i).concat(object).concat(queue.slice(i))
            isDone = true
        }
    })
    
    if(!isDone) {
        queue.push(object)
    }

    else {
        queue = newQueue
    }

    // console.log(queue)

    return queue
}

function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj))
}

