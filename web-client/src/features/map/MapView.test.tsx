import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { roomMapFixture } from '../../test/fixtures/gmcp';
import { MapView } from './MapView';

describe('MapView', () => {
    it('renders real current and adjacent rooms and sends an opaque exit id', () => {
        const onMove = vi.fn();
        render(<MapView connected snapshot={roomMapFixture} onMove={onMove} />);

        expect(screen.getByRole('heading', { name: '地图' })).toBeInTheDocument();
        expect(screen.getByText('扬州客店')).toBeInTheDocument();
        expect(screen.getByText('北面街道')).toBeInTheDocument();
        expect(screen.getAllByText('尚未探索').length).toBeGreaterThan(0);

        fireEvent.click(screen.getByRole('button', { name: /东东面渡口/ }));
        expect(onMove).toHaveBeenCalledWith('x-test-0002');
        expect(onMove).not.toHaveBeenCalledWith('east');
        expect(screen.getByRole('button', { name: /桃花渡/ })).toBeDisabled();
    });

    it('keeps unresolved and conditional exits actionable while disabling dynamic exits', () => {
        const onMove = vi.fn();
        render(<MapView connected snapshot={roomMapFixture} onMove={onMove} />);

        const unresolved = screen.getByRole('button', { name: /^西/ });
        const conditional = screen.getByRole('button', { name: /^上/ });
        expect(unresolved).not.toBeDisabled();
        expect(conditional).not.toBeDisabled();
        expect(screen.getAllByText('尚未探索').length).toBeGreaterThan(0);
        expect(screen.getByText('可能受条件影响')).toBeInTheDocument();

        fireEvent.click(unresolved);
        fireEvent.click(conditional);
        expect(onMove).toHaveBeenNthCalledWith(1, 'x-test-0006');
        expect(onMove).toHaveBeenNthCalledWith(2, 'x-test-0003');
        expect(screen.getByRole('button', { name: /桃花渡/ })).toBeDisabled();
    });

    it('keeps disconnected and empty map states free of movement controls', () => {
        const onMove = vi.fn();
        render(<MapView connected={false} snapshot={null} onMove={onMove} />);

        expect(screen.getByText('尚未连接江湖')).toBeInTheDocument();
        expect(screen.getByText('连接服务器后显示当前房间地图。')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /东/ })).not.toBeInTheDocument();
        expect(onMove).not.toHaveBeenCalled();
    });
});
