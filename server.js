let express = require('express');
let auth = require('http-auth');
let app = express();
let server = require('http').Server(app);
let io = require('socket.io')(server);
let path = require('path');

app.use(express.json());

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.use('/static', express.static(__dirname + '/public'));

let basic = auth.basic({
    file: __dirname + '/users.htpasswd'
});

let log = [];

let passwords = {};

// let template = {
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

// TODO: add basic auth here and config to not display logins/passwords on github
app.post('/', auth.connect(basic), function (req, res) {
    const data = req.body;
    log.push(data);
    log = log.slice(-100);

    const password = data.password;
    if (passwords[password]) {
        passwords[password]++;
    } else {
        passwords[password] = 1;
    }

    console.log(JSON.stringify(data));
    io.emit('update', {
        attackInfo: escapeAllFields(data),
        topPasswords: getTopTenPasswords(passwords)
    });
    res.send('POST Success');
});

io.on('connection', function (socket) {
    socket.emit('existingLog', {
        log: log,
        topPasswords: getTopTenPasswords(passwords)
    });
});

function escapeAllFields(obj) {
    Object.keys(obj).forEach(function (key) {
        if (typeof obj[key] === 'string') {
            console.log(obj[key]);
            obj[key] = escape(obj[key]);
            console.log(obj[key]);
        }
    });

    return obj;
}

function getTopTenPasswords(passwords) {
    const passwordsWithUsageNumber = Object.keys(passwords).map(key => {
        return { password: key, numberOfUses: passwords[key] };
    });
    const sortedByUsage = passwordsWithUsageNumber.sort(p => p.numberOfUses);
    return sortedByUsage.splice(0, 10);
}


server.listen(8080);