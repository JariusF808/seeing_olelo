const hawMap = {
  person: "kanaka",
  bottle: "ʻōmole",
  cup: "kīʻaha",
  backpack: "ʻeke kua",
  handbag: "ʻaʻapu lima",
  suitcase: "pākeke huakaʻi",
  book: "puke",
  cell_phone: "kelepona paʻalima",
  laptop: "lolo uila lawe",
  keyboard: "pā hōkū",
  tv: "kiʻiʻoniʻoni uila",
  chair: "noho",
  couch: "noho lōʻihi",
  dining_table: "pākaukau ʻai",
  carrot: "kaloke",
  banana: "maiʻa",
  apple: "ʻāpala",
  orange: "ʻalani",
  spoon: "pāna",
  fork: "ʻī"
};

const screens = [...document.querySelectorAll('.screen')];
const navButtons = [...document.querySelectorAll('.nav button')];

navButtons.forEach(btn => btn.addEventListener('click', () => {
  navButtons.forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const id = btn.dataset.goto;
  screens.forEach(s => s.classList.toggle('active', s.id === id));
  if (id === 'start') {
    startCameraIfAllowed();
  } else {
    stopCamera();
  }
}));

const $ = sel => document.querySelector(sel);
const txtSize = $('#txtSize');
const allowCamera = $('#allowCamera');
const allowMic = $('#allowMic');
const langSel = $('#lang');
const liveLabel = $('#liveLabel');

const settings = {
  textSize: +localStorage.getItem('txtSize') || 22,
  camera: localStorage.getItem('allowCamera') !== 'false',
  mic: localStorage.getItem('allowMic') === 'true',
  lang: localStorage.getItem('lang') || 'haw'
};

txtSize.value = settings.textSize;
allowCamera.checked = settings.camera;
allowMic.checked = settings.mic;
langSel.value = settings.lang;
document.documentElement.style.setProperty('--labelSize', settings.textSize + 'px');

txtSize.addEventListener('input', e => {
  const v = +e.target.value;
  document.documentElement.style.setProperty('--labelSize', v + 'px');
  localStorage.setItem('txtSize', v);
});
allowCamera.addEventListener('change', e => {
  localStorage.setItem('allowCamera', e.target.checked);
  e.target.checked ? startCameraIfAllowed() : stopCamera();
});
allowMic.addEventListener('change', e => {
  localStorage.setItem('allowMic', e.target.checked);
});
langSel.addEventListener('change', e => {
  localStorage.setItem('lang', e.target.value);
});

const video = $('#camera');
const canvas = $('#overlay');
const ctx = canvas.getContext('2d');
const shutter = $('#shutter');

let stream = null;
let model = null;
let running = false;

async function startCameraIfAllowed() {
  if (!allowCamera.checked) return;
  if (stream) return;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: allowMic.checked
    });
    video.srcObject = stream;
    await video.play();
    fitCanvas();
    await loadModel();
    running = true;
    loopDetect();
  } catch (err) {
    console.error(err);
    liveLabel.textContent = 'Camera blocked (check permissions)';
  }
}
function stopCamera() {
  running = false;
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  liveLabel.textContent = '—';
}
function fitCanvas() {
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 480;
  canvas.width = w;
  canvas.height = h;
}
async function loadModel() {
  if (!model) {
    liveLabel.textContent = 'Loading model…';
    model = await cocoSsd.load();
  }
}
function translateLabel(eng) {
  const haw = hawMap[eng] || null;
  const lang = localStorage.getItem('lang') || 'haw';
  if (lang === 'haw') {
    return haw ? `${haw} (${eng.replaceAll('_',' ')})` : eng.replaceAll('_',' ');
  } else {
    return haw ? `${eng.replaceAll('_',' ')} (${haw})` : eng.replaceAll('_',' ');
  }
}
async function loopDetect() {
  if (!running || !model) return;
  fitCanvas();
  const preds = await model.detect(video);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let topText = '—';
  let topScore = 0;

  preds.forEach(p => {
    if (p.score < 0.6) return;
    const [x, y, w, h] = p.bbox;
    ctx.lineWidth = 3;
    ctx.strokeStyle = varColor();
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.strokeRect(x, y, w, h);

    const label = translateLabel(p.class);
    ctx.font = '18px system-ui, Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(label, x + 5, y > 20 ? y - 5 : y + 20);

    if (p.score > topScore) {
      topScore = p.score;
      topText = label;
    }
  });

  liveLabel.textContent = topText;
  requestAnimationFrame(loopDetect);
}
function varColor() { return '#FF7F50'; }

shutter.addEventListener('click', () => {
  const shot = document.createElement('a');
  shot.download = 'seeing-olelo.png';
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width;
  tmp.height = canvas.height;
  const c = tmp.getContext('2d');
  c.drawImage(video, 0, 0, tmp.width, tmp.height);
  c.drawImage(canvas, 0, 0);
  shot.href = tmp.toDataURL('image/png');
  shot.click();
});

if (document.querySelector('.nav button.active')?.dataset.goto === 'start') {
  startCameraIfAllowed();
}
window.addEventListener('resize', fitCanvas);
