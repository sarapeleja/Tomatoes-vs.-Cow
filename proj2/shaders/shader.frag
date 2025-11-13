#version 300 es

precision mediump float;

in vec4 v_color;
in vec2 v_texcoord;

uniform sampler2D u_texture;
uniform int u_if_texture;

out vec4 outColor;

void main() {
    if (u_if_texture == 1) {
        outColor = texture(u_texture, v_texcoord);
    } else {
        outColor = v_color;
    }
}
