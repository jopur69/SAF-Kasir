import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Trash2, 
  Calendar, 
  Filter, 
  Tag, 
  FileText, 
  Check, 
  X, 
  AlertTriangle, 
  ArrowDownCircle, 
  TrendingDown, 
  Search, 
  Info, 
  CalendarDays,
  Coins
} from 'lucide-react';
import { Expense, EXPENSE_CATEGORIES } from '../types';
import { formatRupiah } from '../utils/format';

interface ExpenseViewProps {
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onDeleteExpense: (expenseId: string) => void;
}

export default function ExpenseView({
  expenses,
  onAddExpense,
  onDeleteExpense
}: ExpenseViewProps) {
  // Modal controllers
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteConf, setDeleteConf] = useState<string | null>(null);

  // Form states for new expense
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amountStr, setAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');

  // Filtering states
  const [searchNotes, setSearchNotes] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('Semua');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'this_month'>('this_month');

  // Statistics calculations
  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    let totalAll = 0;
    let totalToday = 0;
    let totalMonth = 0;
    let categoryTotals: Record<string, number> = {};
    let maxExpenseAmount = 0;
    let maxExpenseName = 'Tidak ada';

    expenses.forEach(exp => {
      const amt = exp.amount;
      totalAll += amt;

      const expDate = new Date(exp.date);
      if (expDate.toDateString() === today) {
        totalToday += amt;
      }

      if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
        totalMonth += amt;
      }

      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + amt;

      if (amt > maxExpenseAmount) {
        maxExpenseAmount = amt;
        maxExpenseName = `${exp.category} (${exp.notes || 'Tanpa catatan'})`;
      }
    });

    // Find dominant category
    let dominantCategory = 'Tidak ada';
    let dominantMax = 0;
    Object.entries(categoryTotals).forEach(([cat, val]) => {
      if (val > dominantMax) {
        dominantMax = val;
        dominantCategory = cat;
      }
    });

    return {
      totalAll,
      totalToday,
      totalMonth,
      maxExpenseAmount,
      maxExpenseName,
      dominantCategory,
      dominantMax
    };
  }, [expenses]);

  // Handle addition
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const parsedAmount = parseFloat(amountStr.replace(/[^0-9]/g, ''));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFormError('Harap masukkan nominal rupiah pengeluaran yang valid (> 0).');
      return;
    }

    if (!category) {
      setFormError('Harap pilih kategori pengeluaran.');
      return;
    }

    const newExpense: Expense = {
      id: `exp-${Date.now()}`,
      date: date || new Date().toISOString().substring(0, 10),
      category,
      amount: parsedAmount,
      notes: notes.trim()
    };

    onAddExpense(newExpense);

    // Reset fields
    setAmountStr('');
    setNotes('');
    setCategory(EXPENSE_CATEGORIES[0]);
    setDate(new Date().toISOString().substring(0, 10));
    setShowAddModal(false);
  };

  // Filter and Search Pipeline
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      // Category check
      if (selectedCategoryFilter !== 'Semua' && exp.category !== selectedCategoryFilter) {
        return false;
      }

      // Search check
      if (searchNotes.trim()) {
        const query = searchNotes.toLowerCase();
        const matchesNotes = exp.notes.toLowerCase().includes(query);
        const matchesCat = exp.category.toLowerCase().includes(query);
        if (!matchesNotes && !matchesCat) return false;
      }

      // Time range check
      const expDate = new Date(exp.date);
      const today = new Date();
      if (timeFilter === 'today') {
        return expDate.toDateString() === today.toDateString();
      } else if (timeFilter === 'this_month') {
        return expDate.getMonth() === today.getMonth() && expDate.getFullYear() === today.getFullYear();
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // newest first
  }, [expenses, selectedCategoryFilter, searchNotes, timeFilter]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/50 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <ArrowDownCircle className="w-6 h-6 shrink-0" />
          </div>
          <div>
            <h2 className="font-display font-black text-slate-800 text-base sm:text-lg tracking-tight leading-none">
              Catatan Pengeluaran Kasir
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1.5">
              Catat pengeluaran kas operasional seperti bayar listrik, gaji karyawan, sewa, bensin, dan lainnya untuk menghitung laba bersih yang sesungguhnya.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setFormError('');
            setShowAddModal(true);
          }}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-emerald-100 hover:bg-emerald-200 active:scale-95 text-emerald-950 font-extrabold text-xs rounded-2xl transition-all cursor-pointer shadow-md shadow-emerald-100/50"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Pengeluaran</span>
        </button>
      </div>

      {/* Mini Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Month */}
        <div className="bg-white border border-slate-200/50 p-5 rounded-3xl shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
            Total Pengeluaran Bulan Ini
          </span>
          <span className="font-display font-black text-xl sm:text-2xl text-rose-600 block mt-1.5">
            {formatRupiah(stats.totalMonth)}
          </span>
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-500">
            <CalendarDays className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Riwayat periode: {new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })}</span>
          </div>
        </div>

        {/* Total Today */}
        <div className="bg-white border border-slate-200/50 p-5 rounded-3xl shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
            Pengeluaran Hari Ini
          </span>
          <span className="font-display font-black text-xl sm:text-2xl text-slate-700 block mt-1.5">
            {formatRupiah(stats.totalToday)}
          </span>
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-500">
            <Coins className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>Outflow harian tercatat</span>
          </div>
        </div>

        {/* Dominant Category */}
        <div className="bg-white border border-slate-200/50 p-5 rounded-3xl shadow-xs">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block font-sans">
            Alokasi Dominan
          </span>
          <span className="font-display font-bold text-sm text-slate-800 block mt-2 truncate" title={stats.dominantCategory}>
            {stats.dominantCategory}
          </span>
          <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-indigo-600 font-extrabold">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Akumulasi: {formatRupiah(stats.dominantMax)}</span>
          </div>
        </div>
      </div>

      {/* Filter and Table Card */}
      <div className="bg-white border border-slate-200/50 rounded-3xl overflow-hidden shadow-xs">
        
        {/* Filters Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Time filters */}
            <button
              onClick={() => setTimeFilter('this_month')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'this_month'
                  ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              Bulan Ini
            </button>
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'today'
                  ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              Hari Ini
            </button>
            <button
              onClick={() => setTimeFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                timeFilter === 'all'
                  ? 'bg-emerald-400 text-emerald-950 shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
              }`}
            >
              Semua Periode
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {/* Category Search Filter */}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Filter className="w-3.5 h-3.5" />
              </span>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="bg-white border border-slate-200/80 rounded-xl py-1.5 pl-8 pr-7 text-xs font-semibold text-slate-700 outline-none hover:bg-slate-50 cursor-pointer appearance-none"
              >
                <option value="Semua">Semua Kategori</option>
                {EXPENSE_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>

            {/* Keyword Search */}
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchNotes}
                onChange={(e) => setSearchNotes(e.target.value)}
                placeholder="Cari catatan..."
                className="bg-white border border-slate-200/80 rounded-xl py-1.5 pl-9 pr-3 text-xs font-semibold text-slate-800 outline-none w-full sm:w-48 focus:border-indigo-500 placeholder:font-normal"
              />
            </div>
          </div>
        </div>

        {/* List Table */}
        <div className="overflow-x-auto">
          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center">
              <div className="p-3 bg-slate-50 rounded-full inline-block text-slate-400 mb-2">
                <TrendingDown className="w-6 h-6 text-slate-350" />
              </div>
              <h4 className="text-xs font-bold text-slate-700">Tidak ada pengeluaran</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                {searchNotes || selectedCategoryFilter !== 'Semua' 
                  ? 'Tidak ada pengeluaran yang sesuai dengan kriteria pencarian dan filter Anda.'
                  : 'Belum ada pengeluaran tercatat untuk kas operasional kasir Anda.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-450">
                  <th className="py-3 px-5">Tanggal</th>
                  <th className="py-3 px-5">Kategori</th>
                  <th className="py-3 px-5">Catatan Pendukung</th>
                  <th className="py-3 px-5 text-right">Nominal</th>
                  <th className="py-3 px-5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-650">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/55 transition-colors">
                    <td className="py-3.5 px-5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(exp.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100/40">
                        <Tag className="w-2.5 h-2.5 text-rose-500" />
                        {exp.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 break-words max-w-xs text-slate-600 font-semibold">
                      {exp.notes || <span className="text-slate-400 font-normal italic">-</span>}
                    </td>
                    <td className="py-3.5 px-5 text-right font-bold text-slate-800 whitespace-nowrap text-xs">
                      {formatRupiah(exp.amount)}
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <button
                        onClick={() => setDeleteConf(exp.id)}
                        className="p-1 px-2.5 border border-slate-200 hover:border-rose-200 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer active:scale-95"
                        title="Hapus Catatan Pengeluaran"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer info counts */}
        <div className="bg-slate-50 bg-opacity-70 border-t border-slate-100 px-5 py-3 flex justify-between items-center text-[11px] text-slate-500 font-semibold">
          <span>Menampilkan {filteredExpenses.length} transaksi pengeluaran</span>
          <span className="text-slate-700">
            Kategori Terpilih: <strong className="text-indigo-650">{selectedCategoryFilter}</strong>
          </span>
        </div>
      </div>

      {/* POPUP MODAL: DATA PENGELUARAN (TAMBAH PENGELUARAN) (mt-24 sm:mt-32 mb-12 based on user request) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center z-50 p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="mt-24 sm:mt-32 mb-12 bg-white rounded-3xl border border-slate-100 w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="p-3.5 px-4 border-b border-slate-150/60 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <h3 className="font-display font-bold text-slate-800 text-xs sm:text-[13px] uppercase tracking-wider">
                  Catat Pengeluaran Baru
                </h3>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg hover:bg-slate-150/60 text-slate-400 hover:text-slate-650 shrink-0 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Form Fields body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 font-sans text-xs">
              
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-slate-700 font-bold leading-normal flex items-start gap-1.5 animate-pulse shrink-0 text-[11px]">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Date Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Tanggal Pengeluaran</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 pl-10 pr-3 font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Category selector */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Kategori Pengeluaran</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Tag className="w-4 h-4" />
                  </span>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2.5 pl-10 pr-10 font-bold text-slate-800 outline-none cursor-pointer appearance-none"
                  >
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-450">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              {/* Amount input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Nominal Rupiah (Rp)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-rose-600 font-extrabold select-none">Rp</span>
                  <input
                    type="text"
                    required
                    value={amountStr}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, '');
                      setAmountStr(digits ? Number(digits).toLocaleString('id-ID') : '');
                    }}
                    placeholder="Contoh: 15.000"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 pl-9 pr-3 font-bold text-slate-850 outline-none text-sm placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Notes Input */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Catatan Tambahan (Keterangan)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-slate-400">
                    <FileText className="w-4 h-4" />
                  </span>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Contoh: Bayar air iuran PDAM bulan Juni"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl py-2 pl-10 pr-3 font-semibold text-slate-800 outline-none resize-none placeholder:font-normal"
                  />
                </div>
              </div>

              {/* Action Buttons footer inside modal */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-100 mt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-500 hover:bg-slate-50 rounded-xl font-bold transition-all cursor-pointer active:scale-95"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-extrabold rounded-xl transition-all cursor-pointer shadow-md shadow-emerald-100/50 flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Catatan</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL (mt-24 sm:mt-32 mb-12 based on user request) */}
      {deleteConf && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setDeleteConf(null)}
          />
          <div className="mt-24 sm:mt-32 mb-12 relative bg-white w-full max-w-sm rounded-2xl shadow-xl border border-slate-100 p-6 flex flex-col items-center text-center z-10 max-h-[85vh] sm:max-h-[80vh] overflow-y-auto font-sans">
            <div className="p-3 bg-rose-50 rounded-full text-rose-600 mb-3 text-sm shrink-0">
              <AlertTriangle className="w-8 h-8 text-rose-550 animate-bounce" />
            </div>
            <h3 className="font-display font-bold text-slate-800 text-sm">Hapus Pengeluaran?</h3>
            <p className="text-[11px] text-slate-500 font-semibold leading-relaxed mt-2">
              Apakah Anda yakin ingin menghapus catatan pengeluaran ini dari database lokal? Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex gap-2.5 w-full mt-5 shrink-0">
              <button
                onClick={() => setDeleteConf(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-150 focus:bg-slate-150 rounded-xl text-xs font-bold text-slate-600 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  onDeleteExpense(deleteConf);
                  setDeleteConf(null);
                }}
                className="flex-1 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 rounded-xl text-xs font-extrabold transition-all cursor-pointer shadow-sm shadow-emerald-100/50"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
