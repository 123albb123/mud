import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Terminal } from './Terminal';

const line = (text: string) => ({ text, bold: false });

const setScrollMetrics = (terminal: HTMLElement, scrollHeight: number, clientHeight: number, scrollTop: number) => {
    Object.defineProperty(terminal, 'scrollHeight', { configurable: true, value: scrollHeight });
    Object.defineProperty(terminal, 'clientHeight', { configurable: true, value: clientHeight });
    terminal.scrollTop = scrollTop;
};

describe('Terminal', () => {
    it('renders untrusted server HTML as text instead of DOM', () => {
        const injection = '<script>window.pwned=true</script><img src=x onerror=alert(1)><b>not bold</b>';
        const { container } = render(<Terminal segments={[{ text: injection, bold: false }]} />);
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
        expect(container.querySelector('b')).toBeNull();
        expect(container).toHaveTextContent(injection);
    });

    it('follows new output when the user is at the bottom', () => {
        const { container, rerender } = render(<Terminal segments={[line('第一行\n第二行')]} />);
        const terminal = container.querySelector('.terminal') as HTMLElement;
        setScrollMetrics(terminal, 500, 200, 300);
        fireEvent.scroll(terminal);

        rerender(<Terminal segments={[line('第一行\n第二行\n第三行')]} />);
        expect(terminal.scrollTop).toBe(500);
        expect(screen.queryByRole('button', { name: '回到底部' })).toBeNull();
    });

    it('does not steal the scroll position while viewing history and offers new output', () => {
        const { container, rerender } = render(<Terminal segments={[line('第一行\n第二行\n第三行')]} />);
        const terminal = container.querySelector('.terminal') as HTMLElement;
        setScrollMetrics(terminal, 800, 200, 80);
        fireEvent.scroll(terminal);

        rerender(<Terminal segments={[line('第一行\n第二行\n第三行\n第四行')]} />);
        expect(terminal.scrollTop).toBe(80);
        expect(screen.getByRole('button', { name: '回到底部' })).toHaveTextContent('1 条新内容');

        fireEvent.click(screen.getByRole('button', { name: '回到底部' }));
        expect(terminal.scrollTop).toBe(800);
        expect(screen.queryByRole('button', { name: '回到底部' })).toBeNull();
    });

    it('does not move a selected terminal while output arrives', () => {
        const { container, rerender } = render(<Terminal segments={[line('可选择文字')]} />);
        const terminal = container.querySelector('.terminal') as HTMLElement;
        const span = terminal.querySelector('span');
        expect(span).not.toBeNull();
        setScrollMetrics(terminal, 500, 200, 300);
        fireEvent.scroll(terminal);

        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(span as Node);
        selection?.removeAllRanges();
        selection?.addRange(range);

        rerender(<Terminal segments={[line('可选择文字\n新输出')]} />);
        expect(terminal.scrollTop).toBe(300);
        expect(screen.getByRole('button', { name: '回到底部' })).toBeInTheDocument();
        selection?.removeAllRanges();
    });
});
