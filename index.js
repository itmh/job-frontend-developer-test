#!/usr/bin/env node

const express = require('express');
const cmd = require('commander');
const cors = require('cors');
const http = require('http');
const morgan = require('morgan');
const padstart = require('lodash.padstart');
const path = require('path');

exports.data = require('./data');

exports.getGroups = function getGroups(req, res) {
    const result = exports.data
        .reduce((groups, channel) => {
            return groups.concat(channel.groups);
        }, [])
        .filter((group, index, array) => {
            return array.indexOf(group) === index;
        })
        .sort((a, b) => {
            return a > b ? 1 : -1;
        })
        .map(group => {
            return {id: group, name: group};
        });

    result.unshift({id: 'Все', name: 'Все'});
    res.status(200).json(result);
};

exports.getGroupChannels = function getGroupChannels(req, res) {
    const result = exports.data
        .filter(channel => {
            return req.params.id === 'Все' || channel.groups.indexOf(req.params.id) > -1;
        })
        .map(channel => {
            const newChannel = {...channel};

            if ('withProgram' in req.query) {
                newChannel.program = getCurrentAndNextProgram(newChannel.program);
            } else {
                delete newChannel.program;
            }
            return newChannel;
        }, []);

    if (result.length === 0) {
        res.sendStatus(404);
    } else {
        res.status(200).json(result);
    }
};

exports.getChannelPrograms = function getChannelPrograms(req, res) {
    const channel = exports.data.find(channel => channel.id.toString() === req.params.id);

    if (!channel) {
        res.sendStatus(404);
    } else {
        res.status(200).json(getCurrentAndNextProgram(channel.program));
    }
};

exports.start = function start(options, callback) {
    const app = express();
    const server = http.createServer(app);

    if (typeof options === 'function') {
        callback = options;
        options = {};
    }
    if (options.data) {
        exports.data = options.data;
    }
    if (options.log) {
        app.use(morgan('tiny'));
    }
    app.use(cors());
    app.get('/channel/:id/program', exports.getChannelPrograms);
    app.get('/group', exports.getGroups);
    app.get('/group/:id/channel', exports.getGroupChannels);
    app.use('/public', express.static(path.resolve(__dirname, './public')));
    if (options.address) {
        server.listen(cmd.port, cmd.address, done);
    } else if (options.port) {
        server.listen(cmd.port, done);
    } else {
        process.nextTick(done);
    }

    function done(error) {
        if (error) {
            callback(error);
        } else {
            exports.server = server;
            callback();
        }
    }
};

exports.server = null;

exports.stop = function stop(callback) {
    if (exports.server) {
        exports.server.close();
        exports.server.once('close', () => {
            exports.server = null;
            callback();
        });
    } else {
        process.nextTick(callback);
    }
};

if (require.main === module) {
    cmd
        .version(require('./package').version, '-v, --version')
        .option('-a, --address [ip]', 'listen connections on address, ' +
            'by default listen all available addresses')
        .option('-p, --port [port]', 'listen connections on port, ' +
            'by default listen on port 3000', '3000', parseInt)
        .parse(process.argv);

    exports.start({
        address: cmd.address,
        port: cmd.port,
        log: true
    }, error => {
        if (error) {
            console.error(error);
            process.exit(1);
        } else {
            console.log('listen connections on ' + (cmd.address ? (cmd.address + ':' + cmd.port) : 'port ' + cmd.port));
            process.on('uncaughtException', onError);
            process.on('unhandledRejection', onError);
            process.on('SIGINT', stop);
            process.on('SIGTERM', stop);
        }

        function onError(error) {
            console.error(error);
            stop();
        }

        function stop() {
            exports.stop(() => {
                console.log('bye!');
                process.exit(0);
            });
        }
    });
}

function getCurrentAndNextProgram(programs) {
    const now = new Date();
    const time = zeroPad(2, now.getHours()) + ':' + zeroPad(2, now.getMinutes()) + ':' + zeroPad(2, now.getSeconds());
    const currentProgram = programs.find(program => program.startTime <= time && program.endTime > time);
    const currentProgramIndex = programs.indexOf(currentProgram);
    const currentProgramStartTime = currentProgram.startTime;
    const nextProgram = (programs.length - currentProgramIndex) > 1
        ? programs[currentProgramIndex + 1]
        : programs[0];

    return {
        current: composeProgram(currentProgram),
        next: composeProgram(nextProgram)
    };

    function composeProgram(program) {
        const newProgram = {...program};

        newProgram.startTime = composeDateTime(newProgram.startTime);
        newProgram.endTime = composeDateTime(newProgram.endTime);
        return newProgram;
    }

    function composeDateTime(time) {
        const year = zeroPad(4, now.getFullYear());
        const month = zeroPad(2, now.getMonth() + 1);
        const date = time < currentProgramStartTime
            ? zeroPad(2, now.getDate() + 1)
            : zeroPad(2, now.getDate());

        return (new Date(year + '-' + month + '-' + date + 'T' + time)).toISOString();
    }

    function zeroPad(digits, value) {
        return padstart(value.toString(), digits, '0');
    }
}
