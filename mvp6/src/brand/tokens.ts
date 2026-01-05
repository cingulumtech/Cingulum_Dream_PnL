export const palette = {
  brand: {
    primary: '#40916A',       // pulled from cingulumhealth.com wordmark
    bright: '#52B788',
    deep: '#1B4332',
    glow: '#C1F8DE',
  },
  neutral: {
    canvas: '#0B141C',
    surface: '#111F2A',
    raised: '#172C3A',
    border: '#304654',
    borderStrong: '#476273',
    text: '#E8F3F6',
    subtle: '#B6C7D2',
    muted: '#90A7B6',
  },
  signal: {
    positive: '#22C55E',
    caution: '#F59E0B',
    critical: '#F43F5E',
  },
}

export const typography = {
  fontFamily: `'Roboto', 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
  weight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tight: '-0.01em',
    wide: '0.08em',
  },
}

export const radii = {
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '22px',
  pill: '999px',
}

export const shadow = {
  soft: '0 12px 40px rgba(5, 16, 24, 0.35)',
  strong: '0 22px 80px rgba(5, 16, 24, 0.55)',
}

export const blur = {
  soft: '14px',
  strong: '18px',
}

export default {
  palette,
  typography,
  radii,
  shadow,
  blur,
}
