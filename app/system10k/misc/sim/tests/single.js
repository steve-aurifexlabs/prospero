var test = {
    "expectedResult": 'a',
    "initialDocument": '',
    "nodes": [
        // Client A
        {
            "type": 'client',
            "name": "steve@aurifexlabs.com",
            "inputEvents": [
                {
                    "at": 0.100,
                    "from": 0,
                    "to": 0,
                    "text": [
                        "a"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0, 0.1, 0.2],
                },
            ]
        },

        // Client B
        {
            "type": 'client',
            "name": "nancy@prospero.live",
            "inputEvents": [
                
            ]
        },
        
        // Server
        {
            type: "server",
            name: "Server",
        }
    ]
}
