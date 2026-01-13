import React, { useEffect, useRef, useState } from 'react';
import './App.css';

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
        this.side = side;
    }

    update(dt, isPressed) {
        const target = isPressed ? this.activeAngle : this.restAngle;
        const diff = target - this.currentAngle;
        const speed = 15;

        if (Math.abs(diff) > 0.05) {
            this.currentAngle += Math.sign(diff) * speed * dt;
        } else {
            this.currentAngle = target;
        }

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

class GameEngine {
    constructor(canvas, updateScore, setGameOver) {
        this.canvas = canvas;
        this.ctx = this.canvas.getContext('2d');
        this.width = 400;
        this.height = 600;
        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.gravity = new Vector(0, 800); // Massive increase for dt in seconds
        this.ball = null;
        this.score = 0;
        this.updateScoreCallback = updateScore;
        this.setGameOverCallback = setGameOver;

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

        this.leftFlipper = new Flipper(120, 550, 70, 0, Math.PI / 6, -Math.PI / 6, 'left');
        this.rightFlipper = new Flipper(280, 550, 70, 0, Math.PI - Math.PI / 6, Math.PI + Math.PI / 6, 'right');

        this.keys = { left: false, right: false };
        this.lastTime = 0;
        this.isRunning = false;
        this.animationId = null;

        // Wall constants
        this.plungerWallX = 350;
    }

    handleKeyDown(code) {
        if (code === 'Space' && !this.isRunning) this.reset();
        if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = true;
        if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = true;
    }

    handleKeyUp(code) {
        if (code === 'ArrowLeft' || code === 'KeyA') this.keys.left = false;
        if (code === 'ArrowRight' || code === 'KeyD') this.keys.right = false;
    }

    reset() {
        this.ball = new Ball(200 + (Math.random() * 20 - 10), 50, 10); // Drop from top with horizontal jitter
        this.ball.vel = new Vector(0, 0);
        this.score = 0;
        this.updateScoreCallback(this.score);
        this.setGameOverCallback(false);
        this.isRunning = true;
    }

    start() {
        this.reset();
        this.lastTime = performance.now();
        this.loop(this.lastTime);
    }

    stop() {
        cancelAnimationFrame(this.animationId);
        this.isRunning = false;
    }

    loop(timestamp) {
        let dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        // Clamp dt to avoid huge jumps on tab switch, but allow smooth play
        if (dt > 0.05) dt = 0.05;

        if (this.isRunning) {
            // Physics sub-stepping for stability
            const steps = 8;
            const subDt = dt / steps;
            for (let i = 0; i < steps; i++) {
                this.update(subDt);
            }
        }
        this.draw();
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (!this.ball) return;

        this.ball.update(dt, this.gravity);
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
        // Left
        if (this.ball.pos.x - this.ball.radius < 0) {
            this.ball.pos.x = this.ball.radius;
            this.ball.vel.x *= -restitution;
        }
        // Right
        if (this.ball.pos.x + this.ball.radius > this.width) {
            this.ball.pos.x = this.width - this.ball.radius;
            this.ball.vel.x *= -restitution;
        }
        // Top
        if (this.ball.pos.y - this.ball.radius < 0) {
            this.ball.pos.y = this.ball.radius;
            this.ball.vel.y *= -restitution;

            // "Curve" logic: if it hits top near right side, push left
            if (this.ball.pos.x > this.plungerWallX) {
                this.ball.vel.x -= 200; // Kick it left into play
            }
        }


        // Plunger Lane Wall
        // Only active if ball is to the right of it and below the top opening area (e.g. y > 100)
        if (this.ball.pos.x > this.plungerWallX - this.ball.radius && this.ball.pos.x < this.plungerWallX + this.ball.radius && this.ball.pos.y > 100) {
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
                // Normal vector from obstacle center to ball center
                const n = this.ball.pos.sub(obstacle.pos).normalize();

                // Reposition ball outside obstacle
                this.ball.pos = obstacle.pos.add(n.mult(minDist + 1));

                // Reflect velocity
                const v = this.ball.vel;
                const dot = v.dot(n);

                // Elastic collision with some energy loss/gain factor
                const bounce = 1.2; // Add some bounce
                this.ball.vel = v.sub(n.mult(2 * dot)).mult(bounce);
            }
        });



        // Bumpers
        this.bumpers.forEach(bumper => {
            const dist = this.ball.pos.sub(bumper.pos).mag();
            if (dist < this.ball.radius + bumper.radius) {
                const n = this.ball.pos.sub(bumper.pos).normalize();
                this.ball.pos = bumper.pos.add(n.mult(bumper.radius + this.ball.radius + 1));

                const v = this.ball.vel;
                const dot = v.dot(n);
                // Bumper bounce
                this.ball.vel = v.sub(n.mult(2 * dot)).mult(1.5);

                if (!bumper.lit) {
                    bumper.lit = true;
                    bumper.litTimer = 0.2;
                    this.score += bumper.score;
                    this.updateScoreCallback(this.score);
                }
            }
        });

        // Flippers
        [this.leftFlipper, this.rightFlipper].forEach(flipper => {
            const p1 = flipper.pivot;
            const p2 = flipper.tip;
            const v1 = this.ball.pos.sub(p1);
            const l = p2.sub(p1);
            const lLen = l.mag();
            const lUnit = l.normalize();
            const t = Math.max(0, Math.min(lLen, v1.dot(lUnit)));
            const closest = p1.add(lUnit.mult(t));
            const dist = this.ball.pos.sub(closest).mag();

            if (dist < this.ball.radius + 8) { // thicker collision for flippers
                const n = this.ball.pos.sub(closest).normalize();
                this.ball.pos = closest.add(n.mult(this.ball.radius + 8));
                const dot = this.ball.vel.dot(n);
                this.ball.vel = this.ball.vel.sub(n.mult(2 * dot));

                // Velocity boost from flipper movement
                if ((flipper.side === 'left' && this.keys.left) || (flipper.side === 'right' && this.keys.right)) {
                    this.ball.vel = this.ball.vel.add(n.mult(600)); // Strong boost
                } else {
                    this.ball.vel = this.ball.vel.mult(0.5); // Damping on static flipper
                }
            }
        });
    }

    draw() {
        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Grid
        this.ctx.strokeStyle = '#222';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.width; i += 40) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, this.height); this.ctx.stroke();
        }

        // Plunger Divider
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(350, 100);
        this.ctx.lineTo(350, 600);
        this.ctx.stroke();

        this.bumpers.forEach(b => b.draw(this.ctx));

        // Draw Obstacles
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

const PinballGame = () => {
    const canvasRef = useRef(null);
    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const gameEngineRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current && !gameEngineRef.current) {
            gameEngineRef.current = new GameEngine(
                canvasRef.current,
                (newScore) => setScore(newScore),
                (isOver) => setGameOver(isOver)
            );
            gameEngineRef.current.start();
        }

        const handleKeyDown = (e) => gameEngineRef.current?.handleKeyDown(e.code);
        const handleKeyUp = (e) => gameEngineRef.current?.handleKeyUp(e.code);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            gameEngineRef.current?.stop();
            gameEngineRef.current = null;
        };
    }, []);

    const handleRestart = () => {
        gameEngineRef.current?.start();
        setGameOver(false);
    }

    return (
        <div className="pinball-container">
            <div className="ui-layer">
                <div className="score">Score: {score}</div>
                {gameOver && (
                    <div className="game-over">
                        <h2>Game Over</h2>
                        <button onClick={handleRestart}>Press Space or Click to Restart</button>
                    </div>
                )}
            </div>
            <canvas ref={canvasRef} className="pinball-canvas" />
        </div>
    );
};

export default PinballGame;
