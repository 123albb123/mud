import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Terminal } from './Terminal';

describe('Terminal', () => {
    it('renders untrusted server HTML as text instead of DOM', () => {
        const injection = '<script>window.pwned=true</script><b>not bold</b>';
        const { container } = render(<Terminal segments={[{ text: injection, bold: false }]} />);
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('b')).toBeNull();
        expect(container).toHaveTextContent(injection);
    });
});
