// Colours for the canvas games. CSS variables can't be used inside a canvas,
// so the games ask for the current set here.
const light = {
  paper: '#ffffff', grid: '#e3ebf5', ink: '#22304a',
  blue: '#2349c9', red: '#d8504e', green: '#3fa66a', greenDark: '#2c8a55', yellow: '#f2b705', orange: '#e8893c',
  pipe: '#cfdcf0', pipeLip: '#b0c4e4', text: '#16233b', dim: '#5f6f8c', soft: '#eaf0f8'
};

const dark = {
  paper: '#171e29', grid: '#222c3b', ink: '#0a0d12',
  blue: '#8ba8ff', red: '#ff7a7a', green: '#5ccf8c', greenDark: '#3fa66a', yellow: '#f2c94c', orange: '#f0a050',
  pipe: '#2a3a55', pipeLip: '#3a4e70', text: '#e8edf5', dim: '#8493ab', soft: '#202a38'
};

export const Pen = {
  get() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? dark : light;
  }
};
