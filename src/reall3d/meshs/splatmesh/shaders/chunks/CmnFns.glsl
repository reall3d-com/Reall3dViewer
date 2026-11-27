// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
const float K = 1.2;
const float EXP4K = exp(-K * 4.0);
const float INV_EXP4K = 1.0 / (1.0 - EXP4K);

float fnExp(float r2) {
    return (exp(-K * r2) - EXP4K) * INV_EXP4K;
}

bool fnWatermark(uvec4 cen) {
    return (cen.w & 65536u) > 0u;
}

float fnWave(float minVal, float maxVal, float time) {
    return (sin(time * 0.005) + 1.0) * 0.5 * (maxVal - minVal) + minVal;
}
