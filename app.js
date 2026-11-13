const $ = (id) => document.getElementById(id);
const KEYS = { sessions: "sqa_sessions_v1", records: "sqa_records_v1", student: "sqa_student_v1" };
const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
let currentScanner = null;
let activeSessionId = null;

function showView(name) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(v => v.classList.toggle("active", v.dataset.view === name));
  $("view-" + name).classList.add("active");
  const titles = {dashboard:"Dashboard",generate:"Generate QR",scan:"Student Scanner",records:"Attendance Records"};
  $("page-title").textContent = titles[name] || "Dashboard";
  if (name === "dashboard" || name === "records") renderAll();
}
document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => showView(b.dataset.go)));
$("today-label").textContent = new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"});

function makeId() { return "S-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2,7).toUpperCase(); }
function clockToMinutes(value) { const [h,m] = value.split(":").map(Number); return h*60+m; }
function timeString(iso) { return new Date(iso).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }

$("session-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const subject = $("subject").value.trim(), section = $("section").value.trim();
  const cutoff = $("cutoff").value;
  if (!subject || !section || !cutoff) return;
  const now = new Date();
  const duration = Number($("duration").value);
  const token = makeId() + "-" + crypto.getRandomValues(new Uint32Array(1))[0].toString(36);
  const session = {
    id: makeId(), token, subject, section, room: $("room").value.trim(),
    createdAt: now.toISOString(), cutoffAt: new Date(now.toDateString() + " " + cutoff).toISOString(),
    expiresAt: new Date(now.getTime() + duration*60000).toISOString(), active: true
  };
  const sessions = read(KEYS.sessions);
  sessions.unshift(session); write(KEYS.sessions, sessions);
  activeSessionId = session.id;
  renderQr(session);
  renderAll();
});

function renderQr(session) {
  $("qr-box").innerHTML = "";
  const holder = document.createElement("div"); holder.id = "qr-code"; $("qr-box").appendChild(holder);
  const payload = JSON.stringify({ app:"SMART_QR_ATTENDANCE", sessionId:session.id, token:session.token });
  new QRCode(holder, {text:payload,width:210,height:210,colorDark:"#172033",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H});
  $("qr-state").textContent = "Session active";
  $("qr-state").style.color = "#21885d";
  $("session-info").classList.remove("hidden");
  $("session-info").innerHTML = `<b>${escapeHtml(session.subject)}</b> · ${escapeHtml(session.section)}<br>Late cutoff: ${new Date(session.cutoffAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}<br>Expires: ${new Date(session.expiresAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}`;
  $("end-session").disabled = false;
}
$("end-session").addEventListener("click", () => {
  const sessions = read(KEYS.sessions);
  const s = sessions.find(x => x.id === activeSessionId);
  if (s) { s.active = false; write(KEYS.sessions,sessions); }
  $("qr-state").textContent = "Session ended";
  $("qr-state").style.color = "#c27a20";
  $("end-session").disabled = true;
  renderAll();
});

$("student-form").addEventListener("submit", e => {
  e.preventDefault();
  const student = { id:$("student-id").value.trim(), name:$("student-name").value.trim() };
  if (!student.id || !student.name) return;
  localStorage.setItem(KEYS.student, JSON.stringify(student));
  setMessage("Student details saved. You can now scan the session QR code.","success");
});
const savedStudent = JSON.parse(localStorage.getItem(KEYS.student) || "null");
if (savedStudent) { $("student-id").value = savedStudent.id; $("student-name").value = savedStudent.name; }

function setMessage(text, type="") { const el=$("scan-message"); el.textContent=text; el.className="message " + type; }
async function startScanner() {
  if (!window.Html5Qrcode) { setMessage("Scanner library did not load. Check your internet connection.","error"); return; }
  if (!$("student-id").value.trim() || !$("student-name").value.trim()) { setMessage("Enter and save your student ID and full name first.","error"); return; }
  try {
    currentScanner = new Html5Qrcode("reader");
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) throw new Error("No camera was found.");
    const cameraId = cameras.find(c => /back|environment/i.test(c.label))?.id || cameras[0].id;
    await currentScanner.start(cameraId,{fps:10,qrbox:{width:230,height:230}},onScanSuccess,()=>{});
    $("start-scan").disabled = true; $("stop-scan").disabled = false;
    setMessage("Camera is running. Point it at the teacher's QR code.");
  } catch(err) { setMessage(err.message || "Could not start camera. Check camera permission and use localhost or HTTPS.","error"); }
}
async function stopScanner() {
  if (currentScanner) { try { await currentScanner.stop(); await currentScanner.clear(); } catch {} currentScanner=null; }
  $("start-scan").disabled=false; $("stop-scan").disabled=true;
}
$("start-scan").addEventListener("click",startScanner);
$("stop-scan").addEventListener("click",stopScanner);

async function onScanSuccess(decodedText) {
  await stopScanner();
  let data;
  try { data=JSON.parse(decodedText); } catch { setMessage("This QR code is not a valid attendance code.","error"); return; }
  if (data.app !== "SMART_QR_ATTENDANCE" || !data.sessionId || !data.token) { setMessage("This QR code is not recognized by the attendance system.","error"); return; }
  const sessions=read(KEYS.sessions);
  const session=sessions.find(s=>s.id===data.sessionId && s.token===data.token);
  if (!session) { setMessage("Session not found in this browser. This prototype requires shared browser storage.","error"); return; }
  if (!session.active || Date.now()>new Date(session.expiresAt).getTime()) { setMessage("This attendance session has expired or is closed.","error"); return; }
  const student=JSON.parse(localStorage.getItem(KEYS.student)||"null");
  if (!student) { setMessage("Save your student information first.","error"); return; }
  const records=read(KEYS.records);
  if (records.some(r=>r.sessionId===session.id && r.studentId.toLowerCase()===student.id.toLowerCase())) { setMessage("Duplicate scan: your attendance has already been recorded.","error"); return; }
  const now=new Date();
  const status=now.getTime()>new Date(session.cutoffAt).getTime() ? "Late" : "Present";
  records.unshift({id:makeId(),sessionId:session.id,studentId:student.id,studentName:student.name,subject:session.subject,section:session.section,createdAt:now.toISOString(),status});
  write(KEYS.records,records);
  setMessage(`Attendance recorded successfully. Status: ${status}.`, "success");
  renderAll();
}

function renderAll() {
  const records=read(KEYS.records), sessions=read(KEYS.sessions);
  $("stat-total").textContent=records.length;
  $("stat-present").textContent=records.filter(r=>r.status==="Present").length;
  $("stat-late").textContent=records.filter(r=>r.status==="Late").length;
  $("stat-session").textContent=sessions.filter(s=>s.active && Date.now()<new Date(s.expiresAt).getTime()).length;
  const recent=records.slice(0,5);
  $("recent-table").innerHTML=recent.length ? recent.map(r=>`<tr><td><b>${escapeHtml(r.studentName)}</b><br><small>${escapeHtml(r.studentId)}</small></td><td>${escapeHtml(r.subject)}</td><td>${timeString(r.createdAt)}</td><td><span class="badge ${r.status}">${r.status}</span></td></tr>`).join("") : '<tr><td colspan="4" class="empty">No attendance records yet.</td></tr>';
  renderRecords();
}
function renderRecords() {
  const q=$("record-search").value.toLowerCase(), status=$("status-filter").value;
  const records=read(KEYS.records).filter(r=>(status==="all"||r.status===status) && [r.studentId,r.studentName,r.subject,r.section].some(v=>String(v).toLowerCase().includes(q)));
  $("records-table").innerHTML=records.length ? records.map(r=>`<tr><td>${escapeHtml(r.studentId)}</td><td><b>${escapeHtml(r.studentName)}</b></td><td>${escapeHtml(r.subject)} / ${escapeHtml(r.section)}</td><td>${new Date(r.createdAt).toLocaleString()}</td><td><span class="badge ${r.status}">${r.status}</span></td></tr>`).join("") : '<tr><td colspan="5" class="empty">No records found.</td></tr>';
}
$("record-search").addEventListener("input",renderRecords);
$("status-filter").addEventListener("change",renderRecords);
$("export-csv").addEventListener("click",()=>{
  const rows=read(KEYS.records);
  if(!rows.length){alert("There are no records to export yet.");return;}
  const header=["Student ID","Student Name","Subject","Section","Date and Time","Status"];
  const lines=[header,...rows.map(r=>[r.studentId,r.studentName,r.subject,r.section,new Date(r.createdAt).toLocaleString(),r.status])];
  const csv=lines.map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="attendance-records.csv";a.click();URL.revokeObjectURL(url);
});
renderAll();
