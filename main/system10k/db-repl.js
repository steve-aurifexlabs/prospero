var process = require('process')
var postgres = require('pg')

var dbConnection = new postgres.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        ca: fs.readFileSync('./server/ca_cert.crt').toString(),
        rejectUnauthorized: true,
    },
})
dbConnection.connect()
dbConnection.query('SELECT NOW()', function(error, response) {
    console.log('SELECT NOW():', response.rows.now, 'Date.now()', Date.now())
})
