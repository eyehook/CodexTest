export const DEFAULT_THEME = Object.freeze({
  background: '#24282c', row: '#292e33', alternateRow: '#30353b', text: '#ffffff',
  muted: '#b9c1c8', subtitle: '#c6ccd2', accent: '#ffb56a', button: '#49515a', hover: '#bc7139',
  sliderTrack: '#435568', selection: '#31566a', selectionButton: '#243342',
  titleFont: 'bold 44px system-ui', subtitleFont: '25px system-ui', labelFont: '29px system-ui',
  buttonFont: '36px system-ui', footerFont: '23px system-ui', rowTop: 150, rowHeight: 70,
});
export function createTheme(overrides = {}) {
  const theme = {...DEFAULT_THEME, ...overrides};
  if (!Number.isFinite(theme.rowTop) || theme.rowTop < 120 || !Number.isFinite(theme.rowHeight) || theme.rowHeight < 56) throw new RangeError('Invalid panel row spacing');
  return theme;
}
