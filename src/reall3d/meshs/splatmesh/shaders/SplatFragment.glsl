// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
precision highp float;

uniform float lightFactor;
uniform float minAlpha, maxDistSq;
uniform bool useSimilarExp, isMotion;
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

    float distSq = dot(vPosition.xy, vPosition.xy);
    if (distSq > maxDistSq) {
        discard;
    }

    alpha *= fnExp(distSq);
    if (alpha <= minAlpha) {
        discard;
    }

    gl_FragColor = vec4(lightFactor * vColor.rgb, alpha);
}
