var test = {
    "expectedResult": '12ab',
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
                    "messageLatencies": [0, 0.1, 0.132],
                },
                {
                    "at": 0.420,
                    "from": 1,
                    "to": 2,
                    "text": [
                        ""
                    ],
                    "removed": [
                        "a"
                    ],
                    "origin": "+input",
                    "messageLatencies": [0, 0.2, 0.132],
                },
                {
                    "at": 0.500,
                    "from": 0,
                    "to": 0,
                    "text": [
                        "1"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0, 0.15, 0.152],
                },
                {
                    "at": 0.740,
                    "from": 1,
                    "to": 1,
                    "text": [
                        "2"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [1, 0.28, 0.158],
                },
            ]
        },

        // Client B
        {
            "type": 'client',
            "name": "nancy@prospero.live",
            "inputEvents": [
                {
                    "at": 0.300,
                    "from": 0,
                    "to": 0,
                    "text": [
                        "1"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0.05, 0, 0.152],
                },
                {
                    "at": 0.400,
                    "from": 1,
                    "to": 1,
                    "text": [
                        "2"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0.18, 0, 0.158],
                },
                {
                    "at": 0.600,
                    "from": 0,
                    "to": 0,
                    "text": [
                        "1"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0.05, 0, 0.152],
                },
                {
                    "at": 0.800,
                    "from": 1,
                    "to": 1,
                    "text": [
                        "2"
                    ],
                    "removed": [
                        ""
                    ],
                    "origin": "+input",
                    "messageLatencies": [0.18, 0, 0.158],
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

// var output = '12ab'