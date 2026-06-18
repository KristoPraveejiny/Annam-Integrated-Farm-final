import { ReactNode } from 'react';

type CardProps = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  variant?: 'dark' | 'light';
};

export function Card({ title, subtitle, action, children, className = '', variant = 'dark' }: CardProps) {
  const toneClasses =
    variant === 'light'
      ? 'border-white/35 bg-white/20 text-white shadow-[0_18px_55px_rgba(2,6,23,0.18)]'
      : 'border-white/15 bg-white/12 text-white/90 shadow-[0_18px_55px_rgba(2,6,23,0.25)]';

  return (
    <div className={`farm-card p-5 sm:p-6 border border-solid rounded-2xl ${toneClasses} ${className} aspect-square`}>
      {(title || subtitle || action) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            {title ? <h3 className={`text-lg font-semibold tracking-tight ${variant === 'light' ? 'text-slate-900' : 'text-white/95'}`}>{title}</h3> : null}
            {subtitle ? <p className={`mt-1 text-sm ${variant === 'light' ? 'text-slate-600' : 'text-white/62'}`}>{subtitle}</p> : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}