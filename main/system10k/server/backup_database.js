var fs = require('fs')
var process = require('process')
var postgres = require('pg')


var backupFilename = '/root/nightly_database_backup/data.json'


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

var data = {}

dbConnection.query('SELECT * FROM users', function(error, response) {
	if(error) {
		console.log('Error reading users table:', error)
		return
	}

	data.users = response.rows

	dbConnection.query('SELECT * FROM teams', function(error, response) {
		if(error) {
			console.log('Error reading users table:', error)
			return
		}

		data.teams = response.rows

		fs.writeFileSync(backupFilename, JSON.stringify(data))

		console.log('Done writing backup database snapshot.')
		process.exit(0)
	})


})
