// --- State ---
let stillTime = 0;
let lastMoveTime = 0;
let prevMouseX = 0;
let prevMouseY = 0;
let isMoving = false;
let moveDecayTimer = 0;

let fearParticles = [];
let introWordPool = [];

let presenceX = 0;
let presenceY = 0;
let presenceEdgeX = 0;
let presenceEdgeY = 0;
let presenceBlobOffset = 0;
let presenceAlpha = 0;
let presenceTransformT = 0;

let currentLineIdx = -1;
let lastCompletedLineIdx = -1;
let currentLineAlpha = 0;
let currentLineStartTime = 0;

let vignetteBuffer;
let rockBuffer;

// --- Constants ---
const INTRO_THRESHOLD    = 20000;
const TOTAL_JOURNEY      = 130000;
const EMBRACE_START      = 90000;
const MOVEMENT_THRESHOLD = 2;

const INTRO_WORD_LIST = [
  "still", "breathe", "here", "quiet", "deep", "dark", "wait",
  "listen", "alone", "fall", "rise", "soft", "rest", "hold",
  "slow", "cave", "breath", "dark", "still", "deep", "here", "quiet"
];

const FEAR_WORDS = [
  'run', 'flee', 'hide', 'escape', 'danger',
  'away', 'back', 'not yet', 'wait', 'no'
];

const POEM_LINES = [
  { text: "you are not alone",                                   time: 5000,   type: "intro"      },
  { text: "something is here with you",                          time: 9000,   type: "intro"      },
  { text: "hold still",                                          time: 13000,  type: "intro"      },
  { text: "And now I am a diver",                                time: 18000,  type: "poem"       },
  { text: "a hero on a search and rescue mission",               time: 23000,  type: "poem"       },
  { text: "for the things that lurk in the deep dark places",    time: 28000,  type: "poem"       },
  { text: "the monsters we have been told to fear",              time: 34000,  type: "poem"       },
  { text: "I am not afraid",                                     time: 40000,  type: "poem"       },
  { text: "they hide because they are hurt and full of shame",   time: 46000,  type: "poem"       },
  { text: "they attack because they are scared and starving",    time: 53000,  type: "poem"       },
  { text: "I sit at the bottom of the cave",                     time: 60000,  type: "poem"       },
  { text: "and do not hide, but shine my light",                 time: 65000,  type: "poem"       },
  { text: "I can sense them coming",                             time: 71000,  type: "poem"       },
  { text: "I can see the meaning",                               time: 76000,  type: "poem"       },
  { text: "I subdue and embrace",                                time: 82000,  type: "poem"       },
  { text: "Embrace",                                             time: 88000,  type: "embrace"    },
  { text: "Embrace",                                             time: 91000,  type: "embrace"    },
  { text: "It's ok",                                             time: 94000,  type: "embrace"    },
  { text: "We're ok",                                            time: 97000,  type: "embrace"    },
  { text: "I love you",                                          time: 100000, type: "embrace"    },
  { text: "It's ok",                                             time: 103000, type: "embrace"    },
  { text: "They are cleansed and brought to the surface",        time: 109000, type: "resolution" },
  { text: "to release and be made into something new",           time: 115000, type: "resolution" },
  { text: "or I kill them right there, at the root",             time: 121000, type: "resolution" },
  { text: "and let it be no more",                               time: 126000, type: "resolution" },
  { text: "and never again",                                     time: 130000, type: "resolution" },
];

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont('Georgia');
  noiseSeed(42);
  noiseDetail(4, 0.5);

  presenceEdgeX = windowWidth * 0.82;
  presenceEdgeY = windowHeight * 0.12;
  presenceX = presenceEdgeX;
  presenceY = presenceEdgeY;

  prevMouseX = mouseX;
  prevMouseY = mouseY;
  lastMoveTime = millis();

  for (let i = 0; i < 22; i++) {
    introWordPool.push(new IntroWord());
  }

  buildRockBuffer();
  buildVignetteBuffer();
}

function draw() {
  let now = millis();
  updateInput(now);
  updateStillTime(now);

  let poemTime = max(0, stillTime - INTRO_THRESHOLD);

  image(rockBuffer, 0, 0);
  drawReaderLight(poemTime);

  // Intro words: visible until poem is underway
  let introFade = constrain(map(poemTime, 0, 2500, 1.0, 0.0), 0, 1);
  if (introFade > 0) {
    for (let w of introWordPool) {
      w.update(isMoving);
      w.show(introFade);
    }
  }

  drawPresence(poemTime);
  drawPoem();
  drawFearParticles();
  image(vignetteBuffer, 0, 0);
}

function updateInput(now) {
  let dMouse = dist(mouseX, mouseY, prevMouseX, prevMouseY);
  if (dMouse > MOVEMENT_THRESHOLD) {
    isMoving = true;
    moveDecayTimer = 800;
    let burst = floor(dMouse / 8) + 1;
    for (let i = 0; i < burst; i++) spawnFearParticle();
  } else {
    moveDecayTimer = max(0, moveDecayTimer - deltaTime);
    if (moveDecayTimer <= 0) isMoving = false;
  }
  prevMouseX = mouseX;
  prevMouseY = mouseY;
}

function updateStillTime(now) {
  if (isMoving) {
    stillTime = 0;
    lastMoveTime = now;
    // Full reset so poem starts from the top next time
    lastCompletedLineIdx = -1;
    currentLineIdx = -1;
    currentLineStartTime = 0;
    currentLineAlpha = max(0, currentLineAlpha - deltaTime * 0.4);
    presenceX = lerp(presenceX, presenceEdgeX, 0.04);
    presenceY = lerp(presenceY, presenceEdgeY, 0.04);
    presenceAlpha = lerp(presenceAlpha, 0, 0.1);
    presenceTransformT = lerp(presenceTransformT, 0, 0.04);
    return;
  }

  stillTime = now - lastMoveTime;
  let poemTime = max(0, stillTime - INTRO_THRESHOLD);

  // Presence position and alpha (keyed to poemTime so intro is presence-free)
  if (poemTime > 10000) {
    let frac = constrain(map(poemTime, 10000, EMBRACE_START, 0, 1), 0, 1);
    let eased = frac * frac * (3 - 2 * frac);
    let tx = lerp(presenceEdgeX, width / 2, eased);
    let ty = lerp(presenceEdgeY, height / 2, eased);
    presenceX = lerp(presenceX, tx, 0.025);
    presenceY = lerp(presenceY, ty, 0.025);
    presenceAlpha = map(poemTime, 10000, 16000, 0, 80, true);
  } else {
    presenceAlpha = lerp(presenceAlpha, 0, 0.05);
    presenceX = lerp(presenceX, presenceEdgeX, 0.02);
    presenceY = lerp(presenceY, presenceEdgeY, 0.02);
  }

  if (poemTime > EMBRACE_START) {
    presenceTransformT = constrain(map(poemTime, EMBRACE_START, EMBRACE_START + 12000, 0, 1), 0, 1);
  }

  updateTextSystem(poemTime);
}

function updateTextSystem(poemTime) {
  let nextIdx = lastCompletedLineIdx + 1;
  if (nextIdx >= POEM_LINES.length) return;

  let nextLine = POEM_LINES[nextIdx];
  if (poemTime < nextLine.time) {
    if (currentLineIdx === nextIdx) {
      currentLineAlpha = constrain(map(poemTime - currentLineStartTime, 0, 2000, 0, 255), 0, 255);
    }
    return;
  }

  if (currentLineIdx !== nextIdx) {
    currentLineIdx = nextIdx;
    currentLineStartTime = poemTime;
    currentLineAlpha = 0;
  }

  let elapsed = poemTime - currentLineStartTime;
  currentLineAlpha = constrain(map(elapsed, 0, 2000, 0, 255), 0, 255);

  if (elapsed > 4000) {
    lastCompletedLineIdx = currentLineIdx;
  }
}

function drawReaderLight(poemTime) {
  let r;
  if (stillTime < INTRO_THRESHOLD) {
    // During intro: glow gently grows as words converge
    let introFrac = constrain(map(stillTime, 0, INTRO_THRESHOLD, 0, 1), 0, 1);
    r = lerp(35, 90, introFrac);
  } else {
    let growFrac = constrain(map(poemTime, 0, EMBRACE_START, 0, 1), 0, 1);
    r = lerp(90, 180, growFrac);
  }

  if (presenceTransformT > 0) {
    r = lerp(r, max(width, height) * 0.55, presenceTransformT * 0.5);
  }

  let ctx = drawingContext;
  ctx.save();
  let cx = width / 2;
  let cy = height / 2;

  let gCool = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  gCool.addColorStop(0,   'rgba(40,30,80,0.5)');
  gCool.addColorStop(0.4, 'rgba(20,15,50,0.3)');
  gCool.addColorStop(1.0, 'rgba(0,0,0,0)');
  ctx.fillStyle = gCool;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  if (presenceTransformT > 0) {
    let warmR = r * 1.9;
    let warmA = (presenceTransformT * 0.6).toFixed(3);
    let gWarm = ctx.createRadialGradient(cx, cy, 0, cx, cy, warmR);
    gWarm.addColorStop(0,   'rgba(255,220,100,' + warmA + ')');
    gWarm.addColorStop(0.5, 'rgba(220,160,60,' + (presenceTransformT * 0.3).toFixed(3) + ')');
    gWarm.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = gWarm;
    ctx.beginPath();
    ctx.arc(cx, cy, warmR, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPresence(poemTime) {
  if (presenceAlpha <= 0 && presenceTransformT <= 0) return;

  presenceBlobOffset += 0.004;

  let px = presenceX;
  let py = presenceY;
  let baseR = 90;
  let noiseAmp = 42;

  let ctx = drawingContext;
  ctx.save();
  let auraR = lerp(100, 280, presenceTransformT);
  let auraA = (presenceAlpha / 255) * lerp(0.12, 0.45, presenceTransformT);
  let auraColor = presenceTransformT > 0.4 ? '255,190,50' : '50,20,90';
  let grad = ctx.createRadialGradient(px, py, 10, px, py, auraR);
  grad.addColorStop(0,   'rgba(' + auraColor + ',' + auraA.toFixed(3) + ')');
  grad.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(px, py, auraR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  push();
  translate(px, py);
  noiseDetail(2, 0.6);

  let blobR = floor(lerp(8,   255, presenceTransformT));
  let blobG = floor(lerp(5,   200, presenceTransformT));
  let blobB = floor(lerp(18,   60, presenceTransformT));
  let blobA = lerp(presenceAlpha, 220, presenceTransformT);

  noStroke();
  fill(blobR, blobG, blobB, blobA);

  let N = 60;
  beginShape();
  for (let i = 0; i <= N + 3; i++) {
    let theta = (TWO_PI * (i % N)) / N;
    let nx = cos(theta) * 0.6;
    let ny = sin(theta) * 0.6;
    let n = noise(nx + presenceBlobOffset * 1.3, ny + presenceBlobOffset, presenceBlobOffset * 0.7);
    let r = baseR + noiseAmp * n;
    curveVertex(cos(theta) * r, sin(theta) * r);
  }
  endShape();

  let eyeA = map(poemTime, 12000, 22000, 0, presenceAlpha * 0.6, true);
  eyeA = lerp(eyeA, presenceAlpha, presenceTransformT);
  let eyeR = floor(lerp(160, 255, presenceTransformT));
  let eyeG = floor(lerp(70,  240, presenceTransformT));
  let eyeB = floor(lerp(50,  100, presenceTransformT));
  fill(eyeR, eyeG, eyeB, eyeA);
  ellipse(-20, -12, 9, 6);
  ellipse(20,  -12, 9, 6);

  fill(eyeR, eyeG, eyeB, eyeA * 0.1);
  ellipse(0, 0, 65, 50);

  noiseDetail(4, 0.5);
  pop();
}

function drawPoem() {
  if (currentLineIdx < 0 || currentLineAlpha <= 0) return;

  let line = POEM_LINES[currentLineIdx];
  push();
  textAlign(CENTER, CENTER);
  noStroke();

  if (line.type === 'intro') {
    textSize(17);
    textStyle(ITALIC);
    fill(175, 155, 200, currentLineAlpha);
  } else if (line.type === 'embrace') {
    textSize(34);
    textStyle(BOLD);
    fill(255, 240, 175, currentLineAlpha);
  } else if (line.type === 'resolution') {
    textSize(20);
    textStyle(NORMAL);
    fill(215, 210, 228, currentLineAlpha);
  } else {
    textSize(22);
    textStyle(NORMAL);
    fill(198, 192, 218, currentLineAlpha);
  }

  text(line.text, width / 2, height / 2 + 18);
  pop();
}

function drawFearParticles() {
  for (let i = fearParticles.length - 1; i >= 0; i--) {
    fearParticles[i].update();
    fearParticles[i].show();
    if (fearParticles[i].finished()) {
      fearParticles.splice(i, 1);
    }
  }
}

function spawnFearParticle() {
  fearParticles.push(new FearParticle());
}

class FearParticle {
  constructor() {
    this.x = random(0, width);
    this.y = -12;
    this.vx = random(-0.7, 0.7);
    this.vy = random(2.5, 5.5);
    this.alpha = 190;
    this.word = random(FEAR_WORDS);
    this.sz = random(11, 17);
  }

  finished() { return this.alpha <= 0; }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.alpha -= 1.8;
  }

  show() {
    push();
    noStroke();
    textAlign(LEFT);
    textSize(this.sz);
    textStyle(NORMAL);
    fill(210, 85, 105, this.alpha);
    text(this.word, this.x, this.y);
    pop();
  }
}

class IntroWord {
  constructor() {
    this._spawn();
  }

  _spawn() {
    // Place each word just off a random edge
    let edge = floor(random(4));
    let margin = 40;
    if (edge === 0) {        // top
      this.x = random(width);
      this.y = random(-margin, -10);
    } else if (edge === 1) { // right
      this.x = random(width + 10, width + margin);
      this.y = random(height);
    } else if (edge === 2) { // bottom
      this.x = random(width);
      this.y = random(height + 10, height + margin);
    } else {                 // left
      this.x = random(-margin, -10);
      this.y = random(height);
    }
    this.spawnX = this.x;
    this.spawnY = this.y;

    // Target: near center with variance so words cluster but don't stack
    this.tx = width  / 2 + random(-70, 70);
    this.ty = height / 2 + random(-50, 50);

    this.word = random(INTRO_WORD_LIST);
    this.alpha = 0;
    this.sz = random(13, 21);
    this.approachSpeed = random(0.006, 0.018);
  }

  update(moving) {
    if (moving) {
      // Recede back toward the edge
      this.x = lerp(this.x, this.spawnX, 0.05);
      this.y = lerp(this.y, this.spawnY, 0.05);
    } else {
      // Drift toward center
      this.x = lerp(this.x, this.tx, this.approachSpeed);
      this.y = lerp(this.y, this.ty, this.approachSpeed);
    }

    // Alpha: 0 at the edges, brightest when close to center
    let d = dist(this.x, this.y, width / 2, height / 2);
    let maxD = max(width, height) * 0.65;
    this.alpha = map(d, maxD, 55, 0, 165, true);
  }

  show(fadeMultiplier) {
    if (this.alpha <= 0) return;
    push();
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(this.sz);
    textStyle(NORMAL);
    fill(175, 155, 200, this.alpha * fadeMultiplier);
    text(this.word, this.x, this.y);
    pop();
  }
}

function buildRockBuffer() {
  rockBuffer = createGraphics(windowWidth, windowHeight);
  rockBuffer.noStroke();
  noiseDetail(4, 0.5);
  noiseSeed(42);
  for (let x = 0; x < windowWidth; x += 4) {
    for (let y = 0; y < windowHeight; y += 4) {
      let n = noise(x * 0.004, y * 0.004);
      let b = map(n, 0, 1, 0, 16);
      rockBuffer.fill(b, b, b + 3);
      rockBuffer.rect(x, y, 4, 4);
    }
  }
}

function buildVignetteBuffer() {
  vignetteBuffer = createGraphics(windowWidth, windowHeight);
  vignetteBuffer.clear();
  let cx = windowWidth / 2;
  let cy = windowHeight / 2;
  let diag = sqrt(cx * cx + cy * cy);
  let ctx = vignetteBuffer.drawingContext;
  let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, diag);
  grad.addColorStop(0,    'rgba(0,0,0,0)');
  grad.addColorStop(0.38, 'rgba(0,0,0,0)');
  grad.addColorStop(1.0,  'rgba(0,0,0,0.96)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, windowWidth, windowHeight);
}

function mouseMoved() {
  isMoving = true;
  moveDecayTimer = 800;
}

function keyPressed() {
  isMoving = true;
  moveDecayTimer = 1200;
  for (let i = 0; i < 6; i++) spawnFearParticle();
}

function touchMoved() {
  isMoving = true;
  moveDecayTimer = 800;
  return false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  presenceEdgeX = windowWidth * 0.82;
  presenceEdgeY = windowHeight * 0.12;
  introWordPool = [];
  for (let i = 0; i < 22; i++) {
    introWordPool.push(new IntroWord());
  }
  buildRockBuffer();
  buildVignetteBuffer();
}
