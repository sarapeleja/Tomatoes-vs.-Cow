import { buildProgramFromSources, loadJSONFile, loadShadersFromURLS, setupWebGL } from "../libs/utils.js";
import { ortho, lookAt, flatten, perspective, add, mult, inverse, scale, rotateX, rotateY, translate } from "../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationY, multRotationZ, multScale, multTranslation, popMatrix, pushMatrix } from "../libs/stack.js";
import { mat4, vec4, vec3, radians } from "../libs/MV.js";
import { Sound } from './sound.js';

import * as CUBE from '../libs/objects/cube.js';
import * as CYLINDER from '../libs/objects/cylinder.js'
import * as SPHERE from '../libs/objects/sphere.js'
import * as COW from '../libs/objects/cow.js'

const CUBE_STRING = "cube";
const CYLINDER_STRING = "cylinder";
const SPHERE_STRING = "sphere";
const COW_STRING = "cow";

const range = 8;
let alpha = 45, l = 0.4;
let gamma = 20, theta = 45;

const front_view = lookAt([10, 3, 0], [0, 3, 0], [0, 1, 0]);
const top_view = lookAt([0, 10, 0], [0, 3, 0], [0, 0, -1]);
const left_view = lookAt([0, 3, 10], [0, 3, 0], [0, 1, 0]);

let isPerspective = false;
let isOblique = true;
let multipleView = false;
let withTriangles = true;
let isFourth = true;

const color1 = [0.4, 0.4, 0.4, 1.0], color2 = [1.0, 1.0, 1.0, 1.0];
const lineColor = [0.2, 0.2, 0.2, 1.0];

let move = 0;
let turnCabin = 0;
let turnCannon = -90;

const vel = 50;
const gravity = 150;
const accel = vec4(0, -gravity, 0, 0);

let tomatoes = [];
const TOMATOES = 5;
let tomatoCount = 50;
const shotInterval = 200;
let lastTime = 0;
let lastTomatoTime = 0;

let M_barrel_world;
let M_cow_world;
let M_cow_mov;

let playing = false;

const ARCHIBALD_MAX_HP = 5, BASE_HIT_POINTS = 100, BASE_MISS_POINTS = 10;
let cowAngle, cowPos, ArchibaldHP = 0, respawnTimer, cowDirection;
let cowSpeed, level, totalPoints;//initial cow speed, level and points
let highScore = parseInt(localStorage.getItem("highScore")) || 0;
document.getElementById("high_score").innerText = highScore;

const COW_TEX_URL = "./images/cow_skin.png";
let texture = false, cowTexture;
let u_texture, u_if_texture, a_texcoord_loc;

let cowDancing = false;
let danceStartTime = 0;
let panel_Display = "block";

function loadCowTexture(gl) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    const image = new Image();
    image.onload = function () {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        console.log("Cow texture loaded.");
    };
    image.onerror = () => {
        console.error("Failed to load cow texture from URL:", COW_TEX_URL);
    };
    image.crossOrigin = ""; // Required for CORS when loading external images
    image.src = COW_TEX_URL;
    return tex;
}

function setup(shaders) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    /** @type WebGL2RenderingContext */
    let gl = setupWebGL(canvas);

    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);

    gl.useProgram(program);
    u_texture = gl.getUniformLocation(program, "u_texture");
    u_if_texture = gl.getUniformLocation(program, "u_if_texture");
    a_texcoord_loc = gl.getAttribLocation(program, "a_texcoord");

    cowTexture = loadCowTexture(gl);
    gl.uniform1i(u_texture, 0); // Assign texture unit 0 to the sampler

    let zoom = 1.0;

    let mView = left_view; //defalut

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    window.addEventListener("wheel", event => {
        let factor = 1.1
        if (event.deltaY < 0)
            zoom /= factor; //scroll up, zoom in
        else zoom *= factor; //scroll daown, zoom out
    });

    const CONTINUOUS_KEYS = ['q', 'e', 'd', 'a', 'w', 's', 'z', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    // A map to track the current pressed state of continuous keys.
    // This allows simultaneous key presses to be detected.
    const keysPressed = {};
    CONTINUOUS_KEYS.forEach(key => keysPressed[key.toLowerCase()] = false);

    // Check each key state and perform corresponding action if true
    function handleSimultaneousKeys() {
        const isPressed = keysPressed; // Readability

        if (keysPressed['q']) move -= 0.1;
        if (keysPressed['e']) move += 0.1;

        if (keysPressed['d']) turnCabin -= 1;
        if (keysPressed['a']) turnCabin += 1;

        if (keysPressed['w']) turnCannon = Math.min(30, turnCannon + 1);
        if (keysPressed['s']) turnCannon = Math.max(-102, turnCannon - 1);

        if (keysPressed['z']) {
            if (lastTime - lastTomatoTime > shotInterval) {
                Sound.playShot(tomatoCount);
                lastTomatoTime = lastTime;
                if (tomatoCount > 0) {
                    let newTomato = {
                        pos: mult(M_barrel_world, vec4(0, 0, 0, 1)), // initial position at barrel
                        vel: mult(M_barrel_world, vec4(0, vel, 0, 0)), // initial velocity
                        cow: false, floor: false // still flying
                    };
                    tomatoes.push(newTomato);
                    tomatoCount -= 1, lastTime = 0; // Reset time for trajectory
                }
            }
        }

        if (['q', 'e', 'd', 'a', 'w', 's'].some(key => isPressed[key])) Sound.playMove();
        else Sound.stopMove();
    }

    window.onkeydown = function (event) {
        const key = event.key.toLowerCase();

        if (CONTINUOUS_KEYS.includes(key)) {
            // Set state to true if the key is pressed
            keysPressed[key] = true;
            // Prevent default browser behavior for common movement keys
            if (['w', 'a', 's', 'd', ' '].includes(key) || key.startsWith('arrow')) {
                event.preventDefault();
            }
        }

        // Handle one-time actions (like view toggles, reset)
        switch (key) {
            case '1': mView = front_view; isFourth = false; break;
            case '2': mView = left_view; isFourth = false; break;
            case '3': mView = top_view; isFourth = false; break;
            case '4': isFourth = true; break;

            case '8': isOblique = !isOblique; break;
            case '9': isPerspective = !isPerspective; break;
            case '0': multipleView = !multipleView; break;

            case ' ': withTriangles = !withTriangles; break;

            case 'h':
                if (playing) break; //no panel while playing
                panel_Display = (panel_Display == 'none') ? 'block' : 'none';
                document.getElementById("bottom").style.display = panel_Display;
                break;

            case 'r': //reset view related stuff
                isFourth = true;
                zoom = 1.0;
                alpha = 45, l = 0.4;
                gamma = 20, theta = 45;
                break;
            case 'arrowleft':
                if (isOblique) l += 0.01;
                else theta += 0.5;
                break;
            case 'arrowright':
                if (isOblique) l -= 0.01;
                else theta -= 0.5;
                break;
            case 'arrowup':
                if (isOblique) alpha += 0.5;
                else gamma += 0.5;
                break;
            case 'arrowdown':
                if (isOblique) alpha -= 0.5;
                else gamma -= 0.5;
                break;

            //EXTRA FUNCTIONALITY
            case 'm': Sound.mute(); break;
            case 'c': //clean floor: remove landed tomatoes
                tomatoes = tomatoes.filter(t => !t.floor); break;
            case 'g'://TODO: way of losing, storing high score and point system
                toggleGame(); break;
            case '.': texture = !texture; break;
        }
    }

    window.onkeyup = function (event) {
        const key = event.key.toLowerCase();

        // Set state to false when the key is released
        if (CONTINUOUS_KEYS.includes(key)) {
            keysPressed[key] = false;
        }
    }

    function toggleGame() {
        Sound.toggleGame();
        playing = !playing, tomatoCount = TOMATOES;
        if (!playing) { //kill cow, clean hits:
            ArchibaldHP = 0, cleanHits();
            tomatoCount *= 10; //more tomatoes in non game mode
            highScore = Math.max(highScore, totalPoints);
            localStorage.setItem("highScore", highScore);
            document.getElementById("high_score").innerText = highScore;
            document.getElementById("archibald_hp").style.display = "none";
            document.getElementById("bottom").style.display = panel_Display;
        } else { //generate first cow with speed = 0.5 and position tank as default:
            move = 0, turnCabin = 0, turnCannon = -90;
            cowSpeed = 0.5, level = 1, totalPoints = 0, generateCow();
            document.getElementById("archibald_hp").style.display = "block";
            document.getElementById("bottom").style.display = 'none';
            document.getElementById("hp_bar").max = ARCHIBALD_MAX_HP;
        }
    }

    let sceneGraph;
    loadJSONFile("graph.json")
        .then(graphData => {
            // 'graphData' is the parsed JSON object
            console.log("Graph loaded successfully:", graphData);
            sceneGraph = graphData;
            window.requestAnimationFrame(render);
        })

    gl.clearColor(0.7, 0.8, 0.9, 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.frontFace(gl.CCW);

    CUBE.init(gl);
    CYLINDER.init(gl);
    SPHERE.init(gl);
    COW.init(gl)

    function resize_canvas(event) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
    }

    function uploadProjection(mProjection) {
        uploadMatrix("u_projection", mProjection);
    }

    function uploadModelView() {
        uploadMatrix("u_model_view", modelView());
    }

    function uploadMatrix(name, m) {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, name), false, flatten(m));
    }

    function getOrtho() { return ortho(-aspect * range / zoom, aspect * range / zoom, -range / zoom, range / zoom, -5 * range, 5 * range) };

    function computeProjection(isFourth) {
        if (isFourth || !isPerspective)
            return getOrtho()
        //else
        zoom = Math.max(0.51, zoom);
        return perspective(90 / zoom, aspect, 0.01, 300);
    }

    function compute4thView() {
        if (isOblique) {
            return mat4(
                vec4(1, 0, -l * Math.cos(radians(alpha)), 0),
                vec4(0, 1, -l * Math.sin(radians(alpha)), 0),
                vec4(0, 0, 1, 0),
                vec4(0, 0, 0, 1)
            );
        }
        //else
        return mult(rotateX(gamma), rotateY(theta));
    }

    function value(v) {
        if (typeof v == "string") {
            switch (v) {
                case "move": return move;
                case "moveWheels": return move * -50;
                case "turnCabin": return turnCabin;
                case "turnCannon": return turnCannon;
            }
        }// else:
        return v;
    }

    function parseFloor(width, depth, tileSize) {
        multTranslation([-width + tileSize / 2, 0, -depth + tileSize / 2]);
        multScale([tileSize, 0.1, tileSize]);
        let toggle = true;

        for (let i = 0; i < width; i++) {
            for (let j = 0; j < depth; j++) {
                pushMatrix();
                multTranslation([i, 0, j]);
                uploadModelView();
                gl.uniform4fv(gl.getUniformLocation(program, "u_color"), toggle ? color1 : color2);
                CUBE.draw(gl, program, withTriangles ? gl.TRIANGLES : gl.LINES);
                popMatrix();
                toggle = !toggle;
            }
            toggle = !toggle;
        }

    }

    function parseGraph(nodeId) {
        const node = sceneGraph.nodes[nodeId];
        if (!node) return;

        // apply transforms
        if (node.transforms) {
            const t = node.transforms;
            if (t.translation) multTranslation(t.translation.map(value));
            if (t.rotation) {
                const [rx, ry, rz] = t.rotation.map(value);
                multRotationZ(rz || 0); multRotationY(ry || 0); multRotationX(rx || 0);
            }
            if (t.scale) multScale(t.scale.map(value));
        }

        if (nodeId == "barrelMouth") M_barrel_world = mult(inverse(mView), modelView());
        if (nodeId == "Archibald") M_cow_world = mult(inverse(mView), modelView());

        // if leaf -> draw primitive
        if (node.primitive && node.color) {
            uploadModelView();
            let SHAPE;
            switch (node.primitive) {
                case CUBE_STRING: SHAPE = CUBE; break;
                case CYLINDER_STRING: SHAPE = CYLINDER; break;
                case SPHERE_STRING: SHAPE = SPHERE; break;
                case COW_STRING: SHAPE = COW; break;
            }

            if (texture && node.primitive == COW_STRING) {
                gl.uniform1i(u_if_texture, 1);
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, cowTexture);
                gl.enableVertexAttribArray(a_texcoord_loc);
            } else {
                gl.uniform1i(u_if_texture, 0);
                if (node.primitive == COW_STRING) {
                    gl.disableVertexAttribArray(a_texcoord_loc);
                }
            }

            gl.uniform4fv(gl.getUniformLocation(program, "u_color"), node.lineColor ? value(node.lineColor) : value(lineColor));
            SHAPE.draw(gl, program, gl.LINES);
            if (withTriangles) {
                gl.uniform4fv(gl.getUniformLocation(program, "u_color"), value(node.color));
                SHAPE.draw(gl, program, gl.TRIANGLES)
            }

        }

        // else render children
        if (node.children && node.children.length > 0) {
            for (const childId of node.children) {
                pushMatrix();
                parseGraph(childId);
                popMatrix();
            }
        }
    }

    function hitCow(pos) {
        if (!M_cow_world) return false;

        // compute vector from cow center (in world space)
        const local = mult(inverse(M_cow_world), vec4(pos[0], pos[1], pos[2], 1)); // cow origin in world space
        const x = local[0], y = local[1], z = local[2];

        // check if inside cube bounds
        // target box -> "scale": [ 1.3, 0.7, 0.4]
        const x_max = 1.3 / 2, x_min = -x_max;
        const y_max = 0.7 / 2, y_min = -y_max;
        const z_max = 0.5 / 2, z_min = -z_max;

        return (
            x >= x_min && x <= x_max &&
            y >= y_min && y <= y_max &&
            z >= z_min && z <= z_max
        );
    }

    function getCowPos(angleRad) {
        return vec3(10 * Math.cos(angleRad), 2.5, 10 * Math.sin(angleRad));
    }

    function generateCow() {
        cowAngle = Math.random() * Math.PI * 2;
        cowDirection = Math.random() < 0.5 ? -1 : 1;
        cowPos = getCowPos(cowAngle);
        ArchibaldHP = ARCHIBALD_MAX_HP;
        respawnTimer = 0;
    }

    function updateCow(timeStep) {
        if (!playing) return;

        if (ArchibaldHP > 0) {
            cowAngle += cowDirection * cowSpeed * timeStep;
            cowPos = getCowPos(cowAngle);
        } else {
            respawnTimer += timeStep;
            if (respawnTimer >= 3.0) {
                level += 1, cowSpeed += 0.3;
                generateCow();
            }
        }
    }

    function renderCow(view) {
        if (ArchibaldHP == 0) return; //dont render dead cow
        loadMatrix(view);
        pushMatrix();
        multTranslation(cowPos);
        multRotationY(((cowAngle * 180 / Math.PI) - 90) * -1);
        if (cowDancing) {
            let danceAngle = 30 * Math.sin(performance.now() * 0.01);
            multRotationX(danceAngle);
        }
        M_cow_mov = mult(inverse(view), modelView());
        parseGraph(sceneGraph.cow_root);
        popMatrix();
    }

    function cleanHits() { tomatoes = tomatoes.filter(t => !t.cow); }

    function updateTomatoes(timeStep) {//TODO: when hit cow stick to moving cow
        for (let t of tomatoes) {
            if (t.floor || t.cow) continue;
            t.pos = add(t.pos, scale(timeStep, t.vel));   // move
            t.vel = add(t.vel, scale(timeStep, accel));   // apply gravity

            if (t.pos[1] < 0.3) { // landed
                t.pos[1] = 0.3, t.floor = true;
                totalPoints = Math.max(0, totalPoints - BASE_MISS_POINTS * level);
                Sound.playSplat();
            }

            if (ArchibaldHP > 0 && (t.cow = hitCow(t.pos))) { // hit
                ArchibaldHP -= 1, tomatoCount += 1, totalPoints += BASE_HIT_POINTS * level;
                t.pos = mult(inverse(M_cow_mov), vec4(t.pos[0], t.pos[1], t.pos[2], 1));
                Sound.playSplat(), Sound.playSadCow();
                if (ArchibaldHP == 0) { //kill
                    cleanHits();
                    Sound.playDeadCow();
                }
            }
        }
    }

    function renderTomatoes(view) {
        if (!sceneGraph.tomato_root) return;
        for (let t of tomatoes) {
            loadMatrix(t.cow ? mult(view, M_cow_mov) : view);
            pushMatrix()
            multTranslation([t.pos[0], t.pos[1], t.pos[2]]);
            parseGraph(sceneGraph.tomato_root); // draws tomato + stem
            popMatrix()
        }
    }

    function upload(isFourthView = false) {
        uploadProjection(computeProjection(isFourthView));
    }

    function renderScene(view = mView) {
        loadMatrix(view);
        parseGraph(sceneGraph.root);
        parseFloor(20, 20, 2);
        renderCow(view);
        renderTomatoes(view)
    }

    function showPopup(message, duration = 3000) {
        document.getElementById("popup").textContent = message;
        document.getElementById("popup").style.display = "block";

        setTimeout(() => {
            popup.style.display = "none"; // hide after duration
        }, duration);
    }


    function render(time) {
        window.requestAnimationFrame(render);
        document.getElementById("tomato_count").innerText = tomatoCount;
        document.getElementById("hp_bar").value = ArchibaldHP;
        document.getElementById("points_count").innerText = totalPoints;
        document.getElementById("level").innerText = level;

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        handleSimultaneousKeys();//verifies keys being pressed on each frame

        // If lastTime is 0, this is the first frame (or first shot)
        // Avoid a giant timeStep by just setting lastTime to the current time
        if (lastTime == 0) lastTime = time;

        let timeStep = (time - lastTime) / 1000.0; // Calculate delta in seconds
        lastTime = time; // ALWAYS update lastTime to the current frame's time

        if (!cowDancing) updateCow(timeStep);
        updateTomatoes(timeStep);

        // Trigger victory dance if cow survives and ammo runs out
        let youLose = tomatoCount == 0 && !tomatoes.some(t => !t.floor && !t.cow)
        if (playing && youLose && !cowDancing) {
            showPopup("Archibald says \"Loser >:P\"");
            cowDancing = true;
            danceStartTime = time;
            Sound.celebrate();
        }

        // End dance after 3 seconds
        if (playing && cowDancing && (time - danceStartTime) > 6000) {
            Sound.endCelebration();
            cowDancing = false;
            toggleGame();
        }

        if (isFourth) mView = compute4thView();

        if (sceneGraph && sceneGraph.root && sceneGraph.nodes) {
            // Load the ModelView matrix with the World to Camera (View) matrix
            if (multipleView) {
                const halfWidth = canvas.width / 2;
                const halfHeight = canvas.height / 2;

                // TOP-LEFT QUADRANT (Front View)
                gl.viewport(0, halfHeight, halfWidth, halfHeight);
                upload();
                renderScene(front_view);

                // TOP-RIGHT QUADRANT (Top View)
                gl.viewport(halfWidth, halfHeight, halfWidth, halfHeight);
                upload();
                renderScene(top_view);

                // BOTTOM-LEFT QUADRANT (Left View)
                gl.viewport(0, 0, halfWidth, halfHeight);
                upload();
                renderScene(left_view);

                // BOTTOM-RIGHT QUADRANT (4th View)
                gl.viewport(halfWidth, 0, halfWidth, halfHeight);
                upload(isFourth);
                renderScene();
            }
            else {
                gl.viewport(0, 0, canvas.width, canvas.height);
                upload(isFourth);
                renderScene();
            }
        }
        gl.uniform1f(gl.getUniformLocation(program, "u_time"), time / 1000);
    }
}

const urls = ["shader.vert", "shader.frag"];

loadShadersFromURLS(urls).then(shaders => setup(shaders))
