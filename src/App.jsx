import React, { useState, useEffect } from 'react';

function App() {
  // --- СОСТОЯНИЯ ---
  const [subjects, setSubjects] = useState(() => JSON.parse(localStorage.getItem('subjects')) || []);
  const [groups, setGroups] = useState(() => JSON.parse(localStorage.getItem('groups')) || ["Группа 1"]);
  const [records, setRecords] = useState([]);
  const [templates, setTemplates] = useState([]); // Шаблоны из БД
  
  const [activeGroup, setActiveGroup] = useState(groups[0]);
  const [darkMode, setDarkMode] = useState(true);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterSubject, setFilterSubject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);

  const [form, setForm] = useState({ subject: '', lessonNumber: '' });
  const [newSubject, setNewSubject] = useState('');
  const [newGroup, setNewGroup] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // --- ЗАГРУЗКА ДАННЫХ ---
  useEffect(() => {
    fetchData();
  }, [activeGroup]);

  async function fetchData() {
    setLoading(true);
    try {
      const [recRes, tempRes] = await Promise.all([
        fetch('/api/schedule'),
        fetch(`/api/templates?group=${activeGroup}`)
      ]);
      const recData = await recRes.json();
      const tempData = await tempRes.json();
      
      if (Array.isArray(recData)) setRecords(sortRecords(recData));
      if (Array.isArray(tempData)) setTemplates(tempData);
    } catch (err) {
      console.error("Ошибка загрузки:", err);
    }
    setLoading(false);
  }

  // --- ЛОГИКА ШАБЛОНОВ ---
  const saveTemplate = async (dayOfWeek, lessonNumber, subject) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group: activeGroup, dayOfWeek, lessonNumber, subject })
    });
    const updated = await res.json();
    setTemplates(prev => {
      const filtered = prev.filter(t => !(t.dayOfWeek === dayOfWeek && t.lessonNumber === lessonNumber));
      return [...filtered, updated];
    });
  };

  const applyTemplate = async () => {
    const dateObj = new Date(selectedDate);
    let dayOfWeek = dateObj.getDay(); 
    if (dayOfWeek === 0) dayOfWeek = 7; // Вс = 7

    const dayTemplates = templates.filter(t => t.dayOfWeek === dayOfWeek);
    
    if (dayTemplates.length === 0) {
      alert("Для этого дня недели (Пн-Вс) шаблоны не настроены!");
      return;
    }

    if (!window.confirm(`Добавить ${dayTemplates.length} уроков из шаблона?`)) return;

    for (const t of dayTemplates) {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: t.subject,
          group: activeGroup,
          date: selectedDate,
          lessonNumber: t.lessonNumber
        })
      });
    }
    fetchData(); // Перезагружаем список
  };

  // --- ОБЩИЕ ФУНКЦИИ ---
  const sortRecords = (data) => [...data].sort((a, b) => a.date.localeCompare(b.date) || a.lessonNumber - b.lessonNumber);

  const addRecord = async (e) => {
    e.preventDefault();
    if (!form.subject) return;
    const finalNum = form.lessonNumber || (records.filter(r => r.date === selectedDate && r.group === activeGroup).length + 1);
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: form.subject, group: activeGroup, date: selectedDate, lessonNumber: parseInt(finalNum) })
    });
    const saved = await res.json();
    setRecords(sortRecords([...records, saved]));
    setForm({ ...form, lessonNumber: '' });
  };

  const deleteRecord = async (id) => {
    await fetch(`/api/schedule?id=${id}`, { method: 'DELETE' });
    setRecords(records.filter(r => r._id !== id));
  };

  const calendarDays = (() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const offset = new Date(year, month, 1).getDay() === 0 ? 6 : new Date(year, month, 1).getDay() - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
    return days;
  })();

  const themeClass = darkMode ? "bg-slate-900 text-white" : "bg-gray-50 text-slate-900";
  const cardClass = darkMode ? "bg-slate-800 border-slate-700 shadow-xl" : "bg-white border-gray-200 shadow-md";

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-900 text-indigo-500 font-black animate-pulse uppercase tracking-[0.3em]">Синхронизация...</div>;

  return (
    <div className={`min-h-screen transition-all ${themeClass} font-sans pb-20`}>
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        
        {/* HEADER */}
        <header className="flex flex-wrap justify-between items-center mb-8 gap-4 border-b border-slate-700 pb-6">
          <div className="flex items-center gap-6">
            <h1 className="text-3xl font-black text-indigo-500 tracking-tighter">EDU.LOG</h1>
            <nav className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 overflow-x-auto">
              {groups.map(g => (
                <button key={g} onClick={() => setActiveGroup(g)} className={`px-5 py-2 rounded-lg font-bold text-xs transition-all whitespace-nowrap ${activeGroup === g ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{g}</button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowTemplateEditor(!showTemplateEditor)} className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase transition-all ${showTemplateEditor ? 'bg-indigo-600' : 'bg-slate-700'}`}>
              {showTemplateEditor ? 'Закрыть редактор' : '⚙️ Настроить шаблоны'}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className="w-10 h-10 flex items-center justify-center bg-slate-800 rounded-xl border border-slate-700">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </header>

        {showTemplateEditor ? (
          /* РЕДАКТОР ШАБЛОНОВ */
          <div className={`p-8 rounded-[3rem] border-2 border-amber-500/30 mb-10 ${cardClass}`}>
            <h2 className="text-2xl font-black text-amber-500 uppercase mb-6 flex items-center gap-2">🛠 Редактор шаблонов для {activeGroup}</h2>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              {[1,2,3,4,5,6,7].map(dayNum => (
                <div key={dayNum} className="space-y-3">
                  <div className="text-[10px] font-black opacity-50 uppercase text-center border-b border-slate-700 pb-2">
                    {["","Пн","Вт","Ср","Чт","Пт","Сб","Вс"][dayNum]}
                  </div>
                  {[1,2,3,4].map(lessonNum => {
                    const temp = templates.find(t => t.dayOfWeek === dayNum && t.lessonNumber === lessonNum);
                    return (
                      <select 
                        key={lessonNum}
                        value={temp?.subject || ""}
                        onChange={(e) => saveTemplate(dayNum, lessonNum, e.target.value)}
                        className="w-full p-2 rounded-lg bg-slate-900 border border-slate-700 text-[10px] outline-none focus:border-amber-500"
                      >
                        <option value="">- Пара {lessonNum} -</option>
                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="mt-6 text-[10px] opacity-40 italic text-center text-amber-500">Изменения сохраняются автоматически в реальном времени</p>
          </div>
        ) : (
          /* ОСНОВНОЙ ЭКРАН */
          <div className="grid lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              {/* КАЛЕНДАРЬ */}
              <div className={`p-6 rounded-[2.5rem] border ${cardClass}`}>
                <div className="flex justify-between items-center mb-6 px-2">
                  <div className="flex gap-2">
                    <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() - 1)))} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center hover:bg-indigo-600 transition text-white">❮</button>
                    <button onClick={() => setViewDate(new Date(viewDate.setMonth(viewDate.getMonth() + 1)))} className="w-8 h-8 flex bg-slate-700 rounded-lg justify-center items-center hover:bg-indigo-600 transition text-white">❯</button>
                  </div>
                  <select value={viewDate.getMonth()} onChange={(e) => setViewDate(new Date(viewDate.setMonth(e.target.value)))} className="bg-transparent font-black uppercase text-[10px] outline-none text-indigo-400 cursor-pointer">
                    {["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"].map((m, i) => <option key={m} value={i} className="text-black">{m}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black opacity-20 mb-4 tracking-tighter">
                  <div>ПН</div><div>ВТ</div><div>СР</div><div>ЧТ</div><div>ПТ</div><div className="text-orange-500">СБ</div><div className="text-red-500">ВС</div>
                </div>
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((day, i) => {
                    if (!day) return <div key={i} className="h-10"></div>;
                    const dStr = day.toISOString().split('T')[0];
                    const hasLessons = records.some(r => r.date === dStr && r.group === activeGroup);
                    const isSelected = selectedDate === dStr;
                    return (
                      <button key={dStr} onClick={() => {setSelectedDate(dStr); setFilterSubject(null);}} className={`h-10 rounded-xl text-xs font-bold transition-all border ${isSelected ? 'bg-indigo-600 border-indigo-400 shadow-lg scale-110 z-10 text-white' : dStr === todayStr ? 'border-indigo-500 text-indigo-400 border-2' : 'bg-slate-700/20 border-slate-700 hover:border-slate-500'}`}>
                        {day.getDate()}
                        {hasLessons && !isSelected && <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 bg-indigo-400 rounded-full"></div>}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* СТАТИСТИКА */}
              <div className={`p-6 rounded-[2rem] border ${cardClass}`}>
                <h3 className="text-xs font-black opacity-40 uppercase mb-5 tracking-[0.2em]">📊 Статистика</h3>
                <div className="grid gap-2 max-h-60 overflow-y-auto">
                  {Object.entries(records.filter(r => r.group === activeGroup).reduce((acc, r) => {acc[r.subject] = (acc[r.subject] || 0) + 1; return acc;}, {})).sort((a,b)=>b[1]-a[1]).map(([sub, count]) => (
                    <button key={sub} onClick={() => setFilterSubject(sub === filterSubject ? null : sub)} className={`flex justify-between items-center p-3 rounded-2xl border transition-all ${filterSubject === sub ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-900/40 border-slate-700/50 hover:bg-slate-700/50'}`}>
                      <span className="text-[10px] font-bold uppercase">{sub}</span>
                      <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-1 rounded-lg">{count}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              {/* ФОРМА ВВОДА */}
              <div className={`p-8 rounded-[3rem] border-2 border-indigo-500/20 ${cardClass}`}>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-indigo-400 uppercase italic">
                    {new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })}
                  </h2>
                  <button onClick={applyTemplate} className="bg-amber-500 hover:bg-amber-600 text-[10px] font-black px-4 py-2 rounded-xl uppercase transition-all flex items-center gap-2 text-white">🪄 Магия шаблона</button>
                </div>

                <form onSubmit={addRecord} className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-7 space-y-3">
                    <div className="flex gap-2">
                      <input value={newSubject} onChange={e => setNewSubject(e.target.value)} className="flex-1 bg-slate-900 p-2.5 rounded-xl text-xs border border-slate-700 text-white outline-none focus:border-indigo-500" placeholder="Новый предмет..." />
                      <button type="button" onClick={() => {if(newSubject){setSubjects([...subjects, newSubject]); setNewSubject('');}}} className="bg-slate-700 px-4 rounded-xl font-bold hover:bg-indigo-600">+</button>
                    </div>
                    <select className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-700 outline-none font-bold text-sm text-white" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})}>
                      <option value="">Выберите предмет</option>
                      {subjects.sort().map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <input type="number" className="w-full p-4 h-full rounded-2xl bg-slate-900 border border-slate-700 text-center font-black text-white outline-none" placeholder="Пара" value={form.lessonNumber} onChange={e => setForm({...form, lessonNumber: e.target.value})} />
                  </div>
                  <button type="submit" className="md:col-span-3 bg-indigo-600 rounded-2xl font-black uppercase tracking-widest shadow-xl hover:bg-indigo-500 active:scale-95 transition-all text-white">Записать</button>
                </form>
              </div>

              {/* СПИСОК УРОКОВ */}
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
                            <button onClick={() => setFilterSubject(r.subject)} className="font-black text-xl uppercase tracking-tight hover:text-indigo-400 transition block text-left">{r.subject}</button>
                            <div className="bg-slate-700/50 text-[10px] px-3 py-1 rounded-full font-bold text-slate-400 border border-slate-600/50 mt-1 inline-block">📅 {new Date(r.date).toLocaleDateString('ru-RU')}</div>
                          </div>
                        </div>
                        <button onClick={() => deleteRecord(r._id)} className="w-10 h-10 flex items-center justify-center rounded-full bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white">✕</button>
                      </div>
                  ))}
                  {records.filter(r => r.group === activeGroup && (filterSubject ? r.subject === filterSubject : r.date === selectedDate)).length === 0 && (
                    <div className="text-center py-20 border-4 border-dashed border-slate-800 rounded-[3rem] opacity-10 font-black uppercase tracking-[0.3em]">Пусто</div>
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