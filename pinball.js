var canvas = document.getElementById("pinballCanvas");
var c = canvas.getContext("2d");

var gravity = { x: 0.0, y: -5.0 }; 
var friction = 0.8; 
var holdCycles = 0;

var px = document.getElementById("physics-x");
var py = document.getElementById("physics-y");

var timeStep = 1.0 / 60.0;

var ball = { 
    radius: 0.5,
    pos: { x: 10, y: 15.0 },
    vel: { x: 40.0, y: 0.0 },
    lastContact: new Date(0, 0, 0),
};

var objects = [];
var collisions = [];

var simWidth, simHeight, cScale;

function isPosInPath(x, y, x0, y0, x1, y1) {
    if ((((x > x0) && (x > x1)) || ((x < x0) && (x < x1))) || (((y > y0) && (y > y1)) || ((y < y0) && (y < y1)))) return false;
    else return true;
}

function posWithAngleRadius(angleRad, radius, offset) {
    return { x: Math.cos(angleRad)*radius + offset?.x ?? 0, y: Math.sin(angleRad)*radius + offset?.y ?? 0 };
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
        c.lineWidth = 2;
        c.strokeStyle = "#6FDF8F";

        const ballDist = Math.sqrt(Math.pow(ball.pos.x - this.x, 2) + Math.pow(ball.pos.y - this.y, 2));
        if (ballDist < (this.radius + ball.radius))
            c.strokeStyle = "#3FFF5F";

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

    getIntersectionPoint(ball, segmentNo) {
        const pointI0 = this.polyIndicies[(segmentNo === 0 ? this.polyIndicies.length : segmentNo) - 1];
        const pointI1 = this.polyIndicies[segmentNo];
        const Xi0 = pointI0.x + this.x;
        const Yi0 = pointI0.y + this.y;
        const Xi1 = pointI1.x + this.x;
        const Yi1 = pointI1.y + this.y;
        if (Xi1 == Xi0) return undefined;
        const Mi = (Yi1 - Yi0) / (Xi1 - Xi0);
        const Bi = Yi0 - Mi*Xi0;

        const Xb0 = ball.pos.x - ball.vel.x*timeStep;
        const Yb0 = ball.pos.y - ball.vel.y*timeStep;
        const Xb1 = ball.pos.x;
        const Yb1 = ball.pos.y;
        if (Xb1 == Xb0) return undefined;
        const Mb = (Yb1 - Yb0) / (Xb1 - Xb0);
        const Bb = Yb0 - Mb*Xb0;

        //console.log(`Ball m:${Mb}, b:${Bb}, (${Xb0}, ${Yb0}) -> (${Xb1}, ${Yb1})`);
        //console.log(`Intercept m:${Mi}, b:${Bi}, (${Xi0}, ${Yi0}) -> (${Xi1}, ${Yi1})`);        

        const MbSqd = Math.pow(Mb, 2);
        const MiSqd = Math.pow(Mi, 2);
        const BbSqd = Math.pow(Bb, 2);
        const BiSqd = Math.pow(Bi, 2);
        const W = 1 + MiSqd;
        const J = BiSqd - Math.pow(ball.radius, 2);
        const A = W - 1 - 2*Mi*Mb - MiSqd*MbSqd + W*MbSqd;
        const B = -2*Bb*W + 2*Bb + 2*Mi*Bi*Mb - 2*W*Bi*MbSqd + 2*MiSqd*MbSqd*Bi + 2*Mi*Mb*Bb;
        const C = BbSqd*W - BbSqd - MbSqd*(MiSqd*BiSqd-W*J) - 2*Mi*Bi*Mb*Bb;

        //Quadratic for ball position
        const determ = Math.pow(B, 2) - (4 * A * C);
        if (determ < 0) {
            console.log('No hit');
            return undefined; //No solution.
        }
        const quad = Math.sqrt(determ);
        const y0 = (-B + quad) / (2 * A);
        const y1 = (-B - quad) / (2 * A);
        const x0 = (y0 - Bb) / Mb;
        const x1 = (y1 - Bb) / Mb;
        const ballPosAtIntercept = (Math.abs(Xb0 - x0) < Math.abs(Xb0 - x1)) || (Math.abs(Yb0 - y0) < Math.abs(Yb0 - y1)) ? {x: x0, y: y0} : {x: x1, y: y1};
        if (((ballPosAtIntercept.x < Xb0) && (ballPosAtIntercept.x < Xb1)) || ((ballPosAtIntercept.x > Xb0) && (ballPosAtIntercept.x > Xb1)) || 
            ((ballPosAtIntercept.y < Yb0) && (ballPosAtIntercept.y < Yb1)) || ((ballPosAtIntercept.y > Yb0) && (ballPosAtIntercept.y > Yb1)))
            return undefined;

        //Now check where it intercepted the segment
        const Ia = 1+MiSqd;
        const Ib = 2*(Mi*Bi-Mi*ballPosAtIntercept.y-ballPosAtIntercept.x);
        const Ic = Math.pow(ballPosAtIntercept.x, 2) + Math.pow(Bi - ballPosAtIntercept.y, 2) - Math.pow(ball.radius, 2);
        const determ2 = Math.pow(Ib, 2) - 4*Ia*Ic;
        if (Math.abs(4*Ia*Ic - Math.pow(Ib, 2)) > 0.00001) console.log(`Error in formula, b*b != 4ac...${Math.pow(Ib, 2)} != ${4*Ia*Ic}, dif: ${determ2}`);
        const interceptPointX = -Ib / (2*Ia);
        const interceptPointY = Mi*interceptPointX + Bi;
        if (((interceptPointX < Xi0) && (interceptPointX < Xi1)) || ((interceptPointX > Xi0) && (interceptPointX > Xi1)) || 
            ((interceptPointY < Yi0) && (interceptPointY < Yi1)) || ((interceptPointY > Yi0) && (interceptPointY > Yi1)))
            return undefined; //Intercept was out of bounds

        console.log(ballPosAtIntercept);    
        var impactNormY = ballPosAtIntercept.y - interceptPointY;
        var impactNormX = ballPosAtIntercept.x - interceptPointX;
        const impactVecLen = Math.sqrt(impactNormX*impactNormX + impactNormY*impactNormY);
        impactNormX = impactNormX / impactVecLen;
        impactNormY = impactNormY / impactVecLen;
        const distToIntercept = Math.sqrt(Math.pow(Xb0 - ballPosAtIntercept.x, 2) + Math.pow(Yb0 - ballPosAtIntercept.y, 2));

        return {ballPosAtIntercept, distToIntercept, interceptNormal: {x: impactNormX, y: impactNormY}, interceptPoint: {x:interceptPointX, y: interceptPointY}};
    }

    getEndPointCollision(ball, pointNo) {
        const point = this.polyIndicies[pointNo];
        const xa = point.x + this.x;
        const ya = point.y + this.y;
        const x2 = ball.pos.x - ball.vel.x * timeStep;
        const y2 = ball.pos.y - ball.vel.y * timeStep;
        const m=(ball.pos.y - y2) / (ball.pos.x - x2);
        const b=y2-m*x2;
        const di = ball.radius;
        const yab = ya - b;
        
        //quadratic
        const qa = (m*m) + 1;
        const qb = -2*(xa + yab*m);
        const qc = (xa*xa) + (yab*yab) - (di*di);
        const determ = (qb*qb) - 4*qa*qc;
        if (determ < 0) return undefined;
        const quadC = Math.sqrt(determ);
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
                return undefined;
            }
        }

        const impactX = xa;
        const impactY = ya;
        var impactNormX = impactX - collisionX;
        var impactNormY = impactY - collisionY;
        const impactVecLen = Math.sqrt(impactNormX*impactNormX + impactNormY*impactNormY);
        impactNormX = impactNormX / impactVecLen;
        impactNormY = impactNormY / impactVecLen;
        const distToIntercept = Math.sqrt(Math.pow(x2 - collisionX, 2) + Math.pow(y2 - collisionY, 2));

        return {ballPosAtIntercept: {x: collisionX, y: collisionY}, distToIntercept, interceptNormal: {x: impactNormX, y: impactNormY}, interceptPoint: {x:impactX, y: impactY}};
    }

    isBallPosInvalid(x, y, radius) {
        for (let i=0;i<this.polyIndicies.length;i++) {
            const point1 = this.polyIndicies[i];
            const x1 = point1.x + this.x;
            const y1 = point1.y + this.y;
            
            //Check for end point collision
            if (Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1)) <= radius) return false;

            //Check for line segment collision
            const i0 = (i == 0 ? this.polyIndicies.length - 1 : i-1);
            const point0 = this.polyIndicies[i0];
            const x0 = point0.x + this.x;
            const y0 = point0.y + this.y;

            const m = (y1 - y0) / (x1 - x0);
            const b = y1 - m*x1;

            const qa = 1 + Math.pow(m, 2);
            const qb = 2*(-m*y + m*b - x);
            const qc = Math.pow(x, 2) + Math.pow(b, 2) -2*b*y + Math.pow(y, 2) - Math.pow(radius, 2);

            const detSq = Math.pow(qb, 2) - 4*qa*qc;
            if (detSq > 0) { //Overlap somewhere...
                const det = Math.sqrt(detSq);

                const collisionX0 = (-qb + det)/(2*qa);
                const collisionX1 = (-qb - det)/(2*qa);

                if ((((collisionX0 < x1) && (collisionX0 < x0)) || ((collisionX0 > x1) && (collisionX0 > x0))) && 
                    (((collisionX1 < x1) && (collisionX1 < x0)) || ((collisionX1 > x1) && (collisionX1 > x0)))) continue;
                else return false; //There is a solution, so there's overlap
            }
        }
        return true;
    }

    influenceBall(ball) {
        const ballDist = Math.sqrt(Math.pow(ball.pos.x - this.x, 2) + Math.pow(ball.pos.y - this.y, 2));
        if (ballDist < (this.radius + ball.radius)) {
            //check for impact...
            var closestIntercept;
            for (let i=0;i<this.polyIndicies.length;i++) {
                var intercept = this.getIntersectionPoint(ball, i); 
                const endPointIntercept = this.getEndPointCollision(ball, i);  
                if ((endPointIntercept) && ((!intercept) || (intercept?.distToIntercept > endPointIntercept?.distToIntercept))) {
                  console.log('got end endpoint');//    intercept = endPointIntercept;       
                  console.log(endPointIntercept); 
                  intercept = endPointIntercept;
                }
                if (intercept) {
                    if ((!closestIntercept) || (intercept.distToIntercept < closestIntercept.distToIntercept)) {
                        closestIntercept = intercept;
                    }                    
                }
            }

            if (closestIntercept) {
                const impactNormX = closestIntercept.interceptNormal.x;
                const impactNormY = closestIntercept.interceptNormal.y;
                const dot = impactNormX * ball.vel.x + impactNormY * ball.vel.y;
                //console.log(intercept);
                ball.vel.y = (ball.vel.y - 2 * impactNormY * dot) * this.friction;
                //console.log(`Velocity y: ${ball.vel.y}, dot: ${dot}, impactNormY: ${impactNormY}`);
                if (ball.vel.y > 0 && ball.vel.y < 0.1) {
                    //Roll the ball
                    console.log(`Rolling the ball...${impactNormX}`);
                    ball.vel.x = (ball.vel.x - 2 * impactNormX * dot);
                    //ball.vel.x += impactNormX*10;
                } else {
                    ball.vel.x = (ball.vel.x - 2 * impactNormX * dot) * this.friction;
                    scoreBoard.addScore(this.contactPoints);
                }
                ball.pos = {x:closestIntercept.ballPosAtIntercept.x + ball.vel.x*timeStep*0.001, y:closestIntercept.ballPosAtIntercept.y + ball.vel.y*timeStep*0.001};

                var searchAttempts = 0;
                while (!this.isBallPosInvalid(ball.pos.x, ball.pos.y, ball.radius)) {
                    console.log("Ball position invalid, looking for closest valid position...");
                    const searchRadiusFidelity = 0.1;
                    const searchAngleFidelity = 2 * Math.PI / 4;
                    
                    const angle = searchAngleFidelity * searchAttempts;
                    const searchRadius = searchRadiusFidelity * searchAttempts;
                    const searchPos = posWithAngleRadius(angle, searchRadius, ball.pos);
                    ball.pos.x = searchPos.x;
                    ball.pos.y = searchPos.y;
                    searchAttempts++;
                }
                collisions.push(new Collision(closestIntercept.ballPosAtIntercept.x, closestIntercept.ballPosAtIntercept.y, "#FFDFFF"));
                collisions.push(new Collision(closestIntercept.interceptPoint.x, closestIntercept.interceptPoint.y, "#0FDF0F"));
                ball.lastContact = new Date();
                while (collisions.length > 200) {
                    collisions.shift();
                }  
            }

/*
                if (intercept) {
                    collisions.push(new Collision(intercept.x, intercept.y, "#FFDFFF"));
                    ball.lastContact = new Date();
                    while (collisions.length > 10) {
                        collisions.shift();
                    }  
                
            }
            */
        }
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
        this.score = Math.round(score);
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
        c.arc(cX(this), cY(this), cScale * this.radius*radiusScaler, 0.0, 2.0 * Math.PI);
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
        this.startRadians = startRadians;
        this.endRadians = endRadians;
        this.surfaceType = "bounce";
        this.friction = friction ?? 0.75;
        this.lastContactTime = new Date(0, 0, 0);
        this.color = "#0000FF";
        this.bounceStrength = 1.0;
    }

    draw(c, ball) {
        c.strokeStyle = "#8F8F8F";
        c.beginPath();
        c.arc(cX(this), cY(this), cScale * this.radius, Math.PI*2 - this.endRadians, Math.PI*2 - this.startRadians, false);
        //c.closePath();
        c.stroke();
    }

    relativePosInRadians(x, y) {
        const deltaX = x - this.x;
        const deltaY = y - this.y;
        var posRads = Math.atan(deltaY / deltaX);
        if (deltaX < 0) return Math.PI+posRads;
        if ((deltaY < 0) && (deltaX > 0)) return Math.PI*2+posRads;
        return posRads;
    }

    isBallPosInvalid(x, y, radius) {
        const dist = Math.sqrt(Math.pow(this.x - x, 2) + Math.pow(this.y - y, 2));
        console.log(`Distance: ${Math.abs(this.radius - dist)}, Radius: ${radius}`);
        if (Math.abs(this.radius - dist) > radius) return false;
        const posAngle = this.relativePosInRadians(x, y);
        if ((posAngle >= this.startRadians) && (posAngle <= this.endRadians)) return true;
        console.log("***Shouldn't really be here...***");
        return false;
    }

    influenceBall(ball) {
        const xa = this.x;
        const ya = this.y;
        const x1 = ball.pos.x;
        const y1 = ball.pos.y;
        const x2 = ball.pos.x - ball.vel.x * timeStep;
        const y2 = ball.pos.y - ball.vel.y * timeStep;
//        const distStart = Math.sqrt(Math.pow(xa - x2, 2) + Math.pow(ya - y2, 2));
//        const distEnd = Math.sqrt(Math.pow(xa - x1, 2) + Math.pow(ya - y1, 2));
//        const maxDistToCompare = this.radius + ball.radius;
//        const minDistToCompate = this.radius - ball.radius;

            
            const m=(ball.pos.y - y2) / (ball.pos.x - x2);
            const b=y2-m*x2;
            const diOut = ball.radius + this.radius;
            const diIn = this.radius - ball.radius;
            const yab = ya - b;
            
            //quadratic
            const qa = (m*m) + 1;
            const qb = -2*(xa + yab*m);
            const qcOutside = (xa*xa) + (yab*yab) - (diIn*diIn);
            const qcInside = (xa*xa) + (yab*yab) - (diOut*diOut);
            const detOutside = (qb*qb) - 4*qa*qcOutside;
            const detInside = (qb*qb) - 4*qa*qcInside;

            if ((detOutside < 0) && (detInside < 0))
                return;

            const quadCOutside = Math.sqrt(detOutside);
            const quadCInside = Math.sqrt(detInside);
            const solX1Outside = (-qb + quadCOutside)/(2*qa);
            const solX2Outside = (-qb - quadCOutside)/(2*qa);
            const solX1Inside = (-qb + quadCInside)/(2*qa);
            const solX2Inside = (-qb - quadCInside)/(2*qa);

            //console.log(`Position ${this.relativePosInRadians(ball.pos.x, ball.pos.y)}`);
            var collisionAngleRad1Outside = this.relativePosInRadians(solX1Outside, m*solX1Outside + b);//Math.atan((m*solX1Outside + b - this.y) / (solX1Outside - this.x));
            var collisionAngleRad2Outside = this.relativePosInRadians(solX2Outside, m*solX2Outside + b);//Math.atan((m*solX2Outside + b - this.y) / (solX2Outside - this.x));
            var collisionAngleRad1Inside = this.relativePosInRadians(solX1Inside, m*solX1Inside + b);//Math.atan((m*solX1Inside + b - this.y) / (solX1Inside - this.x));
            var collisionAngleRad2Inside = this.relativePosInRadians(solX2Inside, m*solX2Inside + b);//Math.atan((m*solX2Inside + b - this.y) / (solX2Inside - this.x));

            var collisionX, collisionAngle;
            //console.log(`Rad1Outside: ${collisionAngleRad1Outside}, Rad1Inside: ${collisionAngleRad1Inside}`);
            //console.log(`Rad2Outside: ${collisionAngleRad2Outside}, Rad2Inside: ${collisionAngleRad2Inside}`);

            var closestIntercept = Infinity;
            if ((collisionAngleRad1Outside > this.startRadians) && (collisionAngleRad1Outside < this.endRadians) && 
                (isPosInPath(solX1Outside, m*solX1Outside + b, ball.pos.x, ball.pos.y, x2, y2)) &&
                ((Math.abs(solX1Outside - x2) < closestIntercept))) {
                collisionX = solX1Outside;
                collisionAngle = collisionAngleRad1Outside;
                closestIntercept = Math.abs(collisionX - x2);
            }
            if ((collisionAngleRad2Outside > this.startRadians) && (collisionAngleRad2Outside < this.endRadians) && 
                (isPosInPath(solX2Outside, m*solX2Outside + b, ball.pos.x, ball.pos.y, x2, y2)) &&
                ((Math.abs(solX2Outside - x2) < closestIntercept))) {
                collisionX = solX2Outside;
                collisionAngle = collisionAngleRad2Outside;
                closestIntercept = Math.abs(collisionX - x2);
            }
            if ((collisionAngleRad1Inside > this.startRadians) && (collisionAngleRad1Inside < this.endRadians) && 
                (isPosInPath(solX1Inside, m*solX1Inside + b, ball.pos.x, ball.pos.y, x2, y2)) &&
                ((Math.abs(solX1Inside - x2) < closestIntercept))) {
                collisionX = solX1Inside;
                collisionAngle = collisionAngleRad1Inside;
                closestIntercept = Math.abs(collisionX - x2);
            }
            if ((collisionAngleRad2Inside > this.startRadians) && (collisionAngleRad2Inside < this.endRadians) && 
                (isPosInPath(solX2Inside, m*solX2Inside + b, ball.pos.x, ball.pos.y, x2, y2)) &&
                ((Math.abs(solX2Inside - x2) < closestIntercept))) {
                collisionX = solX2Inside;
                collisionAngle = collisionAngleRad2Inside;
                closestIntercept = Math.abs(collisionX - x2);
            }
            if (isNaN(collisionX)) return;

            const collisionY = m*collisionX + b;
            const impactX = Math.cos(collisionAngle) * this.radius + this.x; 
            const impactY = Math.sin(collisionAngle) * this.radius + this.y;
            console.log(`Impact at dist: {${Math.sqrt(Math.pow(this.x - impactX, 2) + Math.pow(this.y - impactY, 2))}}`);
            
            collisions.push(new Collision(collisionX, collisionY, "#0FDF0F"));
            collisions.push(new Collision(impactX, impactY, "#FFDFFF"));
            while (collisions.length > 200) {
                collisions.shift();
            }  

            var validX = collisionX;
            var validY = collisionY;
            var searchAttempts = 0;
            while (this.isBallPosInvalid(validX, validY, ball.radius)) {
                console.log("Ball position invalid, looking for closest valid position...");
                const searchRadiusFidelity = 0.02;
                const searchAngleFidelity = 2 * Math.PI / 16;
                
                const angle = searchAngleFidelity * searchAttempts;
                const searchRadius = searchRadiusFidelity * (1 + Math.floor(searchAttempts / (2*Math.PI/searchAngleFidelity)));
                console.log(`Searching for valid position with angle: ${angle}, radius: ${searchRadius}`);
                const searchPos = posWithAngleRadius(angle, searchRadius, {x: collisionX, y: collisionY});
                validX = searchPos.x;
                validY = searchPos.y;
                searchAttempts++;
            }
            if (searchAttempts) console.log(`Took ${searchAttempts} attempts to find a valid location`);
            ball.pos = {x: validX, y: validY};
            const placedDist = Math.sqrt(Math.pow(ball.pos.x - this.x, 2) + Math.pow(ball.pos.y - this.y, 2));
            if (placedDist >= (this.radius-ball.radius)) {
                console.log(`Placed ball outside of valid range...${placedDist}`);
                ball.pos = {x: 1, y: 1};
                // exit(1);
            }
            
            //const radiusRatio = ball.radius / (ball.radius + this.radius);
            var impactNormX = impactX - collisionX;
            var impactNormY = impactY - collisionY;
            const impactVecLen = Math.sqrt(impactNormX*impactNormX + impactNormY*impactNormY);
            impactNormX = impactNormX / impactVecLen;
            impactNormY = impactNormY / impactVecLen;
            const dot = impactNormX * ball.vel.x + impactNormY * ball.vel.y;
            ball.vel.x = (ball.vel.x - 2 * impactNormX * dot) * this.bounceStrength * this.friction ?? 1.0;
            ball.vel.y = (ball.vel.y - 2 * impactNormY * dot) * this.bounceStrength * this.friction ?? 1.0;
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
    c.clearRect(0, 0, canvas.width+1, canvas.height+1);
    
    canvas.width = window.innerWidth - 20;
    canvas.height = window.innerHeight - 20;
    console.log(`Resized to: ${canvas.width} by ${canvas.height}`);
    updateScale();
}

function updateScale() {
    var simMinWidth = 20.0;
    cScale = Math.min(canvas.width, canvas.height) / simMinWidth;
    simWidth = canvas.width / cScale;
    simHeight = canvas.height / cScale;
    console.log(`Sim dimmension: width: ${simWidth}, height: ${simHeight}`);
}

function cX(pos) {
    return pos.x * cScale;
}

function cY(pos) {
    return canvas.height - pos.y * cScale;
}

function draw() {
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.strokeStyle = "#FFFFFF";
    c.strokeRect(0, 0, canvas.width, canvas.height);
    //c.fillStyle = "green";
    //c.fillRect(0, 0, canvas.width, canvas.height);

    //c.drawRect(0, 0, canvas.width, canvas.height);
    c.strokeStyle = "#8F8F8F";
    c.fillStyle = "#FFFFFF";
    if (new Date().getTime() - ball.lastContact.getTime() < 200) c.fillStyle = "#800000";
    c.beginPath();
    c.arc(
        cX(ball.pos), cY(ball.pos), cScale * ball.radius, 0.0, 2.0 * Math.PI
    );
    c.closePath();
    c.fill();

    objects.forEach((obj) => obj.draw(c, ball));
    //  collisions.forEach((obj) => obj.draw(c));

    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 1;
    c.font = "16px serif";
    //c.strokeText(`Ball x: ${ball.pos.x}`, 10, 15);
    //c.strokeText(`Ball y: ${ball.pos.y}`, 10, 30);
    //let m = (ball.pos.y - (ball.pos.y - ball.vel.y)) / (ball.pos.x - (ball.pos.x - ball.vel.x));
    //c.strokeText(`Ball slope: ${m}`, 10, 45);
    c.strokeText('Hold W, A, D to add velocity', cX({x:10}), cY({y:simHeight-2}));
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

function simulate() {
    ball.vel.x += gravity.x * timeStep;
    ball.vel.y += gravity.y * timeStep;

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
    if (ball.pos.y - ball.radius < 0.0) {
        ball.pos.y = ball.radius;
        ball.vel.y = -ball.vel.y;

        ball.vel.x *= friction;
        ball.vel.y *= friction;
    }
    if (ball.pos.y + ball.radius > simHeight) {
        ball.pos.y = simHeight - ball.radius;
        ball.vel.y = -ball.vel.y;

        ball.vel.x *= friction;
        ball.vel.y *= friction;
    }
    //if (isNaN(1 / ball.vel.x)) ball.vel.x = 0.0000001;
    //if (isNaN(1 / ball.vel.y)) ball.vel.y = 0.0000001;
    objects.forEach((obj) => obj.influenceBall(ball));
}

function update() {
    if (!holdCycles) {
        simulate();
    } else {
        holdCycles--;
    }
    draw();
    rotateIndiciesInPlace(flipper.polyIndicies, 0.01);
    rotateIndiciesInPlace(flipper2.polyIndicies, -0.01);
    if (isNaN(ball.pos.x) || isNaN(ball.pos.y) || isNaN(ball.vel.x) || isNaN(ball.vel.y)) {
        ball.pos = {x: 1, y: 1};
        ball.vel = {x: 1, y: 0.5};
    }

    requestAnimationFrame(update);
}

//objects.push(new RectangleObject(5, 5, 3, 3));
//objects.push(new PointObject(2, 2, 1));
//objects.push(new PointObject(20, 3, 1.5));

objects.push(new PointObject(10, 15, 0.7, 50));
objects.push(new PointObject(5, 10, 1.2, 20));
objects.push(new PointObject(15, 10, 1.2, 20));
objects.push(new PointObject(10, 10, 1.5, 20));

objects.push(new PolyObject(18.5, 5, [
    {x: 0, y: 0},
    {x: 0.01, y: 10}
], 0));

const flipper = new PolyObject(5, 5, [
    {x: 0, y: 2},
    {x: 5, y: 1.5},
    {x: 4.8, y: 1},
    {x: -0.2, y: 1},
], 15);
objects.push(flipper);

const flipper2 = new PolyObject(14, 5, [
    {x: 0, y: 2},
    {x: 5, y: 1.5},
    {x: 4.8, y: 1},
    {x: -0.2, y: 1},
], 15);
objects.push(flipper2);
mirrorIndiciesInPlace(flipper2.polyIndicies, false);

objects.push(new ArcObject(10, 11.5, 10, 0, Math.PI, 0.95));

const scoreBoard = new Scoreboard(4, 18, 5);
objects.push(scoreBoard);

window.addEventListener('resize', resizeCanvas);
window.addEventListener('click', resizeCanvas); //Any click event...
window.addEventListener("keypress", function(event) {
    //console.log(event.keyCode);
    switch (event.keyCode) {
        /*W*/ case 119: ball.vel.y += 6; break;
        /*A*/ case 97: ball.vel.x -= 2; break;
        /*D*/ case 100: ball.vel.x += 2; break; 
    }    
  });
resizeCanvas();
update();

