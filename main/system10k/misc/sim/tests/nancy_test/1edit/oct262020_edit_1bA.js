var test = {
    "expectedResult": '0',
    "initialDocument": '',
    "nodes": [
        // Client A
        {
            "type": 'client',
            "name": "steve@aurifexlabs.com",
            "inputEvents": [
                
            ]
        },

        // Client B
        {
            "type": 'client',
            "name": "nancy@prospero.live",
            "inputEvents": [
                {
                    "at": 0.100,
                    "from": 0,
                    "to": 0,
                    "text": [
                        "0"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0, 0.6, 0.2],
                },
            ]
        },
        
        // Server
        {
            type: "server",
            name: "Server",
        }
    ]
}
