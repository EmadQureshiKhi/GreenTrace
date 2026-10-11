'use client';

import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface SearchableDropdownProps {
  options: string[];
  /** Display text per option, when it differs from the value. */
  labels?: Record<string, string>;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const SearchableDropdown = ({ options, labels = {}, value, onChange, placeholder = 'Search and select...', className, disabled = false }: SearchableDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const label = (option: string) => labels[option] ?? option;

  const filteredOptions = options.filter((option) => label(option).toLowerCase().includes(searchTerm.toLowerCase()));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={dropdownRef} className={cn('relative w-full', className)}>
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          setIsOpen((open) => !open);
          setSearchTerm('');
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-left text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={cn('truncate', !value && 'text-muted-foreground')}>{value ? label(value) : placeholder}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 opacity-50 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1" role="listbox">
            {filteredOptions.length === 0 ? (
              <p className="p-3 text-center text-sm text-muted-foreground">No match for &quot;{searchTerm}&quot;</p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="option"
                  aria-selected={value === option}
                  onClick={() => handleSelect(option)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none',
                    value === option && 'bg-primary/10 text-primary',
                  )}
                >
                  <span className="truncate">{label(option)}</span>
                  {value === option && <Check className="h-4 w-4 shrink-0" />}
                </button>
              ))
            )}
          </div>
          {searchTerm && (
            <div className="border-t bg-muted/50 p-2 text-center text-xs text-muted-foreground">
              {filteredOptions.length} of {options.length} shown
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;
