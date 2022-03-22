const maxEdits = 10
const maxStringLength = 16
  

function SimulatorRun(programUnderTest, test) {
  var run = {
    system: {},
    history: {},
    programUnderTest: programUnderTest,
  }

  run.test = test

  run.system.nodes = {
    A: {},
    B: {},
    S: {},
  }
  
  run.system.queues = {
    peer: [[], []],
    server: [[], []],
  }

  if(run.test) {
    run.n = run.test.n
    run.system.initialDocument =  run.test.initialDocument
  }

  else { 
    run.maxEdits = maxEdits
    run.maxStringLength = maxStringLength
    
    run.n = Math.floor(Math.random() * run.maxEdits) + 1
    run.docLength = Math.floor(Math.random() * run.maxStringLength)
    run.system.initialDocument = randomString(run.docLength)
  }

  run.queuesEmpty = function() {
    return !run.system.queues.peer[0] && !run.system.queues.peer[1] &&
           !run.system.queues.server[0] && !run.system.queues.server[1]
  }

  run.newEdit = function() {
    var nextEvent
    
    nextEvent.type = 'original-edit'
    nextEvent.madeBy = Math.floor(Math.random() * 2)
  
    var doc = sim.nodes[nextEvent.madeBy].document
  
    nextEvent.from = randomNumber(0, doc.length)
    nextEvent.to = randomNumber(nextEvent.from, doc.length) 
    nextEvent.addedText = randomString(maxStringLength)
    nextEvent.removedText = doc.slice(nextEvent.from, nextEvent.to)
  
    var peerEvent = deepCopy(nextEvent)
    peerEvent.type = 'peer-edit'
    queues.peer[nextEvent.madeBy].push(peerEvent)
    
    var serverEvent = deepCopy(nextEvent)
    serverEvent.type = 'server-edit'
    queues.server[nextEvent.madeBy].push(serverEvent)
    
    event = nextEvent
  }

  run.processQueue = function() {
    var r = randomNumber(0, 4)
  
    if(r == 0) {
      event = queues.peer[0]
    } else if(r == 1) {
      event = queues.peer[1]
    } else if(r == 2) {
      event = queues.server[0]
    } else if(r == 3) {
      event = queues.server[1]
    }
  }

  run.processEvent = function(event) {
    var node = event.node
    
    node.beforeState = deepCopy(node.state)
    event.beforeState = node.beforeState

    algorithm(event, node)
    
    event.afterState = deepCopy(node.state)

    node.events.push(event)
    system.eventLog.push(event)
  }

  run.checkConsistency = function() {
    var result = true

    system.nodes.forEach(function(node) {
        if(node.state.document !== system.nodes[0].state.document) {
            result = false
        }
    })
    
    return result
  }

  run.run = function() {
    while(n > 0 || !queuesEmpty()) {
      if(queuesEmpty()) {
        newEdit()
      }
      
      else if(n <= 0) {
        processQueue()
      }
      
      else {
        if(Math.random() < 0.5) {
          newEdit()
        }
        
        else {
          processQueue()
        }
      }  
      
      sim.processEvent(event)
      sim.render()
    }

    if(sim.checkConsistency()) {
      console.log('pass')
    }
    

    else {
      console.log('fail')

      var test = "console.log('here!!!')"

      // renderTemplate(test)
    }

  }

  return run
}



var sim = Simulator(programUnderTest)
var event

function randomNumber(a, b) {
	return Math.floor(Math.random() * (b - a)) + a
}


function randomString() {
	// TODO
}


function renderTemplate(test) {
  var template = fs.readFileSync('random-template.html').toString()

  console.log(template)
  var before = template.split('/// INSERT TEST HERE')[0]
  var after = template.split('/// INSERT TEST HERE')[1]

  var htmlOutput = before + test + after

  var filename = 'failing-tests/prospero-random-test--' + (new Date()).toISOString() + '.html'
  fs.writeFileSync(filename, htmlOutput)
}



function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj))
}
