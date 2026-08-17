import { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  theme?: 'dark' | 'light';
};

export function Button({ children, className = '', variant = 'primary', theme = 'dark', ...props }: ButtonProps) {
  const styles = {
    dark: {
      primary: 'border border-white/15 bg-white/15 text-white backdrop-blur-xl hover:border-white/25 hover:bg-white/22 shadow-[0_10px_30px_rgba(2,6,23,0.25)]',
      secondary: 'border border-white/15 bg-emerald-400/12 text-white backdrop-blur-xl hover:bg-emerald-400/18',
      ghost: 'border border-transparent bg-white/6 text-white/80 backdrop-blur-xl hover:border-white/10 hover:bg-white/10',
      outline: ''
    },
    light: {
      primary: 'border border-emerald-500/20 bg-emerald-600 text-white shadow-[0_12px_30px_rgba(16,185,129,0.22)] hover:bg-emerald-700',
      secondary: 'border border-slate-200 bg-white/80 text-slate-900 backdrop-blur-xl hover:bg-white',
      ghost: 'border border-white/60 bg-white/40 text-slate-700 backdrop-blur-xl hover:bg-white/70',
      outline: ''
    },
  };

  return (
    <button className={`inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold tracking-wide transition duration-300 ${styles[theme][variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
