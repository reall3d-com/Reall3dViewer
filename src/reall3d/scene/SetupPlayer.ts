// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import {
    AnimationAction,
    AnimationClip,
    AnimationMixer,
    Clock,
    Group,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    PerspectiveCamera,
    Quaternion,
    Scene,
    Vector3,
    MathUtils,
} from 'three';
import { Events } from '../events/Events';
import {
    OnViewerUpdate,
    GetScene,
    GetControls,
    GetCamera,
    GetPlayer,
    MovePlayer,
    MovePlayerByAngle,
    MovePlayerToTarget,
    GetOptions,
    GetMeta,
    UpdateVirtualGroundPosition,
    UpdateIndicatorTargetStatus,
    IsPointInFront,
    IsPlayerMode,
    IsPlayerMode1,
    IsPlayerMode3,
    PhysicsMovePlayer,
    PhysicsInitCharacterController,
    OnViewerDispose,
    PhysicsAddStaticCollisionGlb,
    PhysicsAdjustCameraByCastShape,
    PlaytBgAudio,
    IsFlyMode,
} from '../events/EventConstants';
import { DRACOLoader, GLTFLoader, OrbitControls } from 'three/examples/jsm/Addons.js';
import { Reall3dViewerOptions } from '../viewer/Reall3dViewerOptions';
import { MetaData } from '../modeldata/MetaData';
import { setupVirtualGround } from './SetupVirtualGround';
import { setupPhysics } from './SetupPhysics';
import { globalEv } from '../events/GlobalEV';
import { loadFile } from '../modeldata/loaders/FileLoader';
import { DecoderPath } from '../utils/GlobalConstants';
import { sleep } from '../utils/CommonUtils';

export function setupPlayer(events: Events) {
    let disposed: boolean = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    const opts: Reall3dViewerOptions = fire(GetOptions);
    const meta: MetaData = fire(GetMeta);
    on(IsPlayerMode1, () => opts.viewMode === 1 || meta.viewMode === 1);
    on(IsPlayerMode3, () => opts.viewMode === 3 || meta.viewMode === 3);
    on(IsPlayerMode, () => fire(IsPlayerMode1) || fire(IsPlayerMode3));
    on(IsFlyMode, () => opts.viewMode === 2 || meta.viewMode === 2);

    !meta.player && fire(IsPlayerMode) && console.warn('missing player data in meta');
    fire(IsPlayerMode) && setupVirtualGround(events);
    setupPhysics(events);
    fire(IsPlayerMode) && fire(PhysicsAddStaticCollisionGlb, meta.collisionUrl);

    const scene: Scene = fire(GetScene);
    const orbitControls: OrbitControls = fire(GetControls);
    const camera: PerspectiveCamera = fire(GetCamera);
    let loading = false;
    let ready = false;

    let player: Group;
    let mixer: AnimationMixer | null = null;
    let clock = new Clock();
    let actions: PlayerActions | null = null;
    let handleTimeout: any = null;
    let angleHandleTimeout: any = null;

    let isMovingToTarget = false; // 是否正在向目标点移动
    let targetPosition: Vector3 | null = null; // 目标点（地面投影）
    const targetReachThreshold = 0.01; // 到达目标的距离阈值（避免精度问题）
    const walkTimeThreshold = 10; // 步行耗时阈值（秒）
    const lastPlayerPosition = new Vector3();
    let lastPlayerMoveTime = 0;
    const lastCameraPosition = new Vector3();

    // 初始值
    const playerUrl = meta.player?.url || 'https://reall3d.com/demo-models/player/soldier.glb';
    const playerScale = meta.player?.scale || 1;
    const playerRotation = meta.player?.rotation || [180, 0, 0];
    const playerPosition = meta.player?.position || [0, 0, 0];
    const playerHeight = meta.player?.height || 1.7;
    const playerSpeed = meta.player?.speed || 3;
    const idleName = (meta.player?.idle || 'idle').toLowerCase();
    const walkName = (meta.player?.walk || 'walk').toLowerCase();
    const runName = (meta.player?.run || 'run').toLowerCase();

    let trigerRunMp3Url = null;
    if (meta.player?.trigerRunMp3) {
        loadFile(meta.player.trigerRunMp3).then((data: any) => {
            trigerRunMp3Url = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
        });
    }

    // 角色控制配置
    const characterControls: CharacterControls = {
        key: [0, 0, 0], // [前后(相机视角), 左右(相机视角), 是否奔跑]
        ease: new Vector3(),
        position: new Vector3().fromArray(playerPosition),
        up: new Vector3(0, 1, 0),
        rotate: new Quaternion(),
        current: 'Idle',
        fadeDuration: 0.3,
        runVelocity: playerSpeed * 3, // 奔跑速度
        walkVelocity: playerSpeed, // 行走速度
        rotateSpeed: 0.1,
        moveAngle: null, // 摇杆偏离角度（弧度，相对于相机视角）
        moveIntensity: 0, // 摇杆移动力度（0~1，0=无移动，1=最大速度）
    };

    lastPlayerPosition.copy(characterControls.position);
    fire(IsPlayerMode) && fire(PhysicsInitCharacterController, characterControls.position.clone());

    on(GetPlayer, () => player);

    on(MovePlayer, (forward?: boolean, backward?: boolean, left?: boolean, right?: boolean, run?: boolean) => {
        if (!fire(IsPlayerMode)) return; // 仅支持第三人称漫游模式

        // 向目标移动时，优先中断目标移动
        stopMoveToTarget();

        if (handleTimeout) {
            clearTimeout(handleTimeout);
            handleTimeout = null;
        }

        characterControls.moveAngle = null;
        characterControls.moveIntensity = 0;

        characterControls.key[0] = forward ? -1 : backward ? 1 : 0;
        characterControls.key[1] = right ? 1 : left ? -1 : 0;
        characterControls.key[2] = run ? 1 : 0;

        handleTimeout = setTimeout(() => (characterControls.key = [0, 0, 0]), 500);
    });

    on(MovePlayerByAngle, (angleRadian = 0, intensity = 1) => {
        if (!fire(IsPlayerMode)) return; // 仅支持第三人称漫游模式

        // 向目标移动时，优先中断目标移动
        stopMoveToTarget();

        if (angleHandleTimeout) {
            clearTimeout(angleHandleTimeout);
            angleHandleTimeout = null;
        }
        characterControls.key = [0, 0, 0];

        const clampIntensity = MathUtils.clamp(intensity, 0, 1);

        if (clampIntensity <= 0) {
            characterControls.moveAngle = null;
            characterControls.moveIntensity = 0;
            characterControls.key[2] = 0;
            return;
        }

        characterControls.key[2] = 0;

        characterControls.moveAngle = angleRadian;
        characterControls.moveIntensity = clampIntensity;

        angleHandleTimeout = setTimeout(() => {
            characterControls.moveAngle = null;
            characterControls.moveIntensity = 0;
            characterControls.key[2] = 0;
        }, 500);
    });

    /**
     * 让角色向指定目标点移动
     * @param targetWorldPos 目标点
     * @param maxHorizontalDistance 最大距离阈值
     */
    on(MovePlayerToTarget, async (targetWorldPos?: Vector3, maxHorizontalDistance: number = 100) => {
        if (!fire(IsPlayerMode)) return; // 仅支持第三人称漫游模式
        if (!targetWorldPos) return;
        if (!fire(IsPointInFront, targetWorldPos)) return;

        // 中断原有控制
        stopMoveToTarget();
        characterControls.key = [0, 0, 0];
        characterControls.moveAngle = null;
        characterControls.moveIntensity = 0;

        fire(UpdateIndicatorTargetStatus, new Vector3(targetWorldPos.x, targetWorldPos.y, targetWorldPos.z)); // 目标点提示球
        fire(IsPlayerMode1) && (await startRotateToVerticalPlane(targetWorldPos)); // 第1人称时，先过渡朝向目标点

        // 1. 计算目标点的地面投影（Y轴与角色保持一致，水平移动）
        const targetProjected = new Vector3(targetWorldPos.x, 0, targetWorldPos.z);

        // 2. 计算角色到目标投影点的方向和距离
        const directionToTarget = new Vector3(
            targetProjected.x - characterControls.position.x,
            targetProjected.y - characterControls.position.y,
            targetProjected.z - characterControls.position.z,
        );
        let distance = directionToTarget.length();

        // 限制最大水平距离
        let limitedTarget = targetProjected; // 默认使用原目标点
        if (distance > maxHorizontalDistance) {
            // 超过最大值时，沿方向取最大距离的点
            directionToTarget.normalize(); // 归一化方向向量
            limitedTarget = new Vector3(
                characterControls.position.x + directionToTarget.x * maxHorizontalDistance,
                playerPosition[1],
                characterControls.position.z + directionToTarget.z * maxHorizontalDistance,
            );
            // 更新距离为最大值
            distance = maxHorizontalDistance;
        }

        // 3. 判断是否需要移动（距离小于阈值则跳过）
        if (distance < targetReachThreshold) return; // 已在目标点，无需移动

        // 4. 判断是否需要奔跑：步行耗时>阈值时长则奔跑
        const walkTime = distance / characterControls.walkVelocity;
        const needRun = walkTime > walkTimeThreshold;
        needRun && fire(IsPlayerMode3) && trigerRunMp3Url && globalEv.fire(PlaytBgAudio, trigerRunMp3Url, false, 0.3);

        // 5. 设置目标移动状态（使用限定后的目标点）
        isMovingToTarget = true;
        targetPosition = limitedTarget; // 替换为限定后的目标点
        characterControls.key[2] = needRun ? 1 : 0; // 标记是否奔跑（复用key[2]字段）
    });

    let rotateProgress = 0;
    let lastFrameTime = performance.now();
    let startAngle = 0;
    let endAngle = 0;
    let rotationRadius = 0;
    let initialY = 0;
    async function startRotateToVerticalPlane(pointA: Vector3) {
        const controls: OrbitControls = fire(GetControls);
        const target = controls.target.clone();
        const cameraPos = controls.object.position.clone();

        // 保存固定参数
        initialY = cameraPos.y;
        rotationRadius = Math.sqrt(Math.pow(cameraPos.x - target.x, 2) + Math.pow(cameraPos.z - target.z, 2));

        // 当前相机的水平角度（从注视点看，相机在哪个方向）
        const dx = cameraPos.x - target.x;
        const dz = cameraPos.z - target.z;
        startAngle = Math.atan2(dx, dz); // 注意：atan2(dx, dz) 对应 (sin, cos) 重建

        // 目标方向：从注视点指向A点的方向
        const adx = pointA.x - target.x;
        const adz = pointA.z - target.z;
        const targetDirAngle = Math.atan2(adx, adz);

        // 关键：相机可以停在 targetDirAngle 或 targetDirAngle + π（正反两个方向）
        // 选择离当前角度更近的那个
        const option1 = targetDirAngle;
        const option2 = targetDirAngle + Math.PI;

        // 归一化到相同范围比较
        const normalizeAngle = (a: number) => {
            while (a > Math.PI) a -= 2 * Math.PI;
            while (a < -Math.PI) a += 2 * Math.PI;
            return a;
        };

        const diff1 = Math.abs(normalizeAngle(option1 - startAngle));
        const diff2 = Math.abs(normalizeAngle(option2 - startAngle));

        endAngle = diff1 < diff2 ? option1 : option2;

        // 确保 endAngle 与 startAngle 连续（不要绕远路）
        while (endAngle - startAngle > Math.PI) endAngle -= 2 * Math.PI;
        while (endAngle - startAngle < -Math.PI) endAngle += 2 * Math.PI;

        // 重置状态
        rotateProgress = 0;
        lastFrameTime = performance.now();
        await sleep(rotateStep(controls, target));
    }

    function rotateStep(controls: OrbitControls, target: Vector3) {
        const DURATION = 500; // 过渡时间(毫秒)
        const currentTime = performance.now();
        const deltaTime = currentTime - lastFrameTime;
        lastFrameTime = currentTime;

        rotateProgress += deltaTime / DURATION;
        rotateProgress = Math.min(rotateProgress, 1);

        const t = 1 - Math.pow(1 - rotateProgress, 3); // 缓动
        const currentAngle = startAngle + (endAngle - startAngle) * t; // 当前绝对角度（插值）

        // 用三角函数重建位置（与 atan2(dx, dz) 对应）
        const newX = target.x + rotationRadius * Math.sin(currentAngle);
        const newZ = target.z + rotationRadius * Math.cos(currentAngle);

        controls.object.position.set(newX, initialY, newZ);

        if (rotateProgress < 1) {
            requestAnimationFrame(() => rotateStep(controls, target));
        }
        return DURATION;
    }

    on(
        OnViewerUpdate,
        () => {
            if (disposed) return;
            if (fire(IsPlayerMode1)) {
                orbitControls.maxDistance = orbitControls.minDistance;
                player?.visible && (player.visible = false);
            } else if (fire(IsPlayerMode3)) {
                orbitControls.maxDistance = 20;
            } else if (fire(IsFlyMode)) {
                return;
            } else {
                !orbitControls.enablePan && (orbitControls.enablePan = true);
                orbitControls.maxDistance = 5000;
                return;
            }
            orbitControls.enablePan && (orbitControls.enablePan = false);

            loadCharacterModelOnce();
            updateCharacter();
        },
        true,
    );

    // 停止向目标移动的辅助函数
    function stopMoveToTarget() {
        isMovingToTarget = false;
        targetPosition = null;

        lastPlayerMoveTime = performance.now();
        fire(UpdateIndicatorTargetStatus, null, true); // 目标点提示球
    }

    function loadCharacterModelOnce() {
        if (loading) return;
        loading = true;

        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(DecoderPath);
        loader.setDRACOLoader(dracoLoader);
        player = new Group();

        loader.load(
            playerUrl,
            gltf => {
                const model = gltf.scene;
                model.scale.set(playerScale, playerScale, playerScale);
                model.rotation.set(0, 0, 0); // 重置原始旋转
                model.rotateX(MathUtils.degToRad(playerRotation[0]));
                model.rotateY(MathUtils.degToRad(playerRotation[1]));
                model.rotateZ(MathUtils.degToRad(playerRotation[2]));
                player.add(model);

                model.traverse((object: any) => {
                    if (object.isMesh) {
                        const mesh = object as Mesh;
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;

                        if (mesh.material instanceof MeshStandardMaterial) {
                            mesh.material.metalness = 0.5;
                            mesh.material.roughness = 0.2;
                            mesh.material.color.set(1, 1, 1);
                            if (mesh.material.map) {
                                mesh.material.metalnessMap = mesh.material.map;
                            }
                            mesh.material.transparent = false;
                            mesh.material.depthWrite = true;
                            mesh.material.depthTest = true;
                        }
                    }
                });

                mixer = new AnimationMixer(model);
                const animations = gltf.animations as AnimationClip[];

                let idle: AnimationClip = null;
                let walk: AnimationClip = null;
                let run: AnimationClip = null;
                let jump: AnimationClip = null;
                const singleAnimate = animations.length === 1;

                if (singleAnimate) {
                    idle = animations[0];
                    walk = animations[0];
                    run = animations[0];
                } else {
                    animations.forEach(item => {
                        const name = item.name.toLowerCase();
                        if (name === idleName) idle = item;
                        if (name === walkName) walk = item;
                        if (name === runName) run = item;
                        if (name.indexOf('jump') >= 0) jump = item;
                    });
                }

                actions = {
                    Idle: mixer.clipAction(idle),
                    Walk: mixer.clipAction(walk),
                    Run: mixer.clipAction(run),
                };
                jump && (actions.Jump = mixer.clipAction(jump));

                Object.entries(actions).forEach(([key, action]) => {
                    if (action) {
                        action.enabled = true;
                        action.setEffectiveTimeScale(1);
                        action.setEffectiveWeight(key === 'Idle' || singleAnimate ? 1 : 0);
                    }
                });
                actions.Idle.play();

                player.position.fromArray(playerPosition);
                fire(UpdateVirtualGroundPosition);

                scene.add(player);

                ready = true;
            },
            () => {},
            error => {
                console.error('model load failed!', error);
            },
        );
    }

    /**
     * 更新角色状态
     */
    function updateCharacter(): void {
        if (!ready) return;

        const delta = clock.getDelta();
        const { key, ease, position, up, rotate, current, fadeDuration, runVelocity, walkVelocity, rotateSpeed, moveAngle, moveIntensity } = characterControls;

        let moveVector = new Vector3(0, 0, 0);
        let hasMoveInput = false;

        if (isMovingToTarget && targetPosition) {
            // 优先处理向目标点移动
            hasMoveInput = true;

            // 1. 计算角色到目标点的方向向量（水平）
            const direction = new Vector3(position.x - targetPosition.x, 0, position.z - targetPosition.z);

            // 2. 判断是否到达目标点
            const distance = direction.length();
            if (distance < 0.5) key[2] = 0; // 跑到边上变行走

            if (distance < targetReachThreshold) {
                stopMoveToTarget(); // 到达目标，停止移动
                hasMoveInput = false;
            } else {
                // 3. 归一化方向向量，计算移动向量
                direction.normalize();
                // 适配模型朝向（乘-1）
                moveVector = direction.multiplyScalar(-1);
            }
        } else if (moveAngle !== null && moveIntensity > 0) {
            // 兼容原有摇杆角度移动
            hasMoveInput = true;
            const cameraForward = new Vector3();
            camera.getWorldDirection(cameraForward);
            cameraForward.y = 0;
            cameraForward.normalize();

            const cameraRight = new Vector3();
            cameraRight.crossVectors(up, cameraForward).normalize();

            const targetDirection = new Vector3();
            targetDirection.x = Math.sin(moveAngle) * cameraRight.x + Math.cos(moveAngle) * cameraForward.x;
            targetDirection.z = Math.sin(moveAngle) * cameraRight.z + Math.cos(moveAngle) * cameraForward.z;
            moveVector = targetDirection;
        } else if (key[0] !== 0 || key[1] !== 0) {
            // 兼容原有前后左右移动
            hasMoveInput = true;
            const cameraDirection = new Vector3();
            camera.getWorldDirection(cameraDirection);
            cameraDirection.y = 0;
            cameraDirection.normalize();

            const cameraRight = new Vector3();
            cameraRight.crossVectors(up, cameraDirection).normalize();

            moveVector.addScaledVector(cameraDirection, key[0] * -1);
            moveVector.addScaledVector(cameraRight, key[1]);
            if (moveVector.length() > 0) moveVector.normalize();
        }

        // 平滑插值
        const easeFactor = 2 * delta; // 缓动系数（值越大，过渡越快）
        ease.lerp(moveVector, easeFactor); // ease向moveVector靠近
        ease.clampLength(0, 1); // 限制最大长度，避免超界
        moveVector = ease.clone(); // 使用缓动后的ease

        // 动画切换逻辑
        const play: 'Idle' | 'Walk' | 'Run' = hasMoveInput ? (key[2] ? 'Run' : 'Walk') : 'Idle';

        if (current !== play) {
            const currentAction = actions[play];
            const oldAction = actions[current];
            characterControls.current = play;

            currentAction.reset();
            currentAction.weight = 1.0;
            currentAction.stopFading();
            oldAction.stopFading();

            if (play !== 'Idle') {
                currentAction.time = oldAction.time * (currentAction.getClip().duration / oldAction.getClip().duration);
            }

            (oldAction as any)._scheduleFading(fadeDuration, oldAction.getEffectiveWeight(), 0);
            (currentAction as any)._scheduleFading(fadeDuration, currentAction.getEffectiveWeight(), 1);
            currentAction.play();
        }

        // 角色移动+转向
        if (play !== 'Idle') {
            const baseVelocity = play === 'Run' ? runVelocity : walkVelocity;
            // 目标移动时力度为1，摇杆/前后左右时复用原有逻辑
            const finalIntensity = isMovingToTarget ? 1 : moveIntensity || 1;
            const finalVelocity = baseVelocity * finalIntensity;
            moveVector.multiplyScalar(finalVelocity * delta);

            // 角色转向：朝向移动方向
            if (moveVector.length() > 0) {
                const targetMatrix = new Matrix4();
                targetMatrix.lookAt(new Vector3(0, 0, 0), moveVector.clone().negate(), up);
                rotate.setFromRotationMatrix(targetMatrix);
                player.quaternion.rotateTowards(rotate, rotateSpeed);
            }

            moveVector = fire(PhysicsMovePlayer, moveVector, delta);

            // 更新位置
            const moveDistance = moveVector ? moveVector.length() : 0;
            const asMoveZero = moveDistance < 0.1;
            if (moveVector) {
                !asMoveZero && (lastPlayerMoveTime = performance.now()); // 有移动时更新最终移动时间
                position.add(moveVector);
                player.position.copy(position);
                orbitControls.target.copy(position).add(new Vector3(0, -playerHeight, 0));
                orbitControls.object.position.add(moveVector);
                fire(PhysicsAdjustCameraByCastShape);
                fire(UpdateVirtualGroundPosition);
            }

            if (asMoveZero && performance.now() - lastPlayerMoveTime > 3000) {
                stopMoveToTarget(); // 3秒原地踏步就停下
            }
        } else {
            if (lastCameraPosition.distanceTo(orbitControls.object.position) > 0.1) {
                lastCameraPosition.copy(orbitControls.object.position);
                fire(PhysicsAdjustCameraByCastShape);
            }
        }

        // 更新动画和控制器
        mixer.update(delta);
    }

    on(
        OnViewerDispose,
        () => {
            if (disposed) return;
            disposed = true;
        },
        true,
    );
}

/** 角色控制配置接口 */
interface CharacterControls {
    key: [number, number, number];
    ease: Vector3;
    position: Vector3;
    up: Vector3;
    rotate: Quaternion;
    current: 'Idle' | 'Walk' | 'Run';
    fadeDuration: number;
    runVelocity: number;
    walkVelocity: number;
    rotateSpeed: number;
    moveAngle: number | null;
    moveIntensity: number;
}

/** 动画动作集合接口 */
interface PlayerActions {
    Idle: AnimationAction;
    Walk: AnimationAction;
    Run: AnimationAction;
    Jump?: AnimationAction;
}
