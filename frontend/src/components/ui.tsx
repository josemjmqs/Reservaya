import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function Button({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  return (
    <button
      {...props}
      className={cx(
        'rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50',
        variant === 'primary' && 'bg-indigo-600 text-white hover:bg-indigo-700',
        variant === 'secondary' &&
          'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
        variant === 'danger' &&
          'border border-red-300 bg-white text-red-600 hover:bg-red-50',
        className,
      )}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm',
        'placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100',
        className,
      )}
    />
  );
}

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {  
  return (
    <div
      {...props}
      className={cx('rounded-lg border border-gray-200 bg-white p-4 shadow-sm', className)}
    />
  );
}