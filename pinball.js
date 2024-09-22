var canvas = document.getElementById("pinballCanvas");
var c = canvas.getContext("2d");

var gravity = { x: 0.0, y: -5.0 }; 
var friction = 1.0; 

var px = document.getElementById("physics-x");
var py = document.getElementById("physics-y");

var timeStep = 1.0 / 60.0;

var ball = { 
    radius: 0.5,
    pos: { x: 0.5, y: 20.0 },
    vel: { x: 40.0, y: 0.0 }
};

var objects = [];
var collisions = [];

var simWidth, simHeight, cScale;

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
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.surfaceType = "bounce";
        this.friction = 0.75;
        this.lastContactTime = new Date(0, 0, 0);
        this.color = "#0000FF";
    }

    draw(c, ball) {
        c.strokeStyle = "#FFFFFF";
        c.beginPath();
        c.arc(cX(this), cY(this), cScale * this.radius, 0.0, 2.0 * Math.PI);
        c.closePath();
        c.fill();

        if (ball) {
            const dist = Math.sqrt(Math.pow(this.x - ball.pos.x, 2) + Math.pow(this.y - ball.pos.y, 2));
            c.strokeStyle = '#FF0000';
            c.font = "16px serif";
            c.lineWidth = 1;
            c.strokeText(`Ball dist: ${dist}`, cX(this), cY(this));
            c.closePath();

            
            const xa = this.x;
            const ya = this.y;
            const x2 = ball.pos.x - ball.vel.x * timeStep;
            const y2 = ball.pos.y - ball.vel.y * timeStep;
            const m=(ball.pos.y - y2) / (ball.pos.x - x2);
            const b=y2-m*x2;
            c.lineWidth = 2;
            c.strokeStyle = "#3FFF5F";
            c.beginPath();
            c.moveTo(cX({x:0}), cY({y:m*0+b}));
            c.lineTo(cX({x:30}), cY({y:m*30+b}));
            c.stroke();
        }
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
            const yab = ya + b;
            
            //quadratic
            const qa = 1+m*m;
            const qb = -2*(xa+m*(ya+b));
            const qc = xa*xa + yab*yab - di*di;
            const quadC = Math.sqrt(qb*qb - 4*qa*qc);
            const solX1 = (-qb + quadC)/(2*qa);
            const solX2 = (-qb - quadC)/(2*qa);
            
            var collisionX = solX1;
            if (((solX1 < x2) && (solX1 < xa)) || ((solX1 > x2) && (solX1 > xa)))
                collisionX = solX2;
            const collisionY = m*collisionX + b;

            console.log(`c: ${qc}`);
            console.log(`m: ${m}, b: ${b}`);
            console.log(`Xa: ${xa}, Ya: ${ya}, Di: ${di}`);
            console.log(`qa: ${Math.round(qa)}, qb: ${Math.round(qb)}, qc: ${Math.round(qc)}`);
            console.log(`Collision x: ${collisionX}, y: ${collisionY}`);

            collisions.push(new Collision(ball.pos.x, ball.pos.y, "#FF00FF"));
            collisions.push(new Collision(collisionX, collisionY, "#0000FF"));
            if (collisions.length > 5000) {
                collisions.shift();
                collisions.shift();
            }
        }  
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
    
    /*canvas.width = window.innerWidth - 20;
    canvas.height = window.innerHeight - 20;
    console.log(`Resized to: ${canvas.width} by ${canvas.height}`);
    updateScale();*/
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
    c.fillStyle = "#d0d0d0";
    c.beginPath();
    c.arc(
        cX(ball.pos), cY(ball.pos), cScale * ball.radius, 0.0, 2.0 * Math.PI
    );
    c.closePath();
    c.fill();

    objects.forEach((obj) => obj.draw(c, ball));
    collisions.forEach((obj) => obj.draw(c));

    c.strokeStyle = '#FFFFFF';
    c.lineWidth = 1;
    c.font = "16px serif";
    c.strokeText(`Ball x: ${ball.pos.x}`, 10, 15);
    c.strokeText(`Ball y: ${ball.pos.y}`, 10, 30);
    let m = (ball.pos.y - (ball.pos.y - ball.vel.y)) / (ball.pos.x - (ball.pos.x - ball.vel.x));
    c.strokeText(`Ball slope: ${m}`, 10, 45);
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

    objects.forEach((obj) => obj.influenceBall(ball));
}

function update() {
    simulate();
    draw();
    requestAnimationFrame(update);
}

//objects.push(new RectangleObject(5, 5, 3, 3));
//objects.push(new PointObject(1, 1, 1));
//objects.push(new PointObject(5, 5, 1.5));
//objects.push(new PointObject(8, 8, 2));
objects.push(new PointObject(12, 12, 2.5));


window.addEventListener('resize', resizeCanvas);
window.addEventListener('click', resizeCanvas); //Any click event...
resizeCanvas();
update();
