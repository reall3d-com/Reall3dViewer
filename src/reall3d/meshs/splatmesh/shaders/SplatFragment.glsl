// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
precision highp float;

uniform float lightFactor;
uniform float minAlpha;
uniform bool useSimilarExp;
varying vec4 vColor;
varying vec4 vPosition;

void main() {
    if (vPosition.z > 1.0) {
        discard;
    }

    float alpha = vColor.a;
    if (alpha < minAlpha) {
        discard;
    }
    float r2 = dot(vPosition.xy, vPosition.xy);
    if (r2 > 4.0) {
        discard;
    }

    alpha *= (useSimilarExp || vPosition.w < 0.0) ? exp2(-r2) : fnExp(-r2);
    if (alpha <= minAlpha) {
        discard;
    }

    gl_FragColor = vec4(lightFactor * vColor.rgb, alpha);
}
