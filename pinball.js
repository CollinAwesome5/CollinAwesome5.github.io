var canvas = document.getElementById("pinballCanvas");
var c = canvas.getContext("2d");

var gravity = { x: 0.0, y: -5.0 }; 
var friction = 0.80; 

var px = document.getElementById("physics-x");
var py = document.getElementById("physics-y");

var timeStep = 1.0 / 60.0;

var ball = { 
    radius: 0.5,
    pos: { x: 0.5, y: 20.0 },
    vel: { x: 40.0, y: 0.0 }
};

var simWidth, simHeight, cScale;

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
    c.fillStyle = "#d0d0d0";
    c.beginPath();
    c.arc(
        cX(ball.pos), cY(ball.pos), cScale * ball.radius, 0.0, 2.0 * Math.PI
    );
    c.closePath();
    c.fill();
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
}

function update() {
    simulate();
    draw();
    requestAnimationFrame(update);
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('click', resizeCanvas); //Any click event...
resizeCanvas();
update();
