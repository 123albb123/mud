import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommandBar } from './CommandBar';

describe('CommandBar', () => {
    it('uses a password input during server ECHO negotiation', () => {
        const onSend = vi.fn();
        const { rerender } = render(<CommandBar connected serverSensitive onSend={onSend} />);
        const input = screen.getByLabelText('密码或敏感输入');
        expect(input).toHaveAttribute('type', 'password');
        fireEvent.change(input, { target: { value: 'secret' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('secret');
        expect(input).toHaveValue('');

        rerender(<CommandBar connected serverSensitive={false} onSend={onSend} />);
        const commandInput = screen.getByLabelText('MUD 命令');
        fireEvent.keyDown(commandInput, { key: 'ArrowUp' });
        expect(commandInput).toHaveValue('');
    });
});
