// Dependencies
send
now

function Algorithm() { 
    var changeId = 0

    function algorithm(event, node) {
        if(node.type == 'client') {
            if(event.type == 'init') {
                initClient(event, node)
            }
            
            else if(event.type == 'input') {
                event.changeId = changeId
                applyInput(event, node)
                inputHandler(event, node)
                changeId++
            }
            
            else if(event.type == 'message' && event.message.type == 'change') {
                event.changeId = event.message.changeId
                clientChangeHandler(event, node)
            }
        }

        else if(node.type == 'server') {
            if(event.type == 'init') {
                initServer(event, node)
            }
            
            else if(event.type == 'message' && event.message.type == 'change') {
                event.changeId = event.message.changeId
                serverChangeHandler(event, node)
            }
        }
    }



    ////// Client

    function initClient(event, node) {
        node.state.document = event.initialDocument
        node.state.revisionId = 0
        node.expectedRevisionId = 1

        var checksum = crc32(node.state.document.toString('binary')) 
        
        node.state.history = [{
            afterDocument: node.state.document,
            afterChecksum: checksum,
        }]
        
        
        node.state.checksumTable = {}
        
        node.state.checksumTable[checksum] = {
            index: 0,
            document: node.state.document,
            // change: deepCopy(node.state.history[0]),
        }
        
        node.state.unappliedChangeQueue = []
    }

    function applyInput(event, node) {
        var document = node.state.document
        
        if(event.from > node.state.document.length) {
            throw 'position: from'
        }

        node.state.document = document.slice(0, event.from) + event.text + document.slice(event.to)
    }

    function inputHandler(event, node) {
        node.state.revisionId++

        var change = {
            at: event.at,
            from: event.from,
            to: event.to,
            text: event.text,
            removed: event.removed,
            madeBy: node.name,
            // origin: event.origin,
        }

        change.afterDocument = node.state.document
        change.afterChecksum = crc32(node.state.document.toString('binary'))

        node.state.checksumTable[change.afterChecksum] = {
            index: node.state.history.length,
            document: node.state.document,
            // change: deepCopy(change),
        }

        node.state.history.push(deepCopy(change))

        var message = {
            type: 'change',
            change: change,
            madeBy: node.name,
            time: now(),
            afterDocument: node.state.document,
            afterChecksum: crc32(node.state.document.toString('binary')),
            beforeDocument: node.beforeState.document,
            beforeChecksum: crc32(node.beforeState.document.toString('binary')),
            revisionId: node.state.revisionId,
            id: Math.random().toString(),
            changeId: event.changeId,
        }

        

        send(node, 'client', deepCopy(message), event)
        send(node, 'server', deepCopy(message), event)
    }

    function clientChangeHandler(event, node) {
        var message = event.message

        if(event.message.revisionId != node.expectedRevisionId) {
            throw 'ordering:tcp-peer'
        }

        node.expectedRevisionId++


        // Check beforeChecksum and find when it matches
        var otherChanges

        var match = node.state.checksumTable[message.beforeChecksum]
            
        if(match !== undefined) {
            otherChanges = node.state.history.slice(match.index + 1)
        }

        if(otherChanges === undefined) {
            node.state.unappliedChangeQueue.push(message)
            return
        }

        else if(otherChanges.length > 0) {
            // add entry to checksum table
            node.state.checksumTable[message.afterChecksum] = {
                index: match.index,
                document: message.afterDocument,
                // change: deepCopy(node.state.history[match.index]),
            }
        }

        var change = message.change

        event.preTransformedChange = deepCopy(change)
        clientShiftChange(otherChanges, change)
        event.transformedChange = deepCopy(change)

        node.state.document = patchFile(node.state.document, change, message.afterChecksum)

        change.afterDocument = node.state.document
        change.afterChecksum = crc32(node.state.document.toString('binary'))

        // Add entry to checksum table
        node.state.checksumTable[change.afterChecksum] = {
            index: node.state.history.length,
            document: node.state.document,
            // change: deepCopy(change),
        }

        node.state.history.push(deepCopy(change))

        if(node.state.unappliedChangeQueue.length > 0) {
            var afterMatch = node.state.checksumTable[node.state.unappliedChangeQueue[0].beforeChecksum]
            
            if(afterMatch !== undefined) {
                var queuedMessage = node.state.unappliedChangeQueue[0]
                node.state.unappliedChangeQueue = node.state.unappliedChangeQueue.slice(1)
                applyChange(queuedMessage, node, false, event)
            } 
        }
    }




    ///////// Server

    function initServer(event, node) {
        node.state.document = event.initialDocument
        
        node.expectedRevisionIds = {
            'A': 1,
            'B': 1,
        }

        var checksum = crc32(node.state.document.toString('binary')) 
        
        node.state.history = [{
            document: node.state.document,
            checksum: checksum,
        }]
        
        node.state.checksumTable = {}
        
        node.state.checksumTable[checksum] = {
            index: 0,
            document: node.state.document,
            // change: deepCopy(node.state.history[0]),
        }

        node.state.unappliedChangeQueue = []
    }
        
    function serverChangeHandler(event, node) {
        if(event.message.revisionId != node.expectedRevisionIds[event.message.madeBy]) {
            throw 'ordering:tcp-server'
        } else {
            node.expectedRevisionIds[event.message.madeBy]++
        }

        applyChange(event.message, node, true, event)
    }

    function applyChange(message, node, isRealMessage, event) {
        // Lookup in checksumTable
        // Check beforeChecksum and find when it matches
        var otherChanges
        
        var match = node.state.checksumTable[message.beforeChecksum]
        
        if(match !== undefined) {
            otherChanges = node.state.history.slice(match.index + 1)
        }
    
        if(otherChanges === undefined) {
            node.state.unappliedChangeQueue.push(message)
            return
        }
    
        else if(otherChanges.length > 0) {
            // add entry to checksum table
            node.state.checksumTable[message.afterChecksum] = {
                index: match.index,
                document: message.afterDocument,
                // change: deepCopy(node.state.history[match.index]),
            }
        }
    
        var change = message.change
        event.preTransformedChange = deepCopy(change)
        serverShiftChange(otherChanges, change)
        event.transformedChange = deepCopy(change)
    
        node.state.document = patchFile(node.state.document, change, message.checksum)
        
        var checksum = crc32(node.state.document.toString('binary'))

        // Add entry to checksum table
        node.state.checksumTable[checksum] = {
            index: node.state.history.length,
            document: node.state.document,
            // change: deepCopy(change),
        }
    
        node.state.history.push(deepCopy(change))

        if(node.state.unappliedChangeQueue.length > 0) {
            var afterMatch = node.state.checksumTable[node.state.unappliedChangeQueue[0].beforeChecksum]
            
            if(afterMatch !== undefined) {
                var queuedMessage = node.state.unappliedChangeQueue[0]
                node.state.unappliedChangeQueue = node.state.unappliedChangeQueue.slice(1)
                applyChange(queuedMessage, node, false, event)
            } 
        }
    }






    ///////// Common
    function clientShiftChange(missedChanges, proposedChange) {
        var proposedChanges = [proposedChange]
        var extraPatches = []
        proposedChanges.forEach(function(proposedChange) {
            missedChanges.forEach(function(missedChange, i) {
                if(missedChange.madeBy != proposedChange.madeBy) {
                    var extraPatch = transformChange(missedChange, proposedChange)
                    
                    if(extraPatch) {
                        extraPatch.i = i
                        extraPatches.push(extraPatch)        
                    }
                }
            })
        })

        extraPatches.forEach(function(extraPatch, i) {
            proposedChanges = proposedChanges.slice(0, extraPatch.i + i).concat([extraPatch, proposedChanges.slice(extraPatch.i + i)])
        })
    }

    clientShiftChange = serverShiftChange   


    function serverShiftChange(missedChanges, proposedChange) {
        // var extraPatches = []
        var newChanges = []

        // Transforms partner history through your history -> 
        missedChanges.forEach(function(missedChange, i) {
            if(missedChange.madeBy != proposedChange.madeBy) {
                
                var newChange = Object.assign({}, missedChange)  
                
                missedChanges.slice(i+1).forEach(function(userOtherChange) {
                    if(userOtherChange.madeBy == proposedChange.madeBy) {
                        transformChange(userOtherChange, newChange)
                    }
                })
                
                newChanges.push(newChange)
            }
        })


        // Trasform your change through other changes...
        newChanges.forEach(function(newChange) {
            transformChange(newChange, proposedChange)
        })
    }


    function forwardRebase(committedChange, patch) {
        var extraPatch = {}
        
        // 1) Shift delete patch by delete committedChange
        // var deleteAmount = 0
        // if(isBefore(committedChange.from, patch.to) && isAfter(committedChange.to, patch.from)) {
        //     deleteAmount = getDistance(committedChange.to, committedChange.from)
        // }
        
        // else if(isBefore(committedChange.from, patch.to)) {
        //     deleteAmount = getDistance(patch.to, committedChange.from)
        // }
        
        // else if(isAfter(committedChange.to, patch.from)) {
        //     deleteAmount = getDistance(committedChange.to, patch.from)
        // }
        
        // shiftBy(patch, 'to', -deleteAmount)
        
        // // 2) Shift delete patch by insert committedChange
        // var shiftAmount = 0
        // if(isAfter(patch.from, committedChange.from)) {
        //     // MAYBE - shiftAmount = committedChange.removed.length
        //     shiftAmount = committedChange.text.length
        //     shiftBy(patch, 'from', shiftAmount)
        //     shiftBy(patch, 'to', shiftAmount)
        // }

        // else if(isAfter(patch.to, committedChange.from)) {
        //     patch.to = committedChange.from
        //     extraPatch.from = committedChange.from + committedChange.text.length
        //     extraPatch.to = patch.to + committedChange.text.length
        // }

        // // 3) Shift insert patch by delete committedChange
        // var insertShift = 0
        // if(isAfter(patch.from, committedChange.from)) {
        //     if(isAfter(patch.from, committedChange.to)) {
        //         insertShift = getDistance(committedChange.to, committedChange.from)
        //     }
            
        //     else {
        //         insertShift = getDistance(patch.to, committedChange.from)
        //     }
        // }

        // shiftBy(patch, 'from', -insertShift)

        // 4) Shift insert patch by insert committedChange
        if(isAfter(patch.from, committedChange.from)) {
            shiftBy(patch, 'from', committedChange.text.length)
        }

        if(isSamePosition(patch.from, committedChange.from)) {
            if(patch.madeBy > committedChange.madeBy) {
                shiftBy(patch, 'from', committedChange.text.length)
            }
        }

        return extraPatch
    }


    function reverseRebase(committedChange, patch) {
        // 4) Undo shift insert patch by insert committedChange
        if(isAfter(patch.from, committedChange.from)) {
            shiftBy(patch, 'from', -committedChange.text.length)
        }

        return extraPatch
    }

    function getDistance(a, b) {
        return b - a
    }

    function isBefore(a, b) {
        return a < b
    }

    function isAfter(a, b) {
        return a > b
    }

    function isSamePosition(a, b) {
        return a == b
    }

    function shiftBy(obj, attr, amount) {
        obj[attr] += amount
    }

    var crcTable = (function() {
        var c;
        var crcTable = [];
        for(var n =0; n < 256; n++){
            c = n;
            for(var k =0; k < 8; k++){
                c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        return crcTable;
    })()

    var crc32 = function(str) {
        var crc = 0 ^ (-1);

        for (var i = 0; i < str.length; i++ ) {
            crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
        }

        return (crc ^ (-1)) >>> 0;
    }


    function patchFile(contents, change, checksum, reverse) {
        var nDeleted = change.removed.length - 1
        change.removed.forEach(function(str) {
            nDeleted += str.length
        })
        contents = contents.slice(0, change.from) + contents.slice(change.from + nDeleted)

        var insertedText = []
        change.text.forEach(function(str) {
            insertedText.push(str)
        })
        insertedText = insertedText.join('\n')
        contents = contents.slice(0, change.from) + insertedText + contents.slice(change.from)
        
        return contents
    }


    return algorithm
}