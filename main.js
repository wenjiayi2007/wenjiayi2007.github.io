
const BLUR = { enabled: true, innerRadius: 150, outerRadius: 400 };
const blurLayer = document.getElementById('blur-layer');
function updateBlurMask(clientX, clientY) {
    if (!BLUR.enabled) return;
    const mask = `radial-gradient(circle at ${clientX}px ${clientY}px, transparent 0px, transparent ${BLUR.innerRadius}px, black ${BLUR.outerRadius}px)`;
    blurLayer.style.maskImage = mask;
    blurLayer.style.webkitMaskImage = mask;
}
updateBlurMask(window.innerWidth / 2, window.innerHeight / 2);
window.addEventListener('mousemove', (e) => updateBlurMask(e.clientX, e.clientY));

const LOAD_BLUR = { blur: 17, tint: 'rgba(255, 255, 255, 0.05)', fadeDuration: 1.2, fadeDelay: 0.2 };
const loadBlurEl = document.getElementById('load-blur-layer');
loadBlurEl.style.backdropFilter = `blur(${LOAD_BLUR.blur}px)`;
loadBlurEl.style.webkitBackdropFilter = `blur(${LOAD_BLUR.blur}px)`;
loadBlurEl.style.background = LOAD_BLUR.tint;
loadBlurEl.style.transition = `opacity ${LOAD_BLUR.fadeDuration}s ease`;
function clearLoadBlur() {
    setTimeout(() => {
        loadBlurEl.classList.add('cleared');
        setTimeout(() => { loadBlurEl.style.display = 'none'; }, LOAD_BLUR.fadeDuration * 1000 + 100);
    }, LOAD_BLUR.fadeDelay * 1000);
}
window.clearLoadBlur = clearLoadBlur;

window.__modelPromise = fetch('./models/wjy3.glb').then(function (res) {
    if (!res.ok) throw new Error('模型请求失败');
    return res.arrayBuffer();
});
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const LOADING = { parseModelAt: 1100 };
const GAZE = { enabled: true, leftBoneName: 'eyeLeft', rightBoneName: 'eyeRight', smooth: 0.80, mouseRange: 1.5, horizontalAxis: 'x', verticalAxis: 'y', horizontalFlip: false, verticalFlip: false, horizontalScale: 1.5, verticalScale: 0.8, moveAmount: 0.3, eyeSeparation: 0.15 };
const HIGHLIGHT = { enabled: true, color: '#ffeeee', intensity: 1, distance: 0.000000005, decay: 0, followDistance: 1.2, offsetX: 0.0, offsetY: 0.0, smooth: 0.5 };

function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
const COLORS = { keyLight: cssVar('--light-key'), fillLight: cssVar('--light-fill'), ambientLight: cssVar('--light-ambient'), outline: cssVar('--outline'), materialFallback: cssVar('--material-fallback'), clear: cssVar('--clear') };

const VIEW = { fov: 45, position: { x: 0, y: 1.39, z: 0.85 }, rotation: { x: 0, y: 5, z: 0 }, lookAtModel: false, lookAtHeight: 0.55 };
const LIGHT = { key: { position: { x: 0.8, y: 2, z: 5 }, intensity: 1.2, castShadow: true }, fill: { position: { x: 5, y: 3, z: -4 }, intensity: 1.2 }, ambient: { intensity: 2 }, envIntensity: 0.35, targetHeightRatio: 0.5 };
const TOON = { steps: 3, outlineThickness: 0.0025, outlineAlpha: 1.0 };

// 1. 基础渲染器（纯默认，去掉了后处理特效）
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(new THREE.Color(COLORS.clear), 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = LIGHT.envIntensity;

const camera = new THREE.PerspectiveCamera(VIEW.fov, window.innerWidth / window.innerHeight, 0.1, 1000);

scene.add(new THREE.AmbientLight(new THREE.Color(COLORS.ambientLight), LIGHT.ambient.intensity));
const keyLight = new THREE.DirectionalLight(new THREE.Color(COLORS.keyLight), LIGHT.key.intensity);
keyLight.position.set(LIGHT.key.position.x, LIGHT.key.position.y, LIGHT.key.position.z);
keyLight.castShadow = LIGHT.key.castShadow;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.bias = -0.0005;
scene.add(keyLight);
scene.add(keyLight.target);
const fillLight = new THREE.DirectionalLight(new THREE.Color(COLORS.fillLight), LIGHT.fill.intensity);
fillLight.position.set(LIGHT.fill.position.x, LIGHT.fill.position.y, LIGHT.fill.position.z);
scene.add(fillLight);

const highlightLight = new THREE.PointLight(new THREE.Color(HIGHLIGHT.color), HIGHLIGHT.intensity, HIGHLIGHT.distance, HIGHLIGHT.decay);
highlightLight.visible = HIGHLIGHT.enabled;
scene.add(highlightLight);

function makeToonGradient(steps) {
    const data = new Uint8Array(steps * 4);
    for (let i = 0; i < steps; i++) {
        const v = Math.round(((i + 0.6) / steps) * 255);
        data[i * 4 + 0] = v; data[i * 4 + 1] = v; data[i * 4 + 2] = v; data[i * 4 + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, steps, 1, THREE.RGBAFormat);
    tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter;
    tex.generateMipmaps = false; tex.needsUpdate = true;
    return tex;
}
const toonGradient = makeToonGradient(TOON.steps);

const mouseNDC = { x: 0, y: 0 };
function updateNDC(clientX, clientY) {
    mouseNDC.x = (clientX / window.innerWidth) * 2 - 1;
    mouseNDC.y = -(clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener('mousemove', (e) => {
    updateNDC(e.clientX, e.clientY);
    updateBlurMask(e.clientX, e.clientY);
});

window.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    updateNDC(touch.clientX, touch.clientY);
    if (!window.isOverviewMode) updateBlurMask(touch.clientX, touch.clientY);
}, { passive: true });

window.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    if (!touch) return;
    const inPanel = e.target.closest('#overview-panel');
    if (inPanel) { updateNDC(touch.clientX, touch.clientY); return; }
    updateNDC(touch.clientX, touch.clientY);
    if (!window.isOverviewMode) updateBlurMask(touch.clientX, touch.clientY);
}, { passive: true });

const _highlightTarget = new THREE.Vector3();
let _highlightInited = false;
function updateHighlight() {
    if (!HIGHLIGHT.enabled) return;
    _highlightTarget.set(mouseNDC.x, mouseNDC.y, 0.5);
    _highlightTarget.unproject(camera);
    _highlightTarget.sub(camera.position).normalize();
    const targetPos = camera.position.clone().addScaledVector(_highlightTarget, HIGHLIGHT.followDistance);
    if (!_highlightInited) { highlightLight.position.copy(targetPos); _highlightInited = true; }
    else { highlightLight.position.lerp(targetPos, HIGHLIGHT.smooth); }
}

let leftBone = null, rightBone = null, leftPos0 = null, rightPos0 = null;
let curMouseX = 0, curMouseY = 0;
function setupGaze(model) {
    leftBone = model.getObjectByName(GAZE.leftBoneName);
    rightBone = model.getObjectByName(GAZE.rightBoneName);
    if (leftBone) leftPos0 = leftBone.position.clone();
    if (rightBone) rightPos0 = rightBone.position.clone();
}
function updateGaze() {
    if (!GAZE.enabled || !leftBone || !rightBone) return;
    curMouseX += (mouseNDC.x - curMouseX) * GAZE.smooth;
    curMouseY += (mouseNDC.y - curMouseY) * GAZE.smooth;
    const mx = curMouseX * GAZE.mouseRange; const my = curMouseY * GAZE.mouseRange; const amt = GAZE.moveAmount;
    let ldx = (mx + GAZE.eyeSeparation) * GAZE.horizontalScale; let ldy = my * GAZE.verticalScale;
    leftBone.position.copy(leftPos0); leftBone.position[GAZE.horizontalAxis] += ldx * amt; leftBone.position[GAZE.verticalAxis] += ldy * amt;
    let rdx = (mx - GAZE.eyeSeparation) * GAZE.horizontalScale; let rdy = my * GAZE.verticalScale;
    rightBone.position.copy(rightPos0); rightBone.position[GAZE.horizontalAxis] += rdx * amt; rightBone.position[GAZE.verticalAxis] += rdy * amt;
}

let isOverviewMode = false;
Object.defineProperty(window, 'isOverviewMode', { get() { return isOverviewMode; } });

const parallaxStrength = 0.012;
const camOriginPos = new THREE.Vector3(VIEW.position.x, VIEW.position.y, VIEW.position.z);
const OVERVIEW_CAM = { targetPos: new THREE.Vector3(1.1, 1.3, 0.2), lookAt: new THREE.Vector3(0, 1.2, -1.4) };

let cameraProgress = 0;
const CAMERA_DURATION = 1.1;

function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

function updateCamera(deltaTime) {
    const targetProgress = isOverviewMode ? 1.0 : 0.0;
    if (cameraProgress < targetProgress) {
        cameraProgress = Math.min(targetProgress, cameraProgress + deltaTime / CAMERA_DURATION);
    } else if (cameraProgress > targetProgress) {
        cameraProgress = Math.max(targetProgress, cameraProgress - deltaTime / CAMERA_DURATION);
    }
    const smoothT = easeInOutCubic(cameraProgress);
    const offsetX = THREE.MathUtils.clamp(mouseNDC.x * parallaxStrength, -0.07, 0.07);
    const offsetY = THREE.MathUtils.clamp(mouseNDC.y * parallaxStrength, -0.07, 0.07);
    const homePos = new THREE.Vector3(camOriginPos.x + offsetX, camOriginPos.y + offsetY, camOriginPos.z);
    const homeLookAt = new THREE.Vector3(0, 1.27, 0);
    camera.position.lerpVectors(homePos, OVERVIEW_CAM.targetPos, smoothT);
    const currentLookAt = new THREE.Vector3().lerpVectors(homeLookAt, OVERVIEW_CAM.lookAt, smoothT);
    camera.lookAt(currentLookAt);
}

const enterBtn = document.getElementById('enter-overview-btn');
const closeBtn = document.getElementById('close-overview-btn');

function closeOverview() {
    if (!isOverviewMode) return;
    isOverviewMode = false;
    document.body.classList.remove('in-overview');
    GAZE.enabled = true;
    HIGHLIGHT.enabled = true;
}

enterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    isOverviewMode = true;
    document.body.classList.add('in-overview');
    HIGHLIGHT.enabled = false;
});

closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeOverview();
});
// ============================================================
// ★★★ 移动端：在面板上向右滑动关闭面板 ★★★
// ============================================================
const overviewPanel = document.getElementById('overview-panel');
let touchStartX = 0;
let isSwiping = false;

overviewPanel.addEventListener('touchstart', (e) => {
    if (!isOverviewMode) return;
    touchStartX = e.touches[0].clientX;
    isSwiping = true;
}, { passive: true });

overviewPanel.addEventListener('touchmove', (e) => {
    if (!isSwiping || !isOverviewMode) return;

    const touchCurrentX = e.touches[0].clientX;
    const swipeDistance = touchCurrentX - touchStartX;

    // 如果向右滑动的距离超过 80 像素，直接关闭
    if (swipeDistance > 80) {
        isSwiping = false;
        closeOverview();
    }
}, { passive: true });

overviewPanel.addEventListener('touchend', () => {
    isSwiping = false;
}, { passive: true });
// ============================================================
document.addEventListener('click', (e) => {
    if (!isOverviewMode) return;
    if (e.target.closest('#overview-panel') || e.target.closest('#enter-overview-btn')) return;
    closeOverview();
});

const clock = new THREE.Clock();
let mixer = null;

// 2. 主渲染循环（去掉了 effect.render 造成的描边冲突）
renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (mixer) mixer.update(delta);
    updateCamera(delta);
    updateGaze();
    updateHighlight();
    renderer.render(scene, camera); // 纯原生渲染
});

const loader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(draco);

// 3. 加载小人模型（剥离了 OutlineEffect 的强加参数）
try {
    const arrayBuffer = await window.__modelPromise;
    loader.parse(arrayBuffer, './', onModelLoaded, onLoadError);
} catch (err) { onLoadError(err); }

function onLoadError(err) {
    console.error('模型加载失败：', err);
    if (window.clearLoadBlur) window.clearLoadBlur();
}

function onModelLoaded(gltf) {
    const model = gltf.scene;
    model.scale.set(0.018, 0.018, 0.018);
    model.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = true; obj.receiveShadow = true; obj.frustumCulled = false;
        const oldMats = Array.isArray(obj.material) ? obj.material : [obj.material];
        const newMats = oldMats.map((old) => {
            const toon = new THREE.MeshToonMaterial({
                map: old.map || null, color: old.color ? old.color.clone() : new THREE.Color(COLORS.materialFallback),
                gradientMap: toonGradient, alphaTest: old.alphaTest || 0, transparent: old.transparent || false,
                opacity: old.opacity !== undefined ? old.opacity : 1, side: old.side,
            });
            if (toon.map) toon.map.colorSpace = THREE.SRGBColorSpace;
            // 彻底移除了描边参数
            return toon;
        });
        obj.material = Array.isArray(obj.material) ? newMats : newMats[0];
    });

    const junk = [];
    model.traverse((obj) => {
        if (!obj.isMesh) return;
        if (/background|bg_?box|sky|dome|sphere|room|stage|floor|ground|groundplane|shadow_?plane/i.test(obj.name)) {
            junk.push(obj);
        }
    });
    junk.forEach((o) => o.parent && o.parent.remove(o));
    scene.add(model);

    const box0 = new THREE.Box3().setFromObject(model);
    const c0 = box0.getCenter(new THREE.Vector3());
    model.position.x -= c0.x; model.position.z -= c0.z; model.position.z -= 0.9; model.position.y -= box0.min.y; model.position.y += 0.45;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    camera.position.set(VIEW.position.x, VIEW.position.y, VIEW.position.z);
    camera.rotation.set(
        THREE.MathUtils.degToRad(VIEW.rotation.x),
        THREE.MathUtils.degToRad(VIEW.rotation.y),
        THREE.MathUtils.degToRad(VIEW.rotation.z),
        'XYZ'
    );
    camera.near = maxDim / 100; camera.far = maxDim * 100; camera.updateProjectionMatrix();

    const d = maxDim * 0.75 + 1;
    const sc = keyLight.shadow.camera;
    sc.left = -d; sc.right = d; sc.top = d; sc.bottom = -d; sc.near = 0.1; sc.far = maxDim * 50;
    sc.updateProjectionMatrix();

    const targetY = size.y * LIGHT.targetHeightRatio;
    keyLight.target.position.set(0, targetY, 0); keyLight.target.updateMatrixWorld();

    HIGHLIGHT.distance = maxDim * 0.8;
    highlightLight.distance = HIGHLIGHT.distance;

    if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.setLoop(THREE.LoopRepeat, Infinity); action.clampWhenFinished = false; action.play();
        });
    }

    setupGaze(model);
    if (window.clearLoadBlur) window.clearLoadBlur();
}

// 4. 加载圆柱体（纯默认方式加载，不做任何后处理特效干预）
// 4. 加载圆柱体（并让它转起来）
loader.load('./models/wenjiayi.glb', (gltf) => {
    const signatureCylinder = gltf.scene;

    signatureCylinder.traverse((child) => {
        if (child.isMesh) {
            child.material.side = THREE.FrontSide;
        }
    });

    // 调好的位置和大小
    signatureCylinder.position.set(0, 1.62, -0.845);
    signatureCylinder.rotation.x = -0.16;
    signatureCylinder.scale.set(0.29, 0.29, 0.29);

    scene.add(signatureCylinder);

    // 👇 关键：在渲染循环中，让圆柱体绕着 Y 轴自转 👇
    // 我们用 requestAnimationFrame，它会和你的场景渲染速度同步
    function animateCylinder() {
        requestAnimationFrame(animateCylinder);

        // 0.01 是旋转速度，数字越大转得越快，负数就是反方向转
        signatureCylinder.rotation.y -= 0.01;
    }

    // 启动旋转
    animateCylinder();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});