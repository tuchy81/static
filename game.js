// ============================================================
//  갤러그 3D — Three.js   (3 styles + OBJ models + touch)
// ============================================================
/* global THREE, selectStyle */

// ---- OBJ loader ----
const objLoader = new THREE.OBJLoader();
let loadedF35 = null;
let loadedZombie = null;

// Preload OBJ models
function loadOBJModels() {
  return Promise.all([
    new Promise(resolve => {
      objLoader.load('uploads_files_2634091_f35+base.obj', obj => {
        // Normalize size & center
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 3.0 / maxDim;
        obj.scale.setScalar(scale);
        obj.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
        // Apply F-35 stealth colors per part
        const colors = [
          0x4a4e53, 0x5a5e63, 0x52565b, 0x3a3d42, 0x5a5e63,
          0x4a4e53, 0x52565b, 0x3a3d42, 0x5a5e63, 0x4a4e53,
          0x52565b, 0x5a5e63, 0x4a4e53, 0x3a3d42, 0x52565b,
          0x5a5e63, 0x4a4e53
        ];
        let idx = 0;
        obj.traverse(child => {
          if (child.isMesh) {
            const c = colors[idx % colors.length];
            child.material = new THREE.MeshStandardMaterial({
              color: c, flatShading: true,
              roughness: 0.3, metalness: 0.7,
            });
            child.castShadow = true;
            child.receiveShadow = true;
            idx++;
          }
        });
        // Wrap in group so we can add afterburner
        const g = new THREE.Group();
        g.add(obj);
        // Cockpit canopy glow
        const canopyGeo = new THREE.SphereGeometry(0.15, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
        const canopy = new THREE.Mesh(canopyGeo, new THREE.MeshStandardMaterial({
          color: 0x88bbdd, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.6
        }));
        canopy.scale.set(1, 0.6, 1.5);
        canopy.position.set(0, 0.2, -0.5);
        g.add(canopy);
        // Afterburner
        const abGeo = new THREE.ConeGeometry(0.12, 0.6, 8);
        const abMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 2 });
        const ab = new THREE.Mesh(abGeo, abMat);
        ab.rotation.x = -Math.PI / 2;
        ab.position.set(0, 0, 1.6);
        ab.name = 'afterburner';
        g.add(ab);
        loadedF35 = g;
        resolve();
      }, undefined, () => { loadedF35 = null; resolve(); });
    }),
    new Promise(resolve => {
      objLoader.load('uploads_files_1005291_zombie_full.obj', obj => {
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = 1.4 / maxDim;
        obj.scale.setScalar(scale);
        obj.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
        obj.rotation.y = Math.PI; // 플레이어를 바라보도록 180도 회전
        // Zombie skin/clothes colors
        const skinColors = [0x5a6a45, 0x4a5a38, 0x3a4a30];
        let idx = 0;
        obj.traverse(child => {
          if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
              color: skinColors[idx % skinColors.length],
              flatShading: true, roughness: 0.8, metalness: 0.1,
            });
            child.castShadow = true;
            idx++;
          }
        });
        // Add glowing eyes
        const eyeGeo = new THREE.SphereGeometry(0.04, 6, 6);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff3300, emissive: 0xff2200, emissiveIntensity: 2 });
        [-0.08, 0.08].forEach(x => {
          const eye = new THREE.Mesh(eyeGeo, eyeMat);
          eye.position.set(x, 1.15, -0.15);
          obj.add(eye);
        });
        loadedZombie = obj;
        resolve();
      }, undefined, () => { loadedZombie = null; resolve(); });
    })
  ]);
}

// ---- Touch controls ----
const touchInput = { dx: 0, dz: 0, fire: false };
let joystickActive = false;
let joystickTouchId = null;
let joystickStartX = 0, joystickStartY = 0;

function isMobile() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function setupTouchControls() {
  if (!isMobile()) return;
  const tc = document.getElementById('touch-controls');
  tc.classList.add('vis');

  const area = document.getElementById('joystick-area');
  const knob = document.getElementById('joystick-knob');
  const fireBtn = document.getElementById('fire-btn');
  const maxDist = 55;

  area.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joystickTouchId = t.identifier;
    joystickActive = true;
    const rect = area.getBoundingClientRect();
    joystickStartX = rect.left + rect.width / 2;
    joystickStartY = rect.top + rect.height / 2;
  }, { passive: false });

  window.addEventListener('touchmove', e => {
    if (!joystickActive) return;
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        let ox = t.clientX - joystickStartX;
        let oy = t.clientY - joystickStartY;
        const dist = Math.sqrt(ox * ox + oy * oy);
        if (dist > maxDist) { ox = ox / dist * maxDist; oy = oy / dist * maxDist; }
        knob.style.left = (50 + ox) + 'px';
        knob.style.top = (50 + oy) + 'px';
        touchInput.dx = ox / maxDist;
        touchInput.dz = oy / maxDist;
      }
    }
  }, { passive: true });

  const resetJoystick = e => {
    for (const t of e.changedTouches) {
      if (t.identifier === joystickTouchId) {
        joystickActive = false;
        joystickTouchId = null;
        touchInput.dx = 0;
        touchInput.dz = 0;
        knob.style.left = '50px';
        knob.style.top = '50px';
      }
    }
  };
  window.addEventListener('touchend', resetJoystick);
  window.addEventListener('touchcancel', resetJoystick);

  // Fire button
  fireBtn.addEventListener('touchstart', e => {
    e.preventDefault();
    touchInput.fire = true;
  }, { passive: false });
  fireBtn.addEventListener('touchend', () => { touchInput.fire = false; });
  fireBtn.addEventListener('touchcancel', () => { touchInput.fire = false; });
}

// ---- renderer / scene / camera ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 14, 12);
camera.lookAt(0, 0, -4);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- lights ----
const ambient = new THREE.AmbientLight(0x404050, 0.6);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
dirLight.position.set(5, 12, 8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(1024, 1024);
dirLight.shadow.camera.near = 1; dirLight.shadow.camera.far = 50;
dirLight.shadow.camera.left = -15; dirLight.shadow.camera.right = 15;
dirLight.shadow.camera.top = 15; dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);
const hemi = new THREE.HemisphereLight(0x4488ff, 0x002244, 0.3);
scene.add(hemi);

// ---- starfield ----
const starGeo = new THREE.BufferGeometry();
const starPos = new Float32Array(600 * 3);
for (let i = 0; i < 600; i++) {
  starPos[i * 3] = (Math.random() - 0.5) * 80;
  starPos[i * 3 + 1] = (Math.random() - 0.5) * 40 + 10;
  starPos[i * 3 + 2] = -Math.random() * 60 - 5;
}
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, sizeAttenuation: true });
const stars = new THREE.Points(starGeo, starMat);
scene.add(stars);

// ---- grid floor ----
const gridHelper = new THREE.GridHelper(40, 40, 0x112233, 0x0a1520);
gridHelper.position.y = -0.6;
scene.add(gridHelper);

// ---- fog ----
scene.fog = new THREE.FogExp2(0x000510, 0.018);

// ============================================================
//  Model builders
// ============================================================

// ---- Shared materials cache ----
const mats = {};
function M(color, opts) {
  const key = color + JSON.stringify(opts || {});
  if (!mats[key]) {
    mats[key] = new THREE.MeshStandardMaterial({
      color, flatShading: true, ...opts
    });
  }
  return mats[key];
}
function MEmit(color, intensity) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity || 1, flatShading: true
  });
}

// ============================================================
//  STYLE 0 — F-35 Lightning II  (reference photo: dark grey stealth)
// ============================================================
function buildF35() {
  if (loadedF35) {
    return loadedF35.clone();
  }
  // Fallback: simple placeholder if OBJ failed to load
  const g = new THREE.Group();
  const bodyGeo = new THREE.ConeGeometry(0.3, 2.5, 4);
  const body = new THREE.Mesh(bodyGeo, M(0x5a5e63, { roughness: 0.3, metalness: 0.7 }));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const wingGeo = new THREE.BoxGeometry(2.5, 0.04, 0.6);
  g.add(new THREE.Mesh(wingGeo, M(0x52565b, { roughness: 0.35, metalness: 0.7 })));
  const abGeo = new THREE.ConeGeometry(0.11, 0.5, 8);
  const ab = new THREE.Mesh(abGeo, MEmit(0xff6600, 2));
  ab.rotation.x = -Math.PI / 2; ab.position.set(0, 0, 1.4); ab.name = 'afterburner';
  g.add(ab);
  g.traverse(c => { if (c.isMesh) { c.castShadow = true; } });
  return g;
}

function buildAlienDrone() {
  const g = new THREE.Group();
  // Saucer body
  const bodyGeo = new THREE.CylinderGeometry(0.5, 0.6, 0.2, 8);
  g.add(new THREE.Mesh(bodyGeo, M(0x882222, { metalness: 0.6 })));
  // Dome
  const domeGeo = new THREE.SphereGeometry(0.25, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = new THREE.Mesh(domeGeo, M(0xff4444, { metalness: 0.4, emissive: 0x330000, emissiveIntensity: 0.3 }));
  dome.position.y = 0.1;
  g.add(dome);
  // Sensor arms
  const armGeo = new THREE.BoxGeometry(0.08, 0.06, 0.5);
  const armMat = M(0x666666, { metalness: 0.8 });
  const la = new THREE.Mesh(armGeo, armMat); la.position.set(-0.45, 0, 0); la.rotation.y = 0.4; g.add(la);
  const ra = new THREE.Mesh(armGeo, armMat); ra.position.set(0.45, 0, 0); ra.rotation.y = -0.4; g.add(ra);
  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const eyeMat = MEmit(0xff0000, 2);
  const le = new THREE.Mesh(eyeGeo, eyeMat); le.position.set(-0.15, 0.15, -0.2); g.add(le);
  const re = new THREE.Mesh(eyeGeo, eyeMat); re.position.set(0.15, 0.15, -0.2); g.add(re);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function buildAlienTank() {
  const g = new THREE.Group();
  const bodyGeo = new THREE.BoxGeometry(0.8, 0.35, 0.7);
  g.add(new THREE.Mesh(bodyGeo, M(0x225522, { metalness: 0.5 })));
  // Turret
  const turGeo = new THREE.BoxGeometry(0.4, 0.2, 0.4);
  const tur = new THREE.Mesh(turGeo, M(0x336633, { metalness: 0.5 }));
  tur.position.y = 0.25; g.add(tur);
  // Cannon
  const canGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6);
  const can = new THREE.Mesh(canGeo, M(0x444444, { metalness: 0.8 }));
  can.rotation.x = Math.PI / 2; can.position.set(0, 0.28, -0.4); g.add(can);
  // Eyes
  const eyeMat = MEmit(0x00ff00, 2);
  const eg = new THREE.SphereGeometry(0.05, 6, 6);
  const le = new THREE.Mesh(eg, eyeMat); le.position.set(-0.1, 0.35, -0.18); g.add(le);
  const re = new THREE.Mesh(eg, eyeMat); re.position.set(0.1, 0.35, -0.18); g.add(re);
  // Treads
  const tGeo = new THREE.BoxGeometry(0.12, 0.12, 0.8);
  const tMat = M(0x333333, { metalness: 0.7 });
  const lt = new THREE.Mesh(tGeo, tMat); lt.position.set(-0.48, -0.18, 0); g.add(lt);
  const rt = new THREE.Mesh(tGeo, tMat); rt.position.set(0.48, -0.18, 0); g.add(rt);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function buildAlienBoss() {
  const g = new THREE.Group();
  // Mothership hull
  const hullGeo = new THREE.CylinderGeometry(0.8, 1.2, 0.4, 6);
  g.add(new THREE.Mesh(hullGeo, M(0x442266, { metalness: 0.6 })));
  // Upper structure
  const upGeo = new THREE.CylinderGeometry(0.4, 0.8, 0.3, 6);
  const up = new THREE.Mesh(upGeo, M(0x553388, { metalness: 0.5 }));
  up.position.y = 0.3; g.add(up);
  // Crown spikes
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const spGeo = new THREE.ConeGeometry(0.08, 0.5, 4);
    const sp = new THREE.Mesh(spGeo, M(0xffcc00, { emissive: 0x332200, emissiveIntensity: 0.5 }));
    sp.position.set(Math.cos(a) * 0.5, 0.6, Math.sin(a) * 0.5);
    g.add(sp);
  }
  // Core glow
  const coreGeo = new THREE.SphereGeometry(0.25, 8, 8);
  const core = new THREE.Mesh(coreGeo, MEmit(0xaa33ff, 2));
  core.position.y = 0.45; core.name = 'core'; g.add(core);
  // Eyes
  const eyeMat = MEmit(0xff0066, 2);
  const eg = new THREE.SphereGeometry(0.08, 6, 6);
  [-0.3, 0.3].forEach(x => { const e = new THREE.Mesh(eg, eyeMat); e.position.set(x, 0.15, -0.6); g.add(e); });
  // Wings
  const wGeo = new THREE.BoxGeometry(1.0, 0.06, 0.5);
  const wMat = M(0x3a2255, { metalness: 0.5 });
  const lw = new THREE.Mesh(wGeo, wMat); lw.position.set(-1.1, 0, 0); g.add(lw);
  const rw = new THREE.Mesh(wGeo, wMat); rw.position.set(1.1, 0, 0); g.add(rw);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

// ============================================================
//  STYLE 1 — Person spitting watermelon seeds vs Fruits
// ============================================================
function buildPerson() {
  const g = new THREE.Group();
  const skinMat = M(0xdbb896);
  const skinDk = M(0xc9a682);
  const shirtMat = M(0x2277dd);
  const pantsMat = M(0x334466);
  const shoeMat = M(0x443322);
  const hairMat = M(0x221100);

  // Torso (T-shirt)
  const torsoGeo = new THREE.BoxGeometry(0.42, 0.48, 0.26);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.y = 0.05;
  g.add(torso);

  // Head
  const headGeo = new THREE.SphereGeometry(0.2, 8, 6);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 0.45, 0);
  g.add(head);

  // Hair
  const hairGeo = new THREE.SphereGeometry(0.21, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.set(0, 0.47, 0.01);
  g.add(hair);

  // Eyes
  const eyeGeo = new THREE.SphereGeometry(0.03, 6, 6);
  const eyeWhite = M(0xffffff);
  const eyePupil = M(0x111111);
  [-0.07, 0.07].forEach(x => {
    const ew = new THREE.Mesh(eyeGeo, eyeWhite);
    ew.position.set(x, 0.48, -0.17);
    g.add(ew);
    const ep = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyePupil);
    ep.position.set(x, 0.48, -0.2);
    g.add(ep);
  });

  // Mouth (open, spitting pose)
  const mouthGeo = new THREE.SphereGeometry(0.045, 6, 6);
  const mouth = new THREE.Mesh(mouthGeo, M(0x882222));
  mouth.scale.set(1, 0.7, 0.5);
  mouth.position.set(0, 0.37, -0.18);
  g.add(mouth);

  // Cheeks (puffed, about to spit)
  const cheekGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const cheekMat = M(0xe8a8a0);
  [-0.13, 0.13].forEach(x => {
    const ch = new THREE.Mesh(cheekGeo, cheekMat);
    ch.position.set(x, 0.4, -0.12);
    g.add(ch);
  });

  // Left arm - holding watermelon slice
  const armGeo = new THREE.BoxGeometry(0.1, 0.38, 0.1);
  const lArm = new THREE.Mesh(armGeo, skinMat);
  lArm.position.set(-0.3, 0.0, -0.1);
  lArm.rotation.x = -0.4;
  lArm.rotation.z = 0.2;
  g.add(lArm);
  // Hand
  const handGeo = new THREE.SphereGeometry(0.06, 6, 6);
  const lHand = new THREE.Mesh(handGeo, skinMat);
  lHand.position.set(-0.33, -0.18, -0.2);
  g.add(lHand);

  // Watermelon slice in hand
  const sliceGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 8, 1, false, 0, Math.PI);
  const slice = new THREE.Mesh(sliceGeo, M(0xee3322)); // red inside
  slice.rotation.z = Math.PI / 2;
  slice.rotation.y = 0.3;
  slice.position.set(-0.38, -0.08, -0.25);
  g.add(slice);
  // Rind
  const rindGeo = new THREE.TorusGeometry(0.22, 0.03, 4, 8, Math.PI);
  const rind = new THREE.Mesh(rindGeo, M(0x228822));
  rind.rotation.z = Math.PI / 2;
  rind.rotation.y = 0.3;
  rind.position.set(-0.38, -0.08, -0.25);
  g.add(rind);
  // Seeds on slice
  const seedMat = M(0x1a1008);
  const seedGeo = new THREE.SphereGeometry(0.015, 4, 4);
  [[-0.35, -0.03, -0.28], [-0.4, -0.1, -0.26], [-0.36, -0.14, -0.27]].forEach(p => {
    const s = new THREE.Mesh(seedGeo, seedMat);
    s.position.set(...p);
    g.add(s);
  });

  // Right arm (relaxed)
  const rArm = new THREE.Mesh(armGeo, skinMat);
  rArm.position.set(0.3, -0.02, 0.02);
  rArm.rotation.z = -0.15;
  g.add(rArm);
  const rHand = new THREE.Mesh(handGeo, skinMat);
  rHand.position.set(0.32, -0.2, 0.02);
  g.add(rHand);

  // Legs
  const legGeo = new THREE.BoxGeometry(0.13, 0.38, 0.14);
  [-0.1, 0.1].forEach(x => {
    const l = new THREE.Mesh(legGeo, pantsMat);
    l.position.set(x, -0.38, 0);
    g.add(l);
  });

  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.14, 0.08, 0.2);
  [-0.1, 0.1].forEach(x => {
    const s = new THREE.Mesh(shoeGeo, shoeMat);
    s.position.set(x, -0.58, -0.03);
    g.add(s);
  });

  g.scale.set(1.15, 1.15, 1.15);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function buildApple() {
  const g = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.4, 8, 8);
  g.add(new THREE.Mesh(bodyGeo, M(0xcc1111)));
  // Stem
  const stemGeo = new THREE.CylinderGeometry(0.02, 0.03, 0.15, 4);
  const stem = new THREE.Mesh(stemGeo, M(0x553311));
  stem.position.y = 0.42; g.add(stem);
  // Leaf
  const leafGeo = new THREE.ConeGeometry(0.06, 0.15, 4);
  const leaf = new THREE.Mesh(leafGeo, M(0x22aa22));
  leaf.rotation.z = -0.8; leaf.position.set(0.08, 0.45, 0); g.add(leaf);
  // Eyes
  const eg = new THREE.SphereGeometry(0.05, 6, 6);
  const em = M(0x111111);
  [-0.12, 0.12].forEach(x => { const e = new THREE.Mesh(eg, em); e.position.set(x, 0.05, -0.36); g.add(e); });
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function buildOrange() {
  const g = new THREE.Group();
  const bodyGeo = new THREE.SphereGeometry(0.38, 8, 8);
  g.add(new THREE.Mesh(bodyGeo, M(0xff8800)));
  // Nub
  const nGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.06, 6);
  const n = new THREE.Mesh(nGeo, M(0x338811));
  n.position.y = 0.38; g.add(n);
  // Eyes
  const eg = new THREE.SphereGeometry(0.04, 6, 6);
  const em = M(0x111111);
  [-0.1, 0.1].forEach(x => { const e = new THREE.Mesh(eg, em); e.position.set(x, 0.05, -0.34); g.add(e); });
  // Mouth
  const mGeo = new THREE.TorusGeometry(0.08, 0.015, 4, 8, Math.PI);
  const mo = new THREE.Mesh(mGeo, M(0x663300));
  mo.rotation.x = Math.PI; mo.position.set(0, -0.08, -0.34); g.add(mo);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function buildWatermelonBoss() {
  const g = new THREE.Group();
  // Big ellipsoid
  const bodyGeo = new THREE.SphereGeometry(1, 10, 8);
  bodyGeo.scale(1.2, 0.9, 1);
  g.add(new THREE.Mesh(bodyGeo, M(0x226622)));
  // Stripes
  const stripeMat = M(0x114411);
  for (let i = -2; i <= 2; i++) {
    const sGeo = new THREE.BoxGeometry(0.08, 1.4, 2.0);
    const s = new THREE.Mesh(sGeo, stripeMat);
    s.position.x = i * 0.35;
    g.add(s);
  }
  // Bite showing red inside
  const biteGeo = new THREE.SphereGeometry(0.45, 8, 8);
  const bite = new THREE.Mesh(biteGeo, M(0xee3322));
  bite.position.set(0.5, 0.2, -0.7); g.add(bite);
  // Seeds in bite
  const seedMat = M(0x221100);
  const seedGeo = new THREE.SphereGeometry(0.04, 4, 4);
  [[0.4, 0.25, -0.9], [0.55, 0.15, -0.85], [0.6, 0.3, -0.82]].forEach(p => {
    const s = new THREE.Mesh(seedGeo, seedMat); s.position.set(...p); g.add(s);
  });
  // Angry eyes
  const eyeMat = MEmit(0xff2222, 1.5);
  const eg = new THREE.SphereGeometry(0.1, 6, 6);
  [-0.35, 0.15].forEach(x => { const e = new THREE.Mesh(eg, eyeMat); e.position.set(x, 0.3, -0.85); g.add(e); });
  // Vine
  const vGeo = new THREE.CylinderGeometry(0.04, 0.02, 0.5, 4);
  const v = new THREE.Mesh(vGeo, M(0x338811));
  v.rotation.z = 0.3; v.position.set(0, 0.95, 0); g.add(v);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

// ============================================================
//  STYLE 2 — Archer vs Zombies
// ============================================================
function buildArcher() {
  const g = new THREE.Group();
  // Torso
  const torsoGeo = new THREE.BoxGeometry(0.4, 0.5, 0.25);
  g.add(new THREE.Mesh(torsoGeo, M(0x2a6630)));
  // Head
  const headGeo = new THREE.SphereGeometry(0.18, 8, 6);
  const head = new THREE.Mesh(headGeo, M(0xdbb896));
  head.position.y = 0.4; g.add(head);
  // Hair
  const hairGeo = new THREE.SphereGeometry(0.19, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const hair = new THREE.Mesh(hairGeo, M(0x331a08));
  hair.position.y = 0.42; g.add(hair);
  // Eyes
  const eg = new THREE.SphereGeometry(0.03, 6, 6);
  [-0.06, 0.06].forEach(x => {
    const e = new THREE.Mesh(eg, M(0x2255aa));
    e.position.set(x, 0.42, -0.16); g.add(e);
  });
  // Bow
  const bowGeo = new THREE.TorusGeometry(0.3, 0.025, 4, 12, Math.PI);
  const bow = new THREE.Mesh(bowGeo, M(0x885522));
  bow.position.set(-0.35, 0.15, -0.05);
  bow.rotation.y = Math.PI / 2;
  g.add(bow);
  // Bowstring
  const strGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.58, 3);
  const str = new THREE.Mesh(strGeo, M(0xccccaa));
  str.position.set(-0.35, 0.15, -0.05);
  g.add(str);
  // Quiver
  const qGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.45, 6);
  const q = new THREE.Mesh(qGeo, M(0x664422));
  q.position.set(0.1, 0.1, 0.18); q.rotation.x = 0.15; g.add(q);
  // Arrow tips
  const atGeo = new THREE.ConeGeometry(0.025, 0.08, 3);
  const atMat = M(0xaaaaaa, { metalness: 0.8 });
  [0.06, 0.14].forEach(x => {
    const a = new THREE.Mesh(atGeo, atMat);
    a.position.set(x, 0.38, 0.18); g.add(a);
  });
  // Cape
  const capeGeo = new THREE.ConeGeometry(0.3, 0.6, 4);
  const cape = new THREE.Mesh(capeGeo, M(0x1a4422, { transparent: true, opacity: 0.85 }));
  cape.position.set(0, -0.05, 0.2);
  cape.rotation.x = 0.2;
  g.add(cape);
  // Legs
  const legGeo = new THREE.BoxGeometry(0.12, 0.35, 0.14);
  const legMat = M(0x553322);
  [-0.1, 0.1].forEach(x => {
    const l = new THREE.Mesh(legGeo, legMat);
    l.position.set(x, -0.4, 0); g.add(l);
  });
  // Boots
  const bootGeo = new THREE.BoxGeometry(0.13, 0.08, 0.2);
  const bootMat = M(0x332211);
  [-0.1, 0.1].forEach(x => {
    const b = new THREE.Mesh(bootGeo, bootMat);
    b.position.set(x, -0.58, -0.02); g.add(b);
  });
  g.scale.set(1.2, 1.2, 1.2);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function buildZombie() {
  if (loadedZombie) {
    const clone = loadedZombie.clone();
    // Slightly different color tint for variety
    clone.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = child.material.clone();
        child.material.color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.05);
      }
    });
    return clone;
  }
  // Fallback
  const g = new THREE.Group();
  const skinMat = M(0x6b7a55);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.25), M(0x444450)));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.25), skinMat);
  head.position.y = 0.35; g.add(head);
  const eyeMat = MEmit(0xff3300, 1.5);
  [-0.07, 0.07].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat); e.position.set(x, 0.38, -0.13); g.add(e); });
  [-0.25, 0.25].forEach(x => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.4), skinMat); a.position.set(x, 0.05, -0.25); a.rotation.x = -0.3; g.add(a); });
  [-0.1, 0.1].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.3, 0.12), M(0x3a3a38)); l.position.set(x, -0.35, 0); g.add(l); });
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function buildZombieStrong() {
  if (loadedZombie) {
    const clone = loadedZombie.clone();
    // Stronger zombie: bigger, darker purple tint, shoulder spikes
    clone.scale.setScalar(clone.scale.x * 1.3);
    clone.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x6a4570, flatShading: true, roughness: 0.7, metalness: 0.15
        });
        child.castShadow = true;
      }
    });
    // Add shoulder spikes
    const spMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, flatShading: true });
    [-0.25, 0.25].forEach(x => {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.25, 4), spMat);
      s.position.set(x, 1.05, 0);
      clone.add(s);
    });
    // Brighter eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3 });
    [-0.07, 0.07].forEach(x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
      e.position.set(x, 1.15, -0.18);
      clone.add(e);
    });
    return clone;
  }
  // Fallback
  const g = new THREE.Group();
  const skinMat = M(0x6a5570);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.35), M(0x553333)));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.28), skinMat); head.position.y = 0.4; g.add(head);
  const eyeMat = MEmit(0xff0000, 2);
  [-0.08, 0.08].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), eyeMat); e.position.set(x, 0.42, -0.15); g.add(e); });
  [-0.3, 0.3].forEach(x => { const s = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 4), M(0xaaaaaa, { metalness: 0.8 })); s.position.set(x, 0.4, 0); g.add(s); });
  [-0.38, 0.38].forEach(x => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.15, 0.45), skinMat); a.position.set(x, 0, -0.2); a.rotation.x = -0.2; g.add(a); });
  [-0.13, 0.13].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.35, 0.16), M(0x3a3035)); l.position.set(x, -0.4, 0); g.add(l); });
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

function buildZombieBoss() {
  if (loadedZombie) {
    const clone = loadedZombie.clone();
    // Boss: much bigger, dark green, crown, glowing aura
    clone.scale.setScalar(clone.scale.x * 2.8);
    clone.traverse(child => {
      if (child.isMesh && child.material) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0x3a4a2a, flatShading: true, roughness: 0.6, metalness: 0.2,
          emissive: 0x111500, emissiveIntensity: 0.3,
        });
        child.castShadow = true;
      }
    });
    // Crown
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x772288, emissive: 0x440066, emissiveIntensity: 1, flatShading: true });
    for (let i = -1; i <= 1; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), crownMat);
      c.position.set(i * 0.1, 1.45, 0);
      clone.add(c);
    }
    // Boss eyes
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 3 });
    [-0.06, 0.06].forEach(x => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), eyeMat);
      e.position.set(x, 1.2, -0.12);
      clone.add(e);
    });
    // Core glow
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x44ff44, emissive: 0x22ff22, emissiveIntensity: 2, transparent: true, opacity: 0.6 })
    );
    core.position.y = 0.6;
    core.name = 'core';
    clone.add(core);
    return clone;
  }
  // Fallback
  const g = new THREE.Group();
  const skinMat = M(0x4a5a3a);
  g.add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.8, 0.8), skinMat));
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.45), M(0x556644)); head.position.y = 0.6; g.add(head);
  const crownMat = M(0x772288, { emissive: 0x220044, emissiveIntensity: 0.5 });
  for (let i = -1; i <= 1; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 4), crownMat); c.position.set(i * 0.15, 0.95, 0); g.add(c); }
  const eyeMat = MEmit(0xff0000, 2);
  [-0.12, 0.12].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat); e.position.set(x, 0.65, -0.24); g.add(e); });
  [-0.7, 0.7].forEach(x => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.55, 0.35), skinMat); a.position.set(x, -0.05, -0.15); g.add(a); });
  [-0.25, 0.25].forEach(x => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.22), M(0x3a4530)); l.position.set(x, -0.6, 0); g.add(l); });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), MEmit(0x44ff44, 2));
  core.position.y = 0.4; core.name = 'core'; g.add(core);
  g.traverse(c => { if (c.isMesh) c.castShadow = true; });
  return g;
}

// ============================================================
//  Projectile builders
// ============================================================
function buildMissile() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 6), M(0x88ccff, { emissive: 0x2266aa, emissiveIntensity: 0.5 }));
  body.rotation.x = Math.PI / 2; g.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.15, 6), MEmit(0x66ddff, 1.5));
  tip.rotation.x = Math.PI / 2; tip.position.z = -0.3; g.add(tip);
  return g;
}
function buildSeed() {
  const g = new THREE.Group();
  // 큰 수박씨 본체
  const geo = new THREE.SphereGeometry(0.18, 6, 5);
  geo.scale(0.7, 0.5, 1.2);
  g.add(new THREE.Mesh(geo, M(0x1a1008, { emissive: 0x332200, emissiveIntensity: 0.3 })));
  // 하이라이트 줄무늬
  const stripe = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 6, 4),
    M(0x3a2a10, { emissive: 0x443311, emissiveIntensity: 0.4 })
  );
  stripe.scale.set(0.3, 0.3, 1.1);
  stripe.position.y = 0.02;
  g.add(stripe);
  // 발광 글로우
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0x88cc22, transparent: true, opacity: 0.25 })
  );
  glow.scale.set(0.7, 0.5, 1.2);
  g.add(glow);
  return g;
}
function buildArrowProj() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 4), M(0x886633));
  shaft.rotation.x = Math.PI / 2; g.add(shaft);
  // 촉이 -Z (앞쪽, 진행 방향)를 향하도록
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 3), M(0xaaaaaa, { metalness: 0.8 }));
  tip.rotation.x = -Math.PI / 2; tip.position.z = -0.4; g.add(tip);
  // 깃털이 +Z (뒤쪽)를 향하도록
  const fletch = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 3), M(0xcc2222));
  fletch.rotation.x = Math.PI / 2; fletch.position.z = 0.35; g.add(fletch);
  return g;
}
function buildEnemyShot(color) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), MEmit(color || 0xff3333, 1.5)));
  return g;
}
function buildPowerup3D() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), MEmit(0x00ffff, 1));
  g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 6, 16), MEmit(0x00ffff, 0.6));
  g.add(ring);
  return g;
}

// ============================================================
//  Style configuration
// ============================================================
let currentStyle = 0;
let templates = {};

const STYLES = [
  { name:'F-35 스텔스', scoreName:'격추',
    playerBuilder: buildF35,
    enemyA: buildAlienDrone, enemyB: buildAlienTank, boss: buildAlienBoss,
    bullet: buildMissile, eBullet: () => buildEnemyShot(0xff3333),
    playerColor: 0x4488ff, enemyColors: [0xff4444, 0x44ff44, 0xaa33ff],
    bgColor: 0x000510,
    stageMessages:['전투 개시!','적 증원 감지!','레이더에 대규모 편대!','최종 방어선!'],
    bossMsg:'적 모함 출현! 격추하라!',
  },
  { name:'수박씨 뱉기', scoreName:'점수',
    playerBuilder: buildPerson,
    enemyA: buildApple, enemyB: buildOrange, boss: buildWatermelonBoss,
    bullet: buildSeed, eBullet: () => buildEnemyShot(0x88cc11),
    playerColor: 0x2277dd, enemyColors: [0xcc1111, 0xff8800, 0x226622],
    bgColor: 0x0a0805,
    stageMessages:['퉤퉤! 수박씨 발사!','과일들이 몰려온다!','입 안에 씨가 가득!','과일 농장 사수!'],
    bossMsg:'거대 수박 등장! 씨를 퉤퉤 뱉어라!',
  },
  { name:'좀비 헌터', scoreName:'처치',
    playerBuilder: buildArcher,
    enemyA: buildZombie, enemyB: buildZombieStrong, boss: buildZombieBoss,
    bullet: buildArrowProj, eBullet: () => buildEnemyShot(0x66aa22),
    playerColor: 0x22aa44, enemyColors: [0x667755, 0x665566, 0x556644],
    bgColor: 0x050802,
    stageMessages:['좀비가 온다!','더 많은 좀비다!','화살을 아끼지 마라!','최후의 방어!'],
    bossMsg:'좀비 왕 등장! 쓰러뜨려라!',
  }
];

function buildTemplates(s) {
  const S = STYLES[s];
  templates = {
    player: S.playerBuilder(),
    enemyA: S.enemyA(),
    enemyB: S.enemyB(),
    boss: S.boss(),
    bullet: S.bullet(),
    eBullet: S.eBullet(),
    powerup: buildPowerup3D(),
  };
  // Hide templates
  Object.values(templates).forEach(t => { t.visible = false; scene.add(t); });
}

function cloneTemplate(name) {
  const t = templates[name].clone();
  t.visible = true;
  scene.add(t);
  return t;
}

// ============================================================
//  Game state
// ============================================================
let gameState = 'menu';
let score = 0, lives = 3, stage = 1, stageTimer = 0, showStageText = 0, spreadShot = 0, gameTime = 0;
const WORLD_W = 8, ENEMY_Z = -10, PLAYER_Z = 0;

const player = { x: 0, z: PLAYER_Z, roll: 0, shootCool: 0, invincible: 0, mesh: null };
const bullets = [];
const enemyBullets = [];
const enemies = [];
const powerups = [];

// Particle system
const MAX_PARTICLES = 500;
const partPositions = new Float32Array(MAX_PARTICLES * 3);
const partColors = new Float32Array(MAX_PARTICLES * 4);
const partGeo = new THREE.BufferGeometry();
partGeo.setAttribute('position', new THREE.BufferAttribute(partPositions, 3));
partGeo.setAttribute('color', new THREE.BufferAttribute(partColors, 4));
const partMat = new THREE.PointsMaterial({ size: 0.2, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
const partPoints = new THREE.Points(partGeo, partMat);
scene.add(partPoints);
const particlePool = [];

function spawnExplosion(x, y, z, color, count) {
  const c = new THREE.Color(color);
  for (let i = 0; i < count; i++) {
    const a1 = Math.random() * Math.PI * 2, a2 = Math.random() * Math.PI - Math.PI / 2;
    const spd = 2 + Math.random() * 6;
    particlePool.push({
      x, y: y + 0.2, z,
      vx: Math.cos(a1) * Math.cos(a2) * spd,
      vy: Math.sin(a2) * spd * 0.5 + 2,
      vz: Math.sin(a1) * Math.cos(a2) * spd,
      life: 0.4 + Math.random() * 0.8,
      maxLife: 0.4 + Math.random() * 0.8,
      r: c.r, g: c.g, b: c.b,
    });
  }
  if (particlePool.length > MAX_PARTICLES) particlePool.splice(0, particlePool.length - MAX_PARTICLES);
}

// HP bar for boss
let bossBarMesh = null;
let bossBarBg = null;
function createBossBar() {
  if (bossBarBg) { scene.remove(bossBarBg); scene.remove(bossBarMesh); }
  const bgGeo = new THREE.PlaneGeometry(4, 0.2);
  bossBarBg = new THREE.Mesh(bgGeo, new THREE.MeshBasicMaterial({ color: 0x333333 }));
  bossBarBg.position.set(0, 1.2, ENEMY_Z + 2);
  bossBarBg.visible = false;
  scene.add(bossBarBg);
  const fgGeo = new THREE.PlaneGeometry(4, 0.18);
  bossBarMesh = new THREE.Mesh(fgGeo, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
  bossBarMesh.position.set(0, 1.2, ENEMY_Z + 1.99);
  bossBarMesh.visible = false;
  scene.add(bossBarMesh);
}
createBossBar();

// ---- Input ----
const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// ============================================================
//  Spawning
// ============================================================
function spawnWave() {
  const rows = Math.min(3 + Math.floor(stage / 2), 5);
  const cols = Math.min(6 + stage, 10);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const type = r === 0 ? 'B' : 'A';
      const spacing = 1.8;
      const totalW = (cols - 1) * spacing;
      const ex = -totalW / 2 + c * spacing;
      const ez = ENEMY_Z - r * 2;
      const mesh = cloneTemplate(type === 'A' ? 'enemyA' : 'enemyB');
      mesh.position.set(ex, 0, ez - 12);
      const baseHp = type === 'A' ? 1 : 2;
      enemies.push({
        type, mesh, x: ex, z: ez - 12, targetZ: ez,
        hp: baseHp + Math.floor(stage / 3),
        maxHp: baseHp + Math.floor(stage / 3),
        score: type === 'A' ? 100 : 200,
        entering: true, phase: Math.random() * Math.PI * 2,
        shootTimer: 2 + Math.random() * 5,
        diving: false, diveVx: 0, diveVz: 0,
      });
    }
  }
  if (stage % 3 === 0) {
    const mesh = cloneTemplate('boss');
    mesh.position.set(0, 0, ENEMY_Z - 18);
    const baseHp = 10 + stage * 2;
    enemies.push({
      type: 'boss', mesh, x: 0, z: ENEMY_Z - 18, targetZ: ENEMY_Z + 2,
      hp: baseHp, maxHp: baseHp, score: 1000,
      entering: true, phase: 0, shootTimer: 1,
      diving: false, diveVx: 0, diveVz: 0,
    });
  }
}

// ============================================================
//  Game flow
// ============================================================
function clearGameObjects() {
  if (player.mesh) { scene.remove(player.mesh); player.mesh = null; }
  bullets.forEach(b => scene.remove(b.mesh));
  bullets.length = 0;
  enemyBullets.forEach(b => scene.remove(b.mesh));
  enemyBullets.length = 0;
  enemies.forEach(e => scene.remove(e.mesh));
  enemies.length = 0;
  powerups.forEach(p => scene.remove(p.mesh));
  powerups.length = 0;
  particlePool.length = 0;
  bossBarBg.visible = false;
  bossBarMesh.visible = false;
}

window.selectStyle = async function(s) {
  currentStyle = s;
  clearGameObjects();
  // Remove old templates
  Object.values(templates).forEach(t => scene.remove(t));
  // Ensure OBJ models loaded for styles that need them
  if ((s === 0 && !loadedF35) || (s === 2 && !loadedZombie)) {
    await loadOBJModels();
  }
  buildTemplates(s);
  startGame();
};

function startGame() {
  gameState = 'playing';
  score = 0; lives = 3; stage = 1; stageTimer = 0; showStageText = 2.5; spreadShot = 0; gameTime = 0;

  clearGameObjects();
  const S = STYLES[currentStyle];
  scene.background = new THREE.Color(S.bgColor);
  scene.fog.color.set(S.bgColor);

  player.x = 0; player.z = PLAYER_Z; player.roll = 0;
  player.invincible = 2; player.shootCool = 0;
  player.mesh = cloneTemplate('player');
  player.mesh.position.set(0, 0, PLAYER_Z);

  spawnWave();
  document.getElementById('ui').classList.remove('active');
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('vis'));
  document.getElementById('hud').classList.remove('hidden');
  if (isMobile()) document.getElementById('touch-controls').classList.add('vis');
  showBanner();
}

function gameOver() {
  gameState = 'gameover';
  document.getElementById('fScore').textContent = score;
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('touch-controls').classList.remove('vis');
  document.getElementById('ui').classList.add('active');
  document.getElementById('go-screen').classList.add('vis');
  hideBanner();
}

function goMenu() {
  gameState = 'menu';
  clearGameObjects();
  document.getElementById('hud').classList.add('hidden');
  document.getElementById('touch-controls').classList.remove('vis');
  document.getElementById('ui').classList.add('active');
  document.querySelectorAll('.scr').forEach(s => s.classList.remove('vis'));
  document.getElementById('style-screen').classList.add('vis');
  hideBanner();
}

document.getElementById('btnRestart').addEventListener('click', startGame);
document.getElementById('btnMenu').addEventListener('click', goMenu);

// ---- HUD ----
function updateHUD() {
  const S = STYLES[currentStyle];
  document.getElementById('hScore').textContent = `${S.scoreName}: ${score}`;
  document.getElementById('hStage').textContent = `단계: ${stage}`;
  document.getElementById('hLives').textContent = '♥'.repeat(Math.max(0, lives));
}

// ---- Banner ----
let bannerTimeout = null;
function showBanner() {
  const S = STYLES[currentStyle];
  const el = document.getElementById('stage-banner');
  document.getElementById('bannerT1').textContent = `제 ${stage} 단계`;
  if (stage % 3 === 0) {
    document.getElementById('bannerT2').textContent = S.bossMsg;
    document.getElementById('bannerT2').style.color = '#f80';
  } else {
    document.getElementById('bannerT2').textContent = S.stageMessages[stage % S.stageMessages.length];
    document.getElementById('bannerT2').style.color = '#0ff';
  }
  el.classList.add('vis');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => el.classList.remove('vis'), 2500);
}
function hideBanner() {
  document.getElementById('stage-banner').classList.remove('vis');
}

// ============================================================
//  Update
// ============================================================
function update(dt) {
  // Stars scroll
  const pos = stars.geometry.attributes.position.array;
  for (let i = 0; i < 600; i++) {
    pos[i * 3 + 2] += 6 * dt;
    if (pos[i * 3 + 2] > 5) { pos[i * 3 + 2] = -60; pos[i * 3] = (Math.random() - 0.5) * 80; }
  }
  stars.geometry.attributes.position.needsUpdate = true;

  if (gameState !== 'playing') return;
  gameTime += dt;

  const S = STYLES[currentStyle];

  // --- Player ---
  let dx = 0, dz = 0;
  if (keys['ArrowLeft'] || keys['KeyA']) dx = -1;
  if (keys['ArrowRight'] || keys['KeyD']) dx = 1;
  if (keys['ArrowUp'] || keys['KeyW']) dz = -1;
  if (keys['ArrowDown'] || keys['KeyS']) dz = 1;
  // Touch joystick input
  if (touchInput.dx || touchInput.dz) { dx = touchInput.dx; dz = touchInput.dz; }
  const spd = 8;
  player.x += dx * spd * dt;
  player.z += dz * spd * dt;
  player.x = Math.max(-WORLD_W, Math.min(WORLD_W, player.x));
  player.z = Math.max(-6, Math.min(2, player.z));
  player.roll += ((-dx * 0.5) - player.roll) * 6 * dt;

  if (player.invincible > 0) player.invincible -= dt;
  if (player.shootCool > 0) player.shootCool -= dt;

  if (player.mesh) {
    player.mesh.position.set(player.x, 0, player.z);
    player.mesh.rotation.z = player.roll;
    // Blink when invincible
    player.mesh.visible = !(player.invincible > 0 && Math.floor(player.invincible * 8) % 2 === 0);

    // Afterburner flicker (F-35)
    if (currentStyle === 0) {
      const ab = player.mesh.getObjectByName('afterburner');
      if (ab) ab.scale.setScalar(0.8 + Math.random() * 0.4);
    }
  }

  // --- Shoot ---
  if ((keys['Space'] || touchInput.fire) && player.shootCool <= 0) {
    player.shootCool = spreadShot > 0 ? 0.1 : 0.16;
    fireBullet(player.x, player.z - 0.5, 0, -28);
    if (spreadShot > 0) {
      fireBullet(player.x - 0.3, player.z - 0.3, -3, -27);
      fireBullet(player.x + 0.3, player.z - 0.3, 3, -27);
    }
  }
  if (spreadShot > 0) spreadShot -= dt;

  // --- Bullets ---
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.mesh.position.set(b.x, 0.2, b.z);
    if (b.z < -30) { scene.remove(b.mesh); bullets.splice(i, 1); continue; }
    // Hit enemies
    let hit = false;
    for (let j = enemies.length - 1; j >= 0; j--) {
      const e = enemies[j];
      const hr = e.type === 'boss' ? 1.6 : 0.8;
      if (Math.abs(b.x - e.x) < hr && Math.abs(b.z - e.z) < hr) {
        e.hp--; hit = true;
        if (e.hp <= 0) {
          score += e.score;
          const ci = e.type === 'boss' ? 2 : e.type === 'B' ? 1 : 0;
          spawnExplosion(e.x, 0, e.z, S.enemyColors[ci], e.type === 'boss' ? 60 : 25);
          scene.remove(e.mesh);
          if (Math.random() < 0.15) spawnPowerupAt(e.x, e.z);
          enemies.splice(j, 1);
        } else {
          spawnExplosion(b.x, 0.2, b.z, 0xffffaa, 5);
        }
        break;
      }
    }
    if (hit) { scene.remove(b.mesh); bullets.splice(i, 1); }
  }

  // --- Enemies ---
  const formSpd = 1.5 + stage * 0.2;
  let hasBoss = false;
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (e.type === 'boss') hasBoss = true;

    if (e.entering) {
      e.z += 8 * dt;
      if (e.z >= e.targetZ) { e.z = e.targetZ; e.entering = false; }
    } else if (e.diving) {
      e.x += e.diveVx * dt; e.z += e.diveVz * dt;
      if (e.z > 5) { scene.remove(e.mesh); enemies.splice(i, 1); continue; }
    } else {
      e.phase += dt * 1.5;
      e.x += Math.sin(e.phase) * formSpd * dt;
      e.x = Math.max(-WORLD_W + 1, Math.min(WORLD_W - 1, e.x));
      if (Math.random() < 0.0008 * (1 + stage * 0.3) && e.type !== 'boss') {
        e.diving = true;
        const a = Math.atan2(player.x - e.x, player.z - e.z);
        const ds = 5 + stage * 0.5;
        e.diveVx = Math.sin(a) * ds; e.diveVz = Math.cos(a) * ds;
      }
    }

    e.mesh.position.set(e.x, 0, e.z);
    e.mesh.rotation.y = Math.PI + Math.sin(e.phase || 0) * 0.12;

    // Boss pulsing
    if (e.type === 'boss') {
      const core = e.mesh.getObjectByName('core');
      if (core) core.scale.setScalar(0.8 + Math.sin(gameTime * 3) * 0.3);
      // HP bar
      bossBarBg.visible = true;
      bossBarMesh.visible = true;
      const ratio = e.hp / e.maxHp;
      bossBarMesh.scale.x = ratio;
      bossBarMesh.position.x = -(1 - ratio) * 2;
      bossBarMesh.material.color.setHSL(ratio * 0.33, 1, 0.5);
      bossBarBg.position.set(0, 1.2, e.z + 1.5);
      bossBarMesh.position.z = e.z + 1.49;
    }

    // Shoot
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && !e.entering) {
      e.shootTimer = (e.type === 'boss' ? 0.5 : 2.5) - stage * 0.06 + Math.random() * 2;
      e.shootTimer = Math.max(e.shootTimer, 0.25);
      const a = Math.atan2(player.x - e.x, player.z - e.z);
      const bs = 8 + stage * 0.5;
      fireEnemyBullet(e.x, e.z, Math.sin(a) * bs, Math.cos(a) * bs);
      if (e.type === 'boss') {
        fireEnemyBullet(e.x, e.z, Math.sin(a - 0.15) * bs, Math.cos(a - 0.15) * bs);
        fireEnemyBullet(e.x, e.z, Math.sin(a + 0.15) * bs, Math.cos(a + 0.15) * bs);
      }
    }
  }
  if (!hasBoss) { bossBarBg.visible = false; bossBarMesh.visible = false; }

  // --- Enemy bullets ---
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * dt; b.z += b.vz * dt;
    b.mesh.position.set(b.x, 0.2, b.z);
    b.mesh.rotation.y += dt * 5;
    if (b.z > 5 || b.z < -30 || Math.abs(b.x) > 15) { scene.remove(b.mesh); enemyBullets.splice(i, 1); continue; }
    if (player.invincible <= 0 && Math.abs(b.x - player.x) < 0.6 && Math.abs(b.z - player.z) < 0.6) {
      scene.remove(b.mesh); enemyBullets.splice(i, 1);
      lives--;
      spawnExplosion(player.x, 0, player.z, S.playerColor, 35);
      player.invincible = 2;
      if (lives <= 0) { gameOver(); return; }
    }
  }

  // --- Collision ---
  if (player.invincible <= 0) {
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i], cr = e.type === 'boss' ? 1.5 : 0.8;
      if (Math.abs(e.x - player.x) < cr && Math.abs(e.z - player.z) < cr) {
        lives--; e.hp -= 3;
        spawnExplosion(player.x, 0, player.z, S.playerColor, 35);
        player.invincible = 2;
        if (e.hp <= 0) {
          score += e.score; spawnExplosion(e.x, 0, e.z, S.enemyColors[0], 25);
          scene.remove(e.mesh); enemies.splice(i, 1);
        }
        if (lives <= 0) { gameOver(); return; }
        break;
      }
    }
  }

  // --- Powerups ---
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.z += 2 * dt; p.life -= dt;
    p.mesh.position.set(p.x, 0.3 + Math.sin(gameTime * 3) * 0.2, p.z);
    p.mesh.rotation.y += dt * 3;
    if (p.life <= 0 || p.z > 5) { scene.remove(p.mesh); powerups.splice(i, 1); continue; }
    if (Math.abs(p.x - player.x) < 1 && Math.abs(p.z - player.z) < 1) {
      spreadShot = 8;
      spawnExplosion(p.x, 0.3, p.z, 0x00ffff, 15);
      scene.remove(p.mesh); powerups.splice(i, 1);
    }
  }

  // --- Particles ---
  for (let i = particlePool.length - 1; i >= 0; i--) {
    const p = particlePool[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    p.vy -= 4 * dt; p.life -= dt;
    if (p.life <= 0) particlePool.splice(i, 1);
  }
  // Update particle buffer
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (i < particlePool.length) {
      const p = particlePool[i], a = p.life / p.maxLife;
      partPositions[i * 3] = p.x; partPositions[i * 3 + 1] = p.y; partPositions[i * 3 + 2] = p.z;
      partColors[i * 4] = p.r; partColors[i * 4 + 1] = p.g; partColors[i * 4 + 2] = p.b; partColors[i * 4 + 3] = a;
    } else {
      partPositions[i * 3] = 0; partPositions[i * 3 + 1] = -100; partPositions[i * 3 + 2] = 0;
      partColors[i * 4 + 3] = 0;
    }
  }
  partGeo.attributes.position.needsUpdate = true;
  partGeo.attributes.color.needsUpdate = true;

  // --- Next stage ---
  if (enemies.length === 0) {
    stageTimer += dt;
    if (stageTimer > 1.5) {
      stage++; stageTimer = 0; showStageText = 2.5;
      spawnWave(); showBanner();
    }
  }
  if (showStageText > 0) showStageText -= dt;

  updateHUD();
}

function fireBullet(x, z, vx, vz) {
  const mesh = cloneTemplate('bullet');
  mesh.position.set(x, 0.2, z);
  bullets.push({ x, z, vx, vz, mesh });
}
function fireEnemyBullet(x, z, vx, vz) {
  const mesh = cloneTemplate('eBullet');
  mesh.position.set(x, 0.2, z);
  enemyBullets.push({ x, z, vx, vz, mesh });
}
function spawnPowerupAt(x, z) {
  const mesh = cloneTemplate('powerup');
  mesh.position.set(x, 0.3, z);
  powerups.push({ x, z, life: 10, mesh });
}

// ============================================================
//  Main loop
// ============================================================
let lastTime = performance.now();
function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// Setup touch controls
setupTouchControls();

// Load OBJ models then start
scene.background = new THREE.Color(0x000510);
loadOBJModels().then(() => {
  buildTemplates(0);
  requestAnimationFrame(loop);
});
