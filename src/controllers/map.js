const express = require('express');
var cors = require('cors');
var navigation = require('../data/MainLibraryNavigation.json');
var router = express.Router();

var map = {};
navigation['wayPoints'].map(function (value, index) {
    map[value.name] = value;
});

router.get('/', cors(), function (req, res) {
    console.log('Received request: ' + req.url);
});

function findPath(start, destination) {
    // Preparation
    var nodes = {};
    var visitedNodesCount = 0;
    for (var node in map) {
        nodes[node] = {};
        nodes[node].links = map[node].links;
        nodes[node].distance = Number.MAX_SAFE_INTEGER;
        nodes[node].closestNode = start;
        nodes[node].visited = false;
    }
    nodes[start].distance = 0;

    // Dijkstra’s algorithm
    var checkNode = function (node) {
        for (var child in nodes[node].links) {
            if (nodes[child].visited == true) continue;
            var distance = nodes[node].links[child] + nodes[node].distance;
            if (distance < nodes[child].distance) {
                nodes[child].distance = distance;
                nodes[child].closestNode = node;
            }
        }
    };

    while (visitedNodesCount < Object.keys(nodes).length) {
        // Searching for closest non-visited node
        var minValue = Number.MAX_SAFE_INTEGER;
        var closestNode = null;
        for (var node in nodes) {
            if (nodes[node].visited == true) continue;
            if (nodes[node].distance < minValue) {
                closestNode = node;
                minValue = nodes[node].distance;
            }
        }
        if (closestNode != null) {
            nodes[closestNode].visited = true;
            visitedNodesCount++;
            checkNode(closestNode);
        }
    }

    var route = [];
    var step = destination;
    route.push(step);
    while (step != start) {
        step = nodes[step].closestNode;
        route.push(step);
    }
    route.reverse();

    return route;
}

function findShelf(location) {
    var code = location.callNumber;
    var splitted = code.split(' ');
    if (splitted[0] != 'AIK') {
        console.log('The book is not in adult department');
        return null;
    }
    var number = splitted[1];
    var symbol = splitted[2];
    var collection = location.collection;
    var hits = [];
    for (var node in map) {
        var wayPoint = map[node];
        if (wayPoint.shelfFrom != null && wayPoint.shelfFrom != '') {
            // Here we go, the shelf containing info
            var shelfFromSplitted = wayPoint.shelfFrom.split('|');
            var shelfToSplitted = wayPoint.shelfTo.split('|');
            // Assuming the from and to are equal lengths
            for (var index = 0; index < shelfFromSplitted.length; index++) {
                var codeFrom = shelfFromSplitted[index].split(' ');
                var codeTo = shelfToSplitted[index].split(' ');
                if (number >= codeFrom[0] && number <= codeTo[0]) {
                    // We have number hit, moving on
                    if (codeFrom[1] != null) {
                        // Compare symbolic part
                        var startCondition = ((codeFrom[1] == '>') ? true : (symbol >= codeFrom[1]));
                        var endCondition = ((codeTo[1] == '<') ? true : (symbol <= codeTo[1]));
                        if (startCondition && endCondition) {
                            // We have symbolic hit, moving on
                            if (codeFrom[2] == null && collection == null) {
                                // No collection, direct hit!
                                hits.push(node);
                            }
                            else {
                                // Compare collection part
                                if (collection == codeFrom[2]) hits.push(node);
                            }
                        }
                    }
                    else {
                        hits.push(node);
                    }
                }
            }
        }
    }
    console.log('Found ' + JSON.stringify(hits));
    return hits;
}

module.exports = router;