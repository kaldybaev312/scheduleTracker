import React, { useState, useEffect } from 'react';

function App() {
  // --- СОСТОЯНИЯ ---
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('groups')) || ["Группа 1"]);
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('subjects_v2')) || []);
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

  // Синхронизация с LocalStorage (для настроек)
  useEffect(() => {
    localStorage.setItem('groups', JSON.stringify(groups));
    localStorage.setItem('subjects_v2', JSON.stringify(subjects));
  }, [groups, subjects]);

  // Загрузка данных из MongoDB
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
    } catch (err) { console.error("Ошибка загрузки данных:", err); }
    setLoading(false);
  }

  // --- ФУНКЦИЯ КОПИРОВАНИЯ МЕЖДУ ГРУППАМИ ---
  const copyToGroup = async (targetGroupName) => {
    if (!targetGroupName) return;

    // Берем все уроки текущего дня для активной группы
    const currentDayRecords = records.filter(r => r.date === selectedDate && r.group === activeGroup);
    
    if (currentDayRecords.length === 0) {
      alert("В этом дне нет уроков для копирования!");
      return;
    }

    if (!window.confirm(`Скопировать ${currentDayRecords.length} уроков в группу ${targetGroupName}?`)) return;

    setLoading(true);
    try {
      // Отправляем запросы на создание записей для целевой группы
      const copyPromises = currentDayRecords.map(r => 
        fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: r.subject,
            group: targetGroupName,
            date: selectedDate,
            lessonNumber: r.lessonNumber
          })
        })
      );

      await Promise.all(copyPromises);
      alert(`Расписание успешно продублировано в ${targetGroupName}`);
      fetchData(); // Обновляем список, чтобы увидеть изменения
    } catch (err) {
      alert("Ошибка при копировании данных");
    }
    setLoading(false);
  };

  // --- УПРАВЛЕНИЕ ГРУППАМИ И ПРЕДМЕТАМИ ---
  const addGroup = () => {
    if (newGroupName && !groups.includes(newGroupName)) {
      setGroups([...groups, newGroupName]);
      setNewGroupName('');
    }
  };

  const removeGroup = (name) => {
    if (groups.length <= 1) return alert("Нельзя удалить последнюю группу");
    if (window.confirm(`Удалить группу ${name}? Данные в базе останутся, но не будут отображаться здесь.`)) {
      setGroups(groups.filter(g => g !== name));
      if (activeGroup === name) setActiveGroup(groups[0]);
    }
  };

  const addSubject = () => {
    if (newSubjName) {
      setSubjects([...subjects, { name: newSubjName, targetGroup: subjTargetGroup }]);
      setNewSubjName('');
    }
  };

  const removeSubject = (index) => {
    setSubjects(subjects.filter((_, i) => i !== index));
  };

  const filteredSubjects = subjects.filter(s => s.targetGroup === 'all' || s.targetGroup === activeGroup);

  const formatDateDisplay = (dateStr) => {
    const [y, m, d] = dateStr.split('-');
    return `${d}.${m}.${y}`;
  };

  // --- РЕНДЕР КАЛЕНДАРЯ ---
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

  const themeClass = darkMode ? "bg-slate-900 text-white" : "bg-gray-50 text-slate-900";
  const cardClass = darkMode ? "bg-slate-800 border-slate-700 shadow-xl" : "bg-white border-gray-200 shadow-md";

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-indigo-500 font-black animate-pulse">ОБРАБОТКА...</div>;

  return (
    <div className={`min-h-screen transition-all ${themeClass} font-sans pb-10`}>
      <div className="max-w-7xl mx-auto p-4">
        
        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-black text-indigo-500 italic tracking-tighter">EDU.LOG</h1>
            <nav className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 overflow-x-auto">
              {groups.map(g => (
                <button key={g} onClick={() => setActiveGroup(g)} className={`px-4 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeGroup === g ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>{g}</button>
              ))}
            </nav>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowSettings(!showSettings)} className="px-4 py-2 bg-slate-700 hover:bg-indigo-600 rounded-xl font-black text-[10px] uppercase transition-all">
              {showSettings ? 'назад' : '⚙️ Настройки'}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="w-10 h-10 bg-slate-800 rounded-xl border border-slate-700 text-center flex items-center justify-center">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </header>

        {showSettings ? (
          /* НАСТРОЙКИ */
          <div className="grid md:grid-cols-2 gap-8 animate-in fade-in duration-300">
            <div className={`p-8 rounded-[2rem] border ${cardClass}`}>
              <h2 className="text-xl font-black uppercase mb-4 text-indigo-400">Управление группами</h2>
              <div className="flex gap-2 mb-6">
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Имя группы" className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-xl outline-none text-white" />
                <button onClick={addGroup} className="bg-indigo-600 px-6 rounded-xl font-black shadow-lg hover:bg-indigo-500">+</button>
              </div>
              <div className="space-y-2">
                {groups.map(g => (
                  <div key={g} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                    <span className="font-bold">{g}</span>
                    <button onClick={() => removeGroup(g)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all">✕</button>
                  </div>
                ))}
              </div>
            </div>

            <div className={`p-8 rounded-[2rem] border ${cardClass}`}>
              <h2 className="text-xl font-black uppercase mb-4 text-emerald-400">Библиотека предметов</h2>
              <div className="space-y-3 mb-6">
                <input value={newSubjName} onChange={e => setNewSubjName(e.target.value)} placeholder="Название предмета" className="w-full bg-slate-900 border border-slate-700 p-3 rounded-xl outline-none text-white" />
                <div className="flex gap-2">
                  <select value={subjTargetGroup} onChange={e => setSubjTargetGroup(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 p-3 rounded-xl outline-none text-xs text-white">
                    <option value="all">Для всех (Общий)</option>
                    {groups.map(g => <option key={g} value={g}>Только для {g}</option>)}
                  </select>
                  <button onClick={addSubject} className="bg-emerald-600 px-6 rounded-xl font-black shadow-lg hover:bg-emerald-500">+</button>
                </div>
              </div>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {subjects.map((s, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-xl border border-slate-700">
                    <div>
                      <span className="font-bold uppercase block text-[11px]">{s.name}</span>
                      <span className="text-[9px] opacity-40 uppercase font-black">{s.targetGroup === 'all' ? 'Общий доступ' : `Для группы: ${s.targetGroup}`}</span>
                    </div>
                    <button onClick={() => removeSubject(i)} className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-all">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* ОСНОВНОЙ ЭКРАН */
          <div className="grid lg:grid-cols-12 gap-8">
             <div className="lg:col-span-4 space-y-6">
                <div className={`p-6 rounded-[2.5rem] border ${cardClass}`}>
                    <div className="flex justify-between items-center mb-6 px-2">
                      <div className="flex gap-2">
                        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center text-white">❮</button>
                        <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center text-white">❯</button>
                      </div>
                      <span className="font-black uppercase text-[10px] text-indigo-400">
                        {viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {calendarDays.map((day, i) => {
                        if (!day) return <div key={i} className="h-10"></div>;
                        const y = day.getFullYear(); const m = String(day.getMonth() + 1).padStart(2, '0'); const d = String(day.getDate()).padStart(2, '0');
                        const dStr = `${y}-${m}-${d}`;
                        const isSelected = selectedDate === dStr;
                        const hasLessons = records.some(r => r.date === dStr && r.group === activeGroup);
                        return (
                          <button key={dStr} onClick={() => setSelectedDate(dStr)} className={`h-10 rounded-xl text-xs font-bold transition-all border relative ${isSelected ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-110 z-10' : 'bg-slate-700/20 border-slate-700 hover:border-slate-500'}`}>
                            {day.getDate()}
                            {hasLessons && !isSelected && <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-500 rounded-full"></div>}
                          </button>
                        );
                      })}
                    </div>
                </div>
             </div>

             <div className="lg:col-span-8 space-y-6">
                <div className={`p-8 rounded-[3rem] border-2 border-indigo-500/20 ${cardClass}`}>
                   <div className="flex justify-between items-center mb-6">
                      <h2 className="text-3xl font-black text-indigo-400 tracking-tighter">{formatDateDisplay(selectedDate)}</h2>
                      
                      {/* УМНОЕ КОПИРОВАНИЕ */}
                      <div className="flex gap-2 items-center">
                        <select 
                          className="bg-slate-700 text-[10px] font-black px-3 py-2 rounded-xl outline-none text-white border border-slate-600"
                          value=""
                          onChange={(e) => copyToGroup(e.target.value)}
                        >
                          <option value="" disabled>КОПИРОВАТЬ ДЕНЬ В...</option>
                          {groups.filter(g => g !== activeGroup).map(g => (
                            <option key={g} value={g}>{g}</option>
                          ))}
                        </select>
                      </div>
                   </div>

                   <form onSubmit={async (e) => {
                     e.preventDefault();
                     if (!form.subject) return;
                     const res = await fetch('/api/schedule', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ subject: form.subject, group: activeGroup, date: selectedDate, lessonNumber: parseInt(form.lessonNumber || 1) })
                     });
                     const saved = await res.json();
                     setRecords([...records, saved]);
                     setForm({...form, lessonNumber: ''});
                   }} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-7">
                        <select className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 font-bold text-white outline-none focus:border-indigo-500 transition-all" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                          <option value="">Выберите предмет</option>
                          {filteredSubjects.map((s, idx) => <option key={idx} value={s.name}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <input type="number" placeholder="Пара" className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 text-center font-black text-white outline-none focus:border-indigo-500 transition-all" value={form.lessonNumber} onChange={e => setForm({...form, lessonNumber: e.target.value})} />
                      </div>
                      <button type="submit" className="md:col-span-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-black uppercase text-white shadow-xl transition-all active:scale-95">Записать</button>
                   </form>
                </div>

                <div className="space-y-4">
                  <h3 className="font-black text-xl uppercase px-4 opacity-50">Занятия группы {activeGroup}</h3>
                  <div className="grid gap-3">
                    {records.filter(r => r.group === activeGroup && r.date === selectedDate).map(r => (
                      <div key={r._id} className={`p-5 rounded-[2rem] border flex justify-between items-center ${cardClass} border-l-[12px] border-l-indigo-600 animate-in slide-in-from-left duration-300`}>
                         <div className="flex items-center gap-6">
                           <div className="text-center min-w-[40px]">
                              <span className="text-[9px] font-black opacity-30 block">ПАРА</span>
                              <div className="text-2xl font-black text-indigo-400">{r.lessonNumber}</div>
                           </div>
                           <div className="h-8 w-[1px] bg-slate-700"></div>
                           <div className="font-black text-lg uppercase tracking-tight">{r.subject}</div>
                         </div>
                         <button onClick={async () => {
                           if(!window.confirm("Удалить урок?")) return;
                           await fetch(`/api/schedule?id=${r._id}`, { method: 'DELETE' });
                           setRecords(records.filter(x => x._id !== r._id));
                         }} className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all">✕</button>
                      </div>
                    ))}
                    {records.filter(r => r.group === activeGroup && r.date === selectedDate).length === 0 && (
                       <div className="text-center py-10 opacity-10 font-black uppercase tracking-widest italic border-4 border-dashed border-slate-700 rounded-[3rem]">План пуст</div>
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;