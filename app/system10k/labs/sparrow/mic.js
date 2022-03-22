class MicProcessor extends AudioWorkletProcessor {
    constructor(...args) {
        super(...args)
        this.port.onmessage = function(event) {
            console.log(event.data)
        }
    }

    process (inputs, outputs, parameters) {
        this.port.postMessage(inputs[0][0])
        return true
    }
  }
  
  registerProcessor('mic-processor', MicProcessor)