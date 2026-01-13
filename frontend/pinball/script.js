class Vector {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    add(v) { return new Vector(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vector(this.x - v.x, this.y - v.y); }
    mult(n) { return new Vector(this.x * n, this.y * n); }
    mag() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    normalize() {
        const m = this.mag();
        return m === 0 ? new Vector(0, 0) : new Vector(this.x / m, this.y / m);
    }
    dot(v) { return this.x * v.x + this.y * v.y; }
    perp() { return new Vector(-this.y, this.x); } // Perpendicular vector
}

class Ball {
    constructor(x, y, radius) {
        this.pos = new Vector(x, y);
        this.vel = new Vector(0, 0);
        this.radius = radius;
        this.restitution = 0.5;
        this.friction = 0.99;
    }

    update(dt, gravity) {
        this.vel = this.vel.add(gravity.mult(dt));
        this.vel = this.vel.mult(this.friction);
        this.pos = this.pos.add(this.vel.mult(dt));
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();
    }
}

class Bumper {
    constructor(x, y, radius, score = 100) {
        this.pos = new Vector(x, y);
        this.radius = radius;
        this.color = '#ff0055';
        this.score = score;
        this.lit = false;
        this.litTimer = 0;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.lit ? '#ff5599' : this.color;
        ctx.shadowBlur = this.lit ? 20 : 5;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.closePath();

        // Inner detail
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = '#330011';
        ctx.fill();
        ctx.closePath();
    }

    update(dt) {
        if (this.lit) {
            this.litTimer -= dt;
            if (this.litTimer <= 0) this.lit = false;
        }
    }
}

class Flipper {
    constructor(x, y, length, angle, restAngle, activeAngle, side) {
        this.pivot = new Vector(x, y);
        this.length = length;
        this.angle = angle;
        this.currentAngle = restAngle;
        this.restAngle = restAngle;
        this.activeAngle = activeAngle;
        this.side = side; // 'left' or 'right'
        this.angularVelocity = 0;
        this.tip = new Vector(
            this.pivot.x + Math.cos(this.currentAngle) * this.length,
            this.pivot.y + Math.sin(this.currentAngle) * this.length
        );
    }

    update(dt, isPressed) {
        const target = isPressed ? this.activeAngle : this.restAngle;
        const diff = target - this.currentAngle;
        const speed = 15; // Angular speed

        if (Math.abs(diff) > 0.05) {
            this.currentAngle += Math.sign(diff) * speed * dt;
        } else {
            this.currentAngle = target;
        }

        // Calculate tip position for drawing and collision
        this.tip = new Vector(
            this.pivot.x + Math.cos(this.currentAngle) * this.length,
            this.pivot.y + Math.sin(this.currentAngle) * this.length
        );
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pivot.x, this.pivot.y);
        ctx.rotate(this.currentAngle);

        ctx.beginPath();
        ctx.roundRect(0, -5, this.length, 10, 5);
        ctx.fillStyle = '#00FFFF';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00FFFF';
        ctx.fill();
        ctx.restore();
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('pinball-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = 400;
        this.height = 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.gravity = new Vector(0, 800);
        this.ball = null;
        this.score = 0;

        // Game Objects
        this.bumpers = [
            new Bumper(200, 200, 25),
            new Bumper(120, 300, 20),
            new Bumper(280, 300, 20),
            new Bumper(200, 100, 15, 200)
        ];

        this.obstacles = [];
        for (let i = 0; i < 5; i++) {
            this.obstacles.push({
                pos: new Vector(Math.random() * 300 + 50, Math.random() * 200 + 150),
                radius: 15 + Math.random() * 15
            });
        }

        // Flippers
        this.leftFlipper = new Flipper(120, 550, 70, 0, Math.PI / 6, -Math.PI / 6, 'left');
        this.rightFlipper = new Flipper(280, 550, 70, 0, Math.PI - Math.PI / 6, Math.PI + Math.PI / 6, 'right');

        this.keys = { left: false, right: false };
        this.lastTime = 0;
        this.isRunning = false;

        this.plungerWallX = 350;

        this.setupInput();
        this.start();
    }

    setupInput() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !this.isRunning) this.reset();
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = true;
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.keys.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.keys.right = false;
        });
    }

    reset() {
        // Drop from top with random offset to prevent infinite vertical bouncing on center bumper
        this.ball = new Ball(200 + (Math.random() * 20 - 10), 50, 10);

        // ✅ 좌우로도 떨어지게: 초기 vx 랜덤 + 초기 vy 약간
        const vx = (Math.random() - 0.5) * 300;     // -150 ~ 150
        const vy = 50 + Math.random() * 100;        // 50 ~ 150 (살짝 아래로 출발)
        this.ball.vel = new Vector(vx, vy);

        // ✅ "스웨이(좌우 흔들림)"용 내부 변수
        this.ball.swayT = 0;
        this.ball.swaySeed = Math.random() * 1000;  // 각 공마다 다른 패턴
        this.ball.spin = (Math.random() - 0.5) * 2; // -1 ~ 1 (약한 회전값 느낌)

        this.score = 0;
        this.updateScoreCallback(this.score);
        this.setGameOverCallback(false);
        this.isRunning = true;
    }

    updateScore() {
        document.getElementById('score').innerText = `Score: ${this.score}`;
    }

    start() {
        this.reset();
        this.lastTime = performance.now();
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (dt > 0.05) dt = 0.05;

        if (this.isRunning) {
            // ⚙️ 고속 발사 대응: 서브스텝 증가 (기존 8)
            const steps = 18;
            const subDt = dt / steps;
            for (let i = 0; i < steps; i++) {
                this.update(subDt);
            }
        }

        this.draw();
        requestAnimationFrame((timestamp) => this.loop(timestamp));
    }

    update(dt) {
        if (!this.ball) return;

        // ✅ 좌우로 흔들리는 "가짜 물리엔진" (바람 + 난류 + 스핀 느낌)
        // - 너무 과하면 숫자만 줄이면 됨
        this.ball.swayT += dt;

        const WIND_STRENGTH = 180;   // 바람 세기(좌우 힘) 120~250 추천
        const TURBULENCE = 80;       // 난류(랜덤성) 40~120 추천
        const DAMP_X = 0.995;        // x 감쇠(미끄러짐/저항) 0.99~0.998

        // 부드러운 좌우 스웨이(사인파) + 공마다 다른 seed로 패턴 다름
        const wind =
            Math.sin((this.ball.swayT + this.ball.swaySeed) * 2.3) * WIND_STRENGTH;

        // 난류: 프레임마다 약간 랜덤한 흔들림
        const noise = (Math.random() - 0.5) * TURBULENCE;

        // 스핀: 진행 중 좌우로 미는 경향(약하게)
        const spinForce = this.ball.spin * 60;

        // 힘을 속도에 반영 (a = F 가정, 질량 1)
        this.ball.vel.x += (wind + noise + spinForce) * dt;
        this.ball.vel.x *= DAMP_X;

        // 원래 물리 업데이트
        this.ball.update(dt, this.gravity);

        // 이하 기존 그대로
        this.bumpers.forEach(b => b.update(dt));
        this.leftFlipper.update(dt, this.keys.left);
        this.rightFlipper.update(dt, this.keys.right);

        this.checkCollisions();

        if (this.ball.pos.y > this.height + 20) {
            this.isRunning = false;
            this.setGameOverCallback(true);
        }
    }

    checkCollisions() {
        const restitution = 0.6;

        // Walls
        if (this.ball.pos.x - this.ball.radius < 0) {
            this.ball.pos.x = this.ball.radius;
            this.ball.vel.x *= -restitution;
        }
        if (this.ball.pos.x + this.ball.radius > this.width) {
            this.ball.pos.x = this.width - this.ball.radius;
            this.ball.vel.x *= -restitution;
        }
        if (this.ball.pos.y - this.ball.radius < 0) {
            this.ball.pos.y = this.ball.radius;
            this.ball.vel.y *= -restitution;

            // 🔥 플런저 레인에서 메인필드로 강하게 튕기기 (기존 -200)
            if (this.ball.pos.x > this.plungerWallX) {
                this.ball.vel.x -= 1200;
            }
        }

        // Plunger Wall
        if (
            this.ball.pos.x > this.plungerWallX - this.ball.radius &&
            this.ball.pos.x < this.plungerWallX + this.ball.radius &&
            this.ball.pos.y > 100
        ) {
            if (this.ball.pos.x > this.plungerWallX) {
                this.ball.pos.x = this.plungerWallX + this.ball.radius;
                this.ball.vel.x *= -0.5;
            } else {
                this.ball.pos.x = this.plungerWallX - this.ball.radius;
                this.ball.vel.x *= -0.5;
            }
        }

        // Circular Obstacles
        this.obstacles.forEach(obstacle => {
            const dist = this.ball.pos.sub(obstacle.pos).mag();
            const minDist = this.ball.radius + obstacle.radius;

            if (dist < minDist) {
                const n = this.ball.pos.sub(obstacle.pos).normalize();
                this.ball.pos = obstacle.pos.add(n.mult(minDist + 1));

                const v = this.ball.vel;
                const dot = v.dot(n);

                const bounce = 1.2;
                this.ball.vel = v.sub(n.mult(2 * dot)).mult(bounce);
            }
        });



        // Bumpers (Circle vs Circle)
        this.bumpers.forEach(bumper => {
            const dist = this.ball.pos.sub(bumper.pos).mag();
            if (dist < this.ball.radius + bumper.radius) {
                const n = this.ball.pos.sub(bumper.pos).normalize();
                this.ball.pos = bumper.pos.add(n.mult(bumper.radius + this.ball.radius + 1));

                const v = this.ball.vel;
                const dot = v.dot(n);
                this.ball.vel = v.sub(n.mult(2 * dot)).mult(1.5);

                bumper.lit = true;
                bumper.litTimer = 0.2;
                this.score += bumper.score;
                this.updateScore();
            }
        });

        // Flippers (Circle vs Line Segment)
        [this.leftFlipper, this.rightFlipper].forEach(flipper => {
            this.checkFlipperCollision(flipper);
        });
    }

    checkFlipperCollision(flipper) {
        const p1 = flipper.pivot;
        const p2 = flipper.tip;

        const v1 = this.ball.pos.sub(p1);
        const l = p2.sub(p1);
        const lLen = l.mag();
        const lUnit = l.normalize();

        const t = Math.max(0, Math.min(lLen, v1.dot(lUnit)));

        const closest = p1.add(lUnit.mult(t));
        const distVec = this.ball.pos.sub(closest);
        const dist = distVec.mag();

        if (dist < this.ball.radius + 8) {
            let n = distVec.normalize();
            this.ball.pos = closest.add(n.mult(this.ball.radius + 8));

            const dot = this.ball.vel.dot(n);
            this.ball.vel = this.ball.vel.sub(n.mult(2 * dot));

            if ((flipper.side === 'left' && this.keys.left) || (flipper.side === 'right' && this.keys.right)) {
                this.ball.vel = this.ball.vel.add(n.mult(600));
            } else {
                this.ball.vel = this.ball.vel.mult(0.5);
            }
        }
    }

    draw() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.width; i += 40) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.height); this.ctx.stroke();
        }
        for (let j = 0; j < this.height; j += 40) {
            this.ctx.beginPath(); this.ctx.moveTo(0, j); this.ctx.lineTo(this.width, j); this.ctx.stroke();
        }

        // Plunger
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(350, 100);
        this.ctx.lineTo(350, 600);
        this.ctx.stroke();

        this.bumpers.forEach(b => b.draw(this.ctx));

        this.ctx.fillStyle = '#999';
        this.obstacles.forEach(obs => {
            this.ctx.beginPath();
            this.ctx.arc(obs.pos.x, obs.pos.y, obs.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.closePath();
        });

        this.leftFlipper.draw(this.ctx);
        this.rightFlipper.draw(this.ctx);

        if (this.ball) this.ball.draw(this.ctx);
    }
}

// Start Game
window.onload = () => {
    const game = new Game();
};