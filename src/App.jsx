import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';

function App() {
  // --- СОСТОЯНИЯ ---
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('groups_v16')) || [{name: "Группа 1", totalStudents: 25}]);
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('subj_v16')) || []);
  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]);
  
  const [activeGroup, setActiveGroup] = useState(groups[0]?.name || "");
  const [darkMode, setDarkMode] = useState(true);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA')); 
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('schedule'); 
  const [historySubject, setHistorySubject] = useState(null);

  // Форма записи
  const [form, setForm] = useState({ 
    subject: '', 
    lessonNumber: '', 
    students: '', 
    topic: '', 
    notes: '', 
    type: 'Лекция', 
    hours: 2 
  });
  
  const [newGroup, setNewGroup] = useState({ name: '', total: '' });
  const [newSubj, setNewSubj] = useState({ name: '', target: 'all' });

  // --- АВТО-НУМЕРАЦИЯ ---
  useEffect(() => {
    const existing = records.filter(r => r.date === selectedDate && r.group === activeGroup);
    setForm(prev => ({ 
      ...prev, 
      lessonNumber: existing.length + 1,
      // При смене дня сбрасываем на Лекцию
      type: 'Лекция',
      hours: 2,
      topic: '',
      notes: ''
    }));
  }, [selectedDate, records, activeGroup]);

  // Сохранение
  useEffect(() => {
    localStorage.setItem('groups_v16', JSON.stringify(groups));
    localStorage.setItem('subj_v16', JSON.stringify(subjects));
  }, [groups, subjects]);

  useEffect(() => { fetchData(); }, [activeGroup]);

  async function fetchData() {
    try {
      const [recRes, tempRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch(`/api/templates?group=${activeGroup}`)
      ]);
      const rData = await recRes.json();
      const tData = await tempRes.json();
      setRecords(Array.isArray(rData) ? rData : []);
      setTemplates(Array.isArray(tData) ? tData : []);
    } catch (err) { console.error("Error:", err); }
    setLoading(false);
  }

  // --- УМНАЯ АНАЛИТИКА (РАЗДЕЛЬНАЯ) ---
  const stats = useMemo(() => {
    const groupRecs = records.filter(r => r.group === activeGroup);
    
    // Переменные для раздельного подсчета
    let lecHours = 0;
    let poHours = 0;
    let ppHours = 0;
    let totalHours = 0;

    const subjH = {};

    groupRecs.forEach(r => {
        const h = parseInt(r.hours) || 2;
        totalHours += h;
        
        // Подсчет по типам
        if (r.type === 'ПО') poHours += h;
        else if (r.type === 'ПП') ppHours += h;
        else lecHours += h; // Лекция и всё остальное

        // Подсчет по предметам
        subjH[r.subject] = (subjH[r.subject] || 0) + h;
    });

    const currentG = groups.find(g => g.name === activeGroup);
    const totalPresent = groupRecs.reduce((acc, r) => acc + (parseInt(r.studentsPresent) || 0), 0);
    const potential = groupRecs.length * (currentG?.totalStudents || 1);
    const attendance = potential > 0 ? ((totalPresent / potential) * 100).toFixed(1) : 0;
    
    return { totalHours, lecHours, poHours, ppHours, attendance, subjectHours: subjH, count: groupRecs.length };
  }, [records, activeGroup, groups]);

  // --- ФУНКЦИИ ---
  const handleTypeSelect = (type, hours) => {
    setForm(prev => ({ ...prev, type, hours }));
  };

  const applyTemplate = async () => {
    const dObj = new Date(selectedDate);
    let dow = dObj.getDay() || 7;
    const dTemps = templates.filter(t => t.dayOfWeek === dow && t.subject);
    if(!dTemps.length) return alert("Шаблон пуст");
    
    for (const t of dTemps) {
      // Шаблон создает Лекции (2 часа) по умолчанию
      await fetch('/api/schedule', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ 
          subject: t.subject, group: activeGroup, date: selectedDate, lessonNumber: t.lessonNumber, 
          studentsPresent: 0, topic: '', notes: '', type: 'Лекция', hours: 2 
        })
      });
    }
    fetchData();
  };

  const copyDay = async (target) => {
    if(!target) return;
    const dayRecs = records.filter(r => r.date === selectedDate && r.group === activeGroup);
    if(!dayRecs.length) return alert("Нет уроков");
    for (const r of dayRecs) {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ ...r, _id: undefined, group: target })
      });
    }
    alert(`Скопировано в ${target}`);
  };

  const deleteGroup = (name) => {
    if(groups.length <= 1) return alert("Нельзя удалить последнюю группу");
    if(confirm(`Удалить группу ${name}?`)) {
      const filtered = groups.filter(g => g.name !== name);
      setGroups(filtered);
      if(activeGroup === name) setActiveGroup(filtered[0].name);
    }
  };

  const exportExcel = () => {
    const data = records.filter(r => r.group === activeGroup).map(r => ({
      "Дата": r.date, "Пара": r.lessonNumber, "Тип": r.type, "Предмет": r.subject, "Тема": r.topic, "Заметки": r.notes, "Часы": r.hours, "Явка": r.studentsPresent
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Журнал");
    XLSX.writeFile(wb, `Journal_${activeGroup}.xlsx`);
  };

  const calendarDays = (() => {
    const y = viewDate.getFullYear(), m = viewDate.getMonth();
    const first = new Date(y, m, 1).getDay();
    const offset = first === 0 ? 6 : first - 1;
    const days = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) days.push(new Date(y, m, d));
    return days;
  })();

  const getTypeColor = (type) => {
    if (type === 'ПО') return 'border-l-emerald-500 shadow-emerald-900/10';
    if (type === 'ПП') return 'border-l-amber-500 shadow-amber-900/10';
    return 'border-l-indigo-500 shadow-indigo-900/10'; // Лекция
  };

  const themeClass = darkMode ? "bg-[#0f172a] text-white" : "bg-gray-50 text-slate-900";
  const cardClass = darkMode ? "bg-[#1e293b] border-slate-700 shadow-xl" : "bg-white border-gray-200 shadow-md";

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#0f172a] text-indigo-500 font-black italic text-2xl animate-pulse">EDU.LOG LOADING...</div>;

  return (
    <div className={`min-h-screen ${themeClass} font-sans pb-20 transition-all`}>
      <div className="max-w-7xl mx-auto p-3 md:p-6">
        
        {/* HEADER */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 py-4 border-b border-indigo-500/20">
          <h1 className="text-3xl font-black text-indigo-500 italic tracking-tighter">EDU.LOG <span className="text-[10px] not-italic text-slate-500">v16 Pro</span></h1>
          <nav className="flex bg-slate-800/50 p-1 rounded-xl w-full md:w-auto overflow-x-auto no-scrollbar">
            {['schedule', 'dashboard', 'settings'].map(t => (
              <button key={t} onClick={() => setCurrentTab(t)} className={`flex-1 md:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap transition-all ${currentTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>
                {t === 'schedule' ? 'План' : t === 'dashboard' ? 'Анализ' : 'Опции'}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <select value={activeGroup} onChange={e => setActiveGroup(e.target.value)} className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-xl text-xs font-bold outline-none">
              {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
            </select>
            <button onClick={() => setDarkMode(!darkMode)} className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center border border-slate-700">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </header>

        {/* --- Вкладка: АНАЛИТИКА (РАЗДЕЛЬНАЯ) --- */}
        {currentTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* КАРТОЧКИ ПО ТИПАМ ЧАСОВ */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
               <div className={`${cardClass} p-5 text-center rounded-[2rem] border-b-4 border-b-indigo-500`}>
                  <div className="text-[9px] opacity-40 uppercase font-black">Лекции</div>
                  <div className="text-2xl font-black text-indigo-400">{stats.lecHours} <span className="text-xs text-white/30">час.</span></div>
               </div>
               <div className={`${cardClass} p-5 text-center rounded-[2rem] border-b-4 border-b-emerald-500`}>
                  <div className="text-[9px] opacity-40 uppercase font-black">ПО (Практика)</div>
                  <div className="text-2xl font-black text-emerald-400">{stats.poHours} <span className="text-xs text-white/30">час.</span></div>
               </div>
               <div className={`${cardClass} p-5 text-center rounded-[2rem] border-b-4 border-b-amber-500`}>
                  <div className="text-[9px] opacity-40 uppercase font-black">ПП (Вне лицея)</div>
                  <div className="text-2xl font-black text-amber-400">{stats.ppHours} <span className="text-xs text-white/30">час.</span></div>
               </div>
               <div className={`${cardClass} p-5 text-center rounded-[2rem] opacity-70`}>
                  <div className="text-[9px] opacity-40 uppercase font-black">Итого</div>
                  <div className="text-2xl font-black text-white">{stats.totalHours} <span className="text-xs text-white/30">час.</span></div>
               </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className={`${cardClass} p-5 text-center rounded-[2rem]`}>
                    <div className="text-[9px] opacity-40 uppercase font-black">Явка %</div>
                    <div className="text-2xl font-black text-white">{stats.attendance}%</div>
                </div>
                <button onClick={exportExcel} className="col-span-1 md:col-span-2 bg-emerald-600 rounded-[2rem] font-black uppercase text-xs text-white shadow-lg flex items-center justify-center gap-2">
                    <span>Скачать Excel Журнал</span> ⬇
                </button>
            </div>

            <div className={`${cardClass} p-6 md:p-8 rounded-[3rem]`}>
              <h3 className="font-black uppercase mb-6 text-indigo-400 italic">Сводка по предметам</h3>
              <div className="grid gap-2">
                {Object.entries(stats.subjectHours).length > 0 ? Object.entries(stats.subjectHours).map(([name, hours]) => (
                  <button key={name} onClick={() => setHistorySubject(name)} className="w-full flex justify-between items-center p-4 bg-slate-900/40 rounded-2xl border border-white/5 hover:border-indigo-500/50 transition-all group">
                    <span className="font-bold text-xs uppercase text-left group-hover:text-indigo-400">{name}</span>
                    <div className="text-right">
                      <span className="font-black text-indigo-400 block">{hours} ч.</span>
                      <span className="text-[9px] opacity-20 uppercase">История →</span>
                    </div>
                  </button>
                )) : <div className="text-center py-10 opacity-20 font-black uppercase italic">Нет данных</div>}
              </div>
            </div>
          </div>
        )}

        {/* --- Вкладка: ПЛАН (SCHEDULE) --- */}
        {currentTab === 'schedule' && (
          <div className="grid lg:grid-cols-12 gap-8 animate-in slide-in-from-bottom-4 duration-500">
            {/* КАЛЕНДАРЬ */}
            <div className="lg:col-span-4">
              <div className={`${cardClass} p-6 rounded-[2.5rem]`}>
                <div className="flex justify-between items-center mb-6">
                  <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="w-8 h-8 bg-slate-700/50 rounded-lg text-xs hover:bg-indigo-600">◀</button>
                  <div className="text-center">
                    <span className="block text-lg font-black uppercase text-indigo-400 leading-none">{viewDate.toLocaleDateString('ru-RU', {month:'long'})}</span>
                    <span className="text-[10px] font-bold text-slate-500 tracking-[0.3em]">{viewDate.getFullYear()}</span>
                  </div>
                  <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="w-8 h-8 bg-slate-700/50 rounded-lg text-xs hover:bg-indigo-600">▶</button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black opacity-40 mb-3">
                  <div>ПН</div><div>ВТ</div><div>СР</div><div>ЧТ</div><div>ПТ</div><div className="text-red-500">СБ</div><div className="text-red-500">ВС</div>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={i} className="h-10"></div>;
                    const ds = day.toLocaleDateString('en-CA');
                    const isS = selectedDate === ds;
                    const has = records.some(r => r.date === ds && r.group === activeGroup);
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    
                    return (
                      <button key={ds} onClick={() => setSelectedDate(ds)} className={`h-10 rounded-xl text-xs font-bold transition-all relative border flex items-center justify-center ${isS ? 'bg-indigo-600 border-indigo-400 scale-105 shadow-lg text-white' : 'bg-slate-700/20 border-slate-700'} ${!isS && isWeekend ? 'text-red-400' : (!isS ? 'text-slate-300' : '')}`}>
                        {day.getDate()}
                        {has && <div className={`absolute bottom-1 w-1 h-1 rounded-full ${isS ? 'bg-white' : 'bg-indigo-500'}`}></div>}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* СПИСОК И ФОРМА */}
            <div className="lg:col-span-8 space-y-6">
              <div className={`${cardClass} p-6 md:p-8 rounded-[3rem] border-2 border-indigo-500/10`}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                  <h2 className="text-3xl font-black text-indigo-400 italic tracking-tighter">{selectedDate.split('-').reverse().join('.')}</h2>
                  <div className="flex w-full md:w-auto gap-2">
                    <button onClick={applyTemplate} className="flex-1 bg-amber-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-900/20 hover:scale-105 transition-transform">Магия 🪄</button>
                    <select onChange={(e) => copyDay(e.target.value)} className="flex-1 bg-slate-700 px-4 py-2 rounded-xl text-[10px] font-black uppercase outline-none" value="">
                      <option value="">Копия в...</option>
                      {groups.filter(g => g.name !== activeGroup).map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* --- 4 БОЛЬШИЕ КНОПКИ ВЫБОРА --- */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
                    <button onClick={() => handleTypeSelect('Лекция', 2)} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${form.type === 'Лекция' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-500 hover:text-white'}`}>
                        Лекция (2ч)
                    </button>
                    <button onClick={() => handleTypeSelect('ПО', 6)} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${form.type === 'ПО' && form.hours === 6 ? 'bg-emerald-600 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-500 hover:text-white'}`}>
                        ПО (6ч)
                    </button>
                    <button onClick={() => handleTypeSelect('ПО', 7)} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${form.type === 'ПО' && form.hours === 7 ? 'bg-emerald-600 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-500 hover:text-white'}`}>
                        ПО (7ч)
                    </button>
                    <button onClick={() => handleTypeSelect('ПП', 8)} className={`py-3 rounded-xl text-[10px] font-black uppercase transition-all ${form.type === 'ПП' ? 'bg-amber-600 text-white shadow-lg scale-105' : 'bg-slate-800 text-slate-500 hover:text-white'}`}>
                        ПП (8ч)
                    </button>
                </div>

                <form onSubmit={async (e) => {
                  e.preventDefault(); if(!form.subject) return;
                  
                  // LOG ДЛЯ ПРОВЕРКИ ТЕМЫ
                  console.log("Отправка:", { ...form, group: activeGroup, date: selectedDate });
                  
                  await fetch('/api/schedule', { method:'POST', headers:{'Content-Type':'application/json'}, 
                    body: JSON.stringify({...form, group:activeGroup, date:selectedDate, lessonNumber: parseInt(form.lessonNumber || 1), studentsPresent: parseInt(form.students || 0), type: form.type, hours: parseInt(form.hours) }) 
                  });
                  fetchData();
                  // Сброс формы (тема тоже чистится)
                  setForm(prev => ({...prev, subject:'', students:'', topic: '', notes: '', type: 'Лекция', hours: 2}));
                }} className="space-y-3">
                  <div className="grid grid-cols-12 gap-3">
                    <select className="col-span-12 md:col-span-6 bg-[#0f172a] p-4 rounded-2xl border border-slate-700 font-bold outline-none text-sm" value={form.subject} onChange={e => setForm({...form, subject:e.target.value})}>
                      <option value="">Выберите предмет</option>
                      {subjects.filter(s => s.targetGroup === 'all' || s.targetGroup === activeGroup).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                    <input type="number" placeholder="Пара №" className="col-span-4 md:col-span-2 bg-[#0f172a] p-4 rounded-2xl border border-slate-700 text-center font-black outline-none text-sm" value={form.lessonNumber} onChange={e => setForm({...form, lessonNumber:e.target.value})} />
                    <input type="number" placeholder="Студ." className="col-span-4 md:col-span-2 bg-[#0f172a] p-4 rounded-2xl border border-slate-700 text-center font-black outline-none text-sm" value={form.students} onChange={e => setForm({...form, students:e.target.value})} />
                    <button className="col-span-4 md:col-span-2 bg-indigo-600 rounded-2xl font-black uppercase text-xs shadow-lg active:scale-95 transition-all">OK</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Тема занятия..." className="bg-[#0f172a] p-3 rounded-xl border border-slate-700 text-xs w-full" value={form.topic} onChange={e => setForm({...form, topic: e.target.value})} />
                    <input placeholder="ДЗ / Заметки..." className="bg-[#0f172a] p-3 rounded-xl border border-slate-700 text-xs w-full" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
                  </div>
                </form>
              </div>

              <div className="grid gap-3">
                {records.filter(r => r.group === activeGroup && r.date === selectedDate).sort((a,b)=>a.lessonNumber-b.lessonNumber).map(r => (
                  <div key={r._id} className={`${cardClass} p-5 rounded-[2rem] border-l-[12px] ${getTypeColor(r.type)} flex justify-between items-start group`}>
                    <div className="flex flex-col gap-1 w-full">
                      <div className="flex items-center gap-3">
                        <div className="text-xl font-black text-slate-500 w-6">{r.lessonNumber}</div>
                        <button onClick={() => setHistorySubject(r.subject)} className="font-black text-lg uppercase tracking-tight hover:text-white text-left transition-all">{r.subject}</button>
                        
                        {/* КРАСИВЫЙ БЭЙДЖИК ТИПА */}
                        <span className={`text-[8px] font-black uppercase px-2 py-1 rounded ml-2 ${r.type === 'ПО' ? 'bg-emerald-500 text-black' : r.type === 'ПП' ? 'bg-amber-500 text-black' : 'bg-indigo-600 text-white'}`}>
                           {r.type} {r.hours}ч
                        </span>
                      </div>
                      <div className="pl-10">
                        {r.topic ? <div className="text-sm font-bold text-white mb-1">📘 {r.topic}</div> : <div className="text-[10px] text-white/20 italic mb-1">(Нет темы)</div>}
                        {r.notes && <div className="text-[10px] text-slate-400 italic">📝 {r.notes}</div>}
                        <div className="text-[9px] opacity-40 font-bold mt-2 uppercase">👥 {r.studentsPresent}/{groups.find(g=>g.name===activeGroup)?.totalStudents} чел.</div>
                      </div>
                    </div>
                    <button onClick={async () => {
                      if(confirm("Удалить?")) {
                        await fetch(`/api/schedule?id=${r._id}`, {method:'DELETE'});
                        setRecords(records.filter(x => x._id !== r._id));
                      }
                    }} className="text-red-500 font-bold px-2 md:opacity-0 group-hover:opacity-100 transition-all uppercase text-[10px] self-start mt-2">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- Вкладка: ОПЦИИ (SETTINGS) --- */}
        {currentTab === 'settings' && (
          <div className="grid lg:grid-cols-3 gap-6 animate-in slide-in-from-top-4 duration-500">
            {/* Группы */}
            <div className={`${cardClass} p-6 rounded-[2rem]`}>
              <h2 className="text-lg font-black uppercase mb-4 text-indigo-400 italic">Группы</h2>
              <div className="space-y-3 mb-4">
                <input className="w-full bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs" placeholder="Имя группы" value={newGroup.name} onChange={e => setNewGroup({...newGroup, name:e.target.value})} />
                <input type="number" className="w-full bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs" placeholder="Всего студентов" value={newGroup.total} onChange={e => setNewGroup({...newGroup, total:e.target.value})} />
                <button onClick={() => {if(newGroup.name && newGroup.total){setGroups([...groups, {name:newGroup.name, totalStudents:parseInt(newGroup.total)}]); setNewGroup({name:'', total:''});}}} className="w-full bg-indigo-600 p-3 rounded-xl font-black uppercase text-xs">Добавить</button>
              </div>
              <div className="space-y-2">
                {groups.map(g => (
                  <div key={g.name} className="flex justify-between p-3 bg-slate-900/40 rounded-xl text-xs border border-white/5 items-center">
                    <div><span className="font-bold block">{g.name}</span><span className="opacity-40 text-[10px]">{g.totalStudents} чел.</span></div>
                    <button onClick={() => deleteGroup(g.name)} className="text-red-500 hover:bg-red-500/20 p-2 rounded-lg transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Библиотека */}
            <div className={`${cardClass} p-6 rounded-[2rem]`}>
              <h2 className="text-lg font-black uppercase mb-4 text-emerald-400 italic">Библиотека</h2>
              <div className="space-y-3 mb-4">
                <input className="w-full bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs" placeholder="Предмет" value={newSubj.name} onChange={e => setNewSubj({...newSubj, name:e.target.value})} />
                <select className="w-full bg-[#0f172a] border border-slate-700 p-3 rounded-xl text-xs" value={newSubj.target} onChange={e => setNewSubj({...newSubj, target:e.target.value})}>
                  <option value="all">Для всех</option>
                  {groups.map(g => <option key={g.name} value={g.name}>{g.name}</option>)}
                </select>
                <button onClick={() => {if(newSubj.name){setSubjects([...subjects, {name:newSubj.name, targetGroup:newSubj.target}]); setNewSubj({name:'', target:'all'});}}} className="w-full bg-emerald-600 p-3 rounded-xl font-black uppercase text-xs">В библиотеку</button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-2 pr-1">
                {subjects.map((s, i) => (<div key={i} className="flex justify-between p-2 bg-slate-900/40 rounded-lg text-[10px]"><span>{s.name} <span className="opacity-20">({s.targetGroup})</span></span><button onClick={() => setSubjects(subjects.filter((_, idx) => idx !== i))} className="text-red-500">✕</button></div>))}
              </div>
            </div>

            {/* План */}
            <div className={`${cardClass} p-6 rounded-[2rem]`}>
              <h2 className="text-lg font-black uppercase mb-4 text-amber-500 italic">План (4 пары)</h2>
              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                {[1,2,3,4,5,6].map(d => (
                  <div key={d} className="p-3 bg-slate-900/40 rounded-2xl border border-white/5 mb-2">
                    <div className="text-[10px] font-black opacity-40 mb-2 uppercase tracking-widest">{['','ПН','ВТ','СР','ЧТ','ПТ','СБ'][d]}</div>
                    <div className="grid grid-cols-2 gap-2">
                      {[1,2,3,4].map(l => {
                        const t = templates.find(x => x.dayOfWeek === d && x.lessonNumber === l);
                        return (
                          <select key={l} className="bg-slate-800 p-1 rounded border border-slate-700 text-[9px]" value={t?.subject || ""} onChange={(e) => {
                            fetch('/api/templates', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ group: activeGroup, dayOfWeek: d, lessonNumber: l, subject: e.target.value }) }).then(() => fetchData());
                          }}>
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

        {/* --- МОДАЛКА: ИСТОРИЯ --- */}
        {historySubject && (
          <div className="fixed inset-0 bg-[#0f172a]/95 backdrop-blur-md flex items-end md:items-center justify-center z-[100] p-0 md:p-4 animate-in fade-in duration-300">
            <div className="bg-[#1e293b] w-full max-w-2xl rounded-t-[2.5rem] md:rounded-[3rem] border border-indigo-500/30 overflow-hidden shadow-2xl">
              <div className="p-6 md:p-8 border-b border-slate-700 flex justify-between items-center bg-indigo-600/10">
                <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tighter text-indigo-400">{historySubject}</h2>
                <button onClick={() => setHistorySubject(null)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center font-black">✕</button>
              </div>
              <div className="p-4 md:p-8 max-h-[60vh] overflow-y-auto space-y-3">
                {records.filter(r => r.subject === historySubject && r.group === activeGroup)
                  .sort((a,b) => b.date.localeCompare(a.date))
                  .map((r, i) => {
                    const group = groups.find(g => g.name === activeGroup);
                    const att = group ? ((r.studentsPresent / group.totalStudents) * 100).toFixed(0) : 0;
                    return (
                      <div key={i} className={`flex flex-col gap-2 p-4 bg-slate-900/50 rounded-2xl border-l-[6px] border-white/5 ${getTypeColor(r.type)}`}>
                        <div className="flex justify-between items-center">
                            <div className="flex gap-2 items-center">
                                <span className="font-black text-white text-sm">{r.date.split('-').reverse().join('.')}</span>
                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ml-1 ${r.type === 'ПО' ? 'bg-emerald-500 text-black' : r.type === 'ПП' ? 'bg-amber-500 text-black' : 'bg-indigo-600 text-white'}`}>
                                   {r.type} {r.hours}ч
                                </span>
                            </div>
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${att > 80 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>Явка: {att}%</span>
                        </div>
                        <div className="pl-2 border-l-2 border-slate-700">
                            {r.topic ? <div className="text-sm font-bold text-white">📘 {r.topic}</div> : <div className="text-[10px] text-white/20 italic">(Нет темы)</div>}
                            {r.notes && <div className="text-[10px] text-slate-400 italic mt-1">📝 {r.notes}</div>}
                        </div>
                      </div>
                    )
                  })}
              </div>
              <div className="p-6 bg-slate-900/50 text-center">
                <button onClick={() => setHistorySubject(null)} className="w-full bg-slate-800 p-4 rounded-2xl font-black uppercase text-xs">Закрыть</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;