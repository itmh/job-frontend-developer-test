describe('API', function () {
    const app = require('./index');
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
    const fs = require('fs');
    const padstart = require('lodash.padstart');
    const path = require('path');
    const request = require('supertest');

    before(app.start.bind(app, {
        address: null,
        data: data,
        log: false,
        port: 3000
    }));
    after(app.stop);

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
        it('Отдаёт список групп телеканалов',
            function () {
                return request(app.server)
                    .get('/group')
                    .expect(200, [{
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
