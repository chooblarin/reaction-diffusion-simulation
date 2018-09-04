import { fromEvent, merge } from 'rxjs';
import { map, mapTo, filter } from 'rxjs/operators';

const sketch = document.querySelector('#sketch');
const radius = 512;
sketch.width = radius;
sketch.height = radius;

const regl = require('regl')(sketch);

const createFramebuffer = () => {

  const data = Array(radius * radius * 4).fill(0.0);

  const color = regl.texture({
    data,
    radius,
    wrap: 'repeat',
    mag: 'linear',
    min: 'linear'
  });

  return regl.framebuffer({
    color,
    width: radius,
    height: radius,
    depthStencil: false
  });
};

const state = Array(2).fill().map(() => createFramebuffer());

const update = regl({
  frag: `
    precision mediump float;
    uniform float sketchWidth;
    uniform float sketchHeight;
    uniform float diffU;
    uniform float diffV;
    uniform float feed;
    uniform float kill;
    uniform float deltaT;
    uniform float deltaX;
    uniform sampler2D prevState;
    uniform bool mousePressed;
    uniform vec2 mousePosition;
    varying vec2 texCoord;

    void main() {
      float stepX = 1.0 / sketchWidth;
      float stepY = 1.0 / sketchHeight;

      vec2 p = texture2D(prevState, texCoord).rg;

      vec2 lapl = vec2(0.0);

      for (int i = -1; i <= 1; i++) {
        for (int j = -1; j <= 1; j++) {
          vec2 delta = vec2(float(i) * stepX, float(j) * stepY);
          vec2 adj = texture2D(prevState, texCoord + delta).rg;
          if (i == 0 && j == 0) {
            lapl += -1.0 * adj;
          } else if (i * j == 0) {
            lapl += 0.2 * adj;
          } else {
            lapl += 0.05 * adj;
          }
        }
      }

      float u = p.r;
      float v = p.g;
      float du = diffU * lapl.r - u * v * v + feed * (1.0 - u);
      float dv = diffV * lapl.g + u * v * v - (feed + kill) * v;

      u += deltaT * du;
      v += deltaT * dv;

      if (mousePressed) {
        vec2 l = mousePosition - texCoord;
        float dist = dot(l, l);
        if (dist < 0.0001) {
          u = 0.2;
          v = 0.4;
        }
      }

      gl_FragColor = vec4(u, v, 0.0, 1.0);
    }
  `,
  framebuffer: ({ tick }) => state[(tick + 1) % 2]
});

const setup = regl({
  frag: `
    precision mediump float;
    uniform sampler2D prevState;
    varying vec2 texCoord;
    void main() {
      vec4 s = texture2D(prevState, texCoord);
      float u = s.r;
      gl_FragColor = vec4(vec3(u), 1.0);
    }
  `,

  vert: `
    precision mediump float;
    attribute vec2 position;
    varying vec2 texCoord;
    void main() {
      texCoord = 0.5 * (position + 1.0);
      gl_Position = vec4(position, 0.0, 1.0);
    }
  `,

  attributes: {
    position: regl.buffer([
      [-1, -1], [1, -1], [1, 1],
      [1, 1], [-1, -1], [-1, 1]
    ])
  },

  uniforms: {
    sketchWidth: radius,
    sketchHeight: radius,
    diffU: 0.5697,
    diffV: 0.265,
    feed: 0.04,
    kill: 0.06,
    deltaT: 2.0,
    deltaX: 1.0,
    prevState: ({ tick }) => state[tick % 2],
    mousePressed: regl.prop('mousePressed'),
    mousePosition: regl.prop('mousePosition')
  },

  depth: {
    enable: false
  },

  count: 6
});

const mouseup$ = fromEvent(window, 'mouseup');
const mousedown$ = fromEvent(sketch, 'mousedown');
const mousemove$ = fromEvent(sketch, 'mousemove');

const isPressed$ = merge(
  mouseup$.pipe(mapTo(false)),
  mousedown$.pipe(
    filter(ev => ev.button === 0),
    mapTo(true)
  )
);

const mousePosition$ = mousemove$
  .pipe(map(positionFromMouseEvent));

let mousePressed = false;
let mousePosition = [0.0, 0.0];

isPressed$.subscribe(v => mousePressed = v);

mousePosition$.pipe(
  map(p => [p.x / radius, 1.0 - (p.y / radius)]),
).subscribe(uv => {
  mousePosition = uv;
});

regl.frame(() => {
  const props = {
    mousePressed,
    mousePosition
  };

  setup(props, () => {
    regl.draw();
    update();
  });
});

function positionFromMouseEvent(ev) {
  const x = ev.pageX - ev.target.offsetLeft;
  const y = ev.pageY - ev.target.offsetTop;
  return { x, y };
}
