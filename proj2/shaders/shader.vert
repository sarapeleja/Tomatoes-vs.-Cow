#version 300 es

uniform mat4 u_model_view;
uniform mat4 u_projection;
uniform vec4 u_color;

in vec4 a_position;
in vec2 a_texcoord;

out vec4 v_color;
out vec2 v_texcoord;

void main() {
    v_color = u_color;
    v_texcoord = a_texcoord;
    gl_Position = u_projection * u_model_view * a_position;
}
