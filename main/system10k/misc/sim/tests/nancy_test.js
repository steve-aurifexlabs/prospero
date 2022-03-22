var test = {
    "expectedResult": 'ab12',
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
                {
                    "at": 0.400,
                    "from": 1,
                    "to": 1,
                    "text": [
                        "b"
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
                {
                    "at": 0.700,
                    "from": 2,
                    "to": 2,
                    "text": [
                        "1"
                    ],
                    "removed": [ 
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0.1, 0, 0.2],
                },
                {
                    "at": 1.0,
                    "from": 3,
                    "to": 3,
                    "text": [
                        "2"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0.1, 0, 0.2],
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
