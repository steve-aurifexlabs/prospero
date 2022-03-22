function renderer(system) {
    var colors = ['#faa', '#afa', '#adf', '#aaa', '#faa', '#afa', '#adf', '#aaa']
    var mutedColors = ['#fbb', '#bfb', '#bdf', '#bbb', '#fbb', '#bfb', '#bdf', '#bbb']

    var html = ''
    var script = ''
    
    html += '<div style="position: fixed; top: 0; background: white; z-index: 4; width: 100%;"><p style="font-size: 125%;">'
        // '<span style="width: 350px; display: inline-block;">Expected result:</span><b>' + system.expectedResult + '</b></p><hr>'

    // html += '<h2 style="font-size: 75%;">Nodes</h2>'

    console.log(system)

    system.nodes.forEach(function(node, i) {
        var color
        if(node.state.document == system.nodes[2].state.document) {
            color = 'green'
        } else {
            color = 'red'
        }

        html += '<p style="font-size: 125%;"><span style="color: ' + color + '; width: 50px; display: inline-block;">' + node.name + '</span><bold>' + node.state.document + '</bold></p>'
        
        node.events.slice(1).forEach(function(event) {
            var color = '#eee'
            var arrow = ''

            if(event.type == 'input') {
                color = colors[event.changeId]
                arrow = '⇉'
            }
            
            else if(event.type == 'message') {
                color = mutedColors[event.changeId]
            }

            html += '<span style="color: ' + color + '; font-size: 275%; display: inline; position: absolute; left: ' +
                (150 + event.at * 100) + 'px; top: ' + (5 + 45  * i) + 'px;">' + event.changeId + arrow + '</span>'
        })
    })

    // html += '<br><hr><h2 style="font-size: 75%;">Event Log</h2>'

    html += '<p style="font-size: 60%; padding: 2px; border-bottom: 1px solid black;">' +
        // '<b style="width: 30px; display: inline-block;">changeId</b> ' +
        '<b style="width: 100px; display: inline-block;">Event</b> ' +
        '<b style="width: 50px; display: inline-block;">Node</b> ' +
        '<b style="width: 50px; display: inline-block;">text</b> ' +
        '<b style="width: 175px; display: inline-block;">Type</b> ' +
        // '<b style="width: 100px; display: inline-block;">Message Operation</b> ' +
        '<b style="width: 50px; display: inline-block;">Position</b> ' +
        '<b style="width: 25px; display: inline-block;">→</b> ' +
        '<b style="width: 150px; display: inline-block;">Transformed</b> ' +
        '<b style="width: 50px; display: inline-block;">Before</b> ' +
        '<b style="width: 25px; display: inline-block;">→</b> ' +
        '<b style="width: 150px; display: inline-block;">After</b> ' +
        '<b style="width: 75px; display: inline-block;">history</b> ' +
        '<b style="width: 75px; display: inline-block;">checksum{}</b> ' +
        '<b style="width: 75px; display: inline-block;">unappliedQ</b> ' +
        '</p></div><div style="width: 95%; position: absolute; top: 205px; overflow: scroll;">'

    system.eventLog.slice(3).forEach(function(event, i) {
        // var operation = ''
        // var transformedOperation = ''

        var text = ''
        var preTransformedPosition = ''
        var transformedPosition = ''

        if(event.type == 'input') {
            // operation = '@' + event.from + '→' + event.to + ' +' + event.text + ' -' + event.removed
            // operation = '@' + event.from + ' +' + event.text
            preTransformedPosition = event.from
            text = event.text
        }
        
        if(event.type == 'message') {
            // operation = '@' + event.message.change.from + '→' + event.message.change.from + 
                // ' +' + event.message.change.text + ' -' + event.message.change.removed
            // operation = '@' + event.message.change.from + 
            //     ' +' + event.message.change.text
            // preTposition = event.message.change.from
            text = event.message.change.text

            try {
                preTransformedPosition = event.preTransformedChange.from
            } catch(e) {
                // console.log(e, event)
            }
            
            try {
                transformedPosition = event.transformedChange.from
            } catch(e) {
                // console.log(e, event)
            }
        }
        var color = '#eee'
        var extraStyle = ''
        if(event.type == 'input') {
            color = colors[event.changeId]
            extraStyle = 'border-bottom: 1px dotted #fff;'
        } else if(event.type == 'message') {
            color = mutedColors[event.changeId]
        }

        html += '<div class="event-row" style="cursor: pointer; margin: 0; padding: 5px 5px; background-color: ' + color + ';">' +
            '<p style="font-size: 90%; ' + extraStyle + '">' +
            // '<span style="width: 75px; font-size: 80%; display: inline-block;">' +
            // event.changeId  + '</span> ' +
        
            '<span style="width: 100px; display: inline-block; font-size: 75%;">' +
            // Math.round(event.at * 10) + '</span> ' +
            event.at + '</span> ' +
            
            '<span style="width: 50px; display: inline-block; font-size: 175%;">' +
            event.node.name + '</span> ' +

            '<span style="width: 50px; display: inline-block;">' +
            text + '</span> ' +
            
            '<span style="width: 175px; display: inline-block; font-size: 90%;">' +
            event.type + '</span> ' +

            '<span style="width: 50px; display: inline-block;">' +
            preTransformedPosition + '</span> ' +

            '<span style="width: 25px; display: inline-block;">' +
            '→</span> ' +

            '<span style="width: 150px; display: inline-block;">' +
            transformedPosition + '</span> ' +

            '<span style="width: 50px; display: inline-block;">' +
            event.beforeState.document + '</span> ' +

            '<span style="width: 25px; display: inline-block;">' +
            '→</span> ' +

            '<span style="width: 150px; display: inline-block;">' +
            event.afterState.document + '</span> ' +

            '<span style="width: 75px; display: inline-block;">' +
            event.afterState.history.length + '</span> ' +
            
            '<span style="width: 75px; display: inline-block;">' +
            Object.keys(event.afterState.checksumTable).length + '</span> ' +
            
            '<span style="width: 75px; display: inline-block;">' +
            event.afterState.unappliedChangeQueue.length + '</span> ' +
            
            '</p><div class="history" style="display: none;"><pre style="width: 30%; display: inline-block;">history==' +
            JSON.stringify(event.afterState.history, null, 2) + '</pre><pre style="width: 30%; display: inline-block;">checksumTable==' +
            JSON.stringify(event.afterState.checksumTable, null, 2) + '</pre><pre style="width: 30%; display: inline-block;">unappliedChangeQueue==' +
            JSON.stringify(event.afterState.unappliedChangeQueue, null, 2) +

            '</pre></div></div>'
    })

    html += '</div>'
    
    script +=
        `
            var rows = document.querySelectorAll('.event-row')
            Array.from(rows).forEach(function(row) {
                row.addEventListener('click', function(event) {
                    if(row.querySelector('.history').style.display == 'block') {
                        row.querySelector('.history').style.display = 'none'
                    } else {
                        row.querySelector('.history').style.display = 'block'
                    }
                    
                    // console.log('event')
                    // var element = document.createElement('div')
                    // element.innerHTML = '<pre>' + JSON.stringify() + '</pre>'
                    // row.appendChild(element)
                })
            })
        `

    return {
        html: html,
        script: script,
    }
}