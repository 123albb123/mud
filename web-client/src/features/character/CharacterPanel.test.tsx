import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { vitalsFixture } from '../../test/fixtures/gmcp';
import { CharacterPanel } from './CharacterPanel';

describe('CharacterPanel', () => {
    it('renders a real Char.Vitals-shaped fixture', () => {
        render(<CharacterPanel vitals={vitalsFixture} />);
        expect(screen.getByText('856 / 1000')).toBeInTheDocument();
        expect(screen.getByText('420 / 500')).toBeInTheDocument();
        expect(screen.getByText('300 / 400')).toBeInTheDocument();
        expect(screen.getByText('680 / 800')).toBeInTheDocument();
    });

    it('uses placeholders when no GMCP data exists', () => {
        render(<CharacterPanel vitals={null} />);
        expect(screen.getAllByText('--')).toHaveLength(4);
    });
});
