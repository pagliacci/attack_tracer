let express = require('express');
let auth = require('http-auth');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);
let compression = require('compression');
let config = require('./config.js');

const port = config.port || 8080;

app.use(express.json());

app.use(compression());

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.use('/static', express.static(__dirname + '/public'));

let basic = auth.basic({
    file: __dirname + '/users.htpasswd'
});

let log = [];

// const dataSample = {
//     "src_city": "St Petersburg",
//     "dst_latitude": 30.2642,
//     "dst_longitude": 59.8944,
//     "src_latitude": -74.00598,
//     "src_longitude": 40.71448,
//     "dst_city": "St Petersburg",
//     "src_country": "Russia",
//     "password": "qwe",
//     "attack_type": "ssh_bruteforce",
//     "src_ip": "188.227.10.209",
//     "dst_country": "Russia",
//     "time": "2018-02-23T10:33:19.866686",
//     "dst_ip": "91.142.94.74",
//     "login": "test"
// };

app.post('/', auth.connect(basic), function (req, res) {
    const data = req.body;
    data.time = new Date().toISOString();
    log.push(data);
    log = log.slice(-10);

    console.log(JSON.stringify(data));
    io.emit('update', {
        attackInfo: escapeAllFields(data)
    });
    res.send('POST Success');
});

io.on('connection', function (socket) {
    socket.emit('existingLog', {
        log: log
    });
});

function escapeAllFields(obj) {
    Object.keys(obj).forEach(function (key) {
        if (typeof obj[key] === 'string') {
            obj[key] = escape(obj[key]);
        }
    });

    return obj;
}

server.listen(port, err => {
    if (err) {
        return console.log(err);
    }

    console.log(`Server is listening on ${port} port`);
});
