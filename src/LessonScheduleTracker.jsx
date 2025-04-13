// LessonScheduleTracker.jsx — финальная рабочая версия
import { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, where, updateDoc, deleteDoc, doc } from "firebase/firestore";

/* ---------------------------- Firebase config ---------------------------- */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FB_APIKEY,
  authDomain: import.meta.env.VITE_FB_AUTHDOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECTID,
  storageBucket: import.meta.env.VITE_FB_BUCKET,
  messagingSenderId: import.meta.env.VITE_FB_SENDER,
  appId: import.meta.env.VITE_FB_APPID,
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default function LessonScheduleTracker() {
  /* ------------------------------ Theme/colors ------------------------------ */
  const brand = { primary: "#22c55e", bg: "#18181b", card: "#27272a" };

  /* --------------------------- Static dictionaries -------------------------- */
  const subjectsList = [
    "Алгебра",
    "Геометрия",
    "Русский язык",
    "Русская лит.",
    "Кыргыз‑тил",
    "Кыргыз‑адаб",
    "Английский язык",
    "Физика",
    "Химия",
    "Биология",
    "История",
    "География",
    "ОБиП",
    "Право",
    "ЗОЖ",
    "ДПМ",
    "Физра",
    "Охрана",
    "ЧиО",
    "Основа Комп.",
    "Основа Прог.",
    "Библ‑яз",
    "ООП",
    "ПО",
  ];
  const classesList = ["WEB-10/24", "WEB-11/24"];
  const MS_IN_DAY = 86_400_000;

  /* --------------------------------- State --------------------------------- */
  const [entries, setEntries] = useState([]);
  const [date, setDate] = useState(new Date());
  const [lessonNumber, setLessonNumber] = useState(1);
  const [subject, setSubject] = useState("");
  const [filterClass, setFilterClass] = useState(classesList[0]);
  const [searchSubject, setSearchSubject] = useState("");
  const [results, setResults] = useState([]);
  const [editEntry, setEditEntry] = useState(null);

  /* ----------------------------- Firestore live ---------------------------- */
  useEffect(() => {
    const q = query(collection(db, "entries"), where("classId", "==", filterClass), orderBy("date"));
    const unsub = onSnapshot(q, snap => setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [filterClass]);

  /* -------------------------------- Helpers -------------------------------- */
  const formatDate = iso => new Date(iso).toLocaleDateString("ru-RU");
  const incDate = dir => setDate(prev => new Date(prev.getTime() + dir * MS_IN_DAY));
  const resetForm = () => { setDate(new Date()); setLessonNumber(1); setSubject(""); setEditEntry(null); };

  /* --------------------------------- CRUD ---------------------------------- */
  const addOrSaveEntry = async () => {
    if (!subject) return;
    const payload = { date: date.toISOString().substring(0,10), lessonNumber: Number(lessonNumber), subject, classId: filterClass };

    if (!editEntry) {
      const tempId = "temp-" + Math.random();
      setEntries(prev => [...prev, { id: tempId, ...payload }]);
      try {
        const ref = await addDoc(collection(db, "entries"), payload);
        setEntries(prev => prev.map(en => en.id === tempId ? { ...en, id: ref.id } : en));
      } catch(err) { alert("Firestore error: " + err.message); }
    } else {
      try { await updateDoc(doc(db, "entries", editEntry.id), payload); }
      catch(err){ alert("Firestore error: " + err.message); }
    }
    resetForm();
  };

  const startEdit = e => { setEditEntry(e); setDate(new Date(e.date)); setLessonNumber(e.lessonNumber); setSubject(e.subject); };
  const removeEntry = async id => { if(confirm("Удалить?")) await deleteDoc(doc(db, "entries", id)); };

  /* --------------------------- Derived calculations ------------------------ */
  const sorted = [...entries].sort((a,b)=>a.date===b.date? a.lessonNumber-b.lessonNumber : new Date(a.date)-new Date(b.date));
  const summary = entries.reduce((acc,e)=>{acc[e.subject]=(acc[e.subject]||0)+2; return acc;},{});
  const chartData = Object.entries(summary).map(([s,h])=>({subject:s,hours:h}));

  /* -------------------------------- Export --------------------------------- */
  const exportToExcel = () => {
    if(!entries.length) return;
    const grouped = entries.reduce((a,e)=>{(a[e.subject]=a[e.subject]||[]).push({Дата:formatDate(e.date),"№":e.lessonNumber});return a;},{});
    const wb = XLSX.utils.book_new();
    Object.entries(grouped).forEach(([n,r])=>XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(r),n.substring(0,31)));
    XLSX.writeFile(wb,`Отчет_${filterClass}.xlsx`);
  };

  /* --------------------------------- Render -------------------------------- */
  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8" style={{background:brand.bg,color:"#f1f5f9", width: "100vw"}}>
      <div className="w-full max-w-4xl space-y-8">
        <motion.h1 initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} className="text-3xl font-bold text-center">Расписание — {filterClass}</motion.h1>

        {/* Class selector */}
        <div className="flex gap-2 justify-center items-center"><span>Класс:</span><select value={filterClass} onChange={e=>{setFilterClass(e.target.value);resetForm();}} className="border rounded px-3 py-1 bg-white text-black">{classesList.map(c=><option key={c}>{c}</option>)}</select></div>

        {/* Form */}
        <div className="p-4 rounded-lg shadow" style={{background:brand.card}}>
          <h2 className="text-xl font-semibold mb-4">{editEntry?"Редактировать":"Добавить"}</h2>
          <div className="grid md:grid-cols-4 gap-2">
            <div className="flex items-center gap-2 col-span-2"><button onClick={()=>incDate(-1)} className="border rounded px-2">←</button><DatePicker selected={date} onChange={setDate} dateFormat="dd.MM.yyyy" className="border rounded px-2 py-1 w-full bg-white text-black"/><button onClick={()=>incDate(1)} className="border rounded px-2">→</button></div>
            <input type="number" min={1} max={10} value={lessonNumber} onChange={e=>setLessonNumber(e.target.value)} className="border rounded px-2 bg-white text-black"/>
            <select value={subject} onChange={e=>setSubject(e.target.value)} className="border rounded px-2 bg-white text-black"><option value="" disabled>Предмет</option>{subjectsList.map(s=><option key={s}>{s}</option>)}</select>
          </div>
          <button onClick={addOrSaveEntry} disabled={!subject} className="mt-4 px-4 py-1 rounded text-white disabled:opacity-50" style={{background:brand.primary}}>{editEntry?"Сохранить":"Добавить"}</button>
        </div>

        {/* Schedule list */}
        <div className="p-4 rounded-lg shadow" style={{background:brand.card}}>
          <h2 className="text-xl font-semibold mb-2">Расписание</h2>{!sorted.length?<p className="text-sm">Нет записей.</p>:<ul className="space-y-1">{sorted.map(e=>(<li key={e.id} className="border rounded p-2 flex justify-between"><span>{formatDate(e.date)} — {e.lessonNumber}-й — {e.subject}</span><span className="flex gap-1"><button onClick={()=>startEdit(e)} className="border rounded px-2">✏️</button><button onClick={()=>removeEntry(e.id)} className="border rounded px-2 text-red-400">🗑️</button></span></li>))}</ul>}
        </div>

        {/* Hours chart */}
        <div className="p-4 rounded-lg shadow" style={{background:brand.card}}>
          <h2 className="text-xl font-semibold mb-4">Часы</h2>{!chartData.length?<p className="text-sm">Нет данных.</p>:<ResponsiveContainer width="100%" height={300}><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke="#52525b"/><XAxis dataKey="subject" tick={{fontSize:12,fill:"#e2e8f0"}} interval={0} angle={-45} textAnchor="end" height={80}/><YAxis tick={{fill:"#e2e8f0"}}/><Tooltip contentStyle={{background:brand.card}}/><Bar dataKey="hours" fill={brand.primary}/></BarChart></ResponsiveContainer>}
        </div>

        {/* Search */}
        <div className="p-4 rounded-lg shadow space-y-4" style={{background:brand.card}}>
          <h2 className="text-xl font-semibold">Поиск</h2>
          <select value={searchSubject} onChange={e=>{const val=e.target.value; setSearchSubject(val); setResults(entries.filter(el=>el.subject===val));}} className="border rounded px-2 bg-white text-black w-full md:w-60"><option value="" disabled>Предмет</option>{subjectsList.map(s=><option key={s}>{s}</option>)}</select>
          {searchSubject && (results.length ? (<div><p>Уроков: <strong>{results.length}</strong> / Часов: <strong>{results.length*2}</strong></p><ul className="space-y-1 mt-2">{results.map(r=><li key={r.id} className="border rounded p-2">{formatDate(r.date)} — {r.lessonNumber}-й</li>)}</ul></div>) : (<p className="text-sm">Уроки не найдены.</p>))}
        </div>

        {/* Export */}
        <div className="p-4 rounded-lg shadow text-center" style={{background:brand.card}}><button onClick={exportToExcel} disabled={!entries.length} className="px-6 py-2 rounded text-white disabled:opacity-50" style={{background:brand.primary}}>Скачать Excel</button></div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
Dependencies:
  npm i react react-dom firebase react-datepicker xlsx recharts framer-motion
  npm i -D vite @vitejs/plugin-react tailwindcss@3.4.4 postcss autoprefixer
  npx tailwindcss init -p
-------------------------------------------------------------------------- */
