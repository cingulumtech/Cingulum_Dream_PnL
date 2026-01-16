export const palette = {
  brand: {
    primary: '#54A885',
    bright: '#74C6A5',
    deep: '#1D3A2C',
    glow: '#CAF8E6',
  },
  neutral: {
    canvas: '#090E14',
    surface: '#101820',
    raised: '#16222D',
    border: '#344A58',
    borderStrong: '#567080',
    text: '#E7EEF2',
    subtle: '#B8C9D2',
    muted: '#8EA2B0',
  },
  signal: {
    positive: '#34B580',
    caution: '#F3C248',
    critical: '#E86060',
  },
}

export const typography = {
  fontFamily: `'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif`,
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
  lift: '0 16px 45px rgba(10, 22, 32, 0.45)',
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
