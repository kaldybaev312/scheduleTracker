import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

function App() {
  // --- СОСТОЯНИЯ ---
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('groups_v8')) || [{name: "Группа 1", totalStudents: 25}]);
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('subj_v8')) || []);
  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [activeGroup, setActiveGroup] = useState(groups[0]?.name || "");
  const [darkMode, setDarkMode] = useState(true);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')); 
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('schedule'); 
  const [historySubject, setHistorySubject] = useState(null);

  const [form, setForm] = useState({ subject: '', lessonNumber: '', students: '' });
  const [newGroup, setNewGroup] = useState({ name: '', total: '' });
  const [newSubj, setNewSubj] = useState({ name: '', target: 'all' });

  useEffect(() => {
    localStorage.setItem('groups_v8', JSON.stringify(groups));
    localStorage.setItem('subj_v8', JSON.stringify(subjects));
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

  const currentGroupInfo = groups.find(g => g.name === activeGroup) || { totalStudents: 1 };
  
  const stats = useMemo(() => {
    const filtered = records.filter(r => r.group === activeGroup);
    const subjectHours = filtered.reduce((acc, r) => {
      acc[r.subject] = (acc[r.subject] || 0) + 2;
      return acc;
    }, {});
    const totalHours = filtered.length * 2;
    const totalPresent = filtered.reduce((acc, r) => acc + (parseInt(r.studentsPresent) || 0), 0);
    const potential = filtered.length * currentGroupInfo.totalStudents;
    const attendance = potential > 0 ? ((totalPresent / potential) * 100).toFixed(1) : 0;
    return { totalHours, attendance, subjectHours, count: filtered.length };
  }, [records, activeGroup, currentGroupInfo]);

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

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0f172a] text-indigo-500 font-black italic animate-pulse tracking-tighter text-2xl">EDU.OS LOADING...</div>;

  return (
    <div className={`min-h-screen ${themeClass} font-sans pb-20 transition-all`}>
      <div className="max-w-7xl mx-auto p-3 md:p-6">
        
        {/* HEADER - Адаптивный */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 py-4 border-b border-indigo-500/20">
          <div className="flex items-center justify-between w-full md:w-auto gap-6">
            <h1 className="text-2xl md:text-3xl font-black text-indigo-500 italic">EDU.LOG</h1>
            <button onClick={() => setDarkMode(!darkMode)} className="md:hidden w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">{darkMode ? '☀️' : '🌙'}</button>
          </div>

          <nav className="flex bg-slate-800/50 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
            {['schedule', 'dashboard', 'settings'].map(t => (
              <button key={t} onClick={() => setCurrentTab(t)} className={`flex-1 md:flex-none px-4 py-2.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentTab === t ? 'bg-indigo-600 shadow-lg' : 'text-slate-500'}`}>
                {t === 'schedule' ? 'План' : t === 'dashboard' ? 'Анализ' : 'Опции'}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex gap-2">
            <select value={activeGroup} onChange={e => setActiveGroup(e.target.value)} className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold outline-none">
              {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
            </select>
            <button onClick={() => setDarkMode(!darkMode)} className="w-10 h-10 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </header>

        {/* СЕЛЕКТОР ГРУППЫ ДЛЯ МОБИЛОК */}
        <div className="md:hidden mb-6">
            <select value={activeGroup} onChange={e => setActiveGroup(e.target.value)} className="w-full bg-slate-800 border border-slate-700 p-4 rounded-2xl text-sm font-black uppercase tracking-widest outline-none shadow-xl">
              {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
            </select>
        </div>

        {/* ВКЛАДКА: АНАЛИЗ (С историей) */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className={`${cardClass} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] text-center`}>
                <div className="text-[9px] opacity-40 uppercase font-black">Всего Часов</div>
                <div className="text-xl md:text-3xl font-black text-indigo-400">{stats.totalHours}</div>
              </div>
              <div className={`${cardClass} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] text-center`}>
                <div className="text-[9px] opacity-40 uppercase font-black">Явка %</div>
                <div className="text-xl md:text-3xl font-black text-amber-400">{stats.attendance}%</div>
              </div>
              <div className={`${cardClass} p-4 md:p-6 rounded-[1.5rem] md:rounded-[2rem] text-center`}>
                <div className="text-[9px] opacity-40 uppercase font-black">Пар</div>
                <div className="text-xl md:text-3xl font-black">{stats.count}</div>
              </div>
              <button onClick={exportToExcel} className="bg-emerald-600 rounded-[1.5rem] md:rounded-[2rem] font-black uppercase text-[10px] md:text-xs text-white shadow-lg active:scale-95 transition-transform">Excel ⬇</button>
            </div>

            <div className={`${cardClass} p-6 md:p-8 rounded-[2rem] md:rounded-[3rem]`}>
              <h3 className="font-black uppercase mb-6 text-indigo-400 italic text-sm md:text-lg">История по предметам</h3>
              <div className="space-y-2">
                {Object.entries(stats.subjectHours).map(([name, hours]) => (
                  <button key={name} onClick={() => setHistorySubject(name)} className="w-full flex justify-between items-center p-4 bg-slate-900/30 hover:bg-indigo-500/10 border border-white/5 rounded-2xl transition-all group">
                    <span className="font-bold text-xs md:text-sm uppercase text-left group-hover:text-indigo-400">{name}</span>
                    <div className="text-right">
                        <span className="font-black text-indigo-400 block">{hours} ч.</span>
                        <span className="text-[9px] opacity-30 uppercase">Подробнее →</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ПЛАН (Мобильная адаптация) */}
        {currentTab === 'schedule' && (
          <div className="grid lg:grid-cols-12 gap-6 md:gap-8">
            {/* КАЛЕНДАРЬ */}
            <div className="lg:col-span-4 order-2 lg:order-1">
              <div className={`${cardClass} p-5 md:p-6 rounded-[2rem]`}>
                <div className="flex justify-between items-center mb-6">
                  <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center transition-active">❮</button>
                  <span className="font-black uppercase text-[11px] text-indigo-400 tracking-tighter">{viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}</span>
                  <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="w-10 h-10 bg-slate-700/50 rounded-xl flex items-center justify-center transition-active">❯</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black opacity-20 mb-3">
                  {['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 md:gap-2">
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={i} className="h-10 md:h-12"></div>;
                    const dStr = day.toLocaleDateString('en-CA');
                    const isSelected = selectedDate === dStr;
                    const hasLessons = records.some(r => r.date === dStr && r.group === activeGroup);
                    return (
                      <button key={dStr} onClick={() => setSelectedDate(dStr)} className={`h-10 md:h-12 rounded-xl text-xs font-black transition-all border relative flex items-center justify-center ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white scale-105 z-10 shadow-lg shadow-indigo-500/20' : 'bg-slate-700/20 border-slate-700 text-slate-400'}`}>
                        {day.getDate()}
                        {hasLessons && <div className={`absolute bottom-1.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`}></div>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* СПИСОК УРОКОВ */}
            <div className="lg:col-span-8 space-y-4 md:space-y-6 order-1 lg:order-2">
              <div className={`${cardClass} p-6 md:p-8 rounded-[2.5rem] md:rounded-[3rem] border-2 border-indigo-500/20 shadow-indigo-500/5`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h2 className="text-2xl md:text-3xl font-black text-indigo-400 italic tracking-tighter">{selectedDate.split('-').reverse().join('.')}</h2>
                  <div className="flex w-full md:w-auto gap-2">
                    <button onClick={async () => {
                        const [y, m, d] = selectedDate.split('-').map(Number);
                        const dayOfWeek = new Date(y, m - 1, d).getDay() || 7;
                        const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek && t.subject);
                        if (!dayTemplates.length) return alert("Пусто");
                        for (const t of dayTemplates) {
                            await fetch('/api/schedule', {
                                method: 'POST',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({ subject: t.subject, group: activeGroup, date: selectedDate, lessonNumber: t.lessonNumber, studentsPresent: 0 })
                            });
                        }
                        fetchData();
                    }} className="flex-1 md:flex-none bg-amber-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-500/20">Магия 🪄</button>
                    
                    <select onChange={(e) => {
                        const target = e.target.value;
                        if(!target) return;
                        const dayRecs = records.filter(r => r.date === selectedDate && r.group === activeGroup);
                        dayRecs.forEach(async r => {
                            await fetch('/api/schedule', {
                                method: 'POST',
                                headers: {'Content-Type':'application/json'},
                                body: JSON.stringify({ ...r, _id: undefined, group: target })
                            });
                        });
                        alert("OK");
                    }} className="flex-1 md:flex-none bg-slate-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase outline-none" value="">
                      <option value="">Копия в...</option>
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
                }} className="grid grid-cols-12 gap-2 md:gap-3">
                  <select className="col-span-12 md:col-span-6 bg-slate-900 p-4 rounded-2xl border border-slate-700 font-bold outline-none text-sm" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                    <option value="">Выберите предмет</option>
                    {subjects.filter(s => s.targetGroup === 'all' || s.targetGroup === activeGroup).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  <input type="number" placeholder="Пара" className="col-span-4 md:col-span-2 bg-slate-900 p-4 rounded-2xl border border-slate-700 text-center font-black outline-none text-sm" value={form.lessonNumber} onChange={e => setForm({...form, lessonNumber: e.target.value})} />
                  <input type="number" placeholder="Студ." className="col-span-4 md:col-span-2 bg-slate-900 p-4 rounded-2xl border border-slate-700 text-center font-black outline-none text-sm" value={form.students} onChange={e => setForm({...form, students: e.target.value})} />
                  <button className="col-span-4 md:col-span-2 bg-indigo-600 rounded-2xl font-black uppercase text-xs shadow-lg shadow-indigo-500/20 active:scale-95 transition-transform">OK</button>
                </form>
              </div>

              <div className="grid gap-3">
                {records.filter(r => r.group === activeGroup && r.date === selectedDate).sort((a,b)=>a.lessonNumber-b.lessonNumber).map(r => (
                  <div key={r._id} className={`${cardClass} p-4 md:p-5 rounded-[1.5rem] md:rounded-[2rem] border-l-[8px] md:border-l-[12px] border-l-indigo-600 flex justify-between items-center group active:bg-indigo-500/5 transition-colors`}>
                    <div className="flex items-center gap-4 md:gap-6">
                      <div className="text-xl md:text-2xl font-black text-indigo-400">{r.lessonNumber}</div>
                      <div>
                        <button onClick={() => setHistorySubject(r.subject)} className="font-black text-sm md:text-lg uppercase tracking-tight hover:text-indigo-400 text-left transition-colors">{r.subject}</button>
                        <div className="text-[8px] md:text-[9px] opacity-40 font-bold mt-0.5 uppercase">🕒 2 ЧАСА | 👥 {r.studentsPresent}/{currentGroupInfo.totalStudents} чел.</div>
                      </div>
                    </div>
                    <button onClick={async () => {
                      if(window.confirm("Удалить?")) {
                        await fetch(`/api/schedule?id=${r._id}`, {method:'DELETE'});
                        setRecords(records.filter(x => x._id !== r._id));
                      }
                    }} className="text-red-500/30 hover:text-red-500 font-bold px-2 text-xs transition-colors uppercase">Удал.</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ВКЛАДКА: ОПЦИИ */}
        {currentTab === 'settings' && (
            <div className="space-y-6 animate-in slide-in-from-top-4">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Группы */}
                    <div className={cardClass}>
                        <h2 className="text-lg font-black uppercase mb-4 text-indigo-400 italic">Группы</h2>
                        <div className="space-y-3">
                            <input className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-xs" placeholder="Имя (напр. 302-Б)" value={newGroup.name} onChange={e => setNewGroup({...newGroup, name: e.target.value})} />
                            <input type="number" className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-xs" placeholder="Всего студентов" value={newGroup.total} onChange={e => setNewGroup({...newGroup, total: e.target.value})} />
                            <button onClick={() => { if(newGroup.name && newGroup.total){setGroups([...groups, {name: newGroup.name, totalStudents: parseInt(newGroup.total)}]); setNewGroup({name:'', total:''});} }} className="w-full bg-indigo-600 p-3 rounded-xl font-black uppercase text-xs">Добавить группу</button>
                        </div>
                        <div className="mt-4 space-y-2">
                            {groups.map(g => (
                                <div key={g.name} className="flex justify-between p-3 bg-slate-900/50 rounded-xl text-xs border border-white/5">
                                    <span className="font-bold">{g.name}</span>
                                    <span className="opacity-40">{g.totalStudents} чел.</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Библиотека */}
                    <div className={cardClass}>
                        <h2 className="text-lg font-black uppercase mb-4 text-emerald-400 italic">Библиотека</h2>
                        <div className="space-y-3">
                            <input className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-xs" placeholder="Название предмета" value={newSubj.name} onChange={e => setNewSubj({...newSubj, name: e.target.value})} />
                            <select className="w-full bg-slate-900 p-3 rounded-xl border border-slate-700 text-xs" value={newSubj.target} onChange={e => setNewSubj({...newSubj, target: e.target.value})}>
                                <option value="all">Для всех групп</option>
                                {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                            </select>
                            <button onClick={() => { if(newSubj.name){setSubjects([...subjects, {name: newSubj.name, targetGroup: newSubj.target}]); setNewSubj({name:'', target:'all'});} }} className="w-full bg-emerald-600 p-3 rounded-xl font-black uppercase text-xs">В библиотеку</button>
                        </div>
                    </div>

                    {/* План (Шаблон) */}
                    <div className={cardClass}>
                        <h2 className="text-lg font-black uppercase mb-4 text-amber-500 italic text-center underline decoration-2">Мой план (4 пары)</h2>
                        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
                            {[1,2,3,4,5,6].map(dayNum => (
                                <div key={dayNum} className="p-3 bg-slate-900/40 rounded-2xl border border-white/5">
                                    <div className="text-[10px] font-black opacity-40 mb-3 uppercase tracking-widest">{['','ПН','ВТ','СР','ЧТ','ПТ','СБ'][dayNum]}</div>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[1,2,3,4].map(lessonNum => {
                                            const t = templates.find(x => x.dayOfWeek === dayNum && x.lessonNumber === lessonNum);
                                            return (
                                                <select key={lessonNum} className="bg-slate-800 p-2 rounded-lg text-[9px] border border-slate-700 outline-none" value={t?.subject || ""} onChange={(e) => {
                                                    fetch('/api/templates', {
                                                        method: 'POST',
                                                        headers: {'Content-Type':'application/json'},
                                                        body: JSON.stringify({ group: activeGroup, dayOfWeek: dayNum, lessonNumber: lessonNum, subject: e.target.value })
                                                    }).then(() => fetchData());
                                                }}>
                                                    <option value="">{lessonNum} пара</option>
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
            </div>
        )}

        {/* МОДАЛКА: ИСТОРИЯ (Адаптивная) */}
        {historySubject && (
          <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-end md:items-center justify-center z-[100] p-0 md:p-4">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-t-[2.5rem] md:rounded-[3rem] border-t md:border border-indigo-500/30 overflow-hidden shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="p-6 md:p-8 border-b border-slate-700 flex justify-between items-center bg-indigo-600/10">
                <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase text-indigo-400 opacity-60">История предмета</span>
                    <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter">{historySubject}</h2>
                </div>
                <button onClick={() => setHistorySubject(null)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-black text-xl hover:bg-red-500/20 transition-colors">✕</button>
              </div>
              <div className="p-4 md:p-8 max-h-[70vh] md:max-h-[60vh] overflow-y-auto space-y-3">
                {records.filter(r => r.subject === historySubject && r.group === activeGroup)
                  .sort((a,b) => b.date.localeCompare(a.date))
                  .map((r, i) => (
                    <div key={i} className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-slate-900/50 rounded-2xl border border-white/5 gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-indigo-400 text-sm">{r.date.split('-').reverse().join('.')}</span>
                        <span className="text-[10px] bg-slate-800 px-2 py-1 rounded font-bold">ПАРА {r.lessonNumber}</span>
                      </div>
                      <div className="flex items-center justify-between w-full md:w-auto gap-4">
                        <span className="text-[10px] font-black uppercase text-white/40">Явка: {((r.studentsPresent / currentGroupInfo.totalStudents) * 100).toFixed(0)}%</span>
                        <span className="bg-indigo-600 px-3 py-1 rounded-lg text-[9px] font-black uppercase">2 ЧАСА</span>
                      </div>
                    </div>
                  ))}
              </div>
              <div className="p-6 bg-slate-900/50 text-center">
                <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4">Всего вычитано: {records.filter(r => r.subject === historySubject && r.group === activeGroup).length * 2} акад. часа(ов)</div>
                <button onClick={() => setHistorySubject(null)} className="md:hidden w-full bg-slate-800 p-4 rounded-2xl font-black uppercase text-xs">Закрыть</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;