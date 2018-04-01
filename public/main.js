const gui = new dat.GUI();

const settings = {
    numberOfSavedTraces: 30,
    lineWidth: 2
};

gui.add(settings, 'numberOfSavedTraces', 1, 100);
gui.add(settings, 'lineWidth', 1, 10);

const NUMBER_OF_SAVED_TRACES = 30;
const PX_RATIO = 2;
const LINE_WIDTH = 2;
const FIREWORK_DISTANCE = 100;

const POINT_STATUSES = {
    charging: 'charging',
    inAir: 'inAir',
    firework: 'firework'
}

let geojson;
fetch('/static/coastline.geojson')
    .then(function (response) {
        response.blob().then(function (data) {
            let reader = new FileReader();
            reader.addEventListener("loadend", function () {
                geojson = JSON.parse(reader.result);
                drawMap(geojson);
            });
            reader.readAsText(data);
        })
    });

window.onresize = () => {
    // TODO: make this work correctly
    console.log('onresize');
    updateCanvas();
    drawMap(geojson);
};

updateCanvas();

let traces = [];

let socket = io.connect('/');

function unescapeOrBlank(stringToUnescape) {
    return stringToUnescape ? unescape(stringToUnescape) : '-';
}
function createTableRow(data) {
    let tr = document.createElement('tr');
    let date = new Date(unescape(data.time));
    let time = date.toString().match(/\d\d:\d\d:\d\d/g)[0];
    let dataToDisplay = [
        time,
        data.src_country,
        data.src_ip,
        data.dst_country,
        data.dst_ip,
        data.login,
        data.password
    ];
    dataToDisplay.forEach((value) => {
        let td = document.createElement('td');
        td.innerText = unescapeOrBlank(value);
        tr.appendChild(td);
    })

    return tr;
};
function setListContent(events) {
    let list = document.getElementsByClassName('events')[0];
    let listElements = events.slice(-20).map(e => createTableRow(e));
    listElements.slice().reverse().forEach(e => list.appendChild(e));
};
function updateList(event) {
    let list = document.getElementsByClassName('events')[0];
    let li = createTableRow(event);
    list.insertBefore(li, list.firstChild);
    if (list.children.length > 20) {
        list.removeChild(list.lastChild);
    }
};

socket.on('existingLog', function (log) {
    setListContent(log.log);
});

socket.on('update', function (data) {
    let d = data.data;
    updateList(data.data);
    let src = [d.src_longitude, d.src_latitude]; //idk pochemu tak
    let dst = [d.dst_longitude, d.dst_latitude];

    traces.push(new Trace(src, dst));
});

tryToAnimate();

function tryToAnimate() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = '#F3161F';
    // ctx.lineWidth = settings.lineWidth * PX_RATIO;

    draw();

    function draw(timestamp) {
        ctx.lineWidth = settings.lineWidth * PX_RATIO;

        traces = traces.filter(p => p.isActual);

        // const initialArcRadius = 30 * PX_RATIO;
        const initialArcRadius = 30 * PX_RATIO;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const animationStep = 0.02;

        traces.forEach(p => {
            if (p.currentPosition >= 1) {
                p.updateStatus();
            }

            ctx.fillStyle = p.color;

            if (p.status === POINT_STATUSES.charging) {
                // TODO: draw several arcs
                ctx.beginPath();
                ctx.arc(p.x, p.y, initialArcRadius * (1 - p.currentPosition), 0, 2 * Math.PI);
                p.currentPosition += animationStep * 3;
                ctx.stroke();
            }

            if (p.status === POINT_STATUSES.inAir) {
                const newPosition = p.currentPosition + animationStep;
                const b = bezier2(p.src, p.dst, p.auxilaryPoint, newPosition);
                ctx.save();

                // logic that draws trace
                // probably could be merged with the next piece
                p.tracePoints.forEach((tracePoint, index) => {
                    ctx.beginPath();
                    // ctx.strokeStyle = `rgba(255, 0, 0, ${1 * index / NUMBER_OF_SAVED_TRACES})`;
                    ctx.strokeStyle = `rgba(255, 0, 0, ${1 * index / settings.numberOfSavedTraces})`;
                    // ctx.lineWidth = LINE_WIDTH * index / NUMBER_OF_SAVED_TRACES;
                    ctx.moveTo(tracePoint.startCoords[0], tracePoint.startCoords[1]);
                    ctx.lineTo(tracePoint.endCoords[0], tracePoint.endCoords[1]);
                    ctx.stroke();
                });

                ctx.beginPath();
                ctx.restore();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(b[0], b[1]);
                ctx.stroke();
                p.addTracePoint([p.x, p.y], [b[0], b[1]]);
                p.x = b[0];
                p.y = b[1];
                p.currentPosition = newPosition;
            }

            if (p.status === POINT_STATUSES.firework) {
                // TODO: figure out how to draw
                // draws circles
                ctx.beginPath();
                ctx.arc(p.x, p.y, initialArcRadius * (p.currentPosition), 0, 2 * Math.PI);
                p.currentPosition += animationStep * 3;
                ctx.stroke();
                // let beams = getFireworkBeams(_convertBack([p.x, p.y]));
                // fireworks.push(...beams);
            }
        });

        // fireworks.forEach(f => {

        //     if (f.currentPosition >= 1) {
        //         f.updateStatus();
        //         // p.isActual = false;
        //         // return;
        //     }

        //     const newPosition = f.currentPosition + animationStep;
        //     const b = bezier2(f.src, f.dst, f.auxilaryPoint, newPosition);
        //     ctx.save();

        //     // logic that draws trace
        //     // probably could be merged with the next piece
        //     f.tracePoints.forEach((tracePoint, index) => {
        //         ctx.beginPath();
        //         ctx.strokeStyle = `rgba(255, 0, 0, ${1 * index / NUMBER_OF_SAVED_TRACES})`;
        //         // ctx.lineWidth = LINE_WIDTH * index / NUMBER_OF_SAVED_TRACES;
        //         ctx.moveTo(tracePoint.startCoords[0], tracePoint.startCoords[1]);
        //         ctx.lineTo(tracePoint.endCoords[0], tracePoint.endCoords[1]);
        //         ctx.stroke();
        //     });

        //     ctx.beginPath();
        //     ctx.restore();
        //     ctx.moveTo(f.x, f.y);
        //     ctx.lineTo(b[0], b[1]);
        //     ctx.stroke();
        //     f.addTracePoint([f.x, f.y], [b[0], b[1]]);
        //     f.x = b[0];
        //     f.y = b[1];
        //     f.currentPosition = newPosition;
        // });

        requestAnimationFrame(draw);
    }
}

function getFireworkBeams(startPoint) {
    let fireworkEndPoint = [startPoint[0], startPoint[1] + FIREWORK_DISTANCE];
    let numberOfBeams = random(6, 10);
    let beams = [];
    for (let i = 0; i < numberOfBeams; i++) {
        const angle = 360 / numberOfBeams * (i + 1);
        const endPointX = fireworkEndPoint[0] * Math.cos(angle) - fireworkEndPoint[1] * Math.sin(angle);
        const endPointY = fireworkEndPoint[0] * Math.sin(angle) + fireworkEndPoint[1] * Math.cos(angle);
        let trace = new Trace(startPoint, [endPointX, endPointY]);
        trace.status = POINT_STATUSES.inAir;
        beams.push(trace);
    }
    return beams;
}

function _convertBack(canvasCoords) {
    return [
        canvasCoords[0] * 360 / canvas.width - 180,
        (canvasCoords[1] * 180 / canvas.height - 90) * -1
    ];
}

function drawMap(data) {
    var canvas = document.getElementById('coastline');
    // canvas.width = canvas.clientWidth * PX_RATIO;
    // canvas.height = canvas.clientHeight * PX_RATIO;
    canvas.width = canvas.clientWidth * PX_RATIO;
    canvas.height = canvas.clientHeight * PX_RATIO;

    const ctx = canvas.getContext('2d');
    // ctx.lineWidth = PX_RATIO;
    ctx.lineWidth = PX_RATIO;
    ctx.lineJoin = ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.beginPath();

    for (let i = 0; i < data.features.length; i++) {
        const line = data.features[i].geometry.coordinates;
        for (let j = 0; j < line.length; j++) {
            ctx[j ? 'lineTo' : 'moveTo'](
                (line[j][0] + 180) * canvas.width / 360,
                (-line[j][1] + 90) * canvas.height / 180);
        }
    }
    ctx.stroke();
}

function getX(latitude) {
    return (latitude + 180) * canvas.width / 360;
}

function getY(longitude) {
    return (-longitude + 90) * canvas.height / 180;
}

function bezier1(src, dst, t) {
    let x = (1 - t) * src[0] + t * dst[0];
    let y = (1 - t) * src[1] + t * dst[1];
    return [x, y];
}
function bezier2(src, dst, auxilaryPoint, t) {
    let f = function (s, d, a) {
        return Math.pow((1 - t), 2) * s + 2 * (1 - t) * t * a + Math.pow(t, 2) * d;
    };
    return [
        f(src[0], dst[0], auxilaryPoint[0]),
        f(src[1], dst[1], auxilaryPoint[1])
    ];
}

function random(min, max) {
    return Math.random() * (max - min) + min;
}

class Trace {
    constructor(src, dst) {
        this.src = this._convertCoords(src);
        this.dst = this._convertCoords(dst);
        this.x = this.src[0];
        this.y = this.src[1];
        this.currentPosition = 0;
        this.isActual = true;
        this.color = '#FF0000';
        this.status = POINT_STATUSES.charging;
        this.tracePoints = [];
    }

    updateStatus() {
        switch (this.status) {
            case POINT_STATUSES.charging:
                this.status = POINT_STATUSES.inAir;
                this.currentPosition = 0;
                break;
            case POINT_STATUSES.inAir:
                this.status = POINT_STATUSES.firework;
                this.currentPosition = 0;
                break;
            default:
                this.isActual = false;
        }
    }

    get auxilaryPoint() {
        const src = this.src;
        const dst = this.dst;
        const middlePoint = this._middlePoint;
        const mcLength = 1 / this.length * this._arcCoefficient;  // weird shit
        const auxVector = [
            -1 * (dst[1] - src[1]) / mcLength,
            (dst[0] - src[0]) / mcLength
        ];
        return [
            middlePoint[0] + auxVector[0],
            middlePoint[1] + auxVector[1]
        ];
    }

    get length() {
        return Math.sqrt(Math.pow(this.dst[0] - this.src[0], 2) + Math.pow(this.dst[1] - this.src[1], 2));
    }

    addTracePoint(startCoords, endCoords) {
        this.tracePoints.push({ startCoords, endCoords });
        // this.tracePoints = this.tracePoints.slice(-1 * NUMBER_OF_SAVED_TRACES);
        this.tracePoints = this.tracePoints.slice(-1 * settings.numberOfSavedTraces);
    }

    _convertCoords(gpsCoords) {
        return [getX(gpsCoords[0]), getY(gpsCoords[1])];
    }

    get _arcCoefficient() {
        // return 10000 / PX_RATIO; // weird shit
        return 10000 / PX_RATIO; // weird shit
    }

    get _middlePoint() {
        return [
            (this.dst[0] + this.src[0]) / 2,
            (this.dst[1] + this.src[1]) / 2
        ];
    }
}

function updateCanvas() {
    const canvas = document.getElementById('canvas');
    // canvas.width = canvas.clientWidth * PX_RATIO;
    // canvas.height = canvas.clientHeight * PX_RATIO;
    canvas.width = canvas.clientWidth * PX_RATIO;
    canvas.height = canvas.clientHeight * PX_RATIO;
}
