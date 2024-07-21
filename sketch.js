let appleCount = 0;
let score = 0;
let failures = 0;
let apples = [];
let explosions = [];
let caterpillars = [];
let obstacles = [];
let baskets = [];
let chordIndex = 0;
let spawnRate = 600; // 初期の青虫の出現頻度（フレーム数）
let spawnRateDecrement = 0.95; // 青虫の出現頻度が時間経過で減少する割合
let gameOverTimer = 0; // ゲームオーバー演出用のタイマー
let lastCaterpillarSpawnTime = 0; // 最後に青虫が出現した時間
let spawnInterval = 10000; // 初期の青虫の出現間隔（ミリ秒）
const maxCaterpillars = 5; // 青虫の最大数

let gameStarted = false;
let gameOver = false;

let chords = [
  [349.23, 440.00, 523.25],  // FMajor (F, A, C)
  [329.63, 493.88, 659.25],  // E7 (E, G#, B)
  [220.00, 261.63, 440.00],  // Am7 (A, C, E, G)
  [196.00, 233.08, 392.00],  // Gm7 (G, Bb, D, F)
  [261.63, 329.63, 392.00]   // C7 (C, E, Bb)
];
let scales = [
  [349.23, 392.00, 440.00, 493.88, 523.25, 587.33, 659.25],  // Fリディアスケール
  [329.63, 370.00, 415.30, 440.00, 493.88, 554.37, 622.25],  // Eミクソリディアスケール
  [220.00, 246.94, 277.18, 293.66, 329.63, 369.99, 415.30],  // Am7に対するスケール
  [196.00, 220.00, 246.94, 261.63, 293.66, 329.63, 369.99],  // Gドリアスケール
  [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88]   // Cミクソリディアスケール
];
let triadOscillators = [];
let sus4Oscillators = [];
let diminishedOscillators = [];
let basket1Oscillator;
let highPitchOscillator;
let noise;

function setup() {
  createCanvas(800, 800);
  noise = new p5.Noise('white');
  noise.amp(0);
  noise.start();

  highPitchOscillator = new p5.Oscillator('sine');
  highPitchOscillator.amp(0);
  highPitchOscillator.start();

  basket1Oscillator = new p5.Oscillator('triangle');
  basket1Oscillator.amp(0);
  basket1Oscillator.start();

  for (let i = 0; i < 2; i++) {
    baskets.push(new Basket(i + 1));
  }
  addObstacles(5); // 障害物を5つ設置
  for (let i = 0; i < 3; i++) {
    let osc = new p5.Oscillator('square');
    osc.amp(0);
    osc.start();
    triadOscillators.push(osc);
  }
  for (let i = 0; i < 3; i++) {
    let osc = new p5.Oscillator('sine');
    osc.amp(0);
    osc.start();
    sus4Oscillators.push(osc);
  }
  for (let i = 0; i < 3; i++) {
    let osc = new p5.Oscillator('triangle');
    osc.amp(0);
    osc.start();
    diminishedOscillators.push(osc);
  }

  lastCaterpillarSpawnTime = millis();
}

function draw() {
  background(255);
  handleExplosions();
  handleApples();
  handleCaterpillars();
  handleObstacles();
  for (let basket of baskets) {
    basket.display();
  }
  
  // 収入を表示
  fill(0);
  textSize(16);
  textAlign(LEFT, TOP);
  text("Score: " + score, 10, 10);

  // Game over condition
  if (failures >= 3 || checkGameOverCondition()) {
    if (!gameOver) {
      gameOver = true;
      gameOverTimer = 0; // タイマーをリセット
    }
    if (gameOverTimer < 60) {
      gameOverTimer++;
    }
    displayGameOver();
  } else if (!gameStarted) {
    // ゲーム開始画面を表示しない
    gameStarted = true;
  } else {
    // 時間経過で青虫の出現頻度を調整
    if (millis() - lastCaterpillarSpawnTime > spawnInterval && apples.length > 0 && caterpillars.length < maxCaterpillars) {
      addCaterpillar();
      lastCaterpillarSpawnTime = millis();
      if (spawnInterval > 1000) { // 最小の出現間隔を設定
        spawnInterval *= spawnRateDecrement;
      }
    }
  }
}

function mousePressed() {
  if (gameOver) {
    restartGame();
  } else {
    explosions.push(new Explosion(mouseX, mouseY));
  }
}

function handleExplosions() {
  for (let i = explosions.length - 1; i >= 0; i--) {
    let explosion = explosions[i];
    explosion.update();
    explosion.display();
    if (explosion.isFinished()) {
      explosions.splice(i, 1);
    }
  }
}

function handleApples() {
  for (let i = apples.length - 1; i >= 0; i--) {
    let apple = apples[i];
    apple.update();
    apple.display();
    if (apple.isOutOfBounds()) {
      apples.splice(i, 1);
      continue;
    }
    for (let j = 0; j < apples.length; j++) {
      let other = apples[j];
      if (apple !== other && apple.isColliding(other)) {
        let dir = p5.Vector.sub(createVector(apple.x, apple.y), createVector(other.x, other.y));
        dir.normalize();
        apple.applyForce(dir);
        other.applyForce(dir.mult(-1));
      }
    }
    for (let obstacle of obstacles) {
      if (obstacle.isColliding(apple)) {
        let dir = p5.Vector.sub(createVector(apple.x, apple.y), createVector(obstacle.x + obstacle.size / 2, obstacle.y + obstacle.size / 2));
        dir.normalize();
        apple.applyForce(dir.mult(10)); // 障害物からの跳ね返り力を強化
        obstacle.playSound(); // 障害物の音を鳴らす
      }
    }
    for (let basket of baskets) {
      if (basket.isColliding(apple)) {
        if (basket.number === 1 && !apple.yellow) {
          apple.turnYellow();
          playBasket1Sound(); // カゴ1番に当たったときの音を鳴らす
        } else if (basket.number === 2 && apple.yellow) {
          score += apple.ripe ? 10 : 5; // 熟したりんごは高得点
          apples.splice(i, 1);
          for (let basket of baskets) {
            basket.relocate(); // カゴをランダムな位置に移動
          }
          playChord(); // 3和音を鳴らす
          createStrongExplosion(basket.x, basket.y); // 強力な爆風を発生させる
        } else {
          // りんごがカゴに当たった時に反射させる
          let dir = p5.Vector.sub(createVector(apple.x, apple.y), createVector(basket.x + 50, basket.y + 50));
          dir.normalize();
          apple.applyForce(dir.mult(10));
          playBasket1Sound(); // カゴに当たったときの音を鳴らす
        }
      }
    }
    // 青虫にぶつかるようにする
    for (let caterpillar of caterpillars) {
      if (apple.yellow && dist(apple.x, apple.y, caterpillar.x, caterpillar.y) < (apple.size + 20) / 2) {
        let dir = p5.Vector.sub(createVector(caterpillar.x, caterpillar.y), createVector(apple.x, apple.y));
        dir.normalize();
        apple.applyForce(dir.mult(10));
      }
    }
  }
  if (frameCount % 120 === 0) { // 出現頻度を低くする
    addApple();
  }
}

function handleCaterpillars() {
  for (let i = caterpillars.length - 1; i >= 0; i--) {
    let caterpillar = caterpillars[i];
    caterpillar.update();
    caterpillar.display();

    // 青虫の目標を2秒ごとに探索
    if (frameCount % 120 === 0) {
      let targetApple = null;
      for (let apple of apples) {
        if (!apple.damaged && apple.ripe) {
          targetApple = apple;
          break;
        }
      }
      caterpillar.setTarget(targetApple);
    }

    if (caterpillar.target) {
      let targetPos = createVector(caterpillar.target.x, caterpillar.target.y);
      let dir = p5.Vector.sub(targetPos, createVector(caterpillar.x, caterpillar.y));
      dir.normalize();
      dir.mult(caterpillar.speed);
      caterpillar.velocity.add(dir);
    } else {
      let dir = p5.Vector.sub(createVector(width / 2, height / 2), createVector(caterpillar.x, caterpillar.y));
      dir.normalize();
      dir.mult(-caterpillar.speed); // Move outwards
      caterpillar.velocity.add(dir);
    }

    if (caterpillar.isOutOfBounds()) {
      createExplosion(caterpillar.x, caterpillar.y); // Create shockwave at caterpillar's last position
      caterpillars.splice(i, 1);
      playHighPitchSound();
    }

    for (let j = apples.length - 1; j >= 0; j--) {
      let apple = apples[j];
      if (caterpillar.isColliding(apple) && !apple.damaged && apple.ripe) {
        playNoise(caterpillar.x); // ノイズを再生
        apple.damage();
        caterpillar.grow(); // 青虫を成長させる
      }
    }
  }
}

function handleObstacles() {
  for (let obstacle of obstacles) {
    obstacle.display();
  }
}

function displayGameOver() {
  if (gameOverTimer >= 60) {
    textSize(32);
    fill(0);
    textAlign(CENTER, CENTER);
    text("Game Over", width / 2, height / 2);
    text("Score: " + score, width / 2, height / 2 + 40);
    textSize(16);
    text("click to restart", width / 2, height / 2 + 80);
    playDiminishedChord(); // Game Over時にディミニッシュコードを再生
    stopAllOscillators(); // すべてのオシレーターを停止
  } else {
    let progress = gameOverTimer / 60;
    let textSizeInterpolated = lerp(0, 32, progress);
    let textXInterpolated = lerp(width + 200, width / 2, progress);
    let textXInterpolatedScore = lerp(width + 200, width / 2, progress);
    let textXInterpolatedRestart = lerp(width + 200, width / 2, progress);
    textSize(textSizeInterpolated);
    fill(0);
    textAlign(CENTER, CENTER);
    text("Game Over", textXInterpolated, height / 2);
    text("Score: " + score, textXInterpolatedScore, height / 2 + 40);
    textSize(16);
    text("click to restart", textXInterpolatedRestart, height / 2 + 80);
  }
}

function restartGame() {
  failures = 0;
  score = 0;
  apples = [];
  explosions = [];
  caterpillars = [];
  obstacles = [];
  baskets = [];
  spawnRate = 600; // リセット時に初期値に戻す
  spawnInterval = 10000; // リセット時に初期値に戻す
  gameOverTimer = 0; // タイマーをリセット
  gameStarted = true;
  gameOver = false;
  lastCaterpillarSpawnTime = millis(); // リセット
  for (let i = 0; i < 2; i++) {
    baskets.push(new Basket(i + 1));
  }
  addObstacles(5); // 再び障害物を設置
}

function addApple() {
  let newApple = new Apple();
  let overlapping;
  do {
    overlapping = false;
    newApple.x = width / 2 + random(-50, 50);
    newApple.y = height / 2 + random(-50, 50);
    for (let apple of apples) {
      if (dist(newApple.x, newApple.y, apple.x, apple.y) < (newApple.size + apple.size) / 2) {
        overlapping = true;
        break;
      }
    }
  } while (overlapping);
  apples.push(newApple);
}

function addCaterpillar() {
  let side = floor(random(4));
  let x, y;
  let offset = 20; // 外周から少し内側にするためのオフセット
  if (side === 0) { // 上から
    x = random(offset, width - offset);
    y = offset;
  } else if (side === 1) { // 右から
    x = width - offset;
    y = random(offset, height - offset);
  } else if (side === 2) { // 下から
    x = random(offset, width - offset);
    y = height - offset;
  } else if (side === 3) { // 左から
    x = offset;
    y = random(offset, height - offset);
  }
  caterpillars.push(new Caterpillar(x, y));
  playSus4ChordWithPanning(x); // 青虫出現時にsus4の和音を鳴らす
}

function addObstacles(count) {
  for (let i = 0; i < count; i++) {
    obstacles.push(new Obstacle());
  }
}

// Apple class
class Apple {
  constructor() {
    this.x = width / 2 + random(-50, 50);
    this.y = height / 2 + random(-50, 50);
    this.size = 20; // サイズを大きめに
    this.ripe = false;
    this.damaged = false;
    this.yellow = false;
    this.velocity = createVector(0, 0);
  }

  update() {
    if (this.size < 40) { // 最大サイズも大きめに
      this.size += 0.5; // 成長速度を速く
    } else {
      this.ripe = true;
    }
    this.x += this.velocity.x;
    this.y += this.velocity.y;
    this.velocity.mult(0.95); // Slowly reduce velocity over time
  }

  display() {
    if (this.yellow) {
      fill(255, 255, 0); // 黄色
    } else {
      fill(this.damaged ? color(100, 50, 50) : (this.ripe ? color(255, 0, 0) : color(0, 255, 0)));
    }
    ellipse(this.x, this.y, this.size, this.size);
  }

  applyForce(force) {
    this.velocity.add(force);
  }

  damage() {
    this.damaged = true;
  }

  turnYellow() {
    this.yellow = true;
  }

  isColliding(other) {
    return dist(this.x, this.y, other.x, other.y) < (this.size + other.size) / 2;
  }

  isOutOfBounds() {
    return (this.x < -this.size || this.x > width + this.size || this.y < -this.size || this.y > height + this.size);
  }
}

// Explosion class
class Explosion {
  constructor(x, y, strong = false) {
    this.x = x;
    this.y = y;
    this.radius = 0;
    this.timer = 60;
    this.duration = 120; // Explosion duration
    this.exploded = false;
    this.strong = strong;

    // パンニングと周波数の設定
    this.panning = map(x, 0, width, -1, 1);
    let scale = scales[chordIndex];
    this.baseFreq = random(scale);
    this.sweepOsc = new p5.Oscillator('sawtooth');
    this.sweepOsc.pan(this.panning);
    this.sweepOsc.start();
    this.sweepOsc.freq(this.baseFreq);
    this.sweepOsc.amp(0.125, 0.1); // 音量を0.125に設定し、徐々に上げる
  }

  update() {
    if (this.timer > 0) {
      this.timer--;
    } else {
      this.exploded = true;
      if (this.radius < (this.strong ? 400 : 200)) { // 爆風の影響範囲を倍に
        this.radius += 10; // 影響範囲の広がり速度も調整
        this.applyShockwave();
        let freq = map(this.radius, 0, (this.strong ? 400 : 200), this.baseFreq, this.baseFreq * 4);
        this.sweepOsc.freq(freq);

        // ビブラートをかける
        let vibrato = sin(this.radius / 10) * 0.125 * map(this.radius, 0, (this.strong ? 400 : 200), 0, 1);
        this.sweepOsc.amp(0.125 + vibrato, 0.1);
      } else {
        this.sweepOsc.amp(0, 0.5); // 音量を徐々に下げる
        this.sweepOsc.stop(); // 音が鳴りっぱなしにならないように停止
      }
      this.duration--;
    }
  }

  display() {
    // 爆弾設置場所を黒い点の点滅で表現
    if (this.timer > 0) {
      fill(0);
      if (this.timer % 20 < 10) {
        ellipse(this.x, this.y, 5, 5);
      }
    }
    if (this.exploded) {
      noFill();
      stroke(255, 0, 0, map(this.duration, 0, 120, 0, 255)); // Fade out the explosion
      strokeWeight(map(this.duration, 0, 120, 1, 3)); // Thicker line for stronger explosion
      ellipse(this.x, this.y, this.radius * 2, this.radius * 2);
    }
  }

  applyShockwave() {
    for (let apple of apples) {
      let dir = p5.Vector.sub(createVector(apple.x, apple.y), createVector(this.x, this.y));
      let distance = dir.mag();
      if (distance < this.radius) {
        dir.normalize();
        dir.mult(70 / distance); // Adjust force based on distance, stronger impact
        apple.applyForce(dir);
      }
    }
    for (let caterpillar of caterpillars) {
      let dir = p5.Vector.sub(createVector(caterpillar.x, caterpillar.y), createVector(this.x, this.y));
      let distance = dir.mag();
      if (distance < this.radius) {
        dir.normalize();
        dir.mult(700 / distance); // Stronger impact for caterpillars
        caterpillar.applyForce(dir);
      }
    }
    for (let other of explosions) {
      if (other !== this && !other.exploded) {
        let dir = p5.Vector.sub(createVector(other.x, other.y), createVector(this.x, this.y));
        let distance = dir.mag();
        if (distance < this.radius) {
          other.explode();
        }
      }
    }
  }

  explode() {
    this.timer = 0;
  }

  isFinished() {
    return this.duration <= 0;
  }
}

function createExplosion(x, y, strong = false) {
  let explosion = new Explosion(x, y, strong);
  explosions.push(explosion);
}

function createStrongExplosion(x, y) {
  createExplosion(x, y, true);
}

// Caterpillar class
class Caterpillar {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.speed = 0.01; // 速度を倍に調整
    this.velocity = createVector(0, 0);
    this.target = null;
  }

  update() {
    if (this.target) {
      let targetPos = createVector(this.target.x, this.target.y);
      let dir = p5.Vector.sub(targetPos, createVector(this.x, this.y));
      dir.normalize();
      dir.mult(this.speed);
      this.velocity.add(dir);
    } else {
      let dir = p5.Vector.sub(createVector(width / 2, height / 2), createVector(this.x, this.y));
      dir.normalize();
      dir.mult(-this.speed); // 外に向かって移動
      this.velocity.add(dir);
    }

    this.x += this.velocity.x;
    this.y += this.velocity.y;
    this.velocity.mult(0.95); // Slowly reduce velocity over time

    if (this.isOutOfBounds()) {
      createExplosion(this.x, this.y); // Create explosion at caterpillar's last position
      caterpillars.splice(caterpillars.indexOf(this), 1);
      playHighPitchSound();
    }
  }

  display() {
    // 青虫を3つの丸で表現し、頭に目をつける
    fill(0, 255, 0);
    ellipse(this.x, this.y, 20, 20); // 頭
    ellipse(this.x - 15, this.y, 15, 15); // 胴体1
    ellipse(this.x - 30, this.y, 10, 10); // 胴体2
    // 目を描画
    fill(0);
    ellipse(this.x - 5, this.y - 5, 3, 3);
    ellipse(this.x + 5, this.y - 5, 3, 3);
  }

  applyForce(force) {
    this.velocity.add(force);
  }

  grow() {
    this.speed *= 1.5; // 速度を50%増加
    this.size = min(this.size + 2, 30); // サイズを増加し、最大サイズを30に制限
  }

  setTarget(apple) {
    this.target = apple;
  }

  isColliding(apple) {
    return dist(this.x, this.y, apple.x, apple.y) < (20 + apple.size) / 2;
  }

  isOutOfBounds() {
    return (this.x < -20 || this.x > width + 20 || this.y < -20 || this.y > height + 20);
  }
}

// Basket class
class Basket {
  constructor(number) {
    this.number = number;
    this.relocate();
  }

  display() {
    fill(255, 200, 0);
    rect(this.x, this.y, 100, 100); // カゴのサイズを倍に
    fill(0);
    textSize(32);
    textAlign(CENTER, CENTER);
    text(this.number, this.x + 50, this.y + 50);
  }

  isColliding(apple) {
    return apple.x > this.x && apple.x < this.x + 100 && apple.y > this.y && apple.y < this.y + 100;
  }

  relocate() {
    if (this.number === 1) {
      // 1つ目のカゴは中央付近に出現
      this.x = width / 2 + random(-100, 100);
      this.y = height / 2 + random(-100, 100);
    } else {
      // 2つ目のカゴは外側付近に出現
      this.x = random(width - 100);
      this.y = random(height - 100);
      if (dist(this.x, this.y, width / 2, height / 2) < 200) {
        this.relocate();
      }
    }
  }
}

// Obstacle class
class Obstacle {
  constructor() {
    this.x = random(width - 50);
    this.y = random(height - 50);
    this.size = 50; // 障害物のサイズ
    this.oscillator = new p5.Oscillator('square');
    this.oscillator.freq(random(scales[chordIndex]));
    this.oscillator.amp(0);
    this.oscillator.start();
  }

  display() {
    fill(150);
    rect(this.x, this.y, this.size, this.size);
  }

  isColliding(apple) {
    return apple.x > this.x && apple.x < this.x + this.size && apple.y > this.y && apple.y < this.y + this.size;
  }

  playSound() {
    this.oscillator.freq(random(scales[chordIndex]));
    this.oscillator.amp(0.5, 0.05);
    this.oscillator.amp(0, 0.1); // 音を短めに設定
  }
}

function playChord() {
  let chord = chords[chordIndex];
  for (let i = 0; i < 3; i++) {
    triadOscillators[i].freq(chord[i]);
    triadOscillators[i].amp(0.5, 0.05);
    triadOscillators[i].amp(0, 0.1); // 音を短めに設定
  }
  chordIndex = (chordIndex + 1) % chords.length;
}

function playBasket1Sound() {
  let scale = scales[chordIndex];
  let note = random(scale);
  basket1Oscillator.freq(note);
  basket1Oscillator.amp(0.5, 0.05);
  basket1Oscillator.amp(0, 0.1); // 音を短めに設定
}

function playSus4ChordWithPanning(x) {
  let scale = scales[chordIndex];
  let root = random(scale);
  let chord = [root, root * pow(2, 5 / 12), root * pow(2, 7 / 12)]; // sus4の和音
  let panning = map(x, 0, width, -1, 1); // パンニングをx位置に基づいて設定
  for (let i = 0; i < 3; i++) {
    sus4Oscillators[i].freq(chord[i]);
    sus4Oscillators[i].pan(panning);
    sus4Oscillators[i].amp(0.5, 0.05);
    sus4Oscillators[i].amp(0, 0.1); // 音を短めに設定
  }
}

function playDiminishedChord() {
  let root = random([220.00, 246.94, 277.18, 329.63, 369.99, 415.30]); // ランダムなルート音を選択
  let chord = [root, root * pow(2, 3 / 12), root * pow(2, 6 / 12)]; // ディミニッシュの和音
  for (let i = 0; i < 3; i++) {
    diminishedOscillators[i].freq(chord[i]);
    diminishedOscillators[i].amp(0.5, 0.05);
    diminishedOscillators[i].amp(0, 0.5); // 音量が速く減衰するように設定
  }
}

function playNoise(x) {
  let panning = map(x, 0, width, -1, 1); // パンニングをx位置に基づいて設定
  noise.pan(panning);
  noise.amp(0.5, 0.05);
  noise.amp(0, 0.1); // 音を短めに設定
}

function playHighPitchSound() {
  let scale = scales[chordIndex];
  let pitch = random(scale) * 2; // スケール音のオクターブ上の音
  highPitchOscillator.freq(pitch);
  highPitchOscillator.amp(0.5, 0.05);
  highPitchOscillator.amp(0, 0.1); // 音を短めに設定
}

function stopAllOscillators() {
  for (let osc of triadOscillators) {
    osc.stop();
  }
  for (let osc of sus4Oscillators) {
    osc.stop();
  }
  for (let osc of diminishedOscillators) {
    osc.stop();
  }
  basket1Oscillator.stop();
  highPitchOscillator.stop();
  noise.stop();
}

function checkGameOverCondition() {
  let damagedCount = apples.filter(apple => apple.damaged).length;
  return damagedCount >= apples.length / 2;
}
