import { buildProgramFromSources, loadJSONFile, loadShadersFromURLS, setupWebGL } from "../../libs/utils.js";
import { ortho, lookAt, flatten, perspective } from "../../libs/MV.js";
import { modelView, loadMatrix, multRotationX, multRotationY, multRotationZ, multScale, multTranslation, popMatrix, pushMatrix } from "../../libs/stack.js";

import * as CUBE from '../../libs/objects/cube.js';
import * as CYLINDER from '../../libs/objects/cylinder.js'
import * as SPHERE from '../../libs/objects/sphere.js'

const CUBE_STRING = "cube";
const CYLINDER_STRING = "cylinder";
const SPHERE_STRING = "sphere";

let multipleView = false;

let front_view = lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]);
let top_view = lookAt([0, 1.0, 0], [0, 0, 0], [0, 0, -1]);;
let left_view = 0;
let fourth_view = 0;
let big_view = 0;

let isOblique = true;
let isPerspective = true;

function setup(shaders) {
    let canvas = document.getElementById("gl-canvas");
    let aspect = canvas.width / canvas.height;

    /** @type WebGL2RenderingContext */
    let gl = setupWebGL(canvas);

    // Drawing mode (gl.LINES or gl.TRIANGLES)
    let mode = gl.LINES;
    let alpha = 0;
    let l = 0;
    let program = buildProgramFromSources(gl, shaders["shader.vert"], shaders["shader.frag"]);
    let obliqueMatrix = [ //shear for oblique projection
        1, 0, -l * Math.cos(alpha), 0,
        0, 1, -l * Math.sin(alpha), 0,
        0, 0, 0, 0,
        0, 0, 0, 1];

    let mProjection = ortho(-1 * aspect, aspect, -1, 1, 0.01, 3);
    let mView = lookAt([0, 0, 1], [0, 0, 0], [0, 1, 0]);

    let zoom = 1.0;

    resize_canvas();
    window.addEventListener("resize", resize_canvas);

    window.addEventListener("wheel", event => {
        event.preventDefault();
        if (event.deltaY < 0)
            zoom *= 1.1; //scroll up
        else zoom /= 1.1; //scroll daown
    });

    document.onkeydown = function (event) {
        switch (event.key) {
            case '1':
                mView = front_view;
                break;
            case '2':
                mView = lookAt([1, 0, 0], [0, 0, 0], [0, 1, 0]);
                break;
            case '3':
                mView = top_view;
                break;
            case '4':
                mView = lookAt([2, 1.2, 1], [0, 0, 0], [0, 1, 0]);
                break;
            case '8': //TODO: Toggle axonometric ⇆ oblique (view 4)
                isOblique = !isOblique;
                break;
            case '9': // TODO: Toggle parallel ⇆ perspective
                isPerspective = !isPerspective;
                break;
            case '0': // TODO: Toggle single ⇆ multiple views
                multipleView = !multipleView;
                break;
            case ' ':
                mode = (mode == gl.TRIANGLES) ? gl.LINES : gl.TRIANGLES;
                break;
            case 'h':
                let panel1 = document.getElementById("bottom");
                let display = panel1.style.display == 'none' ? 'block' : 'none';
                panel1.style.display = display;
                break;

            case 'q': move += 1; break; // Move tank forward
            case 'e': move -= 1; break; // Move tank forward

            case 'd': turnCabin += 1; break; // Rotate cabin clockwise
            case 'a': turnCabin -= 1; break; // Rotate cabin counter clockwise

            case 'w': turnCannon = Math.min(120, turnCannon + 1); break; // Raise cannon
            case 's': turnCannon = Math.max(-120, turnCannon - 1); break; // Lower cannon

            case 'r': //TODO: reset for each view type
                mProjection = perspective(90 / zoom, aspect, 0.01, 3);
                mView = lookAt([1, 0.5, 1], [0, 0, 0], [0, 1, 0]);
                zoom = 1.0;
                break;
            case 'z'://TODO: Shoot tomato
                rb += 1;
                break;
            case 'ArrowLeft': //TODO: Adjust axonometric/oblique parameters
                break;
            case 'ArrowRight': //TODO: Adjust axonometric/oblique parameters
                break;
            case 'ArrowUp': //TODO: Adjust axonometric/oblique parameters
                break;
            case 'ArrowDown': //TODO: Adjust axonometric/oblique parameters
                break;
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

    gl.clearColor(0., 0., 0., 1.0);
    gl.enable(gl.DEPTH_TEST);   // Enables Z-buffer depth test

    CUBE.init(gl);
    CYLINDER.init(gl);
    SPHERE.init(gl);


    function resize_canvas(event) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        aspect = canvas.width / canvas.height;

        gl.viewport(0, 0, canvas.width, canvas.height);
        mProjection = ortho(-aspect * zoom, aspect * zoom, -zoom, zoom, 0.01, 3);
    }

    function uploadProjection() {
        uploadMatrix("u_projection", mProjection);
    }

    function uploadModelView() {
        uploadMatrix("u_model_view", modelView());
    }

    function uploadMatrix(name, m) {
        gl.uniformMatrix4fv(gl.getUniformLocation(program, name), false, flatten(m));
    }

    function value(v) {
        if (typeof v == "string") {
            switch (v) {
                case "move": return move;
                case "moveWheels": return move * -20;
                case "turnCabin": return turnCabin;
                case "turnCannon": return turnCannon;
            }
        }// else:
        return v;
    }

    function renderGraph(nodeId, mode, view) {//TODO: use view
        const node = sceneGraph.nodes[nodeId];
        if (!node) return;

        // apply transforms
        if (node.transforms) {
            const t = node.transforms;
            if (t.translation) multTranslation(t.translation.map(value));
            if (t.rotation) {
                const [rx, ry, rz] = t.rotation.map(value);
                multRotationZ(rz || 0);
                multRotationY(ry || 0);
                multRotationX(rx || 0);
            }
            if (t.scale) multScale(t.scale.map(value));
        }

        // if leaf -> draw primitive
        if (node.primitive) {
            uploadModelView();
            switch (node.primitive) {
                case CUBE_STRING: CUBE.draw(gl, program, mode); break;
                case CYLINDER_STRING: CYLINDER.draw(gl, program, mode); break;
                case SPHERE_STRING: SPHERE.draw(gl, program, mode); break;
            }
        }

        // else render children
        if (node.children && node.children.length > 0) {
            for (const childId of node.children) {
                pushMatrix()
                renderGraph(childId, mode);
                popMatrix();
            }
        }
    }


    function render() {
        window.requestAnimationFrame(render);

        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        gl.useProgram(program);

        // Send the mProjection matrix to the GLSL program
        /* mProjection = ortho(-aspect * zoom, aspect * zoom, -zoom, zoom, 0.01, 3); */
        mProjection = perspective(90 / zoom, aspect, 0.01, 3);
        uploadProjection(mProjection);

        // Load the ModelView matrix with the World to Camera (View) matrix
        loadMatrix(mView);

        if (sceneGraph && sceneGraph.root && sceneGraph.nodes) {
            if (multipleView) {
                const halfWidth = canvas.width / 2;
                const halfHeight = canvas.height / 2;

                // TOP-LEFT QUADRANT (Front View)
                gl.viewport(0, halfHeight, halfWidth, halfHeight);
                renderGraph(sceneGraph.root, mode, front_view);

                // TOP-RIGHT QUADRANT (Top View)
                gl.viewport(halfWidth, halfHeight, halfWidth, halfHeight);
                renderGraph(sceneGraph.root, mode, top_view);

                // BOTTOM-LEFT QUADRANT (Left View)
                gl.viewport(0, 0, halfWidth, halfHeight);
                renderGraph(sceneGraph.root, mode, left_view);

                // BOTTOM-RIGHT QUADRANT (4th View)
                gl.viewport(halfWidth, 0, halfWidth, halfHeight);
                renderGraph(sceneGraph.root, mode, fourth_view);
            }
            else {
                gl.viewport(0, 0, canvas.width, canvas.height);
                renderGraph(sceneGraph.root, mode, big_view);
            }
        }
    }
}

const urls = ["shader.vert", "shader.frag"];
loadShadersFromURLS(urls).then(shaders => setup(shaders))