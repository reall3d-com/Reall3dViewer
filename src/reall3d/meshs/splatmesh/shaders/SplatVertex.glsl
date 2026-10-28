// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
#include ./chunks/Chunk0VarDeclarations
#include ./chunks/Chunk9AnimateParticle
#include ./chunks/Chunk9SpaltEvalSH

void main() {
    uvec4 cen, cov3d;
    int layerIdx = int(splatIndex / (splatTextureHeightAry * (splatTextureWidth >> 1u)));
    uint indexInLayer = splatIndex % (splatTextureHeightAry * (splatTextureWidth >> 1u));
    int fetchX = int(indexInLayer & ((splatTextureWidth >> 1u) - 1u)) << 1;
    int fetchY = int(indexInLayer / (splatTextureWidth >> 1u));

    if (bigSceneMode) {
        if (usingIndex == 0) {
            cen = texelFetch(splatTexture0, ivec3(fetchX, fetchY, layerIdx), 0);
            cov3d = texelFetch(splatTexture0, ivec3(fetchX | 1, fetchY, layerIdx), 0);
        } else {
            cen = texelFetch(splatTexture1, ivec3(fetchX, fetchY, layerIdx), 0);
            cov3d = texelFetch(splatTexture1, ivec3(fetchX | 1, fetchY, layerIdx), 0);
        }
    } else {
        cen = texelFetch(splatTexture0, ivec3(fetchX, fetchY, layerIdx), 0);
        cov3d = texelFetch(splatTexture0, ivec3(fetchX | 1, fetchY, layerIdx), 0);
    }

    bool isWatermark = fnWatermark(cen);
    float colorA = (float(cov3d.w >> 24) / 255.0);
    if (colorA < minAlpha && !isWatermark) {
        vColor = vec4(0.0);
        return;
    }

    vec3 v3Cen = uintBitsToFloat(cen.xyz);
    #include ./chunks/Chunk5SpaltLod
    v3Cen = animateParticle(v3Cen);
    v3Cen = WatermarkEffect(v3Cen, isWatermark, debugEffect, performanceNow);

    vec4 cam = modelViewMatrix * vec4(v3Cen, 1.0);
    if (cam.z > 0.0) {
        vColor = vec4(0.0);
        return;
    }

    vec4 pos2d = projectionMatrix * cam;
    float clip = 1.1 * pos2d.w;
    if (pos2d.z < -clip || pos2d.x < -clip || pos2d.x > clip || pos2d.y < -clip || pos2d.y > clip || isWatermark && (!showWaterMark || pointMode)) {
        vColor = vec4(0.0);
        return;
    }

    float currentRadius = length(vec3(0.0, topY, 0.0) - v3Cen);
    if (currentVisibleRadius > 0.0 && currentRadius > currentVisibleRadius) {
        vColor = vec4(0.0);
        return;
    }

    vec2 uh1 = unpackHalf2x16(cov3d.x), uh2 = unpackHalf2x16(cov3d.y), uh3 = unpackHalf2x16(cov3d.z);
    mat3 Vrk = mat3(uh1.x, uh1.y, uh2.x, uh1.y, uh2.y, uh3.x, uh2.x, uh3.x, uh3.y);

    float ZxZ = cam.z * cam.z;
    mat3 J_m3 = mat3(focal.x / cam.z, 0.0, -(focal.x * cam.x) / ZxZ, 0.0, focal.y / cam.z, -(focal.y * cam.y) / ZxZ, 0.0, 0.0, 0.0);

    mat3 T_m3 = transpose(mat3(modelViewMatrix)) * J_m3;
    mat3 cov2d = transpose(T_m3) * Vrk * T_m3;

    cov2d[0][0] += 0.3;
    cov2d[1][1] += 0.3;
    vec3 cov2Dv = vec3(cov2d[0][0], cov2d[0][1], cov2d[1][1]);
    float disc = max(0.0, (cov2Dv.x + cov2Dv.z) * (cov2Dv.x + cov2Dv.z) / 4.0 - (cov2Dv.x * cov2Dv.z - cov2Dv.y * cov2Dv.y));
    float eigenValue1 = 0.5 * (cov2Dv.x + cov2Dv.z) + sqrt(disc);
    float eigenValue2 = max(0.5 * (cov2Dv.x + cov2Dv.z) - sqrt(disc), 0.0);
    float eigenValueOrig1 = eigenValue1;
    float eigenValueOrig2 = eigenValue2;

    bool isLightColor = false;
    if (!isWatermark) {
        if (pointMode) {
            eigenValue1 = eigenValue2 = 0.5;
        }

#ifndef BigSceneMode
        if (currentLightRadius > 0.0) {
            // 仅小场景支持光圈过渡效果
            if (transitionEffect == 1) {
                if (currentRadius < currentLightRadius && currentRadius > currentLightRadius * 0.9) {
                    eigenValue1 = eigenValueOrig1;
                    eigenValue2 = eigenValueOrig2;
                    isLightColor = true;
                }
                if (currentRadius < currentLightRadius * 0.9) {
                    if (pointMode) {
                        eigenValue1 = eigenValueOrig1;
                        eigenValue2 = eigenValueOrig2;
                    } else {
                        eigenValue1 = eigenValue2 = 0.5;
                    }
                }
            } else {
                vec4 p = projectionMatrix * (modelViewMatrix * vec4(v3Cen, 1.0));
                float currentRatio = transitionEffect == 2 ? length(p.xy / p.w) : (transitionEffect == 3 ? length(p.xx / p.w) : length(p.yy / p.w));        // 到中心距离（NDC单位）
                float currentLightRatio = (performanceNow - performanceAct) / 500.0;
                if (currentRatio < currentLightRatio) {
                    if (pointMode) {
                        eigenValue1 = eigenValueOrig1;
                        eigenValue2 = eigenValueOrig2;
                    } else {
                        eigenValue1 = eigenValue2 = 0.5;
                    }
                }

            }
        }
#endif
    }

    bool isNormal = pointMode && currentRadius < currentLightRadius || !pointMode && currentRadius > currentLightRadius;
    vPosition = vec4(position.xy, -1.0, 1.0);
    vec2 eigenVector1 = normalize(vec2(cov2Dv.y, eigenValue1 - cov2Dv.x));
    if (markPoint.w > 0.0 && length(vec3(markPoint.xyz) - v3Cen) < 0.000001) {
        vColor = vec4(1.0, 1.0, 0.0, 1.0);
        eigenValue1 = eigenValue2 = 11.0;
        eigenVector1 = normalize(vec2(11.0, 0.0));
        vPosition.z = 1.0; // 选点
    } else if (isLightColor) {
        vColor = vec4(1.0, 1.0, 1.0, 0.2);
    } else if (isWatermark) {
        vColor = waterMarkColor;
    } else {
        vColor = vec4(float(cov3d.w & 0xFFu) / 255.0, float((cov3d.w >> 8u) & 0xFFu) / 255.0, float((cov3d.w >> 16u) & 0xFFu) / 255.0, colorA);
        if (shDegree > 0 && isNormal) {
            vColor.rgb += splatEvalSH(v3Cen, cen.w & 0xFFFFu);
        }
        vColor = FvEffect(cen, vColor, activeFlagValue, performanceNow);
    }

    float diameter1 = min(sqrt(2.0 * eigenValue1), maxPixelDiameter);
    float diameter2 = min(sqrt(2.0 * eigenValue2), maxPixelDiameter);
    if (isNormal) {
        if (diameter1 < minPixelDiameter && diameter2 < minPixelDiameter) {
            vColor = vec4(0.0);
            return;
        }
    } else {
        vPosition.w = -1.0;  // 点云模式渲染
    }

    vec2 eigenVector2 = vec2(eigenVector1.y, -eigenVector1.x);
    vec2 majorAxis = eigenVector1 * diameter1;
    vec2 minorAxis = eigenVector2 * diameter2;

    vec3 ndcCenter = pos2d.xyz / pos2d.w;
    vec2 ndcOffset = (vPosition.x * majorAxis + vPosition.y * minorAxis) / viewport;
    gl_Position = vec4(ndcCenter.xy + ndcOffset, ndcCenter.z, 1.0);
}
