function applyChange(node, message) {
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
        node.state.checksumTable[message.afterChecksum] = {
            index: match.index,
            document: message.afterDocument,
        }
    }

    var change = message.change
    shiftChange(otherChanges, change, node.state.checksumTable, match)

    node.state.document = patchFile(node.state.document, change, message.checksum)
    
    var checksum = crc32(node.state.document.toString('binary'))

    node.state.checksumTable[checksum] = {
        index: node.state.history.length,
        document: node.state.document,
    }

    node.state.history.push(deepCopy(change))

    if(node.state.unappliedChangeQueue.length > 0) {
        var afterMatch = node.state.checksumTable[node.state.unappliedChangeQueue[0].beforeChecksum]
        
        if(afterMatch !== undefined) {
            var queuedMessage = node.state.unappliedChangeQueue[0]
            node.state.unappliedChangeQueue = node.state.unappliedChangeQueue.slice(1)
            applyChange(queuedMessage, node)
        } 
    }
}

function shiftChange(missedChanges, proposedChange, checksumTable, match) {
    var extraPatches = []
    var newChanges = []

    // Transforms partner history through your history ->
    missedChanges.forEach(function(missedChange, i) {
        if(missedChange.madeBy != proposedChange.madeBy //) {
            && missedChange.revisionId > proposedChange.peerRevisionId) {
            
            var newChange = Object.assign({}, missedChange)  
            
            missedChanges.slice(i+1).forEach(function(userOtherChange) {
                if(userOtherChange.madeBy == proposedChange.madeBy) {
                    var extraPatch = transformChange(userOtherChange, newChange)
                    if(extraPatch) {
                        extraPatches.push(extraPatch)
                    }
                }
            })
            
            newChanges.push(newChange)
            extraPatches.forEach(function(extraPatch) {
                newChanges.push(extraPatch)
            })
        }
    })


    // Trasform your change through other changes...
    newChanges.forEach(function(newChange) {
        var extraPatch = transformChange(newChange, proposedChange)

        var document = patchFile(newChange.afterDocument, proposedChange)
        
        if(extraPatch) {
            document = patchFile(newChange.afterDocument, extraPatch)
        }
        
        var checksum = crc32(document.toString('binary'))

        checksumTable[checksum] = {
            index: match.index,
            document: document,
        }        
    })
}


function transformChange(committedChange, patch) {
    var delta = committedChange.text.length - (committedChange.to - committedChange.from)
    
    if(patch.to < committedChange.from) {
        return {}
    }
    
    else if(patch.from > committedChange.to) {
        if(delta < 0 && committedChange.to > patch.from) {
            delta -= committedChange.to - patch.from
        }

        patch.from += delta
        patch.to += delta
    }

    else {
        var extraPatch = {}

        if(delta > 0) {
            patch.to = committedChange.from
            extraPatch.from = committedChange.from + delta
            extraPatch.to = patch.to + delta
        }
        
        else {
            patch.to += delta
        }

        return extraPatch
    }
}
