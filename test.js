const app = require('./index');
const assert = require('assert');
const data = [{
    id: 1,
    name: 'Первый канал',
    icon: '/channel-1.png',
    groups: ['Группа 2', 'Группа 1'],
    program: [{
        startTime: '00:00:00',
        name: 'Ночь на первом',
        endTime: '06:00:00'
    }, {
        startTime: '06:00:00',
        name: 'Утро на первом',
        endTime: '12:00:00'
    }, {
        startTime: '12:00:00',
        name: 'День на первом',
        endTime: '18:00:00'
    }, {
        startTime: '18:00:00',
        name: 'Вечер на первом',
        endTime: '00:00:00'
    }]
}, {
    id: 2,
    name: 'Второй канал',
    icon: '/channel-2.png',
    groups: ['Группа 3', 'Группа 1'],
    program: [{
        startTime: '00:00:00',
        name: 'Ночь на втором',
        endTime: '06:00:00'
    }, {
        startTime: '06:00:00',
        name: 'Утро на втором',
        endTime: '12:00:00'
    }, {
        startTime: '12:00:00',
        name: 'День на втором',
        endTime: '18:00:00'
    }, {
        startTime: '18:00:00',
        name: 'Вечер на втором',
        endTime: '00:00:00'
    }]
}];
const fork = require('child_process').fork;
const fs = require('fs');
const getNetworkInterfaces = require('os').networkInterfaces;
const http = require('http');
const padstart = require('lodash.padstart');
const path = require('path');
const request = require('supertest');

describe('API', function () {
    before(app.start.bind(app, {
        address: null,
        data: data,
        log: false,
        port: 3000
    }));
    after(app.stop);

    describe('data set', function () {
        const data = require('./data');

        it('Для всех телеканалов доступны иконки',
            function () {
                data.forEach(channel => {
                    fs.statSync(path.join(__dirname, channel.icon));
                });
            });

        it('Для всех телеканалов доступна телепрограмма, причем на полные сутки от начала и до конца',
            function () {
                data.forEach(channel => {
                    const first = channel.program[0];
                    const last = channel.program[channel.program.length - 1];

                    assert.notStrictEqual(first, last,
                        'У канала "' + channel.name + '" мало передач в программе');
                    assert.strictEqual(first.startTime, '00:00:00',
                        'У канала "' + channel.name + '" первая передача начинается не в 00:00:00');
                    assert.strictEqual(last.endTime, '00:00:00',
                        'У канала "' + channel.name + '" последняя передача заканчивается не в 00:00:00');

                    channel.program.reduce((prev, next) => {
                        if (prev) {
                            assert.strictEqual(prev.endTime, next.startTime, 'На канале "' + channel.name + '" не ' +
                                'совпадает время начала и окончания у передач ' +
                                '"' + prev.name + '" и "' + next.name + '"');
                        }
                        return prev;
                    }, null);
                });
            });
    });

    describe('CORS', function () {
        it('CORS-запросы разрешены отовсюду',
            function () {
                return request(app.server)
                    .get('/')
                    .expect('Access-Control-Allow-Origin', '*')
                    .expect(404);
            });
    });

    describe('GET /group', function () {
        it('Отдаёт список групп телеканалов, включая группу "Все"',
            function () {
                return request(app.server)
                    .get('/group')
                    .expect(200, [{
                        id: 'Все',
                        name: 'Все'
                    }, {
                        id: 'Группа 1',
                        name: 'Группа 1'
                    }, {
                        id: 'Группа 2',
                        name: 'Группа 2'
                    }, {
                        id: 'Группа 3',
                        name: 'Группа 3'
                    }]);
            });
    });

    describe('GET /group/:id/channel', function () {
        it('Отдаёт список телеканалов для группы',
            function () {
                return request(app.server)
                    .get('/group/' + encodeURIComponent('Группа 2') + '/channel')
                    .expect(200, [{
                        id: 1,
                        name: 'Первый канал',
                        icon: '/channel-1.png',
                        groups: ['Группа 2', 'Группа 1']
                    }]);
            });

        it('Поддерживает группу "Все"',
            function () {
                return request(app.server)
                    .get('/group/' + encodeURIComponent('Все') + '/channel')
                    .expect(200, [{
                        id: 1,
                        name: 'Первый канал',
                        icon: '/channel-1.png',
                        groups: ['Группа 2', 'Группа 1']
                    }, {
                        id: 2,
                        name: 'Второй канал',
                        icon: '/channel-2.png',
                        groups: ['Группа 3', 'Группа 1']
                    }]);
            });

        it('Если указан параметр ?withProgram, то для каждого телеканала будет указана программы телепередач',
            function () {
                return request(app.server)
                    .get('/group/' + encodeURIComponent('Группа 3') + '/channel?withProgram')
                    .expect(200, [{
                        id: 2,
                        name: 'Второй канал',
                        icon: '/channel-2.png',
                        groups: ['Группа 3', 'Группа 1'],
                        program: getPrograms([{
                            startTime: '00:00:00',
                            name: 'Ночь на втором',
                            endTime: '06:00:00'
                        }, {
                            startTime: '06:00:00',
                            name: 'Утро на втором',
                            endTime: '12:00:00'
                        }, {
                            startTime: '12:00:00',
                            name: 'День на втором',
                            endTime: '18:00:00'
                        }, {
                            startTime: '18:00:00',
                            name: 'Вечер на втором',
                            endTime: '00:00:00'
                        }])
                    }]);
            });
    });

    describe('GET /channel/:id/program', function () {
        it('Отдаёт программу телепередач для телеканала',
            function () {
                return request(app.server)
                    .get('/channel/1/program?withProgram')
                    .expect(200, getPrograms([{
                        startTime: '00:00:00',
                        name: 'Ночь на первом',
                        endTime: '06:00:00'
                    }, {
                        startTime: '06:00:00',
                        name: 'Утро на первом',
                        endTime: '12:00:00'
                    }, {
                        startTime: '12:00:00',
                        name: 'День на первом',
                        endTime: '18:00:00'
                    }, {
                        startTime: '18:00:00',
                        name: 'Вечер на первом',
                        endTime: '00:00:00'
                    }]));
            });
    });

    describe('GET /public/:file', function () {
        it('Отдаёт содержимое директории /public',
            function () {
                const dir = path.resolve(__dirname, './public');
                const file = fs.readdirSync(dir).shift();
                const contents = fs.readFileSync(path.resolve(dir, file));

                return request(app.server)
                    .get('/public/' + file)
                    .expect(200, contents);
            });
    });

    function getPrograms(programs) {
        const today = new Date();
        const tomorrow = new Date(today.getTime());

        tomorrow.setDate(tomorrow.getDate() + 1);

        const time = padstart(today.getHours(), 2, '0') + ':' +
            padstart(today.getMinutes(), 2, '0') + ':' +
            padstart(today.getSeconds(), 2, '0');
        const todayDate = padstart(today.getFullYear(), 4, '0') + '-' +
            padstart(today.getMonth() + 1, 2, '0') + '-' +
            padstart(today.getDate(), 2, '0');
        const tomorrowDate = padstart(tomorrow.getFullYear(), 4, '0') + '-' +
            padstart(tomorrow.getMonth() + 1, 2, '0') + '-' +
            padstart(tomorrow.getDate(), 2, '0');

        const currentProgram = programs.find(program => program.startTime <= time && program.endTime > time);
        const nextProgram = programs.indexOf(currentProgram) !== (programs.length - 1)
            ? programs[programs.indexOf(currentProgram) + 1]
            : programs[0];

        const currentProgramStartTime = currentProgram.startTime;

        currentProgram.startTime = getDate(currentProgram.startTime);
        currentProgram.endTime = getDate(currentProgram.endTime);
        nextProgram.startTime = getDate(nextProgram.startTime);
        nextProgram.endTime = getDate(nextProgram.endTime);

        return {
            current: currentProgram,
            next: nextProgram
        };

        function getDate(time) {
            return (new Date(time >= currentProgramStartTime
                ? (todayDate + 'T' + time)
                : (tomorrowDate + 'T' + time))).toISOString();
        }
    }
});

describe('CLI', function () {
    const ifaces = getNetworkInterfaces();
    const ips = Object.keys(ifaces).reduce((ips, ifname) => {
        ifaces[ifname].forEach(iface => {
            if (!iface.internal) {
                ips.push(iface.address);
            }
        });
        return ips;
    }, []);

    it('По умолчанию web-server занимает порт 3000',
        function (done) {
            const greeting = 'listen connections on port 3000\n';
            const test = testServerConnection.bind(null, 'localhost:3000');

            runProcess([], greeting, [test], done);
        });

    it('Можно указать порт с помощью параметра `-p, --port [port]`',
        function (done) {
            const greeting = 'listen connections on port 5000\n';
            const test = testServerConnection.bind(null, 'localhost:5000');

            runProcess(['-p', '5000'], greeting, [test], error => {
                assert.ifError(error);
                runProcess(['--port', '5000'], greeting, [test], done);
            });
        });

    it('По умолчанию web-server занимает порт на всех доступных интерфейсах',
        function (done) {
            const greeting = 'listen connections on port 3000\n';
            const tests = ips.concat(['localhost']).map(ip => {
                return testServerConnection.bind(null, ip + ':' + '3000');
            });

            runProcess([], greeting, tests, done);
        });

    it('Можно указать адрес интерфейса с помощью параметра `-a, --address [ip]`',
        function (done) {
            const ip = ips[ips.length - 1];
            const greeting = 'listen connections on ' + ip + ':3000\n';
            const test = testServerConnection.bind(null, ip + ':3000');

            runProcess(['-a', ip], greeting, [test], error => {
                assert.ifError(error);
                runProcess(['--address', ip], greeting, [test], done);
            });
        });

    it('Приложение понимает сигнал `TERM` как сигнал к завершению работы',
        function (done) {
            const proc = fork('./index.js', {silent: true});

            proc.stdout.once('data', () => {
                proc.kill('SIGTERM');
                proc.once('close', done);
            });
        });

    function runProcess(args, expectedGreating, tests, callback) {
        const proc = fork('./index.js', args, {silent: true});

        proc.stdout.once('data', data => {
            assert.strictEqual(data.toString(), expectedGreating);
            runTest();
        });

        function runTest(error) {
            if (error || tests.length === 0) {
                if (proc.killed) {
                    callback(error);
                } else {
                    proc.kill('SIGKILL');
                    proc.once('close', callback.bind(null, error));
                }
            } else {
                tests.shift().call(null, runTest);
            }
        }
    }

    function testServerConnection(host, callback) {
        const req = http.request('http://' + host + '/', res => {
            res.on('data', () => {});
            res.once('end', callback);
        });

        req.once('error', callback);
        req.end();
    }
});
