import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { roomFixture, roomMapFixture } from '../../test/fixtures/gmcp';
import { RoomPanel } from './RoomPanel';

describe('RoomPanel', () => {
    it('renders the room and sends only the opaque map exit token', () => {
        const onMove = vi.fn();
        render(<RoomPanel room={roomFixture} roomMap={roomMapFixture} disabled={false} onMove={onMove} />);
        expect(screen.getByText('扬州客店')).toBeInTheDocument();
        expect(screen.getByText('city')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '东' }));
        fireEvent.click(screen.getByRole('button', { name: '进入' }));
        expect(onMove).toHaveBeenNthCalledWith(1, 'x-test-0002');
        expect(onMove).toHaveBeenNthCalledWith(2, 'x-test-0004');
    });

    it('disables directions absent from exits', () => {
        render(<RoomPanel room={roomFixture} roomMap={roomMapFixture} disabled={false} onMove={() => undefined} />);
        expect(screen.getByRole('button', { name: '南' })).toBeDisabled();
        expect(screen.getByRole('button', { name: '上' })).not.toBeDisabled();
    });

    it('allows unresolved and conditional exits to reach the server action', () => {
        const onMove = vi.fn();
        render(<RoomPanel room={roomFixture} roomMap={roomMapFixture} disabled={false} onMove={onMove} />);

        fireEvent.click(screen.getByRole('button', { name: '西' }));
        fireEvent.click(screen.getByRole('button', { name: '上' }));
        expect(onMove).toHaveBeenNthCalledWith(1, 'x-test-0006');
        expect(onMove).toHaveBeenNthCalledWith(2, 'x-test-0003');
    });

    it('does not fall back to Room.Info commands before a map snapshot arrives', () => {
        const onMove = vi.fn();
        render(<RoomPanel room={roomFixture} roomMap={null} disabled={false} onMove={onMove} />);
        expect(screen.getByText('等待服务器返回真实地图出口')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '东' })).not.toBeInTheDocument();
        expect(onMove).not.toHaveBeenCalled();
    });
});
