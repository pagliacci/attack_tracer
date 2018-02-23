let express = require('express');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);

app.use(express.json());

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

const TTL = 24;
let log = [];

let template = {
    "src_city": "St Petersburg",
    "dst_latitude": 30.2642,
    "dst_longitude": 59.8944,
    "src_latitude": -74.00598,
    "src_longitude": 40.71448,
    "dst_city": "St Petersburg",
    "src_country": "Russia",
    "password": "qwe",
    "attack_type": "ssh_bruteforce",
    "src_ip": "188.227.10.209",
    "dst_country": "Russia",
    "time": "2018-02-23T10:33:19.866686",
    "dst_ip": "91.142.94.74",
    "login": "test"
};

app.post('/', function (req, res) {
    const data = req.body;
    log.push(data);
    console.log(JSON.stringify(data));
    io.emit('update', { data: data });
    res.send('POST Success');
});

io.on('connection', function (socket) {
    socket.emit('existingLog', { log: log });
    // socket.emit('announcements', { message: 'A new user has joined!' + data });
});

server.listen(8080);