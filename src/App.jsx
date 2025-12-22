import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

function App() {
  // --- СОСТОЯНИЯ ---
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('groups_v7')) || [{name: "Группа 1", totalStudents: 25}]);
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('subj_v7')) || []);
  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [activeGroup, setActiveGroup] = useState(groups[0]?.name || "");
  const [darkMode, setDarkMode] = useState(true);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')); 
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('schedule'); // schedule | dashboard | settings
  const [historySubject, setHistorySubject] = useState(null);

  const [form, setForm] = useState({ subject: '', lessonNumber: '', students: '' });
  const [newGroup, setNewGroup] = useState({ name: '', total: '' });
  const [newSubj, setNewSubj] = useState({ name: '', target: 'all' });

  const todayStr = new Date().toLocaleDateString('en-CA');

  // --- СИНХРОНИЗАЦИЯ ---
  useEffect(() => {
    localStorage.setItem('groups_v7', JSON.stringify(groups));
    localStorage.setItem('subj_v7', JSON.stringify(subjects));
  }, [groups, subjects]);

  useEffect(() => { fetchData(); }, [activeGroup]);

  async function fetchData() {
    setLoading(true);
    try {
      const [recRes, tempRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch(`/api/templates?group=${activeGroup}`)
      ]);
      const rData = await recRes.json();
      const tData = await tempRes.json();
      if (Array.isArray(rData)) setRecords(rData);
      if (Array.isArray(tData)) setTemplates(tData);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  // --- ВЫЧИСЛЕНИЯ (STATS) ---
  const currentGroupInfo = groups.find(g => g.name === activeGroup) || { totalStudents: 1 };
  
  const stats = useMemo(() => {
    const filtered = records.filter(r => r.group === activeGroup);
    const totalHours = filtered.length * 2;
    const totalPresent = filtered.reduce((acc, r) => acc + (parseInt(r.studentsPresent) || 0), 0);
    const potential = filtered.length * currentGroupInfo.totalStudents;
    const attendance = potential > 0 ? ((totalPresent / potential) * 100).toFixed(1) : 0;
    
    const subjectHours = filtered.reduce((acc, r) => {
      acc[r.subject] = (acc[r.subject] || 0) + 2;
      return acc;
    }, {});

    return { totalHours, attendance, subjectHours, count: filtered.length };
  }, [records, activeGroup, currentGroupInfo]);

  // --- ФУНКЦИИ ---
  const applyTemplate = async () => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dayOfWeek = new Date(y, m - 1, d).getDay() || 7;
    const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek && t.subject);
    if (!dayTemplates.length) return alert("Шаблон пуст");
    for (const t of dayTemplates) {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ subject: t.subject, group: activeGroup, date: selectedDate, lessonNumber: t.lessonNumber, studentsPresent: 0 })
      });
    }
    fetchData();
  };

  const copyToGroup = async (target) => {
    const dayRecs = records.filter(r => r.date === selectedDate && r.group === activeGroup);
    if (!dayRecs.length) return alert("Нет данных");
    for (const r of dayRecs) {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...r, _id: undefined, group: target })
      });
    }
    alert("Скопировано!");
  };

  const exportToExcel = () => {
    const data = records.filter(r => r.group === activeGroup).map(r => ({
      "Дата": r.date, "Пара": r.lessonNumber, "Предмет": r.subject, "Часы": 2, "Явка": r.studentsPresent
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Отчет");
    XLSX.writeFile(wb, `EduLog_${activeGroup}.xlsx`);
  };

  // --- КАЛЕНДАРЬ ---
  const calendarDays = (() => {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const first = new Date(y, m, 1).getDay();
    const offset = first === 0 ? 6 : first - 1;
    const days = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) days.push(new Date(y, m, d));
    return days;
  })();

  const themeClass = darkMode ? "bg-[#0f172a] text-white" : "bg-gray-50 text-slate-900";
  const cardClass = darkMode ? "bg-[#1e293b] border-slate-700 shadow-xl" : "bg-white border-gray-200 shadow-md";

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0f172a] text-indigo-500 font-black">СИНХРОНИЗАЦИЯ...</div>;

  return (
    <div className={`min-h-screen ${themeClass} font-sans pb-10 transition-all`}>
      <div className="max-w-7xl mx-auto p-4">
        
        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center mb-8 gap-4 py-6 border-b border-indigo-500/20">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-black text-indigo-500 italic">EDU.LOG</h1>
            <nav className="flex bg-slate-800 p-1 rounded-xl">
              {['schedule', 'dashboard', 'settings'].map(t => (
                <button key={t} onClick={() => setCurrentTab(t)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase ${currentTab === t ? 'bg-indigo-600' : 'text-slate-500'}`}>
                  {t === 'schedule' ? 'План' : t === 'dashboard' ? 'Анализ' : 'Опции'}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex gap-2">
            <select value={activeGroup} onChange={e => setActiveGroup(e.target.value)} className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold outline-none">
              {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
            </select>
            <button onClick={() => setDarkMode(!darkMode)} className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </header>

        {currentTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className={`${cardClass} p-6 rounded-[2rem] text-center`}><div className="text-[10px] opacity-40 uppercase">Часы</div><div className="text-3xl font-black">{stats.totalHours} ч.</div></div>
              <div className={`${cardClass} p-6 rounded-[2rem] text-center`}><div className="text-[10px] opacity-40 uppercase">Посещаемость</div><div className="text-3xl font-black text-amber-400">{stats.attendance}%</div></div>
              <div className={`${cardClass} p-6 rounded-[2rem] text-center`}><div className="text-[10px] opacity-40 uppercase">Занятий</div><div className="text-3xl font-black text-indigo-400">{stats.count}</div></div>
              <button onClick={exportToExcel} className="bg-emerald-600 rounded-[2rem] font-black uppercase text-xs">Excel ⬇</button>
            </div>
            <div className={`${cardClass} p-8 rounded-[3rem]`}>
              <h3 className="font-black uppercase mb-4 text-indigo-400 italic">Нагрузка по предметам</h3>
              {Object.entries(stats.subjectHours).map(([name, hours]) => (
                <div key={name} className="flex justify-between border-b border-slate-700 py-3 text-sm">
                  <span className="font-bold uppercase">{name}</span>
                  <span className="font-black">{hours} ч.</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'settings' && (
          <div className="grid lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4">
            {/* Настройка Групп */}
            <div className={`${cardClass} p-6 rounded-[2rem]`}>
              <h2 className="text-lg font-black uppercase mb-4 text-indigo-400">Группы</h2>
              <div className="space-y-2 mb-4">
                <input value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs" placeholder="Имя группы" />
                <input type="number" value={newGroup.total} onChange={e => setNewGroup({...newGroup, total: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs" placeholder="Кол-во студентов" />
                <button onClick={() => {if(newGroup.name && newGroup.total){setGroups([...groups, {name:newGroup.name, totalStudents:parseInt(newGroup.total)}]); setNewGroup({name:'', total:''});}}} className="w-full bg-indigo-600 p-2 rounded-lg font-black uppercase">Создать</button>
              </div>
              {groups.map(g => (
                <div key={g.name} className="flex justify-between p-2 bg-slate-900/40 mb-2 rounded-lg text-xs">
                  <span>{g.name} ({g.totalStudents} чел.)</span>
                  <button onClick={() => setGroups(groups.filter(x => x.name !== g.name))} className="text-red-500">✕</button>
                </div>
              ))}
            </div>
            {/* Настройка Предметов */}
            <div className={`${cardClass} p-6 rounded-[2rem]`}>
              <h2 className="text-lg font-black uppercase mb-4 text-emerald-400">Библиотека</h2>
              <input value={newSubj.name} onChange={e => setNewSubj({...newSubj, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs mb-2" placeholder="Название предмета" />
              <select value={newSubj.target} onChange={e => setNewSubj({...newSubj, target: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-2 rounded-lg text-xs mb-2">
                <option value="all">Для всех</option>
                {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
              </select>
              <button onClick={() => {if(newSubj.name){setSubjects([...subjects, {name: newSubj.name, targetGroup: newSubj.target}]); setNewSubj({name:'', target:'all'});}}} className="w-full bg-emerald-600 p-2 rounded-lg font-black uppercase">Добавить</button>
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1">
                {subjects.map((s, i) => (
                  <div key={i} className="flex justify-between p-2 bg-slate-900/40 rounded-lg text-[10px]">
                    <span>{s.name} ({s.targetGroup})</span>
                    <button onClick={() => setSubjects(subjects.filter((_, idx) => idx !== i))} className="text-red-500">✕</button>
                  </div>
                ))}
              </div>
            </div>
            {/* Настройка Шаблонов */}
            <div className={`${cardClass} p-6 rounded-[2rem]`}>
              <h2 className="text-lg font-black uppercase mb-4 text-amber-500">План (4 пары)</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                {[1,2,3,4,5,6].map(d => (
                  <div key={d} className="border-b border-slate-700 pb-2">
                    <div className="text-[10px] font-black opacity-40 mb-2">{["","ПН","ВТ","СР","ЧТ","ПТ","СБ"][d]}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[1,2,3,4].map(l => {
                        const t = templates.find(x => x.dayOfWeek === d && x.lessonNumber === l);
                        return (
                          <select key={l} value={t?.subject || ""} onChange={(e) => {
                            fetch('/api/templates', {
                              method: 'POST',
                              headers: {'Content-Type':'application/json'},
                              body: JSON.stringify({ group: activeGroup, dayOfWeek: d, lessonNumber: l, subject: e.target.value })
                            }).then(() => fetchData());
                          }} className="w-full bg-slate-900 p-1 rounded text-[9px] border border-slate-700">
                            <option value="">Пара {l}</option>
                            {subjects.filter(s => s.targetGroup === 'all' || s.targetGroup === activeGroup).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                          </select>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {currentTab === 'schedule' && (
          <div className="grid lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4">
            <div className="lg:col-span-4">
              <div className={`${cardClass} p-6 rounded-[2.5rem]`}>
                <div className="flex justify-between items-center mb-6">
                  <div className="flex gap-2">
                    <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center">❮</button>
                    <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center">❯</button>
                  </div>
                  <span className="font-black uppercase text-[10px] text-indigo-400">{viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black opacity-20 mb-2">
                  <div>ПН</div><div>ВТ</div><div>СР</div><div>ЧТ</div><div>ПТ</div><div>СБ</div><div>ВС</div>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={i} className="h-10"></div>;
                    const dStr = day.toLocaleDateString('en-CA');
                    const isSelected = selectedDate === dStr;
                    const hasLessons = records.some(r => r.date === dStr && r.group === activeGroup);
                    return (
                      <button key={dStr} onClick={() => setSelectedDate(dStr)} className={`h-10 rounded-xl text-xs font-bold transition-all border relative ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white scale-105' : 'bg-slate-700/20 border-slate-700'}`}>
                        {day.getDate()}
                        {hasLessons && <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`}></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className={`${cardClass} p-8 rounded-[3rem] border-2 border-indigo-500/20`}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-black text-indigo-400 italic">{selectedDate.split('-').reverse().join('.')}</h2>
                  <div className="flex gap-2">
                    <button onClick={applyTemplate} className="bg-amber-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase">Магия 🪄</button>
                    <select onChange={(e) => copyToGroup(e.target.value)} className="bg-slate-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase outline-none" value="">
                      <option value="">Копировать в...</option>
                      {groups.filter(g => g.name !== activeGroup).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                    </select>
                  </div>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault(); if(!form.subject) return;
                  await fetch('/api/schedule', {
                    method: 'POST',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ subject: form.subject, group: activeGroup, date: selectedDate, lessonNumber: parseInt(form.lessonNumber || 1), studentsPresent: parseInt(form.students || 0) })
                  });
                  fetchData();
                  setForm({subject:'', lessonNumber:'', students:''});
                }} className="grid grid-cols-12 gap-3">
                  <select className="col-span-12 md:col-span-6 bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold outline-none" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                    <option value="">Выберите предмет</option>
                    {subjects.filter(s => s.targetGroup === 'all' || s.targetGroup === activeGroup).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  <input type="number" placeholder="Пара" className="col-span-4 md:col-span-2 bg-slate-900 p-4 rounded-2xl border border-slate-700 text-center font-black" value={form.lessonNumber} onChange={e => setForm({...form, lessonNumber: e.target.value})} />
                  <input type="number" placeholder="Студ." className="col-span-4 md:col-span-2 bg-slate-900 p-4 rounded-2xl border border-slate-700 text-center font-black" value={form.students} onChange={e => setForm({...form, students: e.target.value})} />
                  <button className="col-span-4 md:col-span-2 bg-indigo-600 rounded-2xl font-black uppercase">OK</button>
                </form>
              </div>

              <div className="grid gap-3">
                {records.filter(r => r.group === activeGroup && r.date === selectedDate).sort((a,b)=>a.lessonNumber-b.lessonNumber).map(r => (
                  <div key={r._id} className={`${cardClass} p-5 rounded-[2rem] border-l-[12px] border-l-indigo-600 flex justify-between items-center group`}>
                    <div className="flex items-center gap-6">
                      <div className="text-2xl font-black text-indigo-400">{r.lessonNumber}</div>
                      <div>
                        <button onClick={() => setHistorySubject(r.subject)} className="font-black text-lg uppercase tracking-tight hover:text-indigo-400 text-left">{r.subject}</button>
                        <div className="text-[9px] opacity-40 font-bold mt-1">🕒 2 ЧАСА | 👥 {r.studentsPresent} / {currentGroupInfo.totalStudents} ПРИШЛО</div>
                      </div>
                    </div>
                    <button onClick={async () => {
                      if(window.confirm("Удалить?")) {
                        await fetch(`/api/schedule?id=${r._id}`, {method:'DELETE'});
                        setRecords(records.filter(x => x._id !== r._id));
                      }
                    }} className="text-red-500 font-bold px-4 opacity-0 group-hover:opacity-100 transition-all">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* МОДАЛЬНОЕ ОКНО ИСТОРИИ */}
        {historySubject && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-[3rem] border border-indigo-500/30 overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-slate-700 flex justify-between items-center bg-indigo-600/10 text-white">
                <h2 className="text-2xl font-black uppercase italic">История: {historySubject}</h2>
                <button onClick={() => setHistorySubject(null)} className="text-2xl">✕</button>
              </div>
              <div className="p-8 max-h-[60vh] overflow-y-auto space-y-4">
                {records.filter(r => r.subject === historySubject && r.group === activeGroup)
                  .sort((a,b) => b.date.localeCompare(a.date))
                  .map((r, i) => (
                    <div key={i} className="flex justify-between items-center p-4 bg-slate-900/50 rounded-2xl border border-white/5 text-white">
                      <span className="font-black text-indigo-400">{r.date.split('-').reverse().join('.')}</span>
                      <span className="text-sm font-bold opacity-60">Пара №{r.lessonNumber}</span>
                      <span className="bg-indigo-500/20 px-3 py-1 rounded-lg text-[10px] font-black">
                        Явка: {((r.studentsPresent / currentGroupInfo.totalStudents) * 100).toFixed(0)}%
                      </span>
                    </div>
                  ))}
              </div>
              <div className="p-6 bg-slate-900/50 text-center text-white/50 text-[10px] font-black uppercase">
                Всего проведено: {records.filter(r => r.subject === historySubject && r.group === activeGroup).length * 2} часа(ов)
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;