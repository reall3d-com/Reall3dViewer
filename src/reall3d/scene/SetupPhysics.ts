// ==============================================
// Copyright (c) 2025 reall3d.com, MIT license
// ==============================================
import { BufferAttribute, Clock, Group, LineBasicMaterial, LineSegments, Matrix4, Quaternion, Scene, Vector3 } from 'three';
import { DRACOLoader, GLTFLoader, OrbitControls } from 'three/examples/jsm/Addons.js';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { Events } from '../events/Events';
import {
    PhysicsEnableDebug,
    GetScene,
    PhysicsAddMesh,
    PhysicsRemoveMesh,
    PhysicsAdStaticMesh,
    PhysicsAdDynamicMesh,
    PhysicsInitCharacterController,
    PhysicsMovePlayer,
    OnViewerDispose,
    GetControls,
    PhysicsAddStaticCollisionGlb,
    PhysicsAdjustCameraByCastShape,
    PhysicsGetEnvCollision,
    GetMeta,
} from '../events/EventConstants';
import { DecoderPath } from '../utils/GlobalConstants';
import { MetaData } from '../modeldata/MetaData';

export function setupPhysics(events: Events) {
    let disposed: boolean = false;
    const on = (key: number, fn?: Function, multiFn?: boolean): Function | Function[] => events.on(key, fn, multiFn);
    const fire = (key: number, ...args: any): any => events.fire(key, ...args);

    const controls: OrbitControls = fire(GetControls);
    let world: RAPIER.World;
    let ready: Promise<boolean> = null;
    let enablePhysics = true;
    let enablePhysicsDebug = false;
    let characterController: RAPIER.KinematicCharacterController;
    let characterCollider: RAPIER.Collider;
    let rapierHelper: RapierHelper;

    const meshes = [];
    const meshMap = new WeakMap();
    const _vector = new Vector3();
    const _quaternion = new Quaternion();
    const _matrix = new Matrix4();
    const _scale = new Vector3(1, 1, 1);
    const ZERO = new Vector3();
    const clock = new Clock();
    let keySet: Set<string> = new Set();

    on(PhysicsEnableDebug, (enable = true) => (enablePhysicsDebug = enable));

    let collisionGlb: Group;
    on(PhysicsGetEnvCollision, () => collisionGlb);

    on(PhysicsAddStaticCollisionGlb, async (glbUrl: string) => {
        if (!glbUrl) return;
        await initPhysics();

        const loader = new GLTFLoader();
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath(DecoderPath);
        loader.setDRACOLoader(dracoLoader);

        loader.load(
            glbUrl,
            gltf => {
                const model = gltf.scene;
                model.traverse((object: any) => {
                    object.isMesh && addMesh(object, { type: 'static', mass: 0, friction: 0 });
                });
                model.visible = false;
                (fire(GetScene) as Scene).add(model);
                collisionGlb = model;
            },
            () => {},
            err => console.error(err),
        );
    });

    on(PhysicsAddMesh, async (mesh: any, opt: PhysicsOptions = {}) => {
        await initPhysics();
        addMesh(mesh, opt);
    });
    on(PhysicsAdStaticMesh, async (mesh: any, opt: PhysicsOptions = {}) => {
        await initPhysics();
        opt.type = 'static';
        opt.mass = 0;
        opt.restitution = 0.5;
        addMesh(mesh, opt);
    });
    on(PhysicsAdDynamicMesh, async (mesh: any, opt: PhysicsOptions = {}) => {
        await initPhysics();
        opt.type = 'dynamic';
        opt.mass = opt.mass || 1;
        addMesh(mesh, opt);
    });
    on(PhysicsRemoveMesh, async (mesh: any) => {
        await initPhysics();
        removeMesh(mesh);
    });

    let doing = false;
    on(PhysicsInitCharacterController, async (position = new Vector3(0, 0, 0)) => {
        if (doing) return;
        doing = true;
        const meta: MetaData = fire(GetMeta);
        const [tx, ty, tz] = meta.player?.colliderTranslation || [0, -0.4, 0];

        await initPhysics();
        const controller = world.createCharacterController(0.05);
        controller.setApplyImpulsesToDynamicBodies(true); // 与动态刚体交互
        controller.setCharacterMass(1);
        controller.setUp({ x: 0, y: -1, z: 0 });

        // // 锁定高度
        // controller.setMaxSlopeClimbAngle(0); // 上坡角度设为0 → 完全禁止爬坡
        // controller.setMinSlopeSlideAngle(Math.PI); // 极端值：任何坡度都不触发下坡滑动
        // controller.disableAutostep(); // 禁用自动跨步（彻底禁止上台阶/爬坡）
        // controller.disableSnapToGround(); // 禁用贴地（避免物理引擎自动调整Y轴）
        // controller.setSlideEnabled(true); // 滑动

        controller.setMaxSlopeClimbAngle(Math.PI / 4); // 上坡 45°
        controller.setMinSlopeSlideAngle(Math.PI / 4); // 下坡 45°
        controller.enableAutostep(0.1, 0.05, false); // 自动跨步(maxHeight, minWidth, includeDynamicBodies)
        controller.enableSnapToGround(0.5); // 贴地
        controller.setSlideEnabled(true); // 滑动

        let groundBodyDesc = RAPIER.RigidBodyDesc.fixed();
        let groundBody = world.createRigidBody(groundBodyDesc);
        let groundColliderDesc = RAPIER.ColliderDesc.cuboid(1000, 0.1, 1000).setTranslation(0, 1, 0);
        world.createCollider(groundColliderDesc, groundBody);

        const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, 0, position.z).setCcdEnabled(true).setCanSleep(false);
        const characterBody = world.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(0.6, 0.25).setMass(1).setTranslation(tx, ty, tz).setFriction(0.5).setRestitution(0);
        colliderDesc.setContactSkin(0.02); // 2 cm 皮肤
        characterCollider = world.createCollider(colliderDesc, characterBody);
        characterController = controller;
    });

    let velocityY = 0.01;
    on(PhysicsMovePlayer, (moveVector: Vector3, delta = 1 / 60): Vector3 | null => {
        if (!characterController) {
            fire(PhysicsInitCharacterController);
            return null;
        }
        rapierHelper?.update();
        const position = characterCollider.translation();
        let moveY = moveVector.y + velocityY;
        if (position.y > 0.2) moveY = -0.1; // 别掉了

        const movement = new RAPIER.Vector3(moveVector.x, moveY, moveVector.z);
        characterController.computeColliderMovement(characterCollider, movement);

        const fixedDelta = Math.min(delta, 1 / 30); // 限制最大步长，防止跳帧
        step(fixedDelta);

        const translation = characterController.computedMovement();
        if (Math.abs(translation.y - moveY) > 0.03) {
            velocityY = 0.01; // 上坡
        } else if (Math.abs(translation.y - moveY) < 0.01) {
            velocityY = 0.35; // 下滑
        }

        const base = 1000;
        translation.x = Math.round(translation.x * base) / base;
        translation.y = Math.round(translation.y * base) / base;
        translation.z = Math.round(translation.z * base) / base;

        position.x += translation.x;
        position.y += translation.y;
        position.z += translation.z;

        characterCollider.setTranslation(position);

        return new Vector3(translation.x, translation.y, translation.z);
    });

    const castShapeStartPos = new Vector3();
    const castShapeEndPos = new Vector3();
    const castShapeTgtPos = new Vector3();
    const castShapeTmpPos = new Vector3();
    const direction = new Vector3();
    let savedDistance = 0; // 距离
    let isObstructed = false; // 是否遮挡
    on(PhysicsAdjustCameraByCastShape, () => {
        const ballRadius = 0.2;
        const controls: OrbitControls = fire(GetControls);
        castShapeStartPos.copy(controls.target);
        castShapeEndPos.copy(controls.object.position);

        // 初始距离自动计算
        if (!savedDistance) savedDistance = Math.max(ballRadius + 0.1, castShapeEndPos.distanceTo(castShapeStartPos));

        // 计算方向：从角色头部指向理想相机位置，用 savedDistance 计算理想位置
        direction.subVectors(castShapeEndPos, castShapeStartPos).normalize();
        castShapeTmpPos.copy(castShapeStartPos).add(direction.clone().multiplyScalar(savedDistance));
        const vel = castShapeTmpPos.clone().sub(castShapeStartPos); // 现在：start = 角色头部, end = 理想位置

        const start = new RAPIER.Vector3(castShapeStartPos.x, castShapeStartPos.y, castShapeStartPos.z);
        const rot = { w: 1, x: 0, y: 0, z: 0 };
        const shapeVel = { x: vel.x, y: vel.y, z: vel.z };
        const shape = new RAPIER.Ball(ballRadius);

        const hit = world.castShape(start, rot, shapeVel, shape, 0.0, 1.0, true, undefined, undefined, characterCollider);

        if (hit) {
            // 有遮挡，缩短到遮挡物前
            isObstructed = true;
            const totalLen = vel.length();
            const hitDist = hit.time_of_impact * totalLen; // hit.time_of_impact 是 [0,1] 比例
            const safeDist = Math.max(ballRadius + 0.1, hitDist - ballRadius - 0.05);
            castShapeTgtPos.copy(castShapeStartPos).add(direction.multiplyScalar(safeDist));
        } else {
            // 无遮挡，恢复到原距离
            isObstructed = false;
            castShapeTgtPos.copy(castShapeStartPos).add(direction.multiplyScalar(savedDistance));
        }
        controls.object.position.lerp(castShapeTgtPos, 0.1);
    });

    const lastDir = new Vector3();
    const tmpDir = new Vector3();
    controls.addEventListener('end', () => {
        tmpDir.subVectors(controls.object.position, controls.target).normalize();
        if (Math.abs(lastDir.dot(tmpDir)) > 0.999) {
            const newDist = controls.object.position.distanceTo(controls.target); // 平行，允许调整距离
            if (!isObstructed && Math.abs(newDist - savedDistance) > 0.1) savedDistance = newDist;
        } else {
            lastDir.copy(tmpDir);
        }
    });

    window.addEventListener('keydown', keydownEventListener);
    window.addEventListener('keyup', keyupEventListener);
    on(
        OnViewerDispose,
        () => {
            if (disposed) return;
            disposed = true;
            window.removeEventListener('keydown', keydownEventListener);
            window.removeEventListener('keyup', keyupEventListener);
            world?.free();
        },
        true,
    );

    function initPhysics(): Promise<boolean> {
        if (ready) return ready;
        return (ready = new Promise(async resolve => {
            await RAPIER.init();
            world = new RAPIER.World(new Vector3(0.0, -9.81, 0.0));

            const scene: Scene = fire(GetScene);
            rapierHelper = new RapierHelper();
            scene?.add(rapierHelper);
            if (!scene) {
                ready = null;
            }
            scene?.add(rapierHelper);
            resolve(true);
        }));
    }

    // 几何体转换为 碰撞体描述
    function getShape(geometry: any) {
        const parameters = geometry.parameters;
        if (geometry.type === 'RoundedBoxGeometry') {
            const sx = parameters.width !== undefined ? parameters.width / 2 : 0.5;
            const sy = parameters.height !== undefined ? parameters.height / 2 : 0.5;
            const sz = parameters.depth !== undefined ? parameters.depth / 2 : 0.5;
            const radius = parameters.radius !== undefined ? parameters.radius : 0.1;

            return RAPIER.ColliderDesc.roundCuboid(sx - radius, sy - radius, sz - radius, radius);
        } else if (geometry.type === 'BoxGeometry') {
            const sx = parameters.width !== undefined ? parameters.width / 2 : 0.5;
            const sy = parameters.height !== undefined ? parameters.height / 2 : 0.5;
            const sz = parameters.depth !== undefined ? parameters.depth / 2 : 0.5;

            return RAPIER.ColliderDesc.cuboid(sx, sy, sz);
        } else if (geometry.type === 'SphereGeometry' || geometry.type === 'IcosahedronGeometry') {
            const radius = parameters.radius !== undefined ? parameters.radius : 1;
            return RAPIER.ColliderDesc.ball(radius);
        } else if (geometry.type === 'CylinderGeometry') {
            const radius = parameters.radiusBottom !== undefined ? parameters.radiusBottom : 0.5;
            const length = parameters.height !== undefined ? parameters.height : 0.5;

            return RAPIER.ColliderDesc.cylinder(length / 2, radius);
        } else if (geometry.type === 'CapsuleGeometry') {
            const radius = parameters.radius !== undefined ? parameters.radius : 0.5;
            const length = parameters.height !== undefined ? parameters.height : 0.5;

            return RAPIER.ColliderDesc.capsule(length / 2, radius);
        } else if (geometry.type === 'BufferGeometry') {
            const vertices: number[] = [];
            const vertex = new Vector3();
            const position = geometry.getAttribute('position');

            for (let i = 0; i < position.count; i++) {
                vertex.fromBufferAttribute(position, i);
                vertices.push(vertex.x, vertex.y, vertex.z);
            }

            // if the buffer is non-indexed, generate an index buffer
            const indices = geometry.getIndex() === null ? Uint32Array.from(Array(Math.floor(vertices.length / 3)).keys()) : geometry.getIndex().array;

            return RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), indices);
        }

        console.error('RapierPhysics: Unsupported geometry type:', geometry.type);
        return null;
    }

    function addScene(scene: any) {
        scene.traverse(function (child: any) {
            if (child.isMesh) {
                const physics = child.userData.physics;
                if (physics) {
                    addMesh(child, physics);
                }
            }
        });
    }

    function addMesh(mesh: any, opts: PhysicsOptions = {}) {
        const shape = getShape(mesh.geometry);
        if (!shape) return;

        const mass = opts.mass || 0;

        shape.setMass(mass); // 质量
        shape.setFriction(opts.friction || 0.1); // 摩擦系数
        shape.setRestitution(opts.restitution || 0); // 反弹系数

        const { body, collider } = mesh.isInstancedMesh ? createInstancedBody(mesh, mass, shape) : createBody(mesh.position, mesh.quaternion, mass, shape);

        if (!mesh.userData.physics) mesh.userData.physics = {};

        mesh.userData.physics.body = body;
        mesh.userData.physics.collider = collider;

        if (mass > 0) {
            meshes.push(mesh);
            meshMap.set(mesh, { body, collider });
        }
    }

    function removeMesh(mesh: any) {
        const index = meshes.indexOf(mesh);

        if (index !== -1) {
            meshes.splice(index, 1);
            meshMap.delete(mesh);

            if (!mesh.userData.physics) return;

            const body = mesh.userData.physics.body;
            const collider = mesh.userData.physics.collider;

            if (body) removeBody(body);
            if (collider) removeCollider(collider);
        }
    }

    function createInstancedBody(mesh: any, mass: number, shape: RAPIER.ColliderDesc) {
        const array = mesh.instanceMatrix.array;

        const bodies = [];
        const colliders = [];

        for (let i = 0; i < mesh.count; i++) {
            const position = _vector.fromArray(array, i * 16 + 12);
            const { body, collider } = createBody(position, null, mass, shape);
            bodies.push(body);
            colliders.push(collider);
        }

        return { body: bodies, collider: colliders };
    }

    function createBody(position: Vector3, quaternion: RAPIER.Rotation, mass: number, shape: RAPIER.ColliderDesc) {
        const desc = mass > 0 ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
        desc.setTranslation(position.x, position.y, position.z);
        quaternion && desc.setRotation(quaternion);

        const body = world.createRigidBody(desc);
        const collider = world.createCollider(shape, body);
        return { body, collider };
    }

    function removeBody(body: RAPIER.RigidBody[] | RAPIER.RigidBody) {
        if (Array.isArray(body)) {
            for (let i = 0; i < body.length; i++) {
                world.removeRigidBody(body[i]);
            }
        } else {
            world.removeRigidBody(body);
        }
    }

    function removeCollider(collider: RAPIER.Collider) {
        if (Array.isArray(collider)) {
            for (let i = 0; i < collider.length; i++) {
                world.removeCollider(collider[i], false);
            }
        } else {
            world.removeCollider(collider, false);
        }
    }

    function setMeshPosition(mesh: any, position: Vector3, index = 0) {
        let { body } = meshMap.get(mesh);

        if (mesh.isInstancedMesh) {
            body = body[index];
        }

        body.setAngvel(ZERO);
        body.setLinvel(ZERO);
        body.setTranslation(position);
    }

    function setMeshVelocity(mesh: any, velocity: number, index = 0) {
        let { body } = meshMap.get(mesh);

        if (mesh.isInstancedMesh) {
            body = body[index];
        }

        body.setLinvel(velocity);
    }

    function addHeightfield(mesh: any, width: number, depth: number, heights, scale) {
        const shape = RAPIER.ColliderDesc.heightfield(width, depth, heights, scale);

        const bodyDesc = RAPIER.RigidBodyDesc.fixed();
        bodyDesc.setTranslation(mesh.position.x, mesh.position.y, mesh.position.z);
        bodyDesc.setRotation(mesh.quaternion);

        const body = world.createRigidBody(bodyDesc);
        world.createCollider(shape, body);

        if (!mesh.userData.physics) mesh.userData.physics = {};
        mesh.userData.physics.body = body;

        return body;
    }

    function step(timestep: number) {
        if (!enablePhysics || !world) return;
        world.timestep = timestep || Math.min(clock.getDelta(), 1 / 60);
        world.step();

        for (let i = 0, l = meshes.length; i < l; i++) {
            const mesh = meshes[i];

            if (mesh.isInstancedMesh) {
                const array = mesh.instanceMatrix.array;
                const { body: bodies } = meshMap.get(mesh);

                for (let j = 0; j < bodies.length; j++) {
                    const body = bodies[j];
                    const position = body.translation();
                    _quaternion.copy(body.rotation());
                    _matrix.compose(position, _quaternion, _scale).toArray(array, j * 16);
                }

                mesh.instanceMatrix.needsUpdate = true;
                mesh.computeBoundingSphere();
            } else {
                const { body } = meshMap.get(mesh);
                mesh.position.copy(body.translation());
                mesh.quaternion.copy(body.rotation());
            }
        }
    }

    function keydownEventListener(e: KeyboardEvent) {
        if (e.target['type'] === 'text') return;
        if (e.code === 'AudioVolumeDown' || e.code === 'AudioVolumeUp') return;
        e.preventDefault();
        keySet.add(e.code);
    }

    function keyupEventListener(e: KeyboardEvent) {
        if (e.target['type'] === 'text') return;
        keySet.delete(e.code);
    }

    class RapierHelper extends LineSegments {
        constructor() {
            super();
            this.material = new LineBasicMaterial({ vertexColors: true });
            this.frustumCulled = false;
        }

        public update() {
            if (disposed) return;
            if (!enablePhysicsDebug || !world) {
                this.visible && (this.visible = false);
                return;
            }
            !this.visible && (this.visible = true);

            const { vertices, colors } = world.debugRender();
            this.geometry.deleteAttribute('position');
            this.geometry.deleteAttribute('color');
            this.geometry.setAttribute('position', new BufferAttribute(vertices, 3));
            this.geometry.setAttribute('color', new BufferAttribute(colors, 4));
        }

        public dispose() {
            this.geometry.dispose();
            (this.material as any).dispose?.();
        }
    }
}

export interface PhysicsOptions {
    /** 静态刚体、动态刚体、运动学刚体 */
    type?: 'static' | 'dynamic' | 'kinematic';
    /** 质量 */
    mass?: number;
    /** 摩擦系数 */
    friction?: number;
    /** 反弹系数 */
    restitution?: number;
}
