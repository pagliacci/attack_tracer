(function() {
    const headers = [
        'time',
        'source country',
        'source city',
        'source ip',
        'destination country',
        'destination city',
        'destination ip',
        'login',
        'password'
    ];
    let socket = io.connect('/');
    let existingEvents = [];
    let createLi = function (data) {
        let li = document.createElement('li');
        li.innerHTML =
            `<span>${data.time}</span>
            <span>${data.src_country || '-'}</span>
            <span>${data.src_city || '-'}</span>
            <span>${data.src_ip}</span>
            <span>${data.dst_country || '-'}</span>
            <span>${data.dst_city || '-'}</span>
            <span>${data.dst_ip}</span>
            <span>${data.login}</span>
            <span>${data.password}</span>`;

        return li;
    };
    let updateList = function () {
        let list = document.getElementsByClassName('events-list')[0];
        list.innerHTML = '';
        headers.forEach(h => {
            const header = document.createElement('span');
            header.innerHTML = h.toUpperCase();
            list.appendChild(header);
        });
        let listElements = existingEvents.map(e => createLi(e));
        listElements.slice().reverse().forEach(e => list.appendChild(e));
    };

    mapboxgl.accessToken = 'pk.eyJ1IjoiYmFyYWJ1bGxrbyIsImEiOiJjamUwNjBienQxaTQzMnBvaHZ4OTlsc2t5In0._nrXaI2sCkGLXbIw6GgvdQ';
    let map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/dark-v9',
        zoom: 0,
        interactive: false
    });

    socket.on('existingLog', function (log) {
        existingEvents.push(...log.log);
        updateList();
        console.log(log);
    });

    let lastTraceId = 0;
    socket.on('update', function (data) {
        lastTraceId++;
        let d = data.data;
        existingEvents.push(d);
        existingEvents = existingEvents.slice(-100);
        updateList();
        let src = [d.src_longitude, d.src_latitude]; //idk pochemu tak
        let dst = [d.dst_longitude, d.dst_latitude];

        showTrace(src, dst, lastTraceId);
        console.log(d);
    });

    function showTrace(src, dst, traceId) {
        const lineAnimationId = `line-animation-${traceId}`;
        const pointId = `point-${traceId}`;

        let geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [src]
                }
            }]
        };

        let route = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        src,
                        dst
                    ]
                }
            }]
        };

        let point = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": origin
                }
            }]
        };

        let lineDistance = turf.lineDistance(route.features[0], 'kilometers');

        let arc = [];
        // Draw an arc between the `origin` & `destination` of the two points
        for (let i = 0; i < lineDistance; i += 50) {
            let segment = turf.along(route.features[0], i / 1000 * lineDistance, 'kilometers');
            arc.push(segment.geometry.coordinates);
        }

        route.features[0].geometry.coordinates = arc;

        map.addSource(pointId, {
            "type": "geojson",
            "data": point
        });

        map.addSource(lineAnimationId, {
            "type": "geojson",
            "data": geojson
        });

        map.addLayer({
            "id": pointId,
            "source": pointId,
            "type": "symbol",
            "layout": {
                "icon-image": "airport-15",
                "icon-rotate": 90,
                "icon-allow-overlap": true
            }
        });

        map.addLayer({
            'id': lineAnimationId,
            'type': 'line',
            'source': lineAnimationId,
            'layout': {
                'line-cap': 'round',
                'line-join': 'round'
            },
            'paint': {
                'line-color': '#ed6498',
                'line-width': 3,
                'line-opacity': .8
            }
        });

        let counter = 0;

        animateLine();

        function animateLine(timestamp) {
            point.features[0].geometry.coordinates = route.features[0].geometry.coordinates[counter];
            let currentCoordinates = point.features[0].geometry.coordinates;
            geojson.features[0].geometry.coordinates.push(currentCoordinates);
            geojson.features[0].geometry.coordinates = geojson.features[0].geometry.coordinates.slice(-5);
            map.getSource(lineAnimationId).setData(geojson);
            if (currentCoordinates[0] !== dst[0] && currentCoordinates[1] !== dst[1]) {
                requestAnimationFrame(animateLine);
            }
            else {
                map.removeLayer(lineAnimationId);
            }
            counter = counter + 1;
        }
    }
})();
