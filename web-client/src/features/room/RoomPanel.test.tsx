import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { roomFixture } from '../../test/fixtures/gmcp';
import { RoomPanel } from './RoomPanel';

describe('RoomPanel', () => {
    it('renders Room.Info and sends the original exit command', () => {
        const onMove = vi.fn();
        render(<RoomPanel room={roomFixture} disabled={false} onMove={onMove} />);
        expect(screen.getByText('扬州客店')).toBeInTheDocument();
        expect(screen.getByText('city')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: '东' }));
        fireEvent.click(screen.getByRole('button', { name: '进入' }));
        expect(onMove).toHaveBeenNthCalledWith(1, 'east');
        expect(onMove).toHaveBeenNthCalledWith(2, 'enter');
    });

    it('disables directions absent from exits', () => {
        render(<RoomPanel room={roomFixture} disabled={false} onMove={() => undefined} />);
        expect(screen.getByRole('button', { name: '南' })).toBeDisabled();
    });
});
