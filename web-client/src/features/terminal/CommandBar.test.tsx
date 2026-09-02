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

    it('walks through command history and returns to the draft', () => {
        const onSend = vi.fn();
        render(<CommandBar connected onSend={onSend} serverSensitive={false} />);
        const input = screen.getByLabelText('MUD 命令');

        for (const command of ['look', 'score', 'north']) {
            fireEvent.change(input, { target: { value: command } });
            fireEvent.keyDown(input, { key: 'Enter' });
        }
        fireEvent.change(input, { target: { value: 'examine xxx' } });

        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(input).toHaveValue('north');
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(input).toHaveValue('score');
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(input).toHaveValue('look');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(input).toHaveValue('score');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(input).toHaveValue('north');
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        expect(input).toHaveValue('examine xxx');
    });

    it('does not submit an unfinished IME composition on Enter', () => {
        const onSend = vi.fn();
        render(<CommandBar connected onSend={onSend} serverSensitive={false} />);
        const input = screen.getByLabelText('MUD 命令');

        fireEvent.compositionStart(input);
        fireEvent.change(input, { target: { value: 'nihao' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onSend).not.toHaveBeenCalled();

        fireEvent.compositionEnd(input);
        fireEvent.change(input, { target: { value: '你好' } });
        fireEvent.keyDown(input, { key: 'Enter' });
        expect(onSend).toHaveBeenCalledWith('你好');
    });

    it('keeps sensitive commands out of history, including adjacent repeats', () => {
        const onSend = vi.fn();
        render(<CommandBar connected onSend={onSend} serverSensitive={false} />);
        const input = screen.getByLabelText('MUD 命令');
        const toggle = screen.getByRole('button', { name: '隐藏输入' });
        fireEvent.click(toggle);
        const passwordInput = screen.getByLabelText('密码或敏感输入');
        fireEvent.change(passwordInput, { target: { value: 'secret123' } });
        fireEvent.keyDown(passwordInput, { key: 'Enter' });

        fireEvent.click(screen.getByRole('button', { name: '已隐藏' }));
        expect(input).toHaveValue('');
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(input).toHaveValue('');

        for (const command of ['look', 'look']) {
            fireEvent.change(input, { target: { value: command } });
            fireEvent.keyDown(input, { key: 'Enter' });
        }
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(input).toHaveValue('look');
        fireEvent.keyDown(input, { key: 'ArrowUp' });
        expect(input).toHaveValue('look');
    });

    it('clears a normal draft when manual privacy mode is enabled', () => {
        const onSend = vi.fn();
        render(<CommandBar connected onSend={onSend} serverSensitive={false} />);
        const input = screen.getByLabelText('MUD 命令');
        fireEvent.change(input, { target: { value: 'password-like draft' } });
        fireEvent.click(screen.getByRole('button', { name: '隐藏输入' }));

        expect(screen.getByLabelText('密码或敏感输入')).toHaveValue('');
    });

    it('supports a parent-owned draft while the command bar is remounted', () => {
        const onSend = vi.fn();
        const onValueChange = vi.fn();
        const { rerender } = render(<CommandBar connected onSend={onSend} onValueChange={onValueChange} serverSensitive={false} value="examine" />);
        const input = screen.getByLabelText('MUD 命令');
        fireEvent.change(input, { target: { value: 'examine xxx' } });
        expect(onValueChange).toHaveBeenCalledWith('examine xxx');
        rerender(<CommandBar connected onSend={onSend} onValueChange={onValueChange} serverSensitive={false} value="examine xxx" />);
        expect(screen.getByLabelText('MUD 命令')).toHaveValue('examine xxx');
    });
});
