var pinballCanvas = document.getElementById("pinballCanvas");
var c = pinballCanvas.getContext("2d");

var gravity = { x: 0.0, y: -12.0 }; 
var friction = 0.8; 
var holdCycles = 0;

var px = document.getElementById("physics-x");
var py = document.getElementById("physics-y");

var timeStep = 1.0 / 60.0;
var MAX_BALL_SPEED = 24;
var STARTING_BALLS = 3;
var EXTRA_BALL_EVERY = 1000;
var ballsLeft = STARTING_BALLS;
var HIGH_SCORE_KEY = "starWarsPinballHighScore";
var PINBALL_PROGRESS_KEY = "pinballProgress";
var pinballProgressReady = false;
var highScore = 0;
var sidePanelX = 0;
var sidePanelW = 180;
var fieldStars = [];
for (var si = 0; si < 90; si++) {
    fieldStars.push({ x: Math.random(), y: Math.random(), s: Math.random() * 1.7 + 0.3 });
}
try {
    highScore = parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10);
    if (isNaN(highScore)) highScore = 0;
} catch (e) {
    highScore = 0;
}

var ball = { 
    radius: 0.5,
    pos: { x: 19.25, y: 1.0 },
    vel: { x: 0.0, y: 0.0 },
    lastContact: new Date(0, 0, 0),
};

var objects = [];
var collisions = [];

var simWidth, simHeight, cScale, tableOriginX, tableOriginY;
// Playfield size in simulation units. Top arch peak meets the box/canvas top.
var TABLE_WIDTH = 20.0;
var TABLE_HEIGHT = 23.0;
var LAUNCH_LANE_X = 18.25;
var LAUNCH_WALL_BOTTOM = 0.15;
var LAUNCH_WALL_TOP = 15.1;
var LAUNCH_WALL_SHORTEN_PX = 20;

function isPosInPath(x, y, x0, y0, x1, y1) {
    if ((((x > x0) && (x > x1)) || ((x < x0) && (x < x1))) || (((y > y0) && (y > y1)) || ((y < y0) && (y < y1)))) return false;
    else return true;
}

function posWithAngleRadius(angleRad, radius, offset) {
    return { x: Math.cos(angleRad)*radius + offset?.x ?? 0, y: Math.sin(angleRad)*radius + offset?.y ?? 0 };
}

function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const abLenSq = abx * abx + aby * aby;
    var t = 0;
    if (abLenSq > 1e-12) {
        t = ((px - ax) * abx + (py - ay) * aby) / abLenSq;
        if (t < 0) t = 0;
        else if (t > 1) t = 1;
    }
    return { x: ax + abx * t, y: ay + aby * t };
}

class PolyObject {
    constructor(x, y, polyIndicies, contactPoints = 0, closeLoop = true) {
        this.x = x;
        this.y = y;
        this.contactPoints = contactPoints;
        this.closeLoop = closeLoop;
        var maxX = polyIndicies[0].x; var maxY = polyIndicies[0].y;
        var minX = polyIndicies[0].x; var minY = polyIndicies[0].y;
        polyIndicies.forEach((point) => {
            if (point.x > maxX) maxX = point.x;
            if (point.y > maxY) maxY = point.y;
            if (point.x < minX) minX = point.x;
            if (point.y < minY) minY = point.y;
        });
        console.log(`Max X: ${maxX}, Min X: ${minX}, MaxY: ${maxY}, MinY: ${minY}`);
        const relativeCenter = { x: (maxX + minX) / 2, y: (maxY + minY) / 2 };
        console.log(relativeCenter);
        this.polyIndicies = [];
        for (const point of polyIndicies)
            this.polyIndicies.push({x: point.x - relativeCenter.x, y: point.y - relativeCenter.y});
        console.log(this.polyIndicies);
        var maxDist = 0;
        this.polyIndicies.forEach((point) => { 
            const dist = Math.sqrt(Math.pow(point.x, 2) + Math.pow(point.y, 2));
            if (dist > maxDist) maxDist = dist;
        });
        this.radius = maxDist;
        this.surfaceType = "bounce";
        this.friction = 0.8;
        this.lastContactTime = new Date(0, 0, 0);
        this.color = "#0000FF";
        console.log(`Poly center: (${this.x}, ${this.y}), radius: ${this.radius}`);
    }

    draw(c, ball) {
        const ballDist = Math.sqrt(Math.pow(ball.pos.x - this.x, 2) + Math.pow(ball.pos.y - this.y, 2));
        const near = ballDist < (this.radius + ball.radius);
        c.shadowBlur = 0;

        c.beginPath();
        if (this.closeLoop) {
            const lastPoint = this.polyIndicies[this.polyIndicies.length - 1];
            c.moveTo(cX({x:lastPoint.x + this.x}), cY({y:lastPoint.y + this.y}));
        } else {
            const firstPoint = this.polyIndicies[0];
            c.moveTo(cX({x:firstPoint.x + this.x}), cY({y:firstPoint.y + this.y}));
        }
        for (const point of this.polyIndicies)
            c.lineTo(cX({x:point.x + this.x}), cY({y:point.y + this.y}));

        c.lineWidth = 2;
        c.strokeStyle = near ? "#3FFF5F" : "#6FDF8F";
        c.stroke();

        /*c.strokeStyle = "#5F0000";
        c.beginPath();
        c.arc(cX(this), cY(this), cScale * this.radius, 0.0, 2.0 * Math.PI);
        c.closePath();
        c.stroke();*/

      
      /*  const Xb0 = ball.pos.x - ball.vel.x*timeStep;
        const Yb0 = ball.pos.y - ball.vel.y*timeStep;
        const Xb1 = ball.pos.x;
        const Yb1 = ball.pos.y;
        const Mb = (Yb1 - Yb0) / (Xb1 - Xb0);
        const Bb = Yb0 - Mb*Xb0;
        c.strokeStyle = "#505F50";
        c.beginPath();
        c.moveTo(cX({x:0}), cY({y:Bb}));
        c.lineTo(cX({x:30}), cY({y: Mb*30 + Bb}));
        c.closePath();
        c.stroke();*/
    }

    pointInPolygon(px, py) {
        if (!this.closeLoop) return false;
        var inside = false;
        const pts = this.polyIndicies;
        const n = pts.length;
        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = pts[i].x + this.x;
            const yi = pts[i].y + this.y;
            const xj = pts[j].x + this.x;
            const yj = pts[j].y + this.y;
            const denom = (yj - yi) || 1e-12;
            const intersects = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / denom + xi);
            if (intersects) inside = !inside;
        }
        return inside;
    }

    nearestBallContact(ball) {
        const pts = this.polyIndicies;
        const n = pts.length;
        if (n < 2) return null;

        var best = null;
        const start = this.closeLoop ? 0 : 1;
        for (let i = start; i < n; i++) {
            const a = this.closeLoop ? pts[i === 0 ? n - 1 : i - 1] : pts[i - 1];
            const b = pts[i];
            const ax = a.x + this.x;
            const ay = a.y + this.y;
            const bx = b.x + this.x;
            const by = b.y + this.y;
            const closest = closestPointOnSegment(ball.pos.x, ball.pos.y, ax, ay, bx, by);
            const dx = ball.pos.x - closest.x;
            const dy = ball.pos.y - closest.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (!best || dist < best.dist) {
                best = { closest, dist, dx, dy, ax, ay, bx, by };
            }
        }
        if (!best) return null;

        const inside = this.pointInPolygon(ball.pos.x, ball.pos.y);
        if (!inside && best.dist >= ball.radius) return null;

        var nx;
        var ny;
        if (best.dist > 1e-8) {
            nx = best.dx / best.dist;
            ny = best.dy / best.dist;
        } else {
            nx = -(best.by - best.ay);
            ny = best.bx - best.ax;
            const len = Math.sqrt(nx * nx + ny * ny) || 1;
            nx /= len;
            ny /= len;
            if (nx * (best.closest.x - this.x) + ny * (best.closest.y - this.y) < 0) {
                nx = -nx;
                ny = -ny;
            }
        }

        // Center is inside: vector to closest edge points inward; push the other way.
        if (inside) {
            nx = -nx;
            ny = -ny;
        }

        const penetration = inside ? (ball.radius + best.dist) : (ball.radius - best.dist);
        if (penetration <= 0) return null;
        return { nx, ny, penetration, px: best.closest.x, py: best.closest.y };
    }

    influenceBall(ball) {
        const dx0 = ball.pos.x - this.x;
        const dy0 = ball.pos.y - this.y;
        const maxDist = this.radius + ball.radius;
        if (dx0 * dx0 + dy0 * dy0 > maxDist * maxDist) return;

        var hit = false;
        for (let iter = 0; iter < 4; iter++) {
            const contact = this.nearestBallContact(ball);
            if (!contact) break;
            hit = true;
            const slop = 0.02;
            ball.pos.x += contact.nx * (contact.penetration + slop);
            ball.pos.y += contact.ny * (contact.penetration + slop);

            const vn = ball.vel.x * contact.nx + ball.vel.y * contact.ny;
            if (vn < 0) {
                ball.vel.x = (ball.vel.x - 2 * contact.nx * vn) * this.friction;
                ball.vel.y = (ball.vel.y - 2 * contact.ny * vn) * this.friction;
            }
        }

        if (hit) {
            ball.lastContact = new Date();
            if (this.contactPoints) {
                const now = ball.lastContact.getTime();
                if (now - this.lastContactTime.getTime() > 80) {
                    scoreBoard.addScore(this.contactPoints);
                    this.lastContactTime = ball.lastContact;
                }
            }
        }
    }
}

class Flipper extends PolyObject {
    constructor(x, y, localVerts, restAngle, activeAngle) {
        super(x, y, [{x: 0, y: 0}, {x: 0.2, y: 0.2}], 0, true);
        this.localVerts = localVerts.map(function (p) { return { x: p.x, y: p.y }; });
        this.restAngle = restAngle;
        this.activeAngle = activeAngle;
        this.angle = restAngle;
        this.omega = 0;
        this.closeLoop = true;
        this.contactPoints = 0;
        this.friction = 0.45;
        this.upAccel = 340;
        this.downAccel = 240;
        this.maxOmega = 30;
        this.applyAngle();
    }

    applyAngle() {
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        this.polyIndicies = this.localVerts.map(function (p) {
            return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
        });
        var maxDist = 0;
        for (let i = 0; i < this.polyIndicies.length; i++) {
            const p = this.polyIndicies[i];
            const dist = Math.sqrt(p.x * p.x + p.y * p.y);
            if (dist > maxDist) maxDist = dist;
        }
        this.radius = maxDist;
    }

    step(pressed, dt) {
        const target = pressed ? this.activeAngle : this.restAngle;
        const delta = target - this.angle;
        if (Math.abs(delta) < 0.002 && Math.abs(this.omega) < 0.35) {
            this.angle = target;
            this.omega = 0;
            this.applyAngle();
            return;
        }
        const dir = delta > 0 ? 1 : -1;
        const accel = pressed ? this.upAccel : this.downAccel;
        this.omega += dir * accel * dt;
        if (this.omega > this.maxOmega) this.omega = this.maxOmega;
        if (this.omega < -this.maxOmega) this.omega = -this.maxOmega;
        this.angle += this.omega * dt;
        if ((dir > 0 && this.angle >= target) || (dir < 0 && this.angle <= target)) {
            this.angle = target;
            this.omega = 0;
        }
        this.applyAngle();
    }

    influenceBall(ball) {
        const dx0 = ball.pos.x - this.x;
        const dy0 = ball.pos.y - this.y;
        const maxDist = this.radius + ball.radius;
        if (dx0 * dx0 + dy0 * dy0 > maxDist * maxDist) return;

        for (let iter = 0; iter < 4; iter++) {
            const contact = this.nearestBallContact(ball);
            if (!contact) break;
            const slop = 0.02;
            ball.pos.x += contact.nx * (contact.penetration + slop);
            ball.pos.y += contact.ny * (contact.penetration + slop);

            const rx = contact.px - this.x;
            const ry = contact.py - this.y;
            const fvx = -this.omega * ry;
            const fvy = this.omega * rx;
            const relVx = ball.vel.x - fvx;
            const relVy = ball.vel.y - fvy;
            const vn = relVx * contact.nx + relVy * contact.ny;
            if (vn < 0) {
                const e = 0.35;
                const j = -(1 + e) * vn;
                ball.vel.x = fvx + relVx + j * contact.nx;
                ball.vel.y = fvy + relVy + j * contact.ny;
            }
            ball.lastContact = new Date();
        }
    }

    draw(c, ball) {
        const pts = this.polyIndicies;
        if (!pts.length) return;
        c.beginPath();
        c.moveTo(cX({ x: pts[pts.length - 1].x + this.x }), cY({ y: pts[pts.length - 1].y + this.y }));
        for (let i = 0; i < pts.length; i++) {
            c.lineTo(cX({ x: pts[i].x + this.x }), cY({ y: pts[i].y + this.y }));
        }
        c.closePath();
        c.lineWidth = 2;
        c.strokeStyle = "#6FDF8F";
        c.stroke();
    }
}

class Scoreboard {
    constructor(x, y, digits) {
        this.x = x;
        this.y = y;
        this.digitSpacing = 2;
        this.score = 0;
        this.zero = [{x: 0, y: 0}, {x: 0.5, y: 0}, {x: 0.5, y: -1}, {x: 0, y: -1}, {x: 0, y: 0}];
        this.one = [{x: 0.5, y: 0}, {x: 0.5, y: -1}];
        this.two = [{x: 0, y: 0}, {x: 0.5, y: 0}, {x: 0.5, y: -0.5}, {x: 0, y: -0.5}, {x: 0, y: -1}, {x: 0.5, y: -1}];
        this.three = [{x: 0, y: 0}, {x: 0.5, y: 0},{x: 0.5, y: -0.5}, {x: 0, y: -0.5}, {x: 0.5, y: -0.5}, {x: 0.5, y: -1}, {x: 0, y: -1}];
        this.four = [{x: 0, y: 0}, {x: 0, y: -0.5},{x: 0.5, y: -0.5}, {x: 0.5, y: 0}, {x: 0.5, y: -1}];
        this.five = [{x: 0.5, y: 0}, {x: 0, y: 0}, {x: 0, y: -0.5}, {x: 0.5, y: -0.5}, {x: 0.5, y: -1}, {x: 0, y: -1}];
        this.six = [{x: 0, y: 0}, {x: 0, y: -1}, {x: 0.5, y: -1}, {x: 0.5, y: -0.5}, {x: 0, y: -0.5}];
        this.seven = [{x: 0, y: 0}, {x: 0.5, y: 0}, {x: 0.5, y: -1}];
        this.eight = [{x: 0, y: 0}, {x: 0.5, y: 0}, {x: 0.5, y: -1}, {x: 0, y: -1}, {x: 0, y: 0}, {x: 0, y: -0.5}, {x: 0.5, y: -0.5}];
        this.nine = [{x: 0.5, y: 0},{x: 0, y: 0}, {x: 0, y: -0.5},{x: 0.5, y: -0.5},{x: 0.5, y: 0},{x: 0.5, y: -1}];
        this.digits = [this.zero, this.one, this.two, this.three, this.four, this.five, this.six, this.seven, this.eight, this.nine];
        this.digitCount = digits;
        this.setScore(0);
    }

    addScore(score) {
        this.setScore(this.score + score);
    }

    setScore(score) {
        const prevScore = this.score || 0;
        this.score = Math.round(score);
        if (typeof ballsLeft !== "undefined" && this.score > prevScore) {
            const gained = Math.floor(this.score / EXTRA_BALL_EVERY) - Math.floor(prevScore / EXTRA_BALL_EVERY);
            if (gained > 0) ballsLeft += gained;
        }
        //console.log(`Set score to: ${this.score}`);
        var workingScore = this.score;
        this.objects = [];
        for (var i=0;i<this.digitCount;i++) {
            const digit = workingScore % 10;
            workingScore = Math.floor(workingScore / 10);
            //console.log(`got digit: ${digit}`);
            const digitIndicies = this.digits[digit];
            this.objects.push(new PolyObject(this.x + (this.digitCount - i)*this.digitSpacing, this.y, digitIndicies, 0, false));
        }
        if (typeof considerHighScore === "function") considerHighScore(this.score);
        if (typeof savePinballProgress === "function") savePinballProgress();
        //console.log(this.objects);
    }

    draw(canvas, ball) {
        this.objects.forEach((digit) => digit.draw(canvas, ball));
    }

    influenceBall(ball) {
        this.objects.forEach((digit) => digit.influenceBall(ball));
    }
}

class RectangleObject {
    constructor(x, y, height, width) {
        this.x = x;
        this.y = y;
        this.height = height;
        this.width = width;
        this.radius = sqrt(height*height/2 + width*width/2);
        this.surfaceType = "bounce";
        this.friction = 0.75;
        this.lastContactTime = new Date(0, 0, 0);
        this.color = "#0000FF";
    }

    /**
     * Draws the shape
     */
    draw(canvas) {
        canvas.strokeStyle = "#FFFFFF";
        canvas.strokeRect(x-width/2, y-height/2, x+width/2, y+height/2);
    }

    influenceBall(ball) {
        const ballDist = sqrt((x - ball.pos.x)^2 + (y - ball.pos.y) ^ 2);
        if ((ballDist-ball.radius) > this.radius) return;

        const distX = abs(x - ball.pos.x);
        const distY = abs(y - ball.pos.y);

        const boxTopMin = y - height/2 - ball.radius;
        const boxBottomMax = y + height/2 + ball.radius;
        const boxLeftMin = x - width/2 - ball.radius;
        const boxRightMin = x + width/2 + ball.radius;

        if ((ball.pos.y > boxTopMin) && (ball.pos.y < boxBottomMax)) {

        }

        if ((ball.pos.y > boxTopLeftMin) && (ball.pos.y < boxBottomLeftMax)) {

        }

        if ((distX < width/2) && (distY < height/2)) {
            
        }
    }
}

class PointObject {
    constructor(x, y, radius, contactPoints = 0) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.contactPoints = contactPoints;
        this.surfaceType = "bounce";
        this.friction = 0.75;
        this.lastContactTime = new Date(0, 0, 0);
        this.color = "#0000FF";
        this.bounceStrength = 1.4;
    }

    draw(c, ball) {
        var radiusScaler = 1.0;
        if ((this.bounceStrength > 1.0) && ((new Date() - this.lastContactTime) < 200)) {
            c.strokeStyle = "#FF0000";
            c.fillStyle = "#FF0000";
            radiusScaler = 1.1;
        } else {
            c.strokeStyle = "#8F8F8F";
            c.fillStyle = "#8F8F8F";
        }
        c.beginPath();
        c.arc(cX(this), cY(this), cScale * this.radius * radiusScaler, 0.0, 2.0 * Math.PI);
        c.closePath();
        c.fill();
    }

    influenceBall(ball) {
        const dist = Math.sqrt(Math.pow(this.x - ball.pos.x, 2) + Math.pow(this.y - ball.pos.y, 2));
        if ((ball.radius + this.radius) >= dist) {
            
            const xa = this.x;
            const ya = this.y;
            const x2 = ball.pos.x - ball.vel.x * timeStep;
            const y2 = ball.pos.y - ball.vel.y * timeStep;
            const m=(ball.pos.y - y2) / (ball.pos.x - x2);
            const b=y2-m*x2;
            const di = ball.radius + this.radius;
            const yab = ya - b;
            
            //quadratic
            const qa = (m*m) + 1;
            const qb = -2*(xa + yab*m);
            const qc = (xa*xa) + (yab*yab) - (di*di);
            const quadC = Math.sqrt((qb*qb) - 4*qa*qc);
            const solX1 = (-qb + quadC)/(2*qa);
            const solX2 = (-qb - quadC)/(2*qa);
            
            var collisionX = solX1;
            var collisionY = m*collisionX + b;
            if ((((collisionX < x2) && (collisionX < ball.pos.x)) || ((collisionX > x2) && (collisionX > ball.pos.x))) ||
                (((collisionY < y2) && (collisionY < ball.pos.y)) || ((collisionY > y2) && (collisionY > ball.pos.y)))) {
                collisionX = solX2;
                collisionY = m*collisionX + b;

                if ((((collisionX < x2) && (collisionX < ball.pos.x)) || ((collisionX > x2) && (collisionX > ball.pos.x))) ||
                    (((collisionY < y2) && (collisionY < ball.pos.y)) || ((collisionY > y2) && (collisionY > ball.pos.y))))  {
                        console.log(`Error with collision, couldn't tell where it occurred.`);
                        console.log(`Collision at: (${collisionX}, ${collisionY})`);
                        console.log(`When ball at: (${ball.pos.x}, ${ball.pos.y})`);
                        console.log(`When ball was: (${x2}, ${y2})`);                        
                    return;
                }
            }

            this.lastContactTime = new Date();

            ball.pos.x = collisionX;
            ball.pos.y = collisionY;
            
            const radiusRatio = ball.radius / (ball.radius + this.radius);
            const impactX = collisionX + (this.x - collisionX) * radiusRatio;
            const impactY = collisionY + (this.y - collisionY) * radiusRatio;
            var impactNormX = impactX - collisionX;
            var impactNormY = impactY - collisionY;
            const impactVecLen = Math.sqrt(impactNormX*impactNormX + impactNormY*impactNormY);
            impactNormX = impactNormX / impactVecLen;
            impactNormY = impactNormY / impactVecLen;
            const dot = impactNormX * ball.vel.x + impactNormY * ball.vel.y;
            ball.vel.x = (ball.vel.x - 2 * impactNormX * dot) * this.bounceStrength;
            ball.vel.y = (ball.vel.y - 2 * impactNormY * dot) * this.bounceStrength;
            scoreBoard.setScore(scoreBoard.score + this.contactPoints);

            if (!isNaN(collisionX))
                holdCycles = 0;

            /*console.log(`ac: ${qc}`);
            console.log(`m: ${m}, b: ${b}`);
            console.log(`Xa: ${xa}, Ya: ${ya}, Di: ${di}`);
            console.log(`qa: ${Math.round(qa)}, qb: ${Math.round(qb)}, qc: ${Math.round(qc)}`);
            console.log(`Collision x: ${collisionX}, y: ${collisionY}`);
            console.log(`Impact norm: (${impactNormX}, ${impactNormY})`);
            console.log(`b2 - 4ac: (${qb*qb}) - 4(${qa}*${qc}) = ${qb*qb - 4*qa*qc}`);
*/

            if (isNaN(collisionX)) return; //exit(1);

            //collisions.push(new Collision(ball.pos.x, ball.pos.y, "#FF00FF"));
            
            //if (!isNaN(collisionX)) {
                //collisions.push(new Collision(collisionX, collisionY, "#0000FF"));
                //collisions.push(new Collision(impactX, impactY, "#FFDFFF"));
            //}
            while (collisions.length > 2500) {
                collisions.shift();
            }
        }  
    }
}

class ArcObject {
    constructor(x, y, radius, startRadians, endRadians, friction) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.radiusY = radius;
        this.startRadians = startRadians;
        this.endRadians = endRadians;
        this.surfaceType = "bounce";
        this.friction = friction ?? 0.75;
        this.lastContactTime = new Date(0, 0, 0);
        this.color = "#0000FF";
        this.bounceStrength = 1.0;
    }

    draw(c, ball) {
        const rx = cScale * this.radius;
        const ry = cScale * (this.radiusY ?? this.radius);
        c.strokeStyle = "#8F8F8F";
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(cX(this), cY(this), rx, ry, 0, Math.PI*2 - this.endRadians, Math.PI*2 - this.startRadians, false);
        c.stroke();
    }

    relativePosInRadians(x, y) {
        var posRads = Math.atan2(y - this.y, x - this.x);
        if (posRads < 0) posRads += Math.PI * 2;
        return posRads;
    }

    angleInArc(angle) {
        const pad = 0.05;
        const start = this.startRadians - pad;
        const end = this.endRadians + pad;
        if (end >= start) return angle >= start && angle <= end;
        return angle >= start || angle <= end;
    }

    influenceBall(ball) {
        const dx = ball.pos.x - this.x;
        const dy = ball.pos.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1e-8) return;
        if (!this.angleInArc(this.relativePosInRadians(ball.pos.x, ball.pos.y))) return;

        const rx = this.radius;
        const ry = this.radiusY ?? this.radius;
        const nx = dx / dist;
        const ny = dy / dist;
        const ellipseR = 1 / Math.sqrt((nx * nx) / (rx * rx) + (ny * ny) / (ry * ry));
        const innerLimit = ellipseR - ball.radius;
        if (dist < innerLimit) return;

        const penetration = dist - innerLimit;
        const slop = 0.02;
        // Playfield is inside the arc: push back toward the center.
        ball.pos.x -= nx * (penetration + slop);
        ball.pos.y -= ny * (penetration + slop);

        const nPushX = -nx;
        const nPushY = -ny;
        const vn = ball.vel.x * nPushX + ball.vel.y * nPushY;
        if (vn < 0) {
            const damp = this.bounceStrength * (this.friction || 1);
            ball.vel.x = (ball.vel.x - 2 * nPushX * vn) * damp;
            ball.vel.y = (ball.vel.y - 2 * nPushY * vn) * damp;
        }
        ball.lastContact = new Date();
    }
}

class LaunchDoor {
    constructor() {
        this.open = 0;
        this.friction = 0.62;
        this.tipX = TABLE_WIDTH - 0.18;
        this.rise = 1.05;
        this.openSwing = 1.35;
        this.arcGap = 0.1;
    }

    hinge() {
        return { x: LAUNCH_LANE_X, y: launchWallTopY() };
    }

    closedTip() {
        const h = this.hinge();
        const dx = this.tipX - h.x;
        const dy = this.rise;
        const dirLen = Math.sqrt(dx * dx + dy * dy) || 1;
        const cx = (typeof topArch !== "undefined" && topArch) ? topArch.x : 10;
        const cy = (typeof topArch !== "undefined" && topArch) ? topArch.y : 11.5;
        const rx = (typeof topArch !== "undefined" && topArch) ? topArch.radius : 10;
        const ry = (typeof topArch !== "undefined" && topArch) ? (topArch.radiusY || topArch.radius) : 10;
        const ox = (h.x - cx) / rx;
        const oy = (h.y - cy) / ry;
        const vx = dx / rx;
        const vy = dy / ry;
        const qa = vx * vx + vy * vy;
        const qb = 2 * (ox * vx + oy * vy);
        const qc = ox * ox + oy * oy - 1;
        const disc = qb * qb - 4 * qa * qc;
        var t = 0.55;
        if (qa > 1e-12 && disc >= 0) {
            const root = Math.sqrt(disc);
            const t1 = (-qb - root) / (2 * qa);
            const t2 = (-qb + root) / (2 * qa);
            t = [t1, t2].reduce(function (best, v) {
                if (v > 1e-4 && v < best) return v;
                return best;
            }, 1e9);
            if (t > 1e8) t = 0.55;
        }
        const travel = Math.max(0.2, t - this.arcGap / dirLen);
        return { x: h.x + dx * travel, y: h.y + dy * travel };
    }

    flapTip() {
        const h = this.hinge();
        const tip = this.closedTip();
        const dx = tip.x - h.x;
        const dy = tip.y - h.y;
        const closedAngle = Math.atan2(dy, dx);
        const angle = closedAngle + this.openSwing * this.open;
        const len = Math.sqrt(dx * dx + dy * dy);
        return { x: h.x + Math.cos(angle) * len, y: h.y + Math.sin(angle) * len };
    }

    isLaunchingThrough(ball) {
        return ball.pos.x > LAUNCH_LANE_X && ball.vel.y > 0.8;
    }

    step(dt) {
        const h = this.hinge();
        const launching = this.isLaunchingThrough(ball)
            && ball.pos.y > h.y - 4 && ball.pos.y < h.y + 3;
        const target = launching ? 1 : 0;
        const k = launching ? 18 : 10;
        this.open += (target - this.open) * Math.min(1, dt * k);
        if (this.open < 0.01) this.open = 0;
        if (this.open > 0.99) this.open = 1;
    }

    draw(c, ball) {
        const h = this.hinge();
        const tip = this.flapTip();
        c.lineWidth = 2;
        c.strokeStyle = "#6FDF8F";
        c.beginPath();
        c.moveTo(cX({ x: h.x }), cY({ y: h.y }));
        c.lineTo(cX({ x: tip.x }), cY({ y: tip.y }));
        c.stroke();
    }

    influenceBall(ball) {
        if (this.isLaunchingThrough(ball)) return;

        const h = this.hinge();
        const tip = this.closedTip();
        const ax = h.x;
        const ay = h.y;
        const bx = tip.x;
        const by = tip.y;
        const closest = closestPointOnSegment(ball.pos.x, ball.pos.y, ax, ay, bx, by);
        const dx = ball.pos.x - closest.x;
        const dy = ball.pos.y - closest.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= ball.radius) return;

        var nx = -(by - ay);
        var ny = bx - ax;
        var nlen = Math.sqrt(nx * nx + ny * ny) || 1;
        nx /= nlen;
        ny /= nlen;
        if (ny < 0) {
            nx = -nx;
            ny = -ny;
        }

        // Solid from above only; a ball still under the flap can pass.
        const fromA = (ball.pos.x - ax) * nx + (ball.pos.y - ay) * ny;
        if (fromA < 0) return;

        const slop = 0.02;
        const penetration = ball.radius - dist;
        ball.pos.x += nx * (penetration + slop);
        ball.pos.y += ny * (penetration + slop);

        const vn = ball.vel.x * nx + ball.vel.y * ny;
        if (vn < 0) {
            ball.vel.x = (ball.vel.x - 2 * nx * vn) * this.friction;
            ball.vel.y = (ball.vel.y - 2 * ny * vn) * this.friction;
            ball.vel.x -= 0.9;
            if (ball.vel.x > -1) ball.vel.x = -1.4;
        }
        ball.lastContact = new Date();
    }
}

class Collision {
    constructor(x, y, color="#FF0000") {
        this.x = x;
        this.y = y;
        this.color = color;
    }

    draw(canvas) {
        canvas.strokeStyle = this.color;
        canvas.fillStyle = this.color;
        canvas.beginPath();
        canvas.arc(cX(this), cY(this), cScale * 0.1, 0.0, 2.0 * Math.PI);
        canvas.closePath();
        canvas.fill();
    }
}

function resizeCanvas() {
    var cssW = pinballCanvas.clientWidth || window.innerWidth;
    var cssH = pinballCanvas.clientHeight || window.innerHeight;
    cssW = Math.max(2, Math.floor(cssW));
    cssH = Math.max(2, Math.floor(cssH));

    // Backing store must match the visible CSS box, or the table
    // is drawn in bitmap space and appears stuck to the left.
    pinballCanvas.width = cssW;
    pinballCanvas.height = cssH;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cssW, cssH);
    updateScale();
}

function updateScale() {
    var menu = document.getElementById("inGameMenu");
    var menuH = (menu && !menu.hidden) ? menu.offsetHeight : 0;
    var availW = pinballCanvas.width;
    var availH = Math.max(2, pinballCanvas.height - menuH);

    sidePanelW = 0;
    cScale = Math.min(availW / TABLE_WIDTH, availH / TABLE_HEIGHT);
    simWidth = TABLE_WIDTH;
    simHeight = TABLE_HEIGHT;

    tableOriginX = (availW - TABLE_WIDTH * cScale) / 2;
    tableOriginY = menuH;
    sidePanelX = tableOriginX + TABLE_WIDTH * cScale + 16;

    if (typeof topArch !== "undefined" && topArch && cScale > 0) {
        topArch.radiusY = Math.max(topArch.radius, TABLE_HEIGHT - topArch.y);
    }
    if (typeof launchLaneWall !== "undefined" && launchLaneWall && cScale > 0) {
        setOpenSegment(
            launchLaneWall,
            LAUNCH_LANE_X,
            LAUNCH_WALL_BOTTOM,
            LAUNCH_LANE_X,
            launchWallTopY()
        );
    }
}

function cX(pos) {
    return tableOriginX + pos.x * cScale;
}

function cY(pos) {
    return tableOriginY + (TABLE_HEIGHT - pos.y) * cScale;
}

function drawDeathStar() {
    const cx = cX({ x: 10 });
    const cy = cY({ y: 12.2 });
    const r = cScale * 3.4;
    c.save();
    c.globalAlpha = 0.32;
    const g = c.createRadialGradient(cx - r * 0.25, cy - r * 0.2, r * 0.15, cx, cy, r);
    g.addColorStop(0, "#d8d8d8");
    g.addColorStop(0.7, "#6d6d6d");
    g.addColorStop(1, "#222");
    c.fillStyle = g;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#999";
    c.lineWidth = 1;
    c.beginPath();
    c.arc(cx - r * 0.28, cy - r * 0.32, r * 0.22, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.moveTo(cx - r, cy + r * 0.12);
    c.lineTo(cx + r, cy + r * 0.12);
    c.stroke();
    c.restore();
}

function drawHighScorePanel() {
    const pw = Math.min(sidePanelW, pinballCanvas.width - sidePanelX - 10);
    if (pw < 90) return;
    const px = sidePanelX;
    const py = tableOriginY + 16;
    const ph = Math.min(280, pinballCanvas.height - py - 16);
    c.fillStyle = "rgba(6, 6, 10, 0.82)";
    c.fillRect(px, py, pw, ph);
    c.strokeStyle = "#ffe81f";
    c.lineWidth = 2;
    c.strokeRect(px + 1, py + 1, pw - 2, ph - 2);
    c.textAlign = "center";
    c.fillStyle = "#ffe81f";
    c.font = "bold 20px Impact, 'Arial Black', sans-serif";
    c.fillText("STAR WARS", px + pw / 2, py + 36);
    c.font = "13px sans-serif";
    c.fillText("PINBALL", px + pw / 2, py + 56);
    c.font = "12px sans-serif";
    c.fillStyle = "#c9a227";
    c.fillText("HIGH SCORE", px + pw / 2, py + 96);
    c.fillStyle = "#ffe81f";
    c.font = "bold 26px monospace";
    c.fillText(String(highScore).padStart(6, "0"), px + pw / 2, py + 128);
    c.fillStyle = "#c9a227";
    c.font = "12px sans-serif";
    c.fillText("SCORE", px + pw / 2, py + 168);
    c.fillStyle = "#ffe81f";
    c.font = "bold 22px monospace";
    const current = (typeof scoreBoard !== "undefined" && scoreBoard) ? scoreBoard.score : 0;
    c.fillText(String(current).padStart(6, "0"), px + pw / 2, py + 196);
    c.fillStyle = "#9aa3ad";
    c.font = "11px sans-serif";
    c.fillText("MAY THE FORCE", px + pw / 2, py + 236);
    c.fillText("BE WITH YOU", px + pw / 2, py + 252);
}

function draw() {
    c.clearRect(0, 0, pinballCanvas.width, pinballCanvas.height);
    const tableW = TABLE_WIDTH * cScale;
    const tableH = TABLE_HEIGHT * cScale;
    c.strokeStyle = "#FFFFFF";
    c.lineWidth = 2;
    c.strokeRect(tableOriginX + 1, tableOriginY + 1, tableW - 2, tableH - 2);

    objects.forEach((obj) => obj.draw(c, ball));

    c.strokeStyle = "#8F8F8F";
    c.fillStyle = "#FFFFFF";
    if (new Date().getTime() - ball.lastContact.getTime() < 200) c.fillStyle = "#800000";
    c.beginPath();
    c.arc(cX(ball.pos), cY(ball.pos), cScale * ball.radius, 0.0, 2.0 * Math.PI);
    c.closePath();
    c.fill();

    c.fillStyle = "#FFFFFF";
    c.font = "16px serif";
    c.textAlign = "left";
    c.fillText("BALLS", cX({ x: 0.55 }), cY({ y: 0.85 }));
    for (let i = 0; i < ballsLeft; i++) {
        const ix = cX({ x: 2.6 + i * 0.7 });
        const iy = cY({ y: 0.7 });
        c.fillStyle = "#FFFFFF";
        c.beginPath();
        c.arc(ix, iy, cScale * 0.22, 0, Math.PI * 2);
        c.fill();
    }
}

function updatepx() {
    if (px.value != "" && px.value != "-") {
        gravity.x = px.value;
    }
}

function updatepy() {
    if (py.value != "" && py.value != "-") {
        gravity.y = py.value;
    }
}

function rpx() {
    gravity.x = 0;
    px.value = 0;
}

function rpy() {
    gravity.y = -10;
    py.value = -10;
}

function rotatePoint(xy, radians) {
    const cosTheta = Math.cos(radians);
    const sinTheta = Math.sin(radians);
    const x = xy.x*cosTheta - xy.y*sinTheta;
    const y = xy.y*cosTheta + xy.x*sinTheta;
    return {x:x, y:y};
}

function rotateIndiciesInPlace(indicies, radians) {
    const cosTheta = Math.cos(radians);
    const sinTheta = Math.sin(radians);
    for (let i=0;i<indicies.length;i++) {
        const x = indicies[i].x*cosTheta - indicies[i].y*sinTheta;
        const y = indicies[i].y*cosTheta + indicies[i].x*sinTheta;
        indicies[i] = {x: x, y: y};
    }
}

function mirrorIndiciesInPlace(indicies, yAxis = true) {
    for (let i=0;i<indicies.length;i++) {
        indicies[i] = {x: (yAxis ? indicies[i].x : -indicies[i].x), y: (yAxis ? -indicies[i].y : indicies[i].y)}
    }
}

function clampBallSpeed() {
    var speed = Math.sqrt(ball.vel.x * ball.vel.x + ball.vel.y * ball.vel.y);
    if (speed > MAX_BALL_SPEED) {
        var scale = MAX_BALL_SPEED / speed;
        ball.vel.x *= scale;
        ball.vel.y *= scale;
    }
}

function considerHighScore(score) {
    if (score > highScore) {
        highScore = score;
        try { localStorage.setItem(HIGH_SCORE_KEY, String(highScore)); } catch (e) {}
    }
}

function savePinballProgress() {
    if (!pinballProgressReady) return;
    try {
        localStorage.setItem(PINBALL_PROGRESS_KEY, JSON.stringify({
            score: (typeof scoreBoard !== "undefined" && scoreBoard) ? scoreBoard.score : 0,
            ballsLeft: ballsLeft
        }));
    } catch (e) {}
}

function restorePinballProgress() {
    var data = null;
    try {
        var raw = localStorage.getItem(PINBALL_PROGRESS_KEY);
        data = raw ? JSON.parse(raw) : null;
    } catch (e) {
        data = null;
    }
    if (!data || typeof data !== "object") return;
    var savedScore = Number(data.score) || 0;
    var savedBalls = Number(data.ballsLeft);
    if (typeof scoreBoard !== "undefined" && scoreBoard) scoreBoard.setScore(savedScore);
    if (!isNaN(savedBalls) && savedBalls > 0) ballsLeft = savedBalls;
}

function serveBall() {
    ball.pos = { x: 19.25, y: 1.0 };
    ball.vel = { x: 0.0, y: 0.0 };
}

function resetGame() {
    ballsLeft = STARTING_BALLS;
    if (typeof scoreBoard !== "undefined" && scoreBoard) scoreBoard.setScore(0);
    serveBall();
    savePinballProgress();
}

function loseBall() {
    ballsLeft -= 1;
    if (ballsLeft <= 0) {
        resetGame();
        return;
    }
    serveBall();
    savePinballProgress();
}

function launchWallTopY() {
    if (cScale > 0) return LAUNCH_WALL_TOP - LAUNCH_WALL_SHORTEN_PX / cScale;
    return LAUNCH_WALL_TOP;
}

function plungeBall() {
    // Instant plunger: enough speed to clear the lane, then a random extra kick.
    var rise = Math.max(1, launchWallTopY() + 4 - ball.pos.y);
    var exitVy = Math.sqrt(-2 * gravity.y * rise);
    ball.vel.y = exitVy + 3 + Math.random() * 8;
    ball.vel.x = (Math.random() - 0.5) * 0.5;
    clampBallSpeed();
}

function simulate() {
    ball.vel.x += gravity.x * timeStep;
    ball.vel.y += gravity.y * timeStep;
    clampBallSpeed();

    ball.pos.x += ball.vel.x * timeStep;
    ball.pos.y += ball.vel.y * timeStep;

    if (ball.pos.x - ball.radius < 0.0) {
        ball.pos.x = ball.radius;
        ball.vel.x = -ball.vel.x;
        ball.vel.x *= friction;
        ball.vel.y *= friction;
    }
    if (ball.pos.x + ball.radius > simWidth) {
        ball.pos.x = simWidth - ball.radius;
        ball.vel.x = -ball.vel.x;
        ball.vel.x *= friction;
        ball.vel.y *= friction;
    }
    if (ball.pos.y + ball.radius > simHeight) {
        ball.pos.y = simHeight - ball.radius;
        ball.vel.y = -ball.vel.y;
        ball.vel.x *= friction;
        ball.vel.y *= friction;
    }
    // Plunger lane has a floor; the main table resets only at the canvas bottom.
    if (ball.pos.x > LAUNCH_LANE_X) {
        if (ball.pos.y - ball.radius < 0.0) {
            ball.pos.y = ball.radius;
            ball.vel.y = -ball.vel.y * friction;
            ball.vel.x *= friction;
        }
    } else if (cY({ y: ball.pos.y - ball.radius }) >= pinballCanvas.height) {
        loseBall();
        return;
    }

    objects.forEach((obj) => obj.influenceBall(ball));
    clampBallSpeed();
}

var lastFlipperTime = performance.now();
var leftFlipperDown = false;
var rightFlipperDown = false;

function update() {
    if (typeof activeGame === "undefined" || activeGame === "pinballGame") {
        var now = performance.now();
        var dt = Math.min(0.05, (now - lastFlipperTime) / 1000);
        lastFlipperTime = now;
        if (dt < 0.001) dt = timeStep;

        flipper.step(leftFlipperDown, dt);
        flipper2.step(rightFlipperDown, dt);
        if (typeof launchDoor !== "undefined" && launchDoor) launchDoor.step(dt);

        if (!holdCycles) {
            simulate();
        } else {
            holdCycles--;
        }
        draw();
        if (isNaN(ball.pos.x) || isNaN(ball.pos.y) || isNaN(ball.vel.x) || isNaN(ball.vel.y)) {
            serveBall();
        }
    } else {
        lastFlipperTime = performance.now();
    }

    requestAnimationFrame(update);
}

function setOpenSegment(obj, x0, y0, x1, y1) {
    obj.x = (x0 + x1) / 2;
    obj.y = (y0 + y1) / 2;
    obj.polyIndicies = [
        { x: x0 - obj.x, y: y0 - obj.y },
        { x: x1 - obj.x, y: y1 - obj.y }
    ];
    const dx = x1 - x0;
    const dy = y1 - y0;
    obj.radius = Math.sqrt(dx * dx + dy * dy) / 2;
}

function addWall(x0, y0, x1, y1, points) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const wall = new PolyObject(cx, cy, [{ x: x0, y: y0 }, { x: x1, y: y1 }], points || 0, false);
    objects.push(wall);
    return wall;
}

function addBumper(x, y, radius, points, color) {
    const bumper = new PointObject(x, y, radius, points);
    if (color) bumper.color = color;
    objects.push(bumper);
    return bumper;
}

function addTriangle(ax, ay, bx, by, cx, cy, points) {
    const px = (ax + bx + cx) / 3;
    const py = (ay + by + cy) / 3;
    objects.push(new PolyObject(px, py, [
        { x: ax, y: ay },
        { x: bx, y: by },
        { x: cx, y: cy }
    ], points || 10, true));
}

addBumper(10, 16.4, 0.6, 50);
addBumper(6.8, 13.4, 0.8, 25);
addBumper(13.2, 13.4, 0.8, 25);

var launchLaneWall = addWall(LAUNCH_LANE_X, LAUNCH_WALL_BOTTOM, LAUNCH_LANE_X, LAUNCH_WALL_TOP);
addWall(0.25, 7.4, 5.45, 3.55);
addWall(17.95, 7.4, 12.96, 3.55);
addTriangle(3.1, 7.3, 5.1, 7.2, 4.5, 5.7, 20);
addTriangle(15.2, 7.3, 13.2, 7.2, 13.8, 5.7, 20);

const flipperShape = [
    { x: 0.12, y: 0.32 },
    { x: 3.15, y: 0.20 },
    { x: 3.35, y: 0.0 },
    { x: 3.15, y: -0.20 },
    { x: 0.12, y: -0.32 }
];
const flipper = new Flipper(5.548, 3.2, flipperShape, -0.52, 0.62);
objects.push(flipper);
const flipper2 = new Flipper(12.862, 3.2, flipperShape, Math.PI + 0.52, Math.PI - 0.62);
objects.push(flipper2);

var topArch = new ArcObject(10, 11.5, 10, 0, Math.PI, 0.95);
objects.push(topArch);

var launchDoor = new LaunchDoor();
objects.push(launchDoor);

const scoreBoard = new Scoreboard(4, 18.4, 5);
objects.push(scoreBoard);
restorePinballProgress();
pinballProgressReady = true;
savePinballProgress();

window.addEventListener('resize', resizeCanvas);
if (window.ResizeObserver) {
    var pinballContainerEl = document.getElementById("pinballContainer");
    if (pinballContainerEl) {
        new ResizeObserver(function () {
            if (!pinballContainerEl.hidden) resizeCanvas();
        }).observe(pinballContainerEl);
    }
}
window.addEventListener("keydown", function (event) {
    var key = event.key.toLowerCase();
    if (key === "w") {
        if (event.repeat) return;
        if (ball.pos.x > LAUNCH_LANE_X && ball.pos.y < 3) {
            plungeBall();
        }
        return;
    }
    if (event.repeat) return;
    if (key === "s") leftFlipperDown = true;
    if (key === "k") rightFlipperDown = true;
});
window.addEventListener("keyup", function (event) {
    var key = event.key.toLowerCase();
    if (key === "s") leftFlipperDown = false;
    if (key === "k") rightFlipperDown = false;
});
resizeCanvas();
update();

