import { type InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={`w-full rounded-lg border-none bg-surface-container-lowest px-4 py-3 text-on-surface transition-all placeholder:text-on-surface-variant/30 focus:shadow-[0_0_10px_rgba(174,198,255,0.15)] focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50 ${
            error ? 'ring-1 ring-error/40' : ''
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
