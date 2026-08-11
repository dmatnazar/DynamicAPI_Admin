import type { ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  secondary: 'bg-surface-card hover:bg-surface-border text-neutral-100 border border-surface-border',
  danger: 'bg-red-600/90 hover:bg-red-500 text-white',
  ghost: 'bg-transparent hover:bg-surface-card text-neutral-300',
};

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-3.5 py-2 text-sm',
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`${SIZES[size]} rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
