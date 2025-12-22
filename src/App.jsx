import React, { useState, useEffect } from 'react';

function App() {
  // --- СОСТОЯНИЯ ДАННЫХ ---
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('subjects')) || []);
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('groups')) || ["Группа 1"]);
  const [records, setRecords] = useState([]); // Загружаем из MongoDB
  const [activeGroup, setActiveGroup] = useState(groups[0]);
  
  // --- СОСТОЯНИЯ ИНТЕРФЕЙСА ---
  const [darkMode, setDarkMode] = useState(true);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterSubject, setFilterSubject] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- ФОРМЫ ---
  const [newSubject, setNewSubject] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [form, setForm] = useState({ subject: '', lessonNumber: '' });

  const todayStr = new Date().toISOString().split('T')[0];

  // --- ЗАГРУЗКА ИЗ MONGODB ---
  useEffect(() => {
    async function loadRecords() {
      setLoading(true);
      try {
        const res = await fetch('/api/schedule');
        const data = await res.json();
        if (Array.isArray(data)) {
          setRecords(sortRecords(data));
        }
      } catch (err) {
        console.error("Ошибка подключения к API:", err);
      }
      setLoading(false);
    }
    loadRecords();
  }, []);

  // Сохранение справочников в LocalStorage (для скорости)
  useEffect(() => {
    localStorage.setItem('subjects', JSON.stringify(subjects));
    localStorage.setItem('groups', JSON.stringify(groups));
  }, [subjects, groups]);

  // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
  const sortRecords = (data) => {
    return [...data].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.lessonNumber - b.lessonNumber;
    });
  };

  const exportToCSV = () => {
    const groupRecords = sortRecords(records.filter(r => r.group === activeGroup));
    let csvContent = "\uFEFFДата;Пара;Предмет;Группа\n";
    groupRecords.forEach(r => {
      csvContent += `${r.date};${r.lessonNumber};${r.subject};${r.group}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Отчет_${activeGroup}.csv`;
    link.click();
  };

  const addRecord = async (e) => {
    e.preventDefault();
    if (!form.subject) return;

    let finalNum = form.lessonNumber;
    if (!finalNum) {
      const dayLessons = records.filter(r => r.date === selectedDate && r.group === activeGroup);
      finalNum = dayLessons.length + 1;
    }

    const newEntry = {
      subject: form.subject,
      group: activeGroup,
      date: selectedDate,
      lessonNumber: parseInt(finalNum)
    };

    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEntry)
    });
    
    const saved = await res.json();
    setRecords(sortRecords([...records, saved]));
    setForm({ ...form, lessonNumber: '' });
  };

  const deleteRecord = async (mongoId) => {
    await fetch(`/api/schedule?id=${mongoId}`, { method: 'DELETE' });
    setRecords(records.filter(r => r._id !== mongoId));
  };

  const calendarDays = (() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const offset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  })();

  const getStats = () => {
    const stats = {};
    records.filter(r => r.group === activeGroup).forEach(r => {
      stats[r.subject] = (stats[r.subject] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  };

  // --- СТИЛИ ---
  const themeClass = darkMode ? "bg-slate-900 text-white" : "bg-gray-50 text-slate-900";
  const cardClass = darkMode ? "bg-slate-800 border-slate-700 shadow-xl" : "bg-white border-gray-200 shadow-md";

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-indigo-500 font-black animate-pulse uppercase tracking-[0.3em]">Подключение к MongoDB...</div>;

  return (
    <div className={`min-h-screen transition-all duration-300 ${themeClass} font-sans pb-10`}>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* HEADER С ГРУППАМИ */}
        <header className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-black text-indigo-500 tracking-tighter">EDU.LOG</h1>
            <nav className="flex bg-slate-800 p-1 rounded-xl border border-slate-700">
              {groups.map(g => (
                <button key={g} onClick={() => {setActiveGroup(g); setFilterSubject(null);}} className={`px-5 py-2 rounded-lg font-bold text-xs transition-all ${activeGroup === g ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{g}</button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={exportToCSV} className="bg-emerald-600 hover:bg-emerald-700 text-[11px] font-black px-5 py-2.5 rounded-xl uppercase transition-all">📥 CSV</button>
            <button onClick={() => setDarkMode(!darkMode)} className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </header>

        <div className="grid lg:grid-cols-12 gap-8">
          
          {/* КАЛЕНДАРЬ И СТАТИСТИКА */}
          <div className="lg:col-span-4 space-y-6">
            <div className={`p-6 rounded-[2.5rem] border ${cardClass}`}>
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2">
                  <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center">❮</button>
                  <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center">❯</button>
                </div>
                <select value={viewDate.getMonth()} onChange={(e) => setViewDate(new Date(viewDate.setMonth(e.target.value)))} className="bg-transparent font-black uppercase text-xs outline-none text-indigo-400">
                  {["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"].map((m, i) => <option key={m} value={i} className="text-black">{m}</option>)}
                </select>
                <button onClick={() => {setViewDate(new Date()); setSelectedDate(todayStr);}} className="text-[10px] bg-indigo-500/20 px-2 py-1 rounded text-indigo-400 font-bold">СЕГОДНЯ</button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black opacity-20 mb-4">
                <div>ПН</div><div>ВТ</div><div>СР</div><div>ЧТ</div><div>ПТ</div><div>СБ</div><div>ВС</div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {calendarDays.map((day, i) => {
                  if (!day) return <div key={i} className="h-10"></div>;
                  const dStr = day.toISOString().split('T')[0];
                  const hasLessons = records.some(r => r.date === dStr && r.group === activeGroup);
                  const isSelected = selectedDate === dStr;
                  return (
                    <button key={dStr} onClick={() => {setSelectedDate(dStr); setFilterSubject(null);}} className={`h-10 rounded-xl text-xs font-bold transition-all relative border ${isSelected ? 'bg-indigo-600 border-indigo-400 shadow-lg scale-110 z-10' : dStr === todayStr ? 'border-indigo-500 text-indigo-400 border-2' : 'bg-slate-700/20 border-slate-700'}`}>
                      {day.getDate()}
                      {hasLessons && !isSelected && <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full"></div>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`p-6 rounded-[2.5rem] border ${cardClass}`}>
              <h3 className="text-xs font-black opacity-40 uppercase mb-5 tracking-[0.2em]">📊 Статистика</h3>
              <div className="grid gap-2">
                {getStats().map(([sub, count]) => (
                  <button key={sub} onClick={() => setFilterSubject(sub === filterSubject ? null : sub)} className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${filterSubject === sub ? 'bg-indigo-600 border-indigo-400 shadow-lg' : 'bg-slate-900/40 border-slate-700/50 hover:bg-slate-700/50'}`}>
                    <span className="text-[11px] font-bold uppercase">{sub}</span>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${filterSubject === sub ? 'bg-white text-indigo-600' : 'bg-indigo-600 text-white'}`}>{count}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ОСНОВНОЙ КОНТЕНТ */}
          <div className="lg:col-span-8 space-y-6">
            
            <div className={`p-8 rounded-[3rem] border-2 border-indigo-500/20 ${cardClass}`}>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-black text-indigo-400 uppercase italic">
                  {new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })}
                </h2>
                <div className="flex gap-2">
                  <input value={newGroup} onChange={e => setNewGroup(e.target.value)} className="bg-slate-900 text-[10px] px-3 py-2 rounded-xl border border-slate-700 w-24 text-white" placeholder="+ Группа" />
                  <button onClick={() => {if(newGroup){setGroups([...groups, newGroup]); setNewGroup('');}}} className="bg-indigo-600 w-10 rounded-xl font-bold">+</button>
                </div>
              </div>

              <form onSubmit={addRecord} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 space-y-3">
                   <div className="flex gap-2">
                      <input value={newSubject} onChange={e => setNewSubject(e.target.value)} className="flex-1 bg-slate-900 p-2.5 rounded-xl text-xs border border-slate-700 text-white" placeholder="Новый предмет в базу..." />
                      <button type="button" onClick={() => {if(newSubject){setSubjects([...subjects, newSubject]); setNewSubject('');}}} className="bg-slate-700 px-4 rounded-xl font-bold">+</button>
                   </div>
                   <select className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 outline-none font-bold text-sm text-white focus:border-indigo-500" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                      <option value="">Выберите предмет</option>
                      {subjects.sort().map(s => <option key={s} value={s}>{s}</option>)}
                   </select>
                </div>
                <div className="md:col-span-2">
                   <input type="number" className="w-full p-4 h-full rounded-2xl bg-slate-900 border border-slate-700 outline-none text-center font-black text-white" placeholder="Пара" value={form.lessonNumber} onChange={e => setForm({...form, lessonNumber: e.target.value})} />
                </div>
                <button className="md:col-span-3 bg-indigo-600 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-500 active:scale-95 transition-all text-white">Записать</button>
              </form>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-end px-4">
                 <h3 className="font-black text-2xl uppercase tracking-tighter">
                   {filterSubject ? `История: ${filterSubject}` : `Занятия на день`}
                 </h3>
                 {filterSubject && <button onClick={() => setFilterSubject(null)} className="text-[10px] bg-red-500/10 text-red-500 px-4 py-2 rounded-xl font-black border border-red-500/20 uppercase">Сбросить</button>}
              </div>

              <div className="grid gap-4">
                {records.filter(r => r.group === activeGroup && (filterSubject ? r.subject === filterSubject : r.date === selectedDate))
                  .map(r => (
                    <div key={r._id} className={`p-5 rounded-[2rem] border flex justify-between items-center group transition-all ${cardClass} border-l-[12px] border-l-indigo-600 hover:translate-x-2`}>
                      <div className="flex items-center gap-6">
                        <div className="text-center min-w-[40px]">
                          <span className="text-[10px] font-black opacity-30 uppercase block">Пара</span>
                          <div className="text-2xl font-black text-indigo-400">{r.lessonNumber}</div>
                        </div>
                        <div className="h-10 w-[1px] bg-slate-700"></div>
                        <div>
                          <button onClick={() => setFilterSubject(r.subject)} className="font-black text-xl uppercase tracking-tight hover:text-indigo-400 transition block text-left">
                            {r.subject}
                          </button>
                          <div className="bg-slate-700/50 text-[10px] px-3 py-1 rounded-full font-bold text-slate-400 border border-slate-600/50 mt-1 inline-block">
                             📅 {new Date(r.date).toLocaleDateString('ru-RU')}
                          </div>
                        </div>
                      </div>
                      <button onClick={() => deleteRecord(r._id)} className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white">✕</button>
                    </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default App;