// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LanguageSelector } from '../language-selector';

describe('LanguageSelector', () => {
  it('renders all three language options', () => {
    render(<LanguageSelector language="en" onChange={vi.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('Français')).toBeInTheDocument();
    expect(screen.getByText('Kreyòl Ayisyen')).toBeInTheDocument();
  });

  it('shows the selected language', () => {
    render(<LanguageSelector language="fr" onChange={vi.fn()} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('fr');
  });

  it('calls onChange when a different language is selected', () => {
    const onChange = vi.fn();
    render(<LanguageSelector language="en" onChange={onChange} />);
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'ht' } });
    expect(onChange).toHaveBeenCalledWith('ht');
  });
});
