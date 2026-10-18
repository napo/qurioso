import React from 'react';

/**
 * Qurioso Brand Palette:
 * - Petrolio (Deep Teal / Blue-Green): Primary brand foundation
 * - Mandarino (Mandarin Orange): Dynamic accent and signature Q-tail
 */
export const BRAND_COLORS = {
  petrolio: {
    DEFAULT: '#075E63', dark: '#064b4f', darker: '#123c3f', light: '#387e81',
    ultralight: '#f2f8f7', border: '#c8dedb', glow: 'rgba(7, 94, 99, 0.15)',
  },
  mandarino: {
    DEFAULT: '#FF963B', dark: '#8a4300', light: '#ffab62',
    ultralight: '#fff2e6', border: '#FF963B', glow: 'rgba(255, 150, 59, 0.15)',
  },
};

interface QuriosoIconProps {
  size?: number | string;
  className?: string;
  variant?: 'standalone' | 'contained' | 'flat' | 'rounded';
}

/** The original Q extracted from the supplied logo, including its facial details. */
export const QuriosoIcon: React.FC<QuriosoIconProps> = ({
  size = 40,
  className = '',
  variant = 'contained',
}) => (
  <img
    src="./icon.svg"
    width={size}
    height={size}
    alt="Qurioso"
    className={`shrink-0 object-contain ${variant === 'contained' || variant === 'rounded' ? 'rounded-xl bg-white' : ''} ${className}`}
  />
);

interface QuriosoLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
  theme?: 'dark' | 'light';
}

export const QuriosoLogo: React.FC<QuriosoLogoProps> = ({
  size = 'md',
  showTagline = false,
  className = '',
}) => {
  const widths = { sm: 110, md: 145, lg: 185, xl: 240 };
  return (
    <div className={`inline-flex flex-col justify-center select-none ${className}`}>
      <img
        src="./logo.svg"
        width={widths[size]}
        height={widths[size] * 407 / 1295}
        alt="Qurioso"
        className="rounded-lg bg-white object-contain"
      />
      {showTagline && (
        <span className="text-[11px] font-semibold tracking-wider uppercase text-petrolio mt-1">
          Multiplayer Quiz Studio
        </span>
      )}
    </div>
  );
};
