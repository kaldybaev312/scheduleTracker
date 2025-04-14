// LessonScheduleCalendar.jsx — календарь + статистика + экспорт
import { useState, useEffect, useMemo } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
} from "date-fns";
import ru from "date-fns/locale/ru";
import { initializeApp } from "firebase/app";
import { motion } from "framer-motion";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import * as XLSX from "xlsx";

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

/* ------------------------------ Consts/Lists ----------------------------- */
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
const brand = { primary: "#22c55e", bg: "#18181b", card: "#27272a" };

export default function LessonScheduleCalendar() {
  /* --------------------------------- State --------------------------------- */
  const [entries, setEntries] = useState([]);
  const [filterClass, setFilterClass] = useState(classesList[0]);
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState(null);
  const [lessonNumber, setLessonNumber] = useState(1);
  const [subject, setSubject] = useState("");
  const [editEntry, setEditEntry] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [results, setResults] = useState([]);

  /* ----------------------------- Firestore live ---------------------------- */
  useEffect(() => {
    const q = query(
      collection(db, "entries"),
      where("classId", "==", filterClass)
    );
    return onSnapshot(q, (snap) =>
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [filterClass]);

  /* ----------------------------- Calendar grid ----------------------------- */
  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days = [];
    for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
    return days;
  }, [currentMonth]);

  /* ----------------------------- Helpers ---------------------------------- */
  const isoDate = (d) => format(d, "yyyy-MM-dd");
  const formatDate = (iso) => format(parseISO(iso), "dd.MM.yyyy");
  const dayEntries = (date) =>
    entries.filter((e) => isSameDay(parseISO(e.date), date));

  /* --------------------------------- CRUD ---------------------------------- */
  const saveLesson = async () => {
    if (!selectedDate || !subject) return;
    setErrorMsg("");
    const iso = isoDate(selectedDate);
    const payload = {
      date: iso,
      lessonNumber: Number(lessonNumber),
      subject,
      classId: filterClass,
    };
    if (
      !editEntry &&
      entries.some(
        (e) => e.date === iso && e.lessonNumber === payload.lessonNumber
      )
    ) {
      setErrorMsg("Эта ячейка уже занята");
      return;
    }
    try {
      if (editEntry) await updateDoc(doc(db, "entries", editEntry.id), payload);
      else await addDoc(collection(db, "entries"), payload);
      cancelEdit();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };
  const startEdit = (e) => {
    setSelectedDate(parseISO(e.date));
    setLessonNumber(e.lessonNumber);
    setSubject(e.subject);
    setEditEntry(e);
    setErrorMsg("");
  };
  const cancelEdit = () => {
    setEditEntry(null);
    setSubject("");
    setLessonNumber(1);
  };
  const removeEntry = async (id) => {
    if (confirm("Удалить запись?")) await deleteDoc(doc(db, "entries", id));
  };

  /* ---------------------- Summary & export helpers ------------------------- */
  const summary = entries.reduce((a, e) => {
    a[e.subject] = (a[e.subject] || 0) + 2;
    return a;
  }, {});
  const chartData = Object.entries(summary).map(([s, h]) => ({
    subject: s,
    hours: h,
  }));

  const exportToExcel = () => {
    if (!entries.length) return;
    const grouped = entries.reduce((a, e) => {
      (a[e.subject] = a[e.subject] || []).push({
        Дата: formatDate(e.date),
        "№": e.lessonNumber,
      });
      return a;
    }, {});
    const wb = XLSX.utils.book_new();
    Object.entries(grouped).forEach(([n, r]) =>
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(r),
        n.substring(0, 31)
      )
    );
    XLSX.writeFile(wb, `Отчет_${filterClass}.xlsx`);
  };

  /* --------------------------------- Render -------------------------------- */
  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-8"
      style={{ background: brand.bg, color: "#f1f5f9", width:"100vw" }}
    >
      <div className="w-full max-w-6xl space-y-6">
        <motion.h1
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold text-center"
        >
          Календарь уроков — {filterClass}
        </motion.h1>

        {/* Класс */}
        <div className="flex gap-2 justify-center items-center">
          <span>Класс:</span>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="border rounded px-3 py-1 bg-white text-black"
          >
            {classesList.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Навигация месяца */}
        <div className="flex justify-between items-center">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            ←
          </button>
          <h2 className="text-xl font-semibold">
            {format(currentMonth, "LLLL yyyy", { locale: ru })}
          </h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            →
          </button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-700 rounded overflow-hidden text-sm select-none">
          {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((d) => (
            <div key={d} className="bg-gray-800 p-2 text-center font-semibold">
              {d}
            </div>
          ))}
          {monthDays.map((day) => {
            const inMonth = isSameMonth(day, currentMonth);
            const list = dayEntries(day);
            return (
              <div
                key={day.toISOString()}
                onClick={() => {
                  setSelectedDate(day);
                  cancelEdit();
                }}
                className={`h-24 p-1 cursor-pointer ${
                  inMonth
                    ? "bg-gray-900 hover:bg-gray-800"
                    : "bg-gray-800 opacity-50"
                }`}
              >
                <div className="text-right text-xs">{format(day, "d")}</div>
                {list.slice(0, 2).map((e) => (
                  <div
                    key={e.id}
                    className="truncate text-xs"
                    style={{ color: brand.primary }}
                  >
                    {e.lessonNumber}. {e.subject}
                  </div>
                ))}
                {list.length > 2 && (
                  <div className="text-xs">+{list.length - 2}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Форма добавления / редактирования */}
        {selectedDate && (
          <div
            className="p-4 rounded-lg shadow"
            style={{ background: brand.card }}
          >
            <h3 className="text-lg font-semibold mb-2">
              {format(selectedDate, "dd LLLL yyyy", { locale: ru })}
            </h3>
            <div className="flex gap-2 mb-2">
              <input
                type="number"
                min={1}
                max={10}
                value={lessonNumber}
                onChange={(e) => setLessonNumber(e.target.value)}
                className="border rounded px-2 bg-white text-black w-20"
              />
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="border rounded px-2 bg-white text-black flex-1"
              >
                <option value="" disabled>
                  Предмет
                </option>
                {subjectsList.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={saveLesson}
                disabled={!subject}
                className="px-4 rounded text-white"
                style={{ background: brand.primary }}
              >
                {editEntry ? "Сохранить" : "Добавить"}
              </button>
              {editEntry && (
                <button onClick={cancelEdit} className="border rounded px-2">
                  Отмена
                </button>
              )}
            </div>
            {errorMsg && (
              <p className="text-red-400 text-sm mb-2">{errorMsg}</p>
            )}
            <ul className="space-y-1 max-h-40 overflow-y-auto">
              {dayEntries(selectedDate).map((e) => (
                <li
                  key={e.id}
                  className="border rounded p-1 flex justify-between items-center text-sm"
                >
                  <span>
                    {e.lessonNumber}. {e.subject}
                  </span>
                  <span className="flex gap-1">
                    <button
                      onClick={() => startEdit(e)}
                      className="text-blue-400"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => removeEntry(e.id)}
                      className="text-red-400"
                    >
                      🗑️
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Summary chart */}
        <div
          className="p-4 rounded-lg shadow"
          style={{ background: brand.card }}
        >
          <h2 className="text-xl font-semibold mb-4">Часы по предметам</h2>
          {!chartData.length ? (
            <p className="text-sm">Нет данных.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#52525b" />
                <XAxis
                  dataKey="subject"
                  tick={{ fill: "#e2e8f0", fontSize: 12 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fill: "#e2e8f0" }} />
                <Tooltip contentStyle={{ background: brand.card }} />
                <Bar dataKey="hours" fill={brand.primary} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Поиск по предмету */}
        <div
          className="p-4 rounded-lg shadow space-y-4"
          style={{ background: brand.card }}
        >
          <h2 className="text-xl font-semibold">Поиск уроков</h2>
          <select
            value={searchSubject}
            onChange={(e) => {
              const val = e.target.value;
              setSearchSubject(val);
              setResults(entries.filter((el) => el.subject === val));
            }}
            className="border rounded px-2 bg-white text-black w-full md:w-60"
          >
            <option value="" disabled>
              Предмет
            </option>
            {subjectsList.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          {searchSubject &&
            (results.length ? (
              <div>
                <p>
                  Уроков: <strong>{results.length}</strong> / Часов:{" "}
                  <strong>{results.length * 2}</strong>
                </p>
                <ul className="space-y-1 mt-2">
                  {results.map((r) => (
                    <li key={r.id} className="border rounded p-2 text-sm">
                      {formatDate(r.date)} — {r.lessonNumber}-й
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm">Уроки не найдены.</p>
            ))}
        </div>

        {/* Export */}
        <div
          className="p-4 rounded-lg shadow text-center"
          style={{ background: brand.card }}
        >
          <button
            onClick={exportToExcel}
            disabled={!entries.length}
            className="px-6 py-2 rounded text-white disabled:opacity-50"
            style={{ background: brand.primary }}
          >
            Скачать Excel
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------
Зависимости:
  npm i date-fns recharts xlsx framer-motion firebase react
-------------------------------------------------------------------------- */
