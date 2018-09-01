const sketch = document.querySelector('#sketch');
const radius = 512;
sketch.width = radius;
sketch.height = radius;

const regl = require('regl')(sketch);

const drawTriangle = regl({
  frag: `
    precision mediump float;
    uniform vec4 color;
    void main() {
      gl_FragColor = color;
    }`,

  vert: `
    precision mediump float;
    attribute vec2 position;
    void main() {
      gl_Position = vec4(position, 0, 1);
    }`,

  attributes: {
    position: regl.buffer([
      [-1, -1], [1, -1], [1, 1],
      [1, 1], [-1, -1], [-1, 1]
    ])
  },

  uniforms: {
    color: regl.prop('color')
  },

  count: 6
})

regl.frame(({ time }) => {
  regl.clear({
    color: [0, 0, 0, 1],
    depth: 1
  })

  const r = (Math.cos(time) + 1.0) / 2.0;
  const g = (Math.sin(time) + 1.0) / 2.0;
  const b = (Math.cos(time) + 1.0) / 2.0;

  drawTriangle({
    color: [r, g, b, 1]
  });
});
