// Hand Pose Detection with ml5.js
// https://thecodingtrain.com/tracks/ml5js-beginners-guide/ml5/hand-pose

let video;
let handPose;
let hands = [];

// 遊戲變數
let gameState = "WAITING"; // WAITING, COUNTDOWN, RESULT, GAMEOVER
let pScore = 0;
let cScore = 0;
let playerGesture = "";
let computerGesture = "";
let resultMsg = "";
let timer = 0;
let resultTimer = 0; // 新增：結果停留計時器
let particles = [];  // 新增：粒子陣列
const gestures = ["棒子", "老虎", "雞", "蟲"];

function preload() {
  // Initialize HandPose model with flipped video input
  handPose = ml5.handPose({ flipped: true });
}

function mousePressed() {
  console.log(hands);
}

function gotHands(results) {
  hands = results;
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  // Start detecting hands
  handPose.detectStart(video, gotHands);
}

function draw() {
  background("#7A918D");

  // 1. 顯示學號於置中上方
  fill(255);
  noStroke();
  textSize(32);
  textAlign(CENTER, TOP);
  text("414730035", width / 2, 20);

  fill("#FFD700");
  textSize(28);
  text(resultMsg, width / 2, 110);

  // 計算影像顯示尺寸 (畫布寬高的 50%)
  let displayW = width * 0.5;
  let displayH = height * 0.5;
  let displayX = (width - displayW) / 2;
  let displayY = (height - displayH) / 2;

  // 繪製影像
  image(video, displayX, displayY, displayW, displayH);

  // 3. 遊戲邏輯處理
  let currentPose = detectGesture(hands);
  updateGameLogic(currentPose);

  // 4. 顯示底部指示說明
  fill(255);
  textSize(18);
  textAlign(CENTER, BOTTOM);
  let instruction = "指示：👍 豎起拇指開始下一局 | ☝️ 棒子 | 👐 雙手老虎 | 👌 指尖合攏為雞 | ✋ 手平為蟲";
  if (gameState === "GAMEOVER") instruction = "遊戲結束！請重新整理頁面再次挑戰。";
  text(instruction, width / 2, height - 20);

  if (gameState === "COUNTDOWN") {
    drawCountdown();
  }

  if (gameState === "RESULT") {
    drawResultPrompt();
  }
  
  if (gameState === "WAITING") {
    drawWaitingPrompt();
  }

  // 6. 繪製底部進度條 (讀條)
  drawProgressBar();

  // 5. 更新與繪製粒子
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].finished()) {
      particles.splice(i, 1);
    }
  }

  // Ensure at least one hand is detected
  if (hands.length > 0) {
    for (let hand of hands) {
      if (hand.confidence > 0.1) {
        // 設定連線顏色 (根據左右手區分)
        if (hand.handedness == "Left") {
          stroke(255, 0, 255);
          fill(255, 0, 255);
        } else {
          stroke(255, 255, 0);
          fill(255, 255, 0);
        }

        // 繪製關鍵點與連線
        drawSkeleton(hand.keypoints, displayX, displayY, displayW, displayH);
      }
    }
  }
}

function detectGesture(detectedHands) {
  if (detectedHands.length === 0) return "";
  
  // 老虎判定：雙手
  if (detectedHands.length >= 2) return "老虎";

  let hand = detectedHands[0];
  let kp = hand.keypoints;
  
  // 計算指尖距離 (雞)
  let d_8_12 = dist(kp[8].x, kp[8].y, kp[12].x, kp[12].y);
  let d_12_16 = dist(kp[12].x, kp[12].y, kp[16].x, kp[16].y);
  let d_4_8 = dist(kp[4].x, kp[4].y, kp[8].x, kp[8].y);
  if (d_8_12 < 30 && d_12_16 < 30 && d_4_8 < 40) return "雞";

  // 拇指判定 (開始)
  if (kp[4].y < kp[3].y && kp[8].y > kp[6].y && kp[12].y > kp[10].y) return "START";

  // 棒子判定 (食指豎起)
  if (kp[8].y < kp[6].y && kp[12].y > kp[10].y && kp[16].y > kp[14].y) return "棒子";

  // 蟲判定 (手平放，背面朝上：0號手腕座標與其餘點接近)
  if (abs(kp[5].y - kp[17].y) < 40 && abs(kp[0].y - kp[9].y) < 60) return "蟲";

  return "";
}

function updateGameLogic(currentPose) {
  if (gameState === "WAITING") {
    resultMsg = ""; // 清空上方訊息，改為螢幕中間顯示
    if (currentPose === "START") {
      gameState = "COUNTDOWN";
      timer = 3;
    }
  } else if (gameState === "COUNTDOWN") {
    if (frameCount % 60 === 0 && timer > 0) timer--;
    if (timer <= 0) {
      playerGesture = currentPose === "START" ? "" : currentPose; // 排除開始手勢
      if (playerGesture === "" || playerGesture === "START") {
        resultMsg = "沒有偵測到有效出拳，重來！";
        gameState = "WAITING";
      } else {
        executeRound(playerGesture);
      }
    }
  } else if (gameState === "RESULT") {
    if (resultTimer > 0) {
      resultTimer--;
    } else {
      // 停留結束後，顯示提示文字讓玩家準備下一局
      if (currentPose === "START") gameState = "WAITING";
    }
  }

  if (pScore >= 3 || cScore >= 3) {
    gameState = "GAMEOVER";
    resultMsg = pScore >= 3 ? "恭喜！你獲得最終勝利！" : "電腦贏了，再接再厲！";
  }
}

function executeRound(pChoice) {
  computerChoice = random(gestures);
  playerChoice = pChoice;
  
  let pCol;
  let result = judge(playerChoice, computerChoice);
  
  if (result === "WIN") {
    pScore++;
    resultMsg = `你出【${playerChoice}】 vs 電腦【${computerChoice}】-> 你贏了！`;
    pCol = color(255, 215, 0); // 金色
  } else if (result === "LOSE") {
    cScore++;
    resultMsg = `你出【${playerChoice}】 vs 電腦【${computerChoice}】-> 你輸了！`;
    pCol = color(255, 50, 50); // 紅色
  } else {
    resultMsg = `你出【${playerChoice}】 vs 電腦【${computerChoice}】-> 平手！`;
    pCol = color(255); // 白色
  }
  
  // 產生粒子效果並設定 1 秒停留 (約 60 幀)
  spawnParticles(width / 2, height / 2, pCol);
  resultTimer = 60; 
  gameState = "RESULT";
}

function judge(p, c) {
  if (p === c) return "TIE";
  if (p === "棒子" && c === "老虎") return "WIN";
  if (p === "老虎" && c === "雞") return "WIN";
  if (p === "雞" && c === "蟲") return "WIN";
  if (p === "蟲" && c === "棒子") return "WIN";
  
  if (c === "棒子" && p === "老虎") return "LOSE";
  if (c === "老虎" && p === "雞") return "LOSE";
  if (c === "雞" && p === "蟲") return "LOSE";
  if (c === "蟲" && p === "棒子") return "LOSE";
  
  return "TIE"; // 無相剋關係則平手
}

function drawCountdown() {
  fill(255, 0, 0);
  textSize(100);
  textAlign(CENTER, CENTER);
  text(timer, width / 2, height / 2);
  
  fill(255);
  textSize(32);
  text("請出拳！", width / 2, height / 2 + 80);
}

function drawWaitingPrompt() {
  push();
  fill("#FFD700");
  stroke(0);
  strokeWeight(4);
  textSize(60);
  textAlign(CENTER, CENTER);
  text("請豎起拇指 👍\n開始比賽", width / 2, height / 2);
  pop();
}

function drawResultPrompt() {
  push();
  fill(255);
  stroke(0);
  strokeWeight(6);
  textSize(80);
  textAlign(CENTER, CENTER);
  
  // 只在停留的一秒內顯示大字
  if (resultTimer > 0) {
    text(resultMsg.split("->")[1].trim(), width / 2, height / 2);
  } else {
    textSize(40);
    text("請再次 👍 開始下一局", width / 2, height / 2 + 100);
  }
  pop();
}

function drawProgressBar() {
  let progress = 0;
  let barColor = color(255);

  if (gameState === "COUNTDOWN") {
    // 倒數計時進度 (3秒)
    progress = timer / 3;
    barColor = color(255, 100, 100); // 紅色
  } else if (gameState === "RESULT") {
    // 結果停留進度 (60幀)
    progress = resultTimer / 60;
    barColor = color(100, 255, 100); // 綠色
  }

  if (progress > 0) {
    push();
    noStroke();
    // 繪製進度條底色
    fill(0, 0, 0, 80);
    rect(0, height - 15, width, 15);
    // 繪製進度條本體
    fill(barColor);
    rect(0, height - 15, width * progress, 15);
    pop();
  }
}

function drawSkeleton(keypoints, x, y, w, h) {
  // 定義需要連線的索引範圍
  let segments = [[0, 4], [5, 8], [9, 12], [13, 16], [17, 20]];

  for (let segment of segments) {
    for (let i = segment[0]; i < segment[1]; i++) {
      let pt1 = keypoints[i];
      let pt2 = keypoints[i + 1];

      // 將座標從原始影片尺寸映射到畫布上的顯示尺寸
      let x1 = map(pt1.x, 0, video.width, x, x + w);
      let y1 = map(pt1.y, 0, video.height, y, y + h);
      let x2 = map(pt2.x, 0, video.width, x, x + w);
      let y2 = map(pt2.y, 0, video.height, y, y + h);

      strokeWeight(4);
      line(x1, y1, x2, y2);
      
      noStroke();
      circle(x1, y1, 8);
      if (i === segment[1] - 1) circle(x2, y2, 8); // 畫最後一個點
    }
  }
}

function spawnParticles(x, y, col) {
  for (let i = 0; i < 80; i++) {
    particles.push(new Particle(x, y, col));
  }
}

// 粒子類別
class Particle {
  constructor(x, y, col) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D();
    this.vel.mult(random(2, 10));
    this.acc = createVector(0, 0.1);
    this.alpha = 255;
    this.col = col;
  }

  finished() {
    return this.alpha < 0;
  }

  update() {
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.alpha -= 5;
  }

  show() {
    noStroke();
    let c = color(red(this.col), green(this.col), blue(this.col), this.alpha);
    fill(c);
    ellipse(this.pos.x, this.pos.y, 8);
  }
}
