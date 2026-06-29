import { ReactNode } from 'react';

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  tone?: 'dark' | 'light';
};

export function SectionHeading({ eyebrow, title, description, action, tone = 'dark' }: SectionHeadingProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        {eyebrow ? <p className={`text-sm font-bold uppercase tracking-[0.28em] ${tone === 'light' ? 'text-emerald-200' : 'text-emerald-600'}`}>{eyebrow}</p> : null}
        <h2 className={`mt-2 text-3xl font-black tracking-tight md:text-4xl ${tone === 'light' ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
        {description ? <p className={`mt-3 max-w-3xl text-sm leading-7 md:text-base ${tone === 'light' ? 'text-white/70' : 'text-slate-600'}`}>{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
