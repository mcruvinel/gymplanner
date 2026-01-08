const $ = sel => document.querySelector(sel);
const qs = sel => Array.from(document.querySelectorAll(sel));

const userSelect = $('#userSelect');
const newUserBtn = $('#newUserBtn');
const tabCalendar = $('#tabCalendar');
const tabNotes = $('#tabNotes');
const calendarView = $('#calendarView');
const notesView = $('#notesView');
const calendarEl = $('#calendar');
const monthLabel = $('#monthLabel');
const prevMonthBtn = $('#prevMonth');
const nextMonthBtn = $('#nextMonth');
const notesArea = $('#notesArea');
const saveNotesBtn = $('#saveNotesBtn');
const notesStatus = $('#notesStatus');
const toast = $('#toast');

let users = ['Matheus','Noelia','Ana'];
let currentUser = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let userData = { workouts: {} };

function userKey(name){
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_');
}

function jsonPath(key){ return `data/${key}.json`; }
function mdPath(key){ return `notes/${key}.md`; }

function showToast(msg, ok=true){
  toast.textContent = msg;
  toast.style.background = ok ? '#111' : '#b00020';
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),2500);
}

function populateUsers(){
  userSelect.innerHTML = '';
  users.forEach(u=>{
    const opt = document.createElement('option');
    opt.value = u; opt.textContent = u;
    userSelect.appendChild(opt);
  });
}

async function fetchJson(path){
  const res = await fetch(`${path}?_=${Date.now()}`, {cache:'no-store'});
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function putJson(path, obj){
  const res = await fetch(path, {
    method:'PUT',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify(obj, null, 2)
  });
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}

async function fetchText(path){
  const res = await fetch(`${path}?_=${Date.now()}`, {cache:'no-store'});
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.text();
}

async function putText(path, text){
  const res = await fetch(path, {
    method:'PUT',
    headers:{'Content-Type':'text/markdown'},
    body: text
  });
  if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
}

async function loadUser(u){
  currentUser = u;
  const key = userKey(u);
  try{
    userData = await fetchJson(jsonPath(key));
  }catch(e){
    userData = { workouts: {}, updatedAt: new Date().toISOString() };
    try{ await putJson(jsonPath(key), userData); }catch(err){ console.warn('Erro criando JSON inicial', err); }
  }
}

async function loadNotes(){
  const key = userKey(currentUser);
  try{
    const md = await fetchText(mdPath(key));
    notesArea.value = md;
  }catch(e){
    notesArea.value = `# Notes de ${currentUser}\n\nEscreva suas observações aqui.`;
  }
}

function monthLabelText(year, month){
  const d = new Date(year, month, 1);
  return d.toLocaleString('pt-BR',{month:'long', year:'numeric'});
}

function renderCalendar(){
  monthLabel.textContent = monthLabelText(currentYear, currentMonth);
  calendarEl.innerHTML = '';
  const dayNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  dayNames.forEach(dn=>{
    const el = document.createElement('div'); el.className='dayHead'; el.textContent=dn; calendarEl.appendChild(el);
  });

  const first = new Date(currentYear, currentMonth, 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(currentYear, currentMonth+1,0).getDate();

  for(let i=0;i<startDay;i++){
    const el = document.createElement('div'); el.className='dayCell inactive'; calendarEl.appendChild(el);
  }

  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const el = document.createElement('div'); el.className='dayCell'; el.setAttribute('role','button');
    const dateDiv = document.createElement('div'); dateDiv.className='date'; dateDiv.textContent = d; el.appendChild(dateDiv);
    const dot = document.createElement('div'); dot.className='dot'; el.appendChild(dot);
    if(userData.workouts && userData.workouts[dateStr]){
      el.classList.add('active');
    }
    el.addEventListener('click', ()=> toggleWorkout(dateStr, el));
    calendarEl.appendChild(el);
  }
}

let savingFlag = false;
async function toggleWorkout(dateStr, el){
  if(savingFlag) return;
  const cur = !!(userData.workouts && userData.workouts[dateStr]);
  if(!userData.workouts) userData.workouts = {};
  if(cur) delete userData.workouts[dateStr]; else userData.workouts[dateStr]=true;
  userData.updatedAt = new Date().toISOString();

  el.classList.toggle('active', !cur);
  savingFlag = true;
  try{
    await putJson(jsonPath(userKey(currentUser)), userData);
    showToast('Salvo com sucesso');
  }catch(e){
    if(cur) userData.workouts[dateStr]=true; else delete userData.workouts[dateStr];
    el.classList.toggle('active', cur);
    showToast('Erro ao salvar', false);
    console.error(e);
  }finally{ savingFlag=false; }
}

async function createNewUser(){
  const name = prompt('Nome do novo usuário:');
  if(!name) return;
  const key = userKey(name);
  if(users.includes(name)){
    alert('Usuário já existe no dropdown. Escolha outro nome ou selecione o existente.');
    return;
  }
  users.push(name);
  populateUsers();
  userSelect.value = name;

  const initJson = { workouts: {}, createdAt: new Date().toISOString() };
  const initMd = `# Notes de ${name}\n\nBem-vindo(a), ${name}!\n`;
  try{
    await putJson(jsonPath(key), initJson);
    await putText(mdPath(key), initMd);
    showToast('Usuário criado e arquivos gravados');
  }catch(e){
    showToast('Erro ao criar usuário', false);
    console.error(e);
  }

  await loadUser(name);
  renderCalendar();
  loadNotes();
}

let savingNotes = false;
async function saveNotes(){
  if(!currentUser) return;
  if(savingNotes) return;
  const key = userKey(currentUser);
  const text = notesArea.value;
  notesStatus.textContent = 'Salvando...';
  try{
    savingNotes = true;
    await putText(mdPath(key), text);
    notesStatus.textContent = 'Salvo';
    showToast('Notes salvos');
    setTimeout(()=>{ notesStatus.textContent=''; },1500);
  }catch(e){
    notesStatus.textContent = 'Erro';
    showToast('Erro ao salvar notes', false);
    console.error(e);
  }finally{ savingNotes=false; }
}

function showTab(tab){
  if(tab==='calendar'){
    tabCalendar.classList.add('active'); tabNotes.classList.remove('active');
    calendarView.classList.remove('hidden'); notesView.classList.add('hidden');
  }else{
    tabCalendar.classList.remove('active'); tabNotes.classList.add('active');
    calendarView.classList.add('hidden'); notesView.classList.remove('hidden');
  }
}

async function init(){
  populateUsers();
  if(users.length>0){ userSelect.value = users[0]; }
  userSelect.addEventListener('change', async e=>{
    await loadUser(e.target.value);
    renderCalendar();
    await loadNotes();
  });
  newUserBtn.addEventListener('click', createNewUser);
  prevMonthBtn.addEventListener('click', ()=>{ currentMonth--; if(currentMonth<0){ currentMonth=11; currentYear-- } renderCalendar(); });
  nextMonthBtn.addEventListener('click', ()=>{ currentMonth++; if(currentMonth>11){ currentMonth=0; currentYear++ } renderCalendar(); });
  tabCalendar.addEventListener('click', ()=>showTab('calendar'));
  tabNotes.addEventListener('click', ()=>showTab('notes'));
  saveNotesBtn.addEventListener('click', saveNotes);

  if(userSelect.value){
    await loadUser(userSelect.value);
    renderCalendar();
    await loadNotes();
  }
}

init().catch(e=>console.error(e));
