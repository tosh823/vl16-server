const express = require('express');
const socketIO = require('socket.io');
const Hashids = require('hashids');

// Variables
const PORT = process.env.PORT || 3000;
var hashids = new Hashids();
var session = {
    users: {},
    admins: {},
    rooms: {}
};

// Routing
const app = express();
app.get('/', function (req, res) {
    res.send('VL server is running.');
});

const server = app.listen(PORT, function () {
    console.log('VL server is listening on port ' + PORT + '!');
});

// Socket.IO
const io = socketIO(server);
io.on('connection', function (socket) {
    console.log((new Date().toLocaleString()) + ': Socket [' + socket.id + '] connected.');

    socket.on('newUser', function (payload, callback) {
        var time = new Date().toLocaleString();
        session.users[socket.id] = {
            joinTime: time,
            lastUpdated: time,
            location: 'Pääkirjasto'
        };
        Object.keys(session.admins).map(function (adminID) {
            var socketID = socket.id;
            io.to(adminID).emit('userJoined', {
                socketID: socket.id,
                userData: session.users[socket.id]
            });
        });
        callback();
    });

    socket.on('newAdmin', function (payload, callback) {
        var time = new Date().toLocaleString();
        session.admins[socket.id] = {
            joinTime: time
        };
        // Notify other admins about new adming client
        Object.keys(session.admins).map(function (adminID) {
            var socketID = socket.id;
            io.to(adminID).emit('adminJoined', {
                socketID: socket.id,
                adminData: session.admins[socket.id]
            });
        });
        callback();
    });

    socket.on('updateUser', function (payload, callback) {
        var updateTime = new Date().toLocaleString();
        sessions.users[socket.id].lastUpdated = updateTime;
        sessions.users[socket.id].location = payload.location;
        Object.keys(session.admins).map(function (adminID) {
            var socketID = socket.id;
            io.to(adminID).emit('userUpdated', {
                socketID: socket.id,
                userData: session.users[socket.id]
            });
        });
        callback();
    });

    socket.on('requestUsers', function (payload) {
        io.to(socket.id).emit('users', session.users);
    });

    socket.on('requestAdmins', function (payload) {
        io.to(socket.id).emit('admins', session.admins);
    });

    socket.on('requestRooms', function (payload) {
        io.to(socket.id).emit('rooms', session.rooms);
    });

    socket.on('sdp', function (data) {
        socket.broadcast.to(data.room).emit('sdpReceived', data.sdp);
    });

    socket.on('iceCandidate', function (data) {
        socket.broadcast.to(data.room).emit('iceCandidateReceived', data.candidate);
    });

    socket.on('createOrJoinRoom', function (room) {
        // join room
        console.log(new Date().toLocaleString() + ': Received request from socket [' + socket.id + '] to join room [' + room + ']');
        var existingRoom = io.sockets.adapter.rooms[room];
        var clients = 0;
        var roomID;

        if (existingRoom) {
            // Fetch data about a room
            clients = existingRoom.length;
            roomID = room;
        }
        else {
            // Create a new room
            roomID = hashids.encode(new Date().getTime());
        }

        var time = new Date().toLocaleString();
        if (clients == 0) {
            socket.join(roomID);
            io.to(roomID).emit('emptyRoom', roomID);
            session.rooms[roomID] = {
                creator: socket.id,
                createdTime: time
            };
            console.log(time + ': Socket [' + socket.id + '] joined empty room [' + roomID + '].');
            Object.keys(session.admins).map(function (adminID) {
                var socketID = socket.id;
                io.to(adminID).emit('roomCreated', {
                    roomID: roomID,
                    creator: socket.id,
                    createdTime: time
                });
            });
        }
        else if (clients == 1) {
            socket.join(roomID);
            io.to(roomID).emit('joinRoom', roomID);
            console.log(time + ': Socket [' + socket.id + '] joined room [' + roomID + '].');
        }
        // only allow 2 users max per room
        else {
            console.log(time + ': Room [' + roomID + '] is full.');
            io.emit('fullRoom', roomID);
        }
    });

    socket.on('leaveRoom', function (room) {
        var time = new Date().toLocaleString();
        socket.leave(room);
        socket.broadcast.to(room).emit('leftRoom');

        delete session.rooms[room];
        Object.keys(session.admins).map(function (adminID) {
            io.to(adminID).emit('roomDestroyed', {
                roomID: room,
                destroyedTime: time
            });
        });
        console.log(time + ': Socket [' + socket.id + '] left room [' + room + ']');
    });

    socket.on('destroyRoom', function (room) {
        var time = new Date().toLocaleString();
        var existingRoom = io.sockets.adapter.rooms[room];
        if (existingRoom) {
            var copy = existingRoom.sockets;
            for (var socketID in copy) {
                io.of('/').connected[socketID].leave(room);
                io.to(socketID).emit('leftRoom');
            }
            delete session.rooms[room];
            Object.keys(session.admins).map(function (adminID) {
                io.to(adminID).emit('roomDestroyed', {
                    roomID: room,
                    destroyedTime: time
                });
            });
            console.log(time + ': Room [' + room + '] has been destroyed.');
        }
        else {
            console.log(time + ': Room [' + room + '] does not exist.');
        }
    });

    socket.on('disconnecting', function () {
        for (var roomID in socket.rooms) {
            if (session.rooms[roomID] != null) {
                // Not default own room of socket
                var time = new Date().toLocaleString();
                socket.leave(roomID);
                socket.broadcast.to(roomID).emit('leftRoom');

                delete session.rooms[roomID];
                Object.keys(session.admins).map(function (adminID) {
                    io.to(adminID).emit('roomDestroyed', {
                        roomID: roomID,
                        destroyedTime: time
                    });
                });
                console.log(time + ': Socket [' + socket.id + '] left room [' + roomID + ']');
            }
        }
    });

    socket.on('disconnect', function () {
        if (session.users[socket.id] != null) {
            delete session.users[socket.id];
            Object.keys(session.admins).map(function (adminID) {
                var socketID = socket.id;
                io.to(adminID).emit('userLeft', {
                    socketID: socket.id
                });
            });
        }
        else if (session.admins[socket.id] != null) {
            delete session.admins[socket.id];
            Object.keys(session.admins).map(function (adminID) {
                var socketID = socket.id;
                io.to(adminID).emit('adminLeft', {
                    socketID: socket.id
                });
            });
        }
        console.log((new Date().toLocaleString()) + ': Socket [' + socket.id + '] disconnected.');
    });
});