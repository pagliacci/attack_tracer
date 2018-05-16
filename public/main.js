const settings = {
    numberOfSavedTraces: 10,
    lineWidth: 3,
    traceOpacityCoefficient: 4,
    animationSpeed: 0.035
};

const PX_RATIO = 2;
const NUMBER_OF_TABLE_ENTRIES = 5;

const LAND_GEOJSON_URL = '/static/land.geojson';

const POINT_STATUSES = {
    inAir: 'inAir',
    firework: 'firework'
}

let geojson;
fetch(LAND_GEOJSON_URL)
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
    updateCanvas();
    drawMap(geojson);
};

updateCanvas();

let traces = [];

let socket = io.connect('/');

function unescapeOrBlank(stringToUnescape) {
    return stringToUnescape ? unescape(stringToUnescape) : '-';
}
function getTimeOrBlank(date) {
    if(isNaN(date.getTime())){
        return '-';
    } else {
        return date.toLocaleTimeString('en-GB');
    }
}
function createAttackTableRow(data) {
    const tr = document.createElement('tr');
    const date = new Date(unescape(data.time));
    const time = getTimeOrBlank(date);
    const dataToDisplay = [
        time,
        data.src_ip,
        data.src_city,
        data.dst_ip,
        data.dst_city,
        data.login,
        data.password
    ];
    dataToDisplay.forEach((value) => {
        const td = document.createElement('td');
        td.innerText = unescapeOrBlank(value);
        tr.appendChild(td);
    })

    return tr;
};
function setAttacksListContent(events) {
    const list = document.getElementsByClassName('events')[0];
    const listElements = events.slice(-NUMBER_OF_TABLE_ENTRIES).map(e => createAttackTableRow(e));
    listElements.slice().reverse().forEach(e => list.appendChild(e));
};
function updateAttacksList(event) {
    const list = document.getElementsByClassName('events')[0];
    const li = createAttackTableRow(event);
    list.insertBefore(li, list.firstChild);
    if (list.children.length > NUMBER_OF_TABLE_ENTRIES) {
        list.removeChild(list.lastChild);
    }
};
function clearElementChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

socket.on('existingLog', function (data) {
    setAttacksListContent(data.log);
});

socket.on('update', function (data) {
    const attackInfo = data.attackInfo;
    updateAttacksList(attackInfo);

    const src = [attackInfo.src_longitude, attackInfo.src_latitude]; //idk pochemu tak
    const dst = [attackInfo.dst_longitude, attackInfo.dst_latitude];
    traces.push(new Trace(src, dst));
});

tryToAnimate();

function tryToAnimate() {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    ctx.strokeStyle = '#F3161F';

    draw();

    function draw(timestamp) {
        ctx.lineWidth = settings.lineWidth * PX_RATIO;
        traces = traces.filter(p => p.isActual);
        const initialArcRadius = 30 * PX_RATIO;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const animationStep = settings.animationSpeed;

        traces.forEach(p => {
            if (p.currentPosition >= 1) {
                p.updateStatus();
            }

            ctx.fillStyle = p.color;

            if (p.status === POINT_STATUSES.inAir) {
                const newPosition = p.currentPosition + animationStep;
                const b = bezier2(p.src, p.dst, p.auxilaryPoint, newPosition);
                ctx.save();

                // logic that draws trace
                p.tracePoints.forEach((tracePoint, index) => {
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(255, 0, 0, ${1 * index / settings.traceOpacityCoefficient})`;
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
                ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
                ctx.beginPath();
                ctx.arc(p.x, p.y, initialArcRadius * (p.currentPosition), 0, 2 * Math.PI);
                p.currentPosition += animationStep * 3;
                ctx.stroke();
            }
        });

        requestAnimationFrame(draw);
    }
}

function drawMap(data) {
    var canvas = document.getElementById('coastline');
    canvas.width = canvas.clientWidth * PX_RATIO;
    canvas.height = canvas.clientHeight * PX_RATIO;

    const ctx = canvas.getContext('2d');
    ctx.lineWidth = PX_RATIO;
    ctx.fillStyle = '#373634';

    for (let i = 0; i < data.features.length; i++) {
        const line = data.features[i].geometry.coordinates[0];
        for (let j = 0; j < line.length; j++) {
            ctx[j ? 'lineTo' : 'moveTo'](
                (line[j][0] + 180) * canvas.width / 360,
                (-line[j][1] + 90) * canvas.height / 180);
        }
    }
    ctx.fill();
}

function getX(latitude) {
    return (latitude + 180) * canvas.width / 360;
}

function getY(longitude) {
    return (-longitude + 90) * canvas.height / 180;
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

class Trace {
    constructor(src, dst) {
        this.src = this._convertCoords(src);
        this.dst = this._convertCoords(dst);
        this.x = this.src[0];
        this.y = this.src[1];
        this.currentPosition = 0;
        this.isActual = true;
        this.color = '#FF0000';
        this.status = POINT_STATUSES.inAir;
        this.tracePoints = [];
    }

    updateStatus() {
        switch (this.status) {
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
        this.tracePoints = this.tracePoints.slice(-1 * settings.numberOfSavedTraces);
    }

    _convertCoords(gpsCoords) {
        return [getX(gpsCoords[0]), getY(gpsCoords[1])];
    }

    get _arcCoefficient() {
        return 10000 / PX_RATIO;
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
    canvas.width = canvas.clientWidth * PX_RATIO;
    canvas.height = canvas.clientHeight * PX_RATIO;
}
