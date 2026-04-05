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
          className={`w-full rounded-lg border bg-white/[0.04] px-3 py-2 text-sm text-white transition-colors placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sandra-500 focus:ring-offset-1 focus:ring-offset-[#0d0d0d] disabled:opacity-50 ${
            error ? 'border-red-500/40 focus:ring-red-500' : 'border-white/[0.1]'
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
      </div>
    );
  },
);

Input.displayName = 'Input';
