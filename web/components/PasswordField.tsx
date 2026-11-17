'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordCopy {
  show: string;
  hide: string;
  weak: string;
  fair: string;
  good: string;
  strong: string;
}

function score(value: string): number {
  let points = 0;
  if (value.length >= 8) points += 1;
  if (value.length >= 12) points += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points += 1;
  if (/\d/.test(value)) points += 1;
  if (/[^A-Za-z0-9]/.test(value)) points += 1;
  return Math.min(points, 4);
}

/** Password input with a visibility toggle and a live strength meter. */
export function PasswordField({
  name = 'password',
  label,
  placeholder,
  autoComplete = 'new-password',
  minLength = 8,
  required = true,
  copy,
}: {
  name?: string;
  label: string;
  placeholder?: string;
  autoComplete?: string;
  minLength?: number;
  required?: boolean;
  copy: PasswordCopy;
}) {
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState('');
  const strength = score(value);
  const labels = [copy.weak, copy.weak, copy.fair, copy.good, copy.strong];
  const colors = ['#c6363c', '#c6363c', '#9a6200', '#4b9c93', '#16805a'];

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          placeholder={placeholder}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          style={{ paddingInlineEnd: 44 }}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? copy.hide : copy.show}
          style={{
            position: 'absolute',
            insetInlineEnd: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            padding: 4,
            color: 'var(--muted)',
          }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <div className="progress" style={{ flex: 1, height: 8 }}>
            <span style={{ width: `${(strength / 4) * 100}%`, background: colors[strength] }} />
          </div>
          <span className="small muted">{labels[strength]}</span>
        </div>
      ) : null}
    </div>
  );
}
