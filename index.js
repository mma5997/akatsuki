var Engine = Matter.Engine,
  Render = Matter.Render,
  Runner = Matter.Runner,
  World = Matter.World,
  Composites = Matter.Composites,
  MouseConstraint = Matter.MouseConstraint,
  Mouse = Matter.Mouse,
  Composite = Matter.Composite,
  Body = Matter.Body,
  Svg = Matter.Svg,
  Common = Matter.Common,
  Bounds = Matter.Bounds,
  Vector = Matter.Vector,
  Constraint = Matter.Constraint,
  Events = Matter.Events,
  Bodies = Matter.Bodies;

var engine, render, world, runner, car, terrain;
var viewportCentre, extents, boundsScaleTarget, boundsScale, initialCarPos;
var wallTop, wallRight, wallBottom, wallLeft;
var passengersInCar = [];
var destinationsAvailable = config.platform.destinations.slice(0);
var currentPlatform = "";
var passengerId = 1;
var driverName = getDriverName();
var globalTimer = 300;
var leftScorecard = new LeftScorecard(),
  rightScorecard = new RightScorecard();
var backgroundSound, carDoorOpen, carDoorClose, carJump, carMove;

function preload() {
  soundFormats("mp3", "ogg", "wav");
  carDoorOpen = loadSound("assets/sound/car_door_open.wav");
  carDoorClose = loadSound("assets/sound/car_door_close.wav");
  carJump = loadSound("assets/sound/car_jump.wav");
  gameOver = loadSound("assets/sound/game_over.ogg");
}

function setup() {
  noCanvas();
  config.canvas.width = windowWidth - config.canvas.margin;
  config.canvas.height = windowHeight - config.canvas.margin;

  // create engine
  engine = Engine.create();
  world = engine.world;

  // create renderer
  render = Render.create({
    element: document.getElementById("canvas"),
    engine: engine,
    options: {
      width: config.canvas.width,
      height: config.canvas.height,
      showAngleIndicator: config.debug,
      showCollisions: config.debug,
      wireframes: config.debug,
      showDebug: config.debug,
      background: "transparent",
    },
  });

  Render.run(render);

  // create runner
  runner = Runner.create();
  Runner.run(runner, engine);

  // ground = new Ground(getX(0, config.canvas.width), (config.canvas.height * 0.9),
  //     config.canvas.width, 50);

  screenWidth = config.canvas.width;
  screenHeight = config.canvas.height;
  wallThikness = 50;

  wallTop = new Wall(
    getX(0, screenWidth),
    0 - wallThikness,
    screenWidth,
    wallThikness
  );
  wallRight = new Wall(
    screenWidth + wallThikness / 2,
    screenHeight / 2,
    wallThikness,
    screenHeight
  );
  wallBottom = new Wall(
    getX(0, screenWidth),
    screenHeight - wallThikness / 2,
    screenWidth,
    wallThikness
  );
  wallLeft = new Wall(
    0 - wallThikness / 2,
    screenHeight / 2,
    wallThikness,
    screenHeight
  );

  initialCarPos = { x: getX(100, 200), y: config.canvas.height * 0.1 };
  car = new Car(
    initialCarPos.x,
    initialCarPos.y,
    config.car.width,
    config.car.height,
    config.car.wheelRadius,
    0,
    0,
    false
  );

  // initialCarPos = Vector.magnitude(Vector.sub(car.getPosition(), viewportCentre))
  // fit the render viewport to the scene
  Render.lookAt(render, {
    min: { x: 0, y: 0 },
    max: { x: config.canvas.width, y: config.canvas.height },
  });

  Events.on(engine, "collisionStart", function (event) {
    if (!car.detectCollision(event)) {
      return;
    }
    var pair = event.pairs;
    console.log("Collision start with pair count:", pair.length);
    for (var i = 0; i < pair.length; i++) {
      var bodyALabel = pair[i].bodyA.label;
      var bodyBLabel = pair[i].bodyB.label;
      var passanger, platform;
      // Check collision with car and passenger
      if (bodyALabel.startsWith("passenger")) {
        passanger = pair[i].bodyA;
      } else if (bodyBLabel.startsWith("passenger")) {
        passanger = pair[i].bodyB;
      }
      if (typeof passanger !== "undefined") {
        if (passengersInCar.length < 2) {
          carDoorOpen.play();
          console.log(
            "Number of passengers in car before:",
            passengersInCar.length
          );
          console.log("Adding passenger to car");
          passengersInCar.push(passanger);
          rightScorecard.pickPassenger();
          passanger.isInsideCar = true;
          car.addPassenger(passanger);
          passanger.remove();
          console.log(
            "Number of passengers in car after:",
            passengersInCar.length
          );
          setTimeout(function () {
            startPlayingSound(carDoorClose);
          }, 400);
          break;
        } else {
          console.log(
            "Taxi full. No more passengers allowed. Please drop existing passengers first"
          );
        }
      }
      // Check collision with car and platform
      if (bodyALabel.startsWith("platform")) {
        platform = pair[i].bodyA;
      } else if (bodyBLabel.startsWith("platform")) {
        platform = pair[i].bodyB;
      }
      if (typeof platform !== "undefined") {
        currentPlatform = platform.location;
      }
    }
  });

  textSize(width / 3);
  textAlign(CENTER, CENTER);
}

function draw() {
  background(0);
  if (keyIsDown(LEFT_ARROW)) {
    car.move("LEFT");
  }
  if (keyIsDown(RIGHT_ARROW)) {
    car.move("RIGHT");
  }
  if (frameCount % 60 == 0) {
    globalTimer -= 1;
    leftScorecard.update();
    leftScorecard.show();
    rightScorecard.show();
  }
}

function keyReleased() {
  if (keyCode == 32) {
    car.move("JUMP");
    carJump.play();
    // carJump.playMode("sustain");
    // setTimeout(function (){ stopPlayingSound(carJump); }, 2100);
  }
}

function keyPressed() {
  // display passengers upon DOWN_ARROW key press
  if (keyIsDown(DOWN_ARROW)) {
    console.log("Creating new passenger");
    var randomDestination = getRandomDestination();
    var carX = car.getPosition().x;
    var passengerY = config.canvas.height - wallBottom.h - config.passenger.h;
    if (carX > config.canvas.width * 0.7)
      new Passenger(
        passengerId,
        carX - random(300, 500),
        passengerY,
        config.passenger.w,
        config.passenger.h,
        randomDestination
      );
    else
      new Passenger(
        passengerId,
        carX + random(300, 500),
        passengerY,
        config.passenger.w,
        config.passenger.h,
        randomDestination
      );
    passengerId += 1;
  }
  // drop passengers upon UP_ARROW key press
  if (keyIsDown(UP_ARROW)) {
    if (passengersInCar.length > 0) {
      dropPassenger();
    } else {
      console.log("No passengers found in car");
    }
  }

  //calculations for platform area
  var yMax = config.canvas.height - wallBottom.h - 20;
  var yLevel = config.platform.yLevel + 1;
  var yPartition = yMax / yLevel;
  var xMax = config.canvas.width;
  var xLevel = config.platform.xLevel;
  var xPartition = xMax / xLevel;
  var platformWidth = xPartition - xPartition * config.platform.xMarginFactor;

  if (keyIsDown(49) || keyIsDown(97)) {
    // platform 1:   on keyPress 1
    var pId = 1;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 1");
      new Platform(
        pId,
        getX(xPartition * 0, xPartition),
        yPartition * (yLevel - 1),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
  if (keyIsDown(50) || keyIsDown(98)) {
    // platform 2:   on keyPress 2
    var pId = 2;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 2");
      new Platform(
        pId,
        getX(xPartition * 1, xPartition),
        yPartition * (yLevel - 1),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
  if (keyIsDown(51) || keyIsDown(99)) {
    // platform 3:   on keyPress 3
    var pId = 3;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 3");
      new Platform(
        pId,
        getX(xPartition * 2, xPartition),
        yPartition * (yLevel - 1),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
  if (keyIsDown(52) || keyIsDown(100)) {
    // platform 4:   on keyPress 4
    var pId = 4;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 4");
      new Platform(
        pId,
        getX(xPartition * 0, xPartition),
        yPartition * (yLevel - 2),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
  if (keyIsDown(53) || keyIsDown(101)) {
    // platform 5:   on keyPress 5
    var pId = 5;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 5");
      new Platform(
        pId,
        getX(xPartition * 1, xPartition),
        yPartition * (yLevel - 2),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
  if (keyIsDown(54) || keyIsDown(102)) {
    // platform 6:   on keyPress 6
    var pId = 6;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 6");
      new Platform(
        pId,
        getX(xPartition * 2, xPartition),
        yPartition * (yLevel - 2),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
  if (keyIsDown(55) || keyIsDown(103)) {
    // platform 7:   on keyPress 7
    var pId = 7;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 7");
      new Platform(
        pId,
        getX(xPartition * 0, xPartition),
        yPartition * (yLevel - 3),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
  if (keyIsDown(56) || keyIsDown(104)) {
    // platform 8:   on keyPress 8
    var pId = 8;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 8");
      new Platform(
        pId,
        getX(xPartition * 1, xPartition),
        yPartition * (yLevel - 3),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
  if (keyIsDown(57) || keyIsDown(105)) {
    // platform 9:   on keyPress 9
    var pId = 9;
    var p = isPlatformPresent(pId);
    if (typeof p !== "undefined") {
      World.remove(world, p);
    } else {
      console.log("Creating platform 9");
      new Platform(
        pId,
        getX(xPartition * 2, xPartition),
        yPartition * (yLevel - 3),
        platformWidth,
        config.platform.height,
        config.platform.destinations[pId - 1]
      );
    }
  }
}

function dropPassenger() {
  for (var i = 0; i < passengersInCar.length; i++) {
    if (currentPlatform == passengersInCar[i].destination) {
      console.log("Dropping passenger now");
      console.log(
        "Number of passengers in car before:",
        passengersInCar.length
      );
      rightScorecard.updatePassengerDropped(passengersInCar[i]);
      car.dropPassenger(passengersInCar[i]);
      var dummyPassenger = new Passenger(
        passengersInCar[i].passengerId,
        car.getPosition().x + random(200, 300),
        car.getPosition().y,
        config.passenger.w,
        config.passenger.h,
        passengersInCar[i].destination
      );
      dummyPassenger.body.label = "droppedPassenger";
      passengersInCar.splice(i, 1);
      //car door open and close
      carDoorOpen.play();
      console.log("Found platform with location:", currentPlatform);
      setTimeout(function () {
        dummyPassenger.body.remove();
        carDoorClose.play();
      }, 300);

      console.log("Number of passengers in car after:", passengersInCar.length);
      return;
    }
  }
  console.log("No passenger in car wants to drop here!");
}

function stopPlayingSound(sound) {
  sound.stop();
}

function startPlayingSound(sound) {
  sound.play();
}

window.addEventListener("resize", function () {
  config.canvas.width = window.innerWidth;
  config.canvas.height = window.innerHeight;
});

(function unloadScrollBars() {
  document.documentElement.style.overflow = "hidden"; // firefox, chrome
  document.body.scroll = "no"; // ie only
})();
