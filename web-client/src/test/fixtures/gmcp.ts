import type { CharacterVitals, RoomInfo, RoomMapSnapshot } from '../../protocol/gmcp/gmcp';

export const vitalsFixture: CharacterVitals = {
    hp: 856,
    max_hp: 1000,
    jing: 420,
    max_jing: 500,
    jingli: 300,
    max_jingli: 400,
    neili: 680,
    max_neili: 800,
};

export const roomFixture: RoomInfo = {
    name: '扬州客店',
    area: 'city',
    room_id: 'r-test-0001',
    hash: 'r-test-0001',
    exits: ['north', 'east', 'up', 'enter', '桃花渡'],
};

export const roomMapFixture: RoomMapSnapshot = {
    version: 1,
    snapshot: true,
    revision: 3,
    sequence: 3,
    current_room_id: 'r-test-0001',
    room: {
        room_id: 'r-test-0001',
        name: '扬州客店',
        area: 'city',
    },
    exits: [
        {
            exit_id: 'x-test-0001',
            command: 'north',
            label: '北',
            kind: 'direction',
            resolved: true,
            dynamic: false,
            destination_room_id: 'r-test-0002',
            destination_name: '北面街道',
        },
        {
            exit_id: 'x-test-0002',
            command: 'east',
            label: '东',
            kind: 'direction',
            resolved: true,
            dynamic: false,
            destination_room_id: 'r-test-0003',
            destination_name: '东面渡口',
        },
        {
            exit_id: 'x-test-0003',
            command: 'up',
            label: '上',
            kind: 'vertical',
            resolved: true,
            dynamic: false,
            conditional: true,
            destination_room_id: 'r-test-0004',
            destination_name: '客店二楼',
        },
        {
            exit_id: 'x-test-0006',
            command: 'west',
            label: '西',
            kind: 'direction',
            resolved: false,
            dynamic: false,
        },
        {
            exit_id: 'x-test-0004',
            command: 'enter',
            label: '进入',
            kind: 'portal',
            resolved: true,
            dynamic: false,
            destination_room_id: 'r-test-0005',
            destination_name: '内堂',
        },
        {
            exit_id: 'x-test-0005',
            command: '桃花渡',
            label: '桃花渡',
            kind: 'special',
            resolved: false,
            dynamic: true,
        },
    ],
};
