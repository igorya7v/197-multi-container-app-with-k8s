const keys = require('./keys');

// Express App Setup
const express = require('express');
const bodyParser = require('body-parser');
const cors =  require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
	user: keys.pgUser,
	host: keys.pgHost,
	database: keys.pgDatabase,
	password: keys.pgPassword,
	port: keys.pgPort
});

pgClient.on('error', () => console.log('Lost PG connsection'));

pgClient.query('CREATE TABLE IF NOT EXISTS values (number INT)')
	.catch(err => console.log(err));
	
// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
	host: keys.redisHost,
	port: keys.redisPort,
	retry_strategy: () => 1000
});

// A separate connection is needed for
// for listen, subscribe or publish operations.
const redisPublisher = redisClient.duplicate();


// Express route handlers

app.get('/', (req, res) => {
	res.send('Hello');
});

// Fetch seen indexes from the Postgres (pg) db. 
app.get('/values/all', async (req, res) => {
	const values = await pgClient.query('SELECT * from values');
	res.send(values.rows);
});

// Fetch the calculated values from the Redis db.
app.get('/values/current', async (req, res) => {
	redisClient.hgetall('values', (err, values) => {
		res.send(values);
	});
});

app.post('/values', async (req, res) => {
	const index = req.body.index;
	
	if (parseInt(index) > 40) {
		return res.status(422).send('Index too high!');
	}
	
	// insert index to Redis db 
	// and publish the 'insert' message
	redisClient.hset('values', index, 'Nothing yet!');
	redisPublisher.publish('insert', index);
	
	// insert index to Postgres db
	pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
	
	res.send({ working: true });
});

app.listen(5000, err => {
	console.log('Listening');
});



