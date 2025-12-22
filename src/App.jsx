import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

function App() {
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('subj_v4')) || []);
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('groups_v4')) || ["Группа 1"]);
  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [activeGroup, setActiveGroup] = useState(groups[0]);
  const [darkMode, setDarkMode] = useState(true);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')); 
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const [form, setForm] = useState({ subject: '', lessonNumber: '' });
  const [newGroupName, setNewGroupName] = useState('');
  const [newSubjName, setNewSubjName] = useState('');
  const [subjTargetGroup, setSubjTargetGroup] = useState('all');

  const todayStr = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    localStorage.setItem('subj_v4', JSON.stringify(subjects));
    localStorage.setItem('groups_v4', JSON.stringify(groups));
  }, [subjects, groups]);

  useEffect(() => { fetchData(); }, [activeGroup]);

  async function fetchData() {
    setLoading(true);
    try {
      const [recRes, tempRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch(`/api/templates?group=${activeGroup}`)
      ]);
      const recData = await recRes.json();
      const tempData = await tempRes.json();
      if (Array.isArray(recData)) setRecords(recData);
      if (Array.isArray(tempData)) setTemplates(tempData);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  // --- ЭКСПОРТ ---
  const exportToExcel = () => {
    const groupRecords = records
      .filter(r => r.group === activeGroup)
      .sort((a, b) => a.date.localeCompare(b.date) || a.lessonNumber - b.lessonNumber)
      .map(r => ({
        "Дата": r.date.split('-').reverse().join('.'),
        "Пара": r.lessonNumber,
        "Предмет": r.subject
      }));
    const ws = XLSX.utils.json_to_sheet(groupRecords);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Расписание");
    XLSX.writeFile(wb, `EduLog_${activeGroup}.xlsx`);
  };

  // --- КОПИРОВАНИЕ ---
  const copyToGroup = async (targetGroup) => {
    const currentDay = records.filter(r => r.date === selectedDate && r.group === activeGroup);
    if (!currentDay.length) return alert("Нет данных");
    if (window.confirm(`Скопировать в ${targetGroup}?`)) {
      for (const r of currentDay) {
        await fetch('/api/schedule', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ subject: r.subject, group: targetGroup, date: selectedDate, lessonNumber: r.lessonNumber })
        });
      }
      fetchData();
    }
  };

  // --- ЛОГИКА КАЛЕНДАРЯ ---
  const calendarDays = (() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1; // Смещение для ПН
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  })();

  const changeMonth = (offset) => {
    const newDate = new Date(viewDate.setMonth(viewDate.getMonth() + offset));
    setViewDate(new Date(newDate));
  };

  const filteredSubjects = subjects.filter(s => s.targetGroup === 'all' || s.targetGroup === activeGroup);
  const themeClass = darkMode ? "bg-slate-900 text-white" : "bg-gray-50 text-slate-900";
  const cardClass = darkMode ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200 shadow-md";

  return (
    <div className={`min-h-screen ${themeClass} font-sans pb-10 transition-all`}>
      <div className="max-w-7xl mx-auto p-4">
        
        <header className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-black text-indigo-500 italic tracking-tighter">EDU.LOG</h1>
            <nav className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 overflow-x-auto">
              {groups.map(g => (
                <button key={g} onClick={() => setActiveGroup(g)} className={`px-4 py-2 rounded-lg font-bold text-xs ${activeGroup === g ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{g}</button>
              ))}
            </nav>
          </div>
          <div className="flex gap-2">
            <button onClick={exportToExcel} className="px-4 py-2 bg-emerald-600 rounded-xl font-black text-[10px] uppercase">Excel ⬇</button>
            <button onClick={() => setShowSettings(!showSettings)} className="px-4 py-2 bg-slate-700 rounded-xl font-black text-[10px] uppercase">{showSettings ? 'Назад' : '⚙ Настройки'}</button>
            <button onClick={() => setDarkMode(!darkMode)} className="w-10 h-10 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </header>

        {showSettings ? (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Группы */}
            <div className={`p-6 rounded-[2rem] border ${cardClass}`}>
              <h2 className="text-lg font-black uppercase mb-4 text-indigo-400">Группы</h2>
              <div className="flex gap-2 mb-4">
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="flex-1 bg-slate-900 p-2 rounded-lg text-xs border border-slate-700" placeholder="Имя группы" />
                <button onClick={() => {if(newGroupName){setGroups([...groups, newGroupName]); setNewGroupName('');}}} className="bg-indigo-600 px-4 rounded-lg font-black">+</button>
              </div>
              <div className="space-y-2">
                {groups.map(g => (
                  <div key={g} className="flex justify-between p-2 bg-slate-900/50 rounded-lg text-xs">
                    <span>{g}</span>
                    <button onClick={() => setGroups(groups.filter(x => x !== g))} className="text-red-500">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Предметы */}
            <div className={`p-6 rounded-[2rem] border ${cardClass}`}>
              <h2 className="text-lg font-black uppercase mb-4 text-emerald-400">Предметы</h2>
              <input value={newSubjName} onChange={e => setNewSubjName(e.target.value)} className="w-full bg-slate-900 p-2 rounded-lg text-xs mb-2 border border-slate-700" placeholder="Название предмета" />
              <select value={subjTargetGroup} onChange={e => setSubjTargetGroup(e.target.value)} className="w-full bg-slate-900 p-2 rounded-lg text-xs mb-2 border border-slate-700">
                <option value="all">Для всех</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
              <button onClick={() => {if(newSubjName){setSubjects([...subjects, {name: newSubjName, targetGroup: subjTargetGroup}]); setNewSubjName('');}}} className="w-full bg-emerald-600 p-2 rounded-lg font-black text-xs mb-4">Добавить</button>
              <div className="max-h-60 overflow-y-auto pr-2">
                {subjects.map((s, i) => (
                  <div key={i} className="flex justify-between p-2 bg-slate-900/50 mb-2 rounded-lg text-[10px]">
                    <span>{s.name} <span className="opacity-30">({s.targetGroup})</span></span>
                    <button onClick={() => setSubjects(subjects.filter((_, idx) => idx !== i))} className="text-red-500">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* ШАБЛОНЫ (ДО 4 УРОКОВ) */}
            <div className={`p-6 rounded-[2rem] border ${cardClass}`}>
              <h2 className="text-lg font-black uppercase mb-4 text-amber-500">Шаблон (до 4-х пар)</h2>
              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {[1,2,3,4,5,6].map(d => (
                  <div key={d} className="border-b border-slate-700 pb-3">
                    <div className="text-[10px] font-black text-indigo-300 mb-2 uppercase">{["","ПН","ВТ","СР","ЧТ","ПТ","СБ"][d]}</div>
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
                                {filteredSubjects.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                        );
                        })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8">
            {/* КАЛЕНДАРЬ */}
            <div className="lg:col-span-4">
              <div className={`p-6 rounded-[2.5rem] border ${cardClass}`}>
                <div className="flex justify-between items-center mb-6 px-2">
                  <div className="flex gap-2">
                    <button onClick={() => changeMonth(-1)} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center text-white">❮</button>
                    <button onClick={() => changeMonth(1)} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center text-white">❯</button>
                  </div>
                  <span className="font-black uppercase text-[10px] text-indigo-400">
                    {viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                  </span>
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
                      <button key={dStr} onClick={() => setSelectedDate(dStr)} className={`h-10 rounded-xl text-xs font-bold transition-all border relative ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white scale-105 z-10' : 'bg-slate-700/20 border-slate-700'}`}>
                        {day.getDate()}
                        {hasLessons && <div className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`}></div>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <div className={`p-8 rounded-[3rem] border-2 border-indigo-500/20 ${cardClass}`}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-black text-indigo-400">{selectedDate.split('-').reverse().join('.')}</h2>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                        const [y, m, d] = selectedDate.split('-').map(Number);
                        const dayOfWeek = new Date(y, m - 1, d).getDay() || 7;
                        const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek && t.subject);
                        if (!dayTemplates.length) return alert("Пустой шаблон");
                        for (const t of dayTemplates) {
                            await fetch('/api/schedule', {
                                method: 'POST',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({ subject: t.subject, group: activeGroup, date: selectedDate, lessonNumber: t.lessonNumber })
                            });
                        }
                        fetchData();
                    }} className="bg-amber-600 px-3 py-2 rounded-xl text-[10px] font-black uppercase">Магия 🪄</button>
                    <select onChange={(e) => copyToGroup(e.target.value)} className="bg-slate-700 px-3 py-2 rounded-xl text-[10px] font-black uppercase outline-none" value="">
                      <option value="">Копировать в...</option>
                      {groups.filter(g => g !== activeGroup).map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                </div>

                <form onSubmit={async (e) => {
                   e.preventDefault(); if(!form.subject) return;
                   await fetch('/api/schedule', {
                     method: 'POST',
                     headers: {'Content-Type':'application/json'},
                     body: JSON.stringify({...form, group: activeGroup, date: selectedDate, lessonNumber: parseInt(form.lessonNumber || 1)})
                   });
                   fetchData();
                   setForm({subject:'', lessonNumber:''});
                }} className="grid grid-cols-12 gap-3">
                  <select className="col-span-8 bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold outline-none" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                    <option value="">Выберите предмет</option>
                    {filteredSubjects.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  <input type="number" placeholder="Пара" className="col-span-2 bg-slate-900 p-4 rounded-2xl border border-slate-700 text-center font-black outline-none" value={form.lessonNumber} onChange={e => setForm({...form, lessonNumber: e.target.value})} />
                  <button className="col-span-2 bg-indigo-600 rounded-2xl font-black uppercase">➕</button>
                </form>
              </div>

              <div className="grid gap-3">
                {records.filter(r => r.group === activeGroup && r.date === selectedDate).sort((a,b)=>a.lessonNumber-b.lessonNumber).map(r => (
                  <div key={r._id} className={`p-5 rounded-[2rem] border flex justify-between items-center ${cardClass} border-l-[12px] border-l-indigo-600 animate-in slide-in-from-left duration-200`}>
                    <div className="flex items-center gap-6">
                      <div className="text-2xl font-black text-indigo-400">{r.lessonNumber}</div>
                      <div className="font-black text-lg uppercase tracking-tight">{r.subject}</div>
                    </div>
                    <button onClick={async () => {
                      await fetch(`/api/schedule?id=${r._id}`, {method:'DELETE'});
                      setRecords(records.filter(x => x._id !== r._id));
                    }} className="text-red-500 font-bold px-4">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;