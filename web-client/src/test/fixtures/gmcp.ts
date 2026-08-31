import type { CharacterVitals, RoomInfo } from '../../protocol/gmcp/gmcp';

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
